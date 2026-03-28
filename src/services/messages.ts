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
   * Registra uma nova mensagem no banco
   */
  static async createMessage(data: CreateMessageData) {
    const { conversationId, channelId, ...rest } = data
    return await MessageRepository.create({
      ...rest,
      conversationId: conversationId,
      channelId: channelId,
      type: data.type || 'TEXT'
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
