import { NextRequest, NextResponse } from 'next/server'
import { MessageService } from '@/services/messages'
import { handleApiError, validateBody } from '@/lib/api-errors'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) throw organizationNotFoundError();
    validateBody(body, ['conversationId', 'presence']);
    
    const { conversationId, presence } = body;
    
    // Status deve ser 'composing' ou 'paused'.
    await MessageService.sendPresence(conversationId, presence, organizationId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, req, { route: '/api/messages/presence' })
  }
}
