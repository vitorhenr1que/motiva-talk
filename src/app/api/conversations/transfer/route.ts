import { NextResponse } from 'next/server';
import { ConversationService } from '@/services/conversations';
import { handleApiError, validateBody } from '@/lib/api-errors';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    validateBody(body, ['conversationId', 'targetChannelId']);

    const { conversationId, targetChannelId, agentId, note } = body;

    const result = await ConversationService.transferToChannel(
      conversationId, 
      targetChannelId, 
      agentId, 
      note
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error, req, { route: '/api/conversations/transfer' });
  }
}
