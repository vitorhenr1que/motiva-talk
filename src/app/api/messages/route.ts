import { NextResponse } from 'next/server'
import { MessageService } from '@/services/messages'
import { handleApiError, validateBody, AppError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/messages';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')
    
    console.log(`[MSG_DEBUG] Buscando mensagens para conversa: ${conversationId}`);

    if (!conversationId) {
      throw new AppError('conversationId é obrigatório', 400, 'VALIDATION_ERROR');
    }

    const messages = await MessageService.listByConversation(conversationId)
    
    // Logs temporários para validação de reply / quoted messages
    const total = messages?.length || 0;
    const withReplyId = messages?.filter((m: any) => m.replyToMessageId).length || 0;
    const withReplyData = messages?.filter((m: any) => m.replyToMessage).length || 0;

    console.log(`[MSG_DEBUG] Conversa ${conversationId}: ${total} mensagens retornadas.`);
    if (withReplyId > 0) {
      console.log(`[MSG_DEBUG] Mensagens com replyToMessageId: ${withReplyId}`);
      console.log(`[MSG_DEBUG] Dados da mensagem original (replyToMessage) carregados: ${withReplyData}/${withReplyId}`);
      
      if (withReplyData < withReplyId) {
        console.warn(`[MSG_DEBUG] AVISO: Algumas mensagens possuem ID de resposta mas os dados não foram encontrados (podem ter sido deletadas).`);
      }
    } else {
      console.log(`[MSG_DEBUG] Nenhuma mensagem com reply detectada nesta conversa.`);
    }

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
    const { conversationId, channelId, senderType, content, type, replyToMessageId, metadata } = body

    const message = await MessageService.createMessage({
      conversationId,
      channelId,
      senderType,
      content,
      type,
      replyToMessageId,
      metadata
    })

    return NextResponse.json({ success: true, data: message }, { status: 201 })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
