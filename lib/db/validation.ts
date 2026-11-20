import { z } from 'zod';

const uuid = z.string().uuid();

export function isValidDatabaseId(value: unknown): value is string {
  return uuid.safeParse(value).success;
}
