import 'server-only';
import { genSaltSync, hashSync } from 'bcrypt-ts';
import { and, asc, desc, eq, gt, gte, inArray, lt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

import {
  user,
  chat,
  type User,
  document,
  type Suggestion,
  suggestion,
  message,
  vote,
  type DBMessage,
  Chat,
} from './schema';
import type { ArtifactKind } from '@/components/artifact';

// Ensure DATABASE_URL is always provided
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

// Create libSQL client with required configuration for Edge Runtime
const client = createClient({
  url: process.env.DATABASE_URL as string,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// Create a new Drizzle instance using the libSQL client
const db = drizzle(client);

// Function to generate unique IDs that works in Edge Runtime
const generateId = () => {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db
      .select({
        id: user.id,
        email: user.email,
        password: user.password,
      })
      .from(user)
      .where(eq(user.email, email));
  } catch (error) {
    console.error('Failed to get user from database');
    throw error;
  }
}

// ... rest of the file unchanged ...
