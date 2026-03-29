import { NextResponse } from 'next/server'
import { MessageService } from '@/services/messages'
import { handleApiError, validateBody, AppError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/messages';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const before = searchParams.get('before') || undefined

    if (!conversationId) {
      throw new AppError('conversationId é obrigatório', 400, 'VALIDATION_ERROR');
    }

    const result = await MessageService.listByConversation(conversationId, limit, before)
    
    // Logs temporários para validação de paginação
    console.log(`[PAGINATION_DEBUG] Conv: ${conversationId} | Limit: ${limit} | Cursor: ${before || 'NONE'}`);
    console.log(`[PAGINATION_DEBUG] Retornou: ${result.messages.length} | HasMore: ${result.hasMore} | Next: ${result.nextCursor}`);

    return NextResponse.json({ 
      success: true, 
      data: result.messages,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore
    })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, body);

    validateBody(body, ['conversationId', 'channelId', 'senderType', 'content'])
    const { 
      conversationId, 
      channelId, 
      senderType, 
      content, 
      type, 
      replyToMessageId, 
      metadata,
      mediaUrl,
      fileName,
      mimeType,
      fileSize,
      thumbnailUrl
    } = body

    const message = await MessageService.createMessage({
      conversationId,
      channelId,
      senderType,
      content,
      type,
      replyToMessageId,
      metadata,
      mediaUrl,
      fileName,
      mimeType,
      fileSize,
      thumbnailUrl
    })

    return NextResponse.json({ success: true, data: message }, { status: 201 })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
