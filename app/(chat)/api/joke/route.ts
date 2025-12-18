import { auth } from '@/app/(auth)/auth';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import {
  FALLBACK_JOKES,
  getJokeCache,
  isCacheValid,
  mapCategoryToApiCategory,
  setJokeCache,
} from '@/lib/utils/joke-utils';

// Rate limiting configuration
let ratelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
  });
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Apply rate limiting if configured
  if (ratelimit) {
    const identifier = session.user.id;
    const { success, limit, reset, remaining } = await ratelimit.limit(identifier);

    if (!success) {
      return Response.json(
        {
          error: 'Rate limit exceeded',
          limit,
          reset,
          remaining,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          },
        },
      );
    }
  }

  const { searchParams } = request.nextUrl;
  const category = searchParams.get('category') || 'any';

  // Check cache first (category-specific)
  const cachedJoke = getJokeCache(category);
  if (cachedJoke && isCacheValid(category)) {
    return Response.json({
      joke: cachedJoke.joke,
      source: 'cache',
      category: cachedJoke.category,
    });
  }

  try {
    // Use JokeAPI - it's free and doesn't require authentication
    const categoryParam = mapCategoryToApiCategory(category);
    const response = await fetch(
      `https://v2.jokeapi.dev/joke/${categoryParam}?blacklistFlags=nsfw,religious,political,racist,sexist,explicit&type=single`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.message || 'API returned an error');
    }

    const joke = data.joke || `${data.setup} ${data.delivery}`;

    // Update cache (category-specific)
    setJokeCache(category, {
      joke,
      timestamp: Date.now(),
      category: data.category,
    });

    return Response.json({
      joke,
      source: 'api',
      category: data.category,
    });
  } catch (error) {
    // Fallback to local jokes if API fails
    const randomJoke = FALLBACK_JOKES[Math.floor(Math.random() * FALLBACK_JOKES.length)];

    return Response.json({
      joke: randomJoke,
      source: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
