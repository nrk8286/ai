import { config } from 'dotenv';

config({
  path: '.env.local',
});

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || './db.sqlite',
  },
};
