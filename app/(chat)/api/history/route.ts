import { auth } from '@/app/(auth)/auth';
import type { NextRequest } from 'next/server';
import { getChatsByUserId } from '@/lib/db/queries';
import { isValidDatabaseId } from '@/lib/db/validation';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const limit = Number(searchParams.get('limit') || '10');
  const startingAfter = searchParams.get('starting_after');
  const endingBefore = searchParams.get('ending_before');

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    (startingAfter && !isValidDatabaseId(startingAfter)) ||
    (endingBefore && !isValidDatabaseId(endingBefore))
  ) {
    return Response.json(
      { error: 'Invalid pagination parameters' },
      { status: 400 },
    );
  }

  if (startingAfter && endingBefore) {
    return Response.json(
      'Only one of starting_after or ending_before can be provided!',
      { status: 400 },
    );
  }

  const session = await auth();

  if (!session?.user?.id) {
    return Response.json('Unauthorized!', { status: 401 });
  }

  try {
    const chats = await getChatsByUserId({
      id: session.user.id,
      limit,
      startingAfter,
      endingBefore,
    });

    return Response.json(chats);
  } catch (_) {
    return Response.json('Failed to fetch chats!', { status: 500 });
  }
}
