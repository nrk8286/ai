import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { compare } from 'bcrypt-ts';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { closeDb, getDb } from '../../lib/db/connection';
import {
  createUser,
  getUser,
  saveChat,
  getChatById,
  deleteChatById,
  saveMessages,
  getMessagesByChatId,
  voteMessage,
  getVotesByChatId,
  saveDocument,
  getDocumentsById,
  saveSuggestions,
  getSuggestionsByDocumentId,
  deleteDocumentsByIdAfterTimestamp,
} from '../../lib/db/queries';
import {
  document,
  messageDeprecated,
  suggestion,
  user,
  voteDeprecated,
} from '../../lib/db/schema';

// Never fall back to the app's hosted connection when running destructive fixtures.
const testUrl = process.env.TEST_DATABASE_URL;
if (
  !testUrl ||
  !['localhost', '127.0.0.1', '[::1]'].includes(new URL(testUrl).hostname)
) {
  throw new Error(
    'TEST_DATABASE_URL must point to a disposable local PostgreSQL database.',
  );
}
process.env.DATABASE_URL = testUrl;

test('PostgreSQL persistence matches the existing hosted schema', async (t) => {
  const db = getDb();
  const email = `${randomUUID()}@example.test`;
  const password = 'Database integration password';
  const chatId = randomUUID();
  const messageId = randomUUID();
  const documentId = randomUUID();
  let userId: string | undefined;

  try {
    await t.test(
      'accounts, UUIDs, JSON messages, attachments and timestamps round-trip',
      async () => {
        await createUser(email, password);
        const [account] = await getUser(email);
        userId = account.id;
        assert.match(userId, /^[0-9a-f-]{36}$/);
        assert.equal(await compare(password, account.password ?? ''), true);
        await saveChat({ id: chatId, userId, title: 'PostgreSQL integration' });
        const createdAt = new Date('2026-01-02T03:04:05.678Z');
        const parts = [{ type: 'text' as const, text: 'Saved message' }];
        const attachments = [
          {
            name: 'example.png',
            contentType: 'image/png',
            url: 'https://example.test/example.png',
          },
        ];
        await saveMessages({
          messages: [
            {
              id: messageId,
              chatId,
              role: 'assistant',
              parts,
              attachments,
              createdAt,
            },
          ],
        });
        const [saved] = await getMessagesByChatId({ id: chatId });
        assert.deepEqual(saved.parts, parts);
        assert.deepEqual(saved.attachments, attachments);
        assert.equal(saved.createdAt.toISOString(), createdAt.toISOString());
        assert.equal((await getChatById({ id: chatId })).userId, userId);
      },
    );

    await t.test(
      'concurrent votes use the existing compound primary key',
      async () => {
        await Promise.all([
          voteMessage({ chatId, messageId, type: 'up' }),
          voteMessage({ chatId, messageId, type: 'up' }),
        ]);
        await voteMessage({ chatId, messageId, type: 'down' });
        const votes = await getVotesByChatId({ id: chatId });
        assert.equal(votes.length, 1);
        assert.equal(votes[0].isUpvoted, false);
      },
    );

    await t.test(
      'document versions and suggestions retain their composite relationship',
      async () => {
        assert.ok(userId);
        await saveDocument({
          id: documentId,
          userId,
          kind: 'text',
          title: 'Versioned document',
          content: 'First version',
        });
        const [first] = await getDocumentsById({ id: documentId });
        // Insert a later version deterministically; no timing-dependent sleeps.
        const later = new Date(first.createdAt.getTime() + 1000);
        await db
          .insert(document)
          .values({ ...first, createdAt: later, content: 'Second version' });
        await saveSuggestions({
          suggestions: [
            {
              id: randomUUID(),
              documentId,
              documentCreatedAt: later,
              userId,
              originalText: 'Second',
              suggestedText: 'Revised',
              description: null,
              isResolved: false,
              createdAt: later,
            },
          ],
        });
        assert.equal((await getDocumentsById({ id: documentId })).length, 2);
        assert.equal(
          (await getSuggestionsByDocumentId({ documentId }))[0].isResolved,
          false,
        );
        await deleteDocumentsByIdAfterTimestamp({
          id: documentId,
          timestamp: first.createdAt,
        });
        assert.equal((await getDocumentsById({ id: documentId })).length, 1);
        assert.equal(
          (await getSuggestionsByDocumentId({ documentId })).length,
          0,
        );
      },
    );

    await t.test(
      'replaying the restored migrations preserves existing records',
      async () => {
        await migrate(db, { migrationsFolder: './lib/db/migrations' });
        assert.equal((await getUser(email))[0].id, userId);
        assert.equal((await getMessagesByChatId({ id: chatId })).length, 1);
        assert.equal(
          (await getDocumentsById({ id: documentId }))[0].content,
          'First version',
        );
      },
    );

    await t.test(
      'chat deletion respects both legacy and current foreign keys',
      async () => {
        const legacyId = randomUUID();
        await db
          .insert(messageDeprecated)
          .values({
            id: legacyId,
            chatId,
            role: 'assistant',
            content: 'Legacy message',
            createdAt: new Date(),
          });
        await db
          .insert(voteDeprecated)
          .values({ chatId, messageId: legacyId, isUpvoted: true });
        await deleteChatById({ id: chatId });
        assert.equal(await getChatById({ id: chatId }), undefined);
        assert.deepEqual(await getMessagesByChatId({ id: chatId }), []);
        assert.deepEqual(await getVotesByChatId({ id: chatId }), []);
        assert.deepEqual(
          await db
            .select()
            .from(messageDeprecated)
            .where(eq(messageDeprecated.chatId, chatId)),
          [],
        );
      },
    );
  } finally {
    try {
      await deleteChatById({ id: chatId });
      await db.delete(suggestion).where(eq(suggestion.documentId, documentId));
      await db.delete(document).where(eq(document.id, documentId));
      if (userId) await db.delete(user).where(eq(user.id, userId));
    } finally {
      await closeDb();
    }
  }
});
