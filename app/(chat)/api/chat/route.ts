import {
  type UIMessage,
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
  streamText,
} from 'ai';
import { auth } from '@/app/(auth)/auth';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  getTrailingMessageId,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { getJoke } from '@/lib/ai/tools/get-joke';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      selectedChatModel,
    }: {
      id: string;
      messages: Array<UIMessage>;
      selectedChatModel: string;
    } = await request.json();

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    // Validate chat access or create new chat
    try {
      const chat = await getChatById({ id });

      if (!chat) {
        const title = await generateTitleFromUserMessage({
          message: userMessage,
        });
        await saveChat({ id, userId: session.user.id, title });
      } else if (chat.userId !== session.user.id) {
        return new Response('Unauthorized', { status: 401 });
      }
    } catch (error) {
      console.error('Error handling chat:', error);
      return new Response('Error handling chat', { status: 500 });
    }

    // Save user message with validation
    try {
      const messageToSave = {
        chatId: id,
        id: userMessage.id,
        role: 'user',
        parts: Array.isArray(userMessage.parts)
          ? JSON.stringify(userMessage.parts)
          : JSON.stringify([{ type: 'text', text: userMessage.content }]),
        attachments: JSON.stringify(userMessage.experimental_attachments ?? []),
        createdAt: new Date(),
      };

      await saveMessages({
        messages: [messageToSave],
      });
    } catch (error) {
      console.error('Error saving user message:', error);
      return new Response('Error saving message', { status: 500 });
    }

    return createDataStreamResponse({
      execute: (dataStream) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel }),
          messages,
          maxSteps: 5,
          experimental_activeTools:
            selectedChatModel === 'chat-model-reasoning'
              ? []
              : [
                  'getWeather',
                  'getJoke',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                ],
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_generateMessageId: generateUUID,
          tools: {
            getWeather,
            getJoke,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          onFinish: async ({ response }) => {
            if (session.user?.id) {
              try {
                const assistantId = getTrailingMessageId({
                  messages: response.messages.filter(
                    (message) => message.role === 'assistant',
                  ),
                });

                if (!assistantId) {
                  throw new Error('No assistant message found!');
                }

                const [, assistantMessage] = appendResponseMessages({
                  messages: [userMessage],
                  responseMessages: response.messages,
                });

                if (!assistantMessage) {
                  throw new Error('Failed to process assistant message');
                }

                const messageToSave = {
                  id: assistantId,
                  chatId: id,
                  role: assistantMessage.role,
                  parts: Array.isArray(assistantMessage.parts)
                    ? JSON.stringify(assistantMessage.parts)
                    : JSON.stringify([
                        { type: 'text', text: assistantMessage.content },
                      ]),
                  attachments: JSON.stringify(
                    assistantMessage.experimental_attachments ?? [],
                  ),
                  createdAt: new Date(),
                };

                await saveMessages({
                  messages: [messageToSave],
                });
              } catch (error) {
                console.error('Failed to save assistant message:', error);
                // Don't throw here to avoid breaking the stream
              }
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: (error) => {
        console.error('Stream error:', error);
        return 'An error occurred while streaming the response.';
      },
    });
  } catch (error) {
    console.error('Request error:', error);
    return new Response('An error occurred while processing your request!', {
      status: 500,
    });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request!', {
      status: 500,
    });
  }
}
