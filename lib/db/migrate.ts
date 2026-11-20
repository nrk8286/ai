import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { getDatabaseUrl } from './connection';

config({ path: '.env.local' });

async function runMigrate() {
  const client = postgres(getDatabaseUrl({ migration: true }), {
    max: 1,
    prepare: false,
    connect_timeout: 10,
  });
  try {
    console.log('Running PostgreSQL migrations...');
    await migrate(drizzle(client), { migrationsFolder: './lib/db/migrations' });
    console.log('PostgreSQL migrations completed.');
  } finally {
    await client.end({ timeout: 5 });
  }
}

runMigrate().catch(() => {
  console.error(
    'PostgreSQL migration failed. Check the connection and migration history before retrying.',
  );
  process.exitCode = 1;
});
