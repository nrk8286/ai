import { auth } from '@/app/(auth)/auth';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// In-memory cache to avoid excessive API calls
interface JokeCache {
  joke: string;
  timestamp: number;
  category?: string;
}

let jokeCache: JokeCache | null = null;
const CACHE_DURATION = 60000; // 1 minute cache

// Fallback jokes in case API is down
const fallbackJokes = [
  "Why don't scientists trust atoms? Because they make up everything!",
  "Why did the scarecrow win an award? Because he was outstanding in his field!",
  "What do you call a fake noodle? An impasta!",
  "Why don't eggs tell jokes? They'd crack each other up!",
  "What did the ocean say to the beach? Nothing, it just waved!",
  "Why did the bicycle fall over? Because it was two-tired!",
  "What do you call cheese that isn't yours? Nacho cheese!",
  "Why did the math book look so sad? Because it had too many problems!",
];

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

  // Check cache first
  if (jokeCache && Date.now() - jokeCache.timestamp < CACHE_DURATION) {
    return Response.json({
      joke: jokeCache.joke,
      source: 'cache',
      category: jokeCache.category,
    });
  }

  try {
    // Use JokeAPI - it's free and doesn't require authentication
    const categoryParam =
      category === 'programming' ? 'Programming' : category === 'misc' ? 'Miscellaneous' : 'Any';
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

    // Update cache
    jokeCache = {
      joke,
      timestamp: Date.now(),
      category: data.category,
    };

    return Response.json({
      joke,
      source: 'api',
      category: data.category,
    });
  } catch (error) {
    // Fallback to local jokes if API fails
    const randomJoke = fallbackJokes[Math.floor(Math.random() * fallbackJokes.length)];

    return Response.json({
      joke: randomJoke,
      source: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
