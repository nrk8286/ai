import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis/cloudflare';
import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { authConfig } from '@/app/(auth)/auth.config';
import { isTestEnvironment } from '@/lib/constants';

const redisReady =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisReady
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL ?? '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN ?? '',
    })
  : undefined;

const ratelimit = redis && !isTestEnvironment
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '10 s'),
    })
  : undefined;

const { auth } = NextAuth(authConfig);

async function enforceRateLimit(request: NextRequest) {
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
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((reset - Date.now()) / 1000),
    );

    return success
      ? NextResponse.next()
      : NextResponse.json(
          { error: 'Too many requests' },
          {
            status: 429,
            headers: { 'Retry-After': retryAfterSeconds.toString() },
          },
        );
  } catch (err) {
    console.error('Rate limiting failed:', err);
    return NextResponse.next();
  }
}

export default auth((request) => enforceRateLimit(request));

export const config = {
  matcher: ['/', '/:id', '/api/:path*', '/login', '/register'],
};
