import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({
  path: '.env.local',
});

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL || 'https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/3084dbc2-3ab4-455c-809f-23f7ece5d983', // Temporary solution
  },
});
