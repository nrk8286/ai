import { auth } from '@/app/(auth)/auth';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const redisReady =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisReady
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL ?? '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    })
  : undefined;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '10 s'),
    })
  : undefined;

export async function middleware(request: NextRequest) {
  if (!ratelimit) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        'Upstash Redis is not configured. Rate limiting is disabled.',
      );
    }
    return NextResponse.next();
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';
  try {
    const { success, reset } = await ratelimit.limit(ip);

    return success
      ? NextResponse.next()
      : NextResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: { 'Retry-After': reset.toString() } },
        );
  } catch (err) {
    console.error('Rate limiting failed:', err);
    return NextResponse.next();
  }
}

export default auth;

export const config = {
  matcher: ['/', '/:id', '/api/:path*', '/login', '/register'],
};
