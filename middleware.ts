import { authConfig } from '@/app/(auth)/auth.config';
import { auth } from '@/app/(auth)/auth';

export default auth;

export const config = {
  matcher: ['/', '/:id', '/api/:path*', '/login', '/register'],
};
