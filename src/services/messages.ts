import { MessageRepository } from '@/repositories/messageRepository'
import { Channel } from '@/types/chat';
import { AppError } from '@/lib/api-errors';

export interface CreateMessageData {
  conversationId: string;
  channelId: string;
  senderType: string;
  content: string;
  type?: string;
  externalMessageId?: string;
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  thumbnailUrl?: string;
  metadata?: any;
}

export class MessageService {
  /**
   * Lista histórico de mensagens paginado
   * Filtra mensagens apagadas (me/todos)
   */
  static async listByConversation(conversationId: string, limit: number = 20, before?: string) {
    const messages = await MessageRepository.findMany({ 
      conversationId,
      limit,
      before
    })
    
    // Filtrar localmente as deletadas para o atendente
    const filtered = messages.filter((m: any) => !m.deletedForMe);

    // Inverter para ASC antes de retornar para renderizar corretamente no chat (o repo mandou DESC)
    const sorted = [...filtered].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // O cursor para a PRÓXIMA página (anterior no tempo) é a createdAt da mensagem MAIS ANTIGA deste lote (última do array original DESC)
    const hasMore = messages.length === limit;
    const nextCursor = hasMore ? messages[messages.length - 1].createdAt : null;

    return { 
      messages: sorted,
      nextCursor,
      hasMore
    }
  }

  /**
   * Registra uma nova mensagem no banco e envia via API se for do atendente
   */
  static async createMessage(data: CreateMessageData & { replyToMessageId?: string }) {
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
    } = data
    
    let externalMessageId: string | undefined = data.externalMessageId
    let quoted: { id: string, content: string, fromMe: boolean, type?: string } | undefined = undefined;

    if (replyToMessageId) {
      const originalMsg = await MessageRepository.findById(replyToMessageId);
      if (originalMsg && originalMsg.externalMessageId) {
        quoted = {
          id: originalMsg.externalMessageId,
          content: originalMsg.content,
          fromMe: originalMsg.senderType === 'AGENT' || originalMsg.senderType === 'SYSTEM',
          type: originalMsg.type
        };
      }
    }

    if (senderType === 'AGENT') {
      try {
        const { ConversationRepository } = await import('@/repositories/conversationRepository')
        const { evolutionProvider } = await import('@/services/whatsapp/evolution-provider')
        
        const conversation = await ConversationRepository.findById(conversationId)
        if (!conversation || !conversation.contact || !conversation.channel) {
          throw new AppError('Conversa, contato ou canal não encontrados.', 404, 'NOT_FOUND');
        }

        // Se for mídia, passamos as informações pro provider
        const result = await evolutionProvider.sendMessage(
          conversation.channel,
          conversation.contact.phone,
          content,
          (type as any) || 'TEXT',
          quoted,
          {
            ...metadata,
            mediaUrl: mediaUrl || content, // content pode ser a URL se for mídia
            fileName,
            mimeType,
            fileSize
          }
        )

        externalMessageId = result?.key?.id || result?.message?.key?.id
        
        if (!externalMessageId) {
           console.error('[MSG_SERVICE] Falha ao obter ID externo da mensagem da Evolution API. Retorno bruto:', result);
           throw new Error('A Evolution API não retornou o ID da mensagem enviada.');
        }

      } catch (error: any) {
        console.error('[MSG_SERVICE] Erro ao enviar mensagem via Evolution API:', error)
        throw new AppError(`Falha no envio via WhatsApp: ${error.message}`, 500, 'INTERNAL_ERROR');
      }
    }

    const newMessage = await MessageRepository.create({
      conversationId,
      channelId,
      senderType,
      content,
      type: type || 'TEXT',
      externalMessageId,
      replyToMessageId,
      metadata,
      mediaUrl,
      fileName,
      mimeType,
      fileSize,
      thumbnailUrl,
      createdAt: new Date().toISOString()
    })

    if (senderType === 'AGENT') {
      const { ConversationRepository } = await import('@/repositories/conversationRepository')
      await ConversationRepository.update(conversationId, { 
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0 
      })
    }

    return newMessage
  }

  /**
   * Apaga mensagem apenas para o atendente (localmente)
   */
  static async deleteForMe(id: string) {
    return await MessageRepository.update(id, { deletedForMe: true })
  }

  /**
   * Apaga mensagem para todos (Evolution API + Banco)
   */
  static async deleteForEveryone(id: string) {
    const message = await MessageRepository.findById(id);
    if (!message) throw new Error('Mensagem não encontrada');

    // 1. Apagar no WhatsApp via Evolution API se tiver ID externo
    if (message.externalMessageId) {
      try {
        const { ConversationRepository } = await import('@/repositories/conversationRepository');
        const { evolutionProvider } = await import('@/services/whatsapp/evolution-provider');
        
        const conversation = await ConversationRepository.findById(message.conversationId);
        if (conversation && conversation.contact && conversation.channel) {
           await evolutionProvider.deleteMessage(
             conversation.channel, 
             conversation.contact.phone, 
             message.externalMessageId,
             message.senderType === 'AGENT'
           );
        }
      } catch (error) {
        console.error('[MSG_SERVICE] Erro ao apagar no WhatsApp:', error);
      }
    }

    // 2. Atualizar no Banco (Marcamos como deletada para todos)
    return await MessageRepository.update(id, { 
      deletedForEveryone: true,
      content: '🚫 Mensagem apagada' 
    });
  }

  /**
   * Envia status de presença (digitando) para o contato
   */
  static async sendPresence(conversationId: string, presence: 'composing' | 'paused') {
    const { ConversationRepository } = await import('@/repositories/conversationRepository');
    const { evolutionProvider } = await import('@/services/whatsapp/evolution-provider');

    const conversation = await ConversationRepository.findById(conversationId);
    if (conversation && conversation.contact && conversation.channel) {
      await evolutionProvider.sendPresence(
        conversation.channel,
        conversation.contact.phone,
        presence
      );
    }
  }

  static async getMessageById(id: string) {
    return await MessageRepository.findById(id)
  }

  static async deleteMessage(id: string) {
    return await MessageRepository.delete(id)
  }

  static async getLastMessage(conversationId: string) {
    return await MessageRepository.findLastByConversation(conversationId)
  }

  static async searchMessages(conversationId: string, query: string) {
    const results = await MessageRepository.search(conversationId, query)
    
    // Filtrar mensagens apagadas para todos (opcional: o atendente pode querer saber que algo existiu, mas aqui limpamos)
    return results.filter((m: any) => !m.deletedForEveryone).map((m: any) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt,
      senderType: m.senderType,
      conversationId: m.conversationId
    }))
  }
}
