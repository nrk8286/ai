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
  const { pathname } = request.nextUrl;
  
  // Skip rate limiting for health checks and static assets
  if (pathname === '/api/health' || pathname.startsWith('/_next/')) {
    return NextResponse.next();
  }

  // Add security headers to all responses
  const response = NextResponse.next();
  
  // Rate limiting
  if (ratelimit) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';
      
    try {
      const { success, reset, remaining } = await ratelimit.limit(ip);

      if (!success) {
        return NextResponse.json(
          { 
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: reset 
          },
          { 
            status: 429, 
            headers: { 
              'Retry-After': reset.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString()
            } 
          },
        );
      }

      // Add rate limit headers to successful responses
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      response.headers.set('X-RateLimit-Reset', reset.toString());
    } catch (err) {
      console.error('Rate limiting failed:', err);
      // Continue without rate limiting if Redis fails
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn(
      'Upstash Redis is not configured. Rate limiting is disabled in production.',
    );
  }

  return response;
}

export default auth;

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
