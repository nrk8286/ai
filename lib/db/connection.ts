import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

export function getDatabaseUrl({ migration = false } = {}) {
  const url =
    (migration &&
      (process.env.DATABASE_URL_UNPOOLED ||
        process.env.POSTGRES_URL_NON_POOLING)) ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!url) {
    throw new Error(
      'Set DATABASE_URL or POSTGRES_URL to a PostgreSQL connection URL.',
    );
  }

  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    throw new Error('The database connection URL is invalid.');
  }
  if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
    throw new Error(
      'This application requires PostgreSQL; SQLite and libSQL URLs are not supported.',
    );
  }
  return url;
}

export function createDatabaseClient(url = getDatabaseUrl()) {
  return postgres(url, {
    // Each function instance has a small pool; Neon handles pooling upstream.
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    // Works with pooled connections and transaction-mode poolers.
    prepare: false,
  });
}

let client: ReturnType<typeof createDatabaseClient> | undefined;
let database: ReturnType<typeof drizzle> | undefined;

export function getDb() {
  // Next.js evaluates route modules during builds. Connect only on first use.
  if (!database) {
    client = createDatabaseClient();
    database = drizzle(client);
  }
  return database;
}

export async function closeDb() {
  await client?.end({ timeout: 5 });
  database = undefined;
  client = undefined;
}
