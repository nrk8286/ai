import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { createDatabaseClient, getDatabaseUrl } from './connection';
import * as schema from './schema';

config({ path: '.env.local' });

async function verify() {
  const client = createDatabaseClient(getDatabaseUrl({ migration: true }));
  try {
    const result = await drizzle(client).transaction(
      async (db) => {
        await db.execute(sql`SET LOCAL statement_timeout = '10s'`);
        const columns = await db.execute<{
          table_name: string;
          column_name: string;
          udt_name: string;
          is_nullable: string;
          character_maximum_length: number | null;
        }>(sql`
        SELECT table_name, column_name, udt_name, is_nullable, character_maximum_length
        FROM information_schema.columns WHERE table_schema = 'public'
      `);
        for (const table of Object.values(schema)) {
          const definition = getTableConfig(table);
          for (const column of definition.columns) {
            const actual = columns.find(
              (item) =>
                item.table_name === definition.name &&
                item.column_name === column.name,
            );
            const type = column
              .getSQLType()
              .replace(/\(.*\)/, '')
              .replace('boolean', 'bool');
            if (
              !actual ||
              actual.udt_name !== type ||
              (column.notNull && actual.is_nullable !== 'NO')
            ) {
              throw new Error(
                `Schema mismatch: ${definition.name}.${column.name}`,
              );
            }
          }
          // Exercise the real Drizzle select mapping without reading user records.
          await db.select().from(table).limit(0);
        }
        const applied = await db.execute<{
          hash: string;
          created_at: string;
        }>(sql`
        SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at
      `);
        const migrations = readMigrationFiles({
          migrationsFolder: './lib/db/migrations',
        });
        if (
          applied.length !== migrations.length ||
          applied.some(
            (row, i) =>
              row.hash !== migrations[i].hash ||
              Number(row.created_at) !== migrations[i].folderMillis,
          )
        ) {
          throw new Error(
            'Migration history differs from this checkout. Review it before migrating.',
          );
        }
        return {
          tablesVerified: Object.keys(schema).length,
          migrationsVerified: applied.length,
        };
      },
      { accessMode: 'read only' },
    );
    console.log(
      'PostgreSQL schema and migration history verified (read only).',
      result,
    );
  } finally {
    await client.end({ timeout: 5 });
  }
}

verify().catch((error: unknown) => {
  // Do not log connection strings, query parameters, or driver error objects.
  const message =
    error instanceof Error &&
    /^(Schema mismatch:|Migration history differs|Set DATABASE_URL|This application requires)/.test(
      error.message,
    )
      ? error.message
      : 'Database verification failed. Check connectivity, credentials, and schema.';
  console.error(message);
  process.exitCode = 1;
});
