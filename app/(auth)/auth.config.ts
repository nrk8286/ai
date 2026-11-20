import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
    newUser: '/',
  },
  providers: [
    // added later in auth.ts since it requires bcrypt which is only compatible with Node.js
    // while this file is also used in non-Node.js environments
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnRegister = nextUrl.pathname === '/register';
      const isOnLogin = nextUrl.pathname === '/login';

      // Auth.js must be able to serve sessions, CSRF tokens and callbacks
      // before there is an authenticated session.
      if (
        nextUrl.pathname === '/api/auth' ||
        nextUrl.pathname.startsWith('/api/auth/')
      ) {
        return true;
      }

      if (isLoggedIn && (isOnLogin || isOnRegister)) {
        return Response.redirect(new URL('/', nextUrl as unknown as URL));
      }

      if (isOnRegister || isOnLogin) {
        return true; // Always allow access to register and login pages
      }

      if (!isLoggedIn && nextUrl.pathname.startsWith('/api/')) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // The custom rate-limit middleware runs even when authorized returns
      // false. Return an explicit response so anonymous page access is denied.
      if (!isLoggedIn) {
        return Response.redirect(new URL('/login', nextUrl as unknown as URL));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
