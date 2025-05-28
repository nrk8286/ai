import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({
  path: '.env.local',
});

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  driver: 'turso', // Use turso driver for Edge Runtime compatibility
  dbCredentials: {
    url: process.env.DATABASE_URL,
    // Only include auth token if in production or explicitly provided
    ...(process.env.NODE_ENV === 'production' || process.env.DATABASE_AUTH_TOKEN
      ? { authToken: process.env.DATABASE_AUTH_TOKEN }
      : {}),
  },
});
