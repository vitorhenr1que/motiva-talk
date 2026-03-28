import { NextResponse } from 'next/server'
import { MessageService } from '@/services/messages'
import { handleApiError, validateBody, AppError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/messages';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')
    
    if (!conversationId) {
      throw new AppError('conversationId é obrigatório', 400, 'VALIDATION_ERROR');
    }

    const messages = await MessageService.listByConversation(conversationId)
    return NextResponse.json({ success: true, data: messages })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, body);

    validateBody(body, ['conversationId', 'channelId', 'senderType', 'content'])
    const { conversationId, channelId, senderType, content, type } = body

    const message = await MessageService.createMessage({
      conversationId,
      channelId,
      senderType,
      content,
      type
    })

    return NextResponse.json({ success: true, data: message }, { status: 201 })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
