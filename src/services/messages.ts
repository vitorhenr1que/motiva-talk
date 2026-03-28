import { MessageRepository } from '@/repositories/messageRepository'

export interface CreateMessageData {
  conversationId: string;
  channelId: string;
  senderType: string;
  content: string;
  type?: string;
  externalMessageId?: string;
}

export class MessageService {
  /**
   * Lista histórico de mensagens paginado (simplificado)
   */
  static async listByConversation(conversationId: string) {
    return await MessageRepository.findMany({ conversationId })
  }

  /**
   * Registra uma nova mensagem no banco e envia via API se for do atendente
   */
  static async createMessage(data: CreateMessageData & { replyToMessageId?: string }) {
    const { conversationId, channelId, senderType, content, type, replyToMessageId } = data
    
    let externalMessageId: string | undefined = data.externalMessageId
    let quoted: { id: string, content: string, fromMe: boolean, type?: string } | undefined = undefined;

    // Se houver uma resposta, precisamos buscar os dados da mensagem original para a Evolution API
    if (replyToMessageId) {
      const { MessageRepository } = await import('@/repositories/messageRepository');
      const originalMsg = await MessageRepository.findById(replyToMessageId);
      if (originalMsg && originalMsg.externalMessageId) {
        quoted = {
          id: originalMsg.externalMessageId,
          content: originalMsg.content,
          fromMe: originalMsg.senderType === 'AGENT' || originalMsg.senderType === 'SYSTEM',
          type: originalMsg.type
        };
        console.log(`[MSG_SERVICE] Preparando resposta para mensagem: ${quoted.id}`);
      }
    }

    // Se a mensagem for do atendente, PRECISAMOS enviar para a Evolution API
    if (senderType === 'AGENT') {
      try {
        const { ConversationRepository } = await import('@/repositories/conversationRepository')
        const { evolutionProvider } = await import('@/services/whatsapp/evolution-provider')
        
        console.log(`[MSG_SERVICE] Enviando mensagem via Provider: Conv[${conversationId}] Content[${content.substring(0, 15)}...]`);
        
        // 1. Obter conversa com contato e canal
        const conversation = await ConversationRepository.findById(conversationId)
        if (!conversation || !conversation.contact || !conversation.channel) {
          throw new Error('Conversa, contato ou canal não encontrados para envio.')
        }

        // 2. Enviar via Provider (Passando o quoted se existir)
        const phone = conversation.contact.phone
        const result = await evolutionProvider.sendMessage(
          conversation.channel,
          phone,
          content,
          (type as any) || 'TEXT',
          quoted
        )

        // 3. Pegar ID externo retornado
        externalMessageId = result?.key?.id || result?.message?.key?.id
        console.log(`[MSG_SERVICE] Enviado com sucesso! ExtID[${externalMessageId}]`);
      } catch (error) {
        console.error('[MSG_SERVICE] Erro ao enviar mensagem via Evolution API:', error)
      }
    }

    const { MessageRepository } = await import('@/repositories/messageRepository')
    const newMessage = await MessageRepository.create({
      conversationId,
      channelId,
      senderType,
      content,
      type: type || 'TEXT',
      externalMessageId,
      replyToMessageId
    })

    // Se o atendente enviou mensagem, marcamos a conversa como "lida" (unreadCount = 0)
    if (senderType === 'AGENT') {
      const { ConversationRepository } = await import('@/repositories/conversationRepository')
      console.log(`[UNREAD_DEBUG] Atendente enviou mensagem. Resetando unreadCount para conversa ${conversationId}`);
      await ConversationRepository.update(conversationId, { 
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0 
      })
    }

    return newMessage
  }

  /**
   * Obtém uma mensagem específica pelo ID
   */
  static async getMessageById(id: string) {
    return await MessageRepository.findById(id)
  }

  /**
   * Exclui uma mensagem do banco
   */
  static async deleteMessage(id: string) {
    return await MessageRepository.delete(id)
  }

  /**
   * Obtém a última mensagem enviada em uma conversa
   */
  static async getLastMessage(conversationId: string) {
    return await MessageRepository.findLastByConversation(conversationId)
  }
}
