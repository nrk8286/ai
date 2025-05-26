import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';

config({
  path: '.env.local',
});

const runMigrate = async () => {
  if (!process.env.DATABASE_URL) {
    console.error(
      '❌ DATABASE_URL environment variable is not defined. Please set it in your environment variables.',
    );
    process.exit(1);
  }

  const sqlite = new Database(process.env.DATABASE_URL);
  const db = drizzle(sqlite);

  console.log('⏳ Running migrations...');

  const start = Date.now();
  await migrate(db, { migrationsFolder: './lib/db/migrations' });
  const end = Date.now();

  console.log('✅ Migrations completed in', end - start, 'ms');
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error('❌ Migration failed');
  console.error(err);
  process.exit(1);
});
