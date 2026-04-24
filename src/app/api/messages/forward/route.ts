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

    // Processamento sequencial para garantir ordem e evitar sobrecarga na Evolution API
    const results = [];
    
    for (const conversationId of targetConversationIds) {
      for (const messageId of messageIds) {
        try {
          const originalMessage = await MessageRepository.findById(messageId);
          if (!originalMessage) continue;

          // Criar nova mensagem baseada na original
          const forwardData = {
            conversationId,
            channelId: originalMessage.channelId,
            senderType: 'AGENT', // Mensagem encaminhada pelo atendente
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
          results.push(newMessage);
        } catch (err) {
          console.error(`[API_FORWARD] Falha ao encaminhar msg ${messageId} para conv ${conversationId}:`, err);
        }
      }
    }

    return NextResponse.json({ success: true, count: results.length });
  } catch (error: any) {
    console.error('[API_FORWARD] Erro geral:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Erro interno ao encaminhar mensagens.' 
    }, { status: 500 });
  }
}
