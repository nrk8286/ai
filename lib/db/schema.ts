import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export type Tables = {
  users: typeof user;
  chats: typeof chat;
  messages: typeof message;
  messageDeprecated: typeof messageDeprecated;
  votes: typeof vote;
  documents: typeof document;
  suggestions: typeof suggestion;
};

export const user = sqliteTable('User', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  password: text('password'),
});

export type User = typeof user.$inferSelect;

export const chat = sqliteTable('Chat', {
  id: text('id').primaryKey(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  title: text('title').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  visibility: text('visibility').notNull().default('private'),
});

export type Chat = typeof chat.$inferSelect;

export const messageDeprecated = sqliteTable('Message', {
  id: text('id').primaryKey(),
  chatId: text('chatId')
    .notNull()
    .references(() => chat.id),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export type MessageDeprecated = typeof messageDeprecated.$inferSelect;

export const message = sqliteTable('Message_v2', {
  id: text('id').primaryKey(),
  chatId: text('chatId')
    .notNull()
    .references(() => chat.id),
  role: text('role').notNull(),
  parts: text('parts').notNull(),
  attachments: text('attachments').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export type DBMessage = typeof message.$inferSelect;

export const vote = sqliteTable('Vote_v2', {
  chatId: text('chatId')
    .notNull()
    .references(() => chat.id),
  messageId: text('messageId')
    .notNull()
    .references(() => message.id),
  isUpvoted: integer('isUpvoted').notNull(),
});

export type Vote = typeof vote.$inferSelect;

export const document = sqliteTable('Document', {
  id: text('id').primaryKey(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  title: text('title').notNull(),
  content: text('content'),
  kind: text('kind').notNull().default('text'),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
});

export type Document = typeof document.$inferSelect;

export const suggestion = sqliteTable('Suggestion', {
  id: text('id').primaryKey(),
  documentId: text('documentId')
    .notNull()
    .references(() => document.id),
  documentCreatedAt: integer('documentCreatedAt', {
    mode: 'timestamp',
  }).notNull(),
  originalText: text('originalText').notNull(),
  suggestedText: text('suggestedText').notNull(),
  description: text('description'),
  isResolved: integer('isResolved').notNull().default(0),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export type Suggestion = typeof suggestion.$inferSelect;
