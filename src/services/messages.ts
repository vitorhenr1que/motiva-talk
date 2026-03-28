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
  static async createMessage(data: CreateMessageData) {
    const { conversationId, channelId, senderType, content, type } = data
    
    let externalMessageId: string | undefined = data.externalMessageId

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

        // 2. Enviar via Provider
        const phone = conversation.contact.phone
        const result = await evolutionProvider.sendMessage(
          conversation.channel,
          phone,
          content,
          (type as any) || 'TEXT'
        )

        // 3. Pegar ID externo retornado
        externalMessageId = result?.key?.id || result?.message?.key?.id
        console.log(`[MSG_SERVICE] Enviado com sucesso! ExtID[${externalMessageId}]`);
      } catch (error) {
        console.error('[MSG_SERVICE] Erro ao enviar mensagem via Evolution API:', error)
        // Decidimos salvar no banco mesmo se o envio falhar? 
        // Por enquanto sim, mas sinalizamos o erro.
      }
    }

    const { MessageRepository } = await import('@/repositories/messageRepository')
    return await MessageRepository.create({
      conversationId,
      channelId,
      senderType,
      content,
      type: type || 'TEXT',
      externalMessageId
    })
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
