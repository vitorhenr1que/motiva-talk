import { ConversationRepository } from '@/repositories/conversationRepository'

export class ConversationService {
  /**
   * Lista conversas por filtro genérico (suporta RBAC)
   */
  static async listByFilter(where: any) {
    return await ConversationRepository.findMany(where)
  }

  /**
   * Lista conversas por canal
   */
  static async listByChannel(channelId: string, status?: string) {
    return await ConversationRepository.findMany({
       channelId,
       status: status || undefined
    })
  }

  /**
   * Atribui um atendente à conversa
   */
  static async assignAgent(conversationId: string, agentId: string) {
    return await ConversationRepository.update(conversationId, {
      assignedTo: agentId,
      status: 'IN_PROGRESS'
    })
  }

  /**
   * Altera o status da conversa (Ex: Fechar atendimento)
   */
  static async updateStatus(conversationId: string, status: string) {
    return await ConversationRepository.update(conversationId, { status })
  }

  /**
   * Busca conversa detalhada por ID
   */
  static async getById(id: string) {
    return await ConversationRepository.findById(id)
  }

  /**
   * Cria uma nova conversa (ex: contato enviou mensagem pela primeira vez)
   */
  static async startConversation(contactId: string, channelId: string) {
    const existing = await ConversationRepository.findActive(contactId, channelId)
    if (existing) return existing

    return await ConversationRepository.create({
      contactId: contactId,
      channelId: channelId,
      status: 'OPEN'
    })
  }

  /**
   * Atualiza unreadCount de uma conversa
   */
  static async setUnreadCount(id: string, count: number) {
    return await ConversationRepository.update(id, { unreadCount: count });
  }

  /**
   * Atualização genérica de conversa
   */
  static async updateConversation(id: string, data: any) {
    return await ConversationRepository.update(id, data);
  }
}
