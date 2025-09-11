import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import {
  chat,
  message,
  messageDeprecated,
  vote,
  vote as voteDeprecated,
} from '../schema';
import { eq, inArray } from 'drizzle-orm';
import { appendResponseMessages } from 'ai';
import type { UIMessage } from 'ai';

config({
  path: '.env.local',
});

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

if (!process.env.DATABASE_AUTH_TOKEN) {
  throw new Error('DATABASE_AUTH_TOKEN environment variable is not set');
}

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const db = drizzle(client);

const BATCH_SIZE = 50; // Process 50 chats at a time
const INSERT_BATCH_SIZE = 100; // Insert 100 messages at a time

type NewMessageInsert = {
  id: string;
  chatId: string;
  parts: any[];
  role: string;
  attachments: any[];
  createdAt: Date;
};

type NewVoteInsert = {
  id: string;
  messageId: string;
  chatId: string;
  isUpvoted: boolean;
};

async function createNewTable() {
  const chats = await db.select().from(chat);
  let processedCount = 0;

  // Process chats in batches
  for (let i = 0; i < chats.length; i += BATCH_SIZE) {
    const chatBatch = chats.slice(i, i + BATCH_SIZE);
    const chatIds = chatBatch.map((chat) => chat.id);

    // Fetch all messages and votes for the current batch of chats in bulk
    const allMessages = await db
      .select()
      .from(messageDeprecated)
      .where(inArray(messageDeprecated.chatId, chatIds));

    const allVotes = await db
      .select()
      .from(voteDeprecated)
      .where(inArray(voteDeprecated.chatId, chatIds));

    // Prepare batches for insertion
    const newMessagesToInsert: NewMessageInsert[] = [];
    const newVotesToInsert: NewVoteInsert[] = [];

    // Process each chat in the batch
    for (const chat of chatBatch) {
      processedCount++;
      console.info(`Processed ${processedCount}/${chats.length} chats`);

      // Filter messages and votes for this specific chat
      const messages = allMessages.filter((msg) => msg.chatId === chat.id);
      const votes = allVotes.filter((v) => v.chatId === chat.id);

      // Group messages into sections
      const messageSection: Array<UIMessage> = [];
      const messageSections: Array<Array<UIMessage>> = [];

      for (const message of messages) {
        const { role } = message;

        if (role === 'user' && messageSection.length > 0) {
          messageSections.push([...messageSection]);
          messageSection.length = 0;
        }

        messageSection.push({
          id: message.id,
          role: message.role as 'user' | 'assistant' | 'system' | 'data',
          content: message.content.toString(),
          parts: [{ type: 'text', text: message.content.toString() }],
          createdAt: message.createdAt,
        });
      }

      if (messageSection.length > 0) {
        messageSections.push([...messageSection]);
      }

      // Process each message section
      for (const section of messageSections) {
        const [userMessage, ...assistantMessages] = section;
        const assistantOnlyMessages = assistantMessages
          .filter(msg => msg.role === 'assistant')
          .map(msg => ({ ...msg, role: 'assistant' as const }));
        const [firstAssistantMessage] = assistantOnlyMessages;

        try {
          const uiSection = appendResponseMessages({
            messages: [userMessage],
            responseMessages: assistantOnlyMessages as any, // Type assertion for compatibility
            _internal: {
              currentDate: () => firstAssistantMessage?.createdAt ?? new Date(),
            },
          });

          const projectedUISection = uiSection.map((message) => {
            if (message.role === 'user') {
              return {
                id: message.id,
                chatId: chat.id,
                parts: [{ type: 'text', text: message.content }],
                role: message.role,
                createdAt: message.createdAt,
                attachments: [],
              } as NewMessageInsert;
            } else {
              return {
                id: message.id,
                chatId: chat.id,
                parts: message.parts || [],
                role: message.role,
                createdAt: message.createdAt,
                attachments: (message as any).attachments || [],
              } as NewMessageInsert;
            }
          });

          newMessagesToInsert.push(...projectedUISection);

          // Add votes
          const existingVotesForMessage = votes.filter(
            (vote) => vote.messageId === firstAssistantMessage?.id,
          );

          for (const vote of existingVotesForMessage) {
            newVotesToInsert.push({
              id: vote.id,
              messageId: vote.messageId,
              chatId: vote.chatId,
              isUpvoted: vote.isUpvoted,
            });
          }
        } catch (error) {
          console.error('Error processing message section:', error);
        }
      }
    }

    // Batch insert messages
    for (let j = 0; j < newMessagesToInsert.length; j += INSERT_BATCH_SIZE) {
      const messageBatch = newMessagesToInsert.slice(j, j + INSERT_BATCH_SIZE);
      if (messageBatch.length > 0) {
        const validMessageBatch = messageBatch.map((msg) => ({
          id: msg.id,
          chatId: msg.chatId,
          parts: JSON.stringify(msg.parts),
          role: msg.role,
          attachments: JSON.stringify(msg.attachments),
          createdAt: msg.createdAt,
        }));

        try {
          await db.insert(message).values(validMessageBatch);
        } catch (error) {
          console.error('Error inserting messages:', error);
        }
      }
    }

    // Batch insert votes
    for (let j = 0; j < newVotesToInsert.length; j += INSERT_BATCH_SIZE) {
      const voteBatch = newVotesToInsert.slice(j, j + INSERT_BATCH_SIZE);
      if (voteBatch.length > 0) {
        try {
          await db.insert(vote).values(voteBatch);
        } catch (error) {
          console.error('Error inserting votes:', error);
        }
      }
    }
  }

  console.info(`Migration completed: ${processedCount} chats processed`);
}

createNewTable()
  .then(() => {
    console.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
