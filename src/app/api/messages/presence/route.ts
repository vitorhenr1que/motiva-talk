import { NextRequest, NextResponse } from 'next/server'
import { MessageService } from '@/services/messages'
import { handleApiError, validateBody } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    validateBody(body, ['conversationId', 'presence']);
    
    const { conversationId, presence } = body;
    
    // Status deve ser 'composing' ou 'paused' (conforme Evolution API)
    await MessageService.sendPresence(conversationId, presence);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, req, { route: '/api/messages/presence' })
  }
}
