import { ConversationRepository } from '@/repositories/conversationRepository'
import { ConversationStatus } from '@prisma/client'

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
  static async listByChannel(channelId: string, status?: ConversationStatus) {
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
      agent: { connect: { id: agentId } },
      status: 'IN_PROGRESS'
    })
  }

  /**
   * Altera o status da conversa (Ex: Fechar atendimento)
   */
  static async updateStatus(conversationId: string, status: ConversationStatus) {
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
    return await ConversationRepository.create({
      contact: { connect: { id: contactId } },
      channel: { connect: { id: channelId } },
      status: 'OPEN'
    })
  }
}
