import { auth } from '@/app/(auth)/auth';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '10 s'),
});

export async function middleware(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';
  const { success, pending, limit, reset, remaining } =
    await ratelimit.limit(ip);

  return success
    ? NextResponse.next()
    : NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': reset.toString() } },
      );
}

export default auth;

export const config = {
  matcher: ['/', '/:id', '/api/:path*', '/login', '/register'],
};
