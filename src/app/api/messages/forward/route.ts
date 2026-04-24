import { NextRequest, NextResponse } from 'next/server';
import { MessageService } from '@/services/messages';
import { MessageRepository } from '@/repositories/messageRepository';
import { AppError } from '@/lib/api-errors';

export async function POST(req: NextRequest) {
  try {
    const { messageIds, targetConversationIds } = await req.json();

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Lista de mensagens inválida.' }, { status: 400 });
    }

    if (!targetConversationIds || !Array.isArray(targetConversationIds) || targetConversationIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Lista de conversas de destino inválida.' }, { status: 400 });
    }

    // 1. Buscar todas as mensagens originais de uma vez para evitar queries repetitivas
    const originalMessages = await Promise.all(
      messageIds.map(id => MessageRepository.findById(id))
    );
    const validOriginalMessages = originalMessages.filter(m => !!m);

    if (validOriginalMessages.length === 0) {
      return NextResponse.json({ success: false, error: 'Mensagens originais não encontradas.' }, { status: 404 });
    }

    // 2. Processar cada conversa de destino em PARALELO
    // Dentro de cada conversa, as mensagens são enviadas em SEQUÊNCIA para manter a ordem
    const forwardPromises = targetConversationIds.map(async (conversationId) => {
      const sentInThisConversation = [];
      
      for (const originalMessage of validOriginalMessages) {
        try {
          const forwardData = {
            conversationId,
            channelId: originalMessage.channelId,
            senderType: 'AGENT',
            content: originalMessage.content,
            type: originalMessage.type,
            mediaUrl: originalMessage.mediaUrl,
            fileName: originalMessage.fileName,
            mimeType: originalMessage.mimeType,
            fileSize: originalMessage.fileSize,
            duration: originalMessage.duration,
            thumbnailUrl: originalMessage.thumbnailUrl,
            metadata: {
              ...(originalMessage.metadata || {}),
              isForwarded: true,
              forwardedFromMessageId: originalMessage.id
            },
            isForwarded: true,
            forwardedFromMessageId: originalMessage.id
          };

          const newMessage = await MessageService.createMessage(forwardData);
          sentInThisConversation.push(newMessage);
        } catch (err) {
          console.error(`[API_FORWARD] Erro ao encaminhar para conv ${conversationId}:`, err);
        }
      }
      return sentInThisConversation;
    });

    const resultsArray = await Promise.all(forwardPromises);
    const totalResults = resultsArray.flat();

    return NextResponse.json({ success: true, count: totalResults.length });
  } catch (error: any) {
    console.error('[API_FORWARD] Erro geral:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Erro interno ao encaminhar mensagens.' 
    }, { status: 500 });
  }
}
