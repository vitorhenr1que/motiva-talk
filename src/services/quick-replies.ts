import { QuickReplyRepository } from '@/repositories/quickReplyRepository'
import { ChannelRepository } from '@/repositories/channelRepository'

export class QuickReplyService {
  /**
   * Lista respostas rápidas disponíveis por canal ou globais
   */
  static async listAvailable(organizationId: string, channelId?: string) {
    if (!channelId) {
      return await QuickReplyRepository.findMany(organizationId)
    }

    return await QuickReplyRepository.findMany(organizationId, {
      OR: [
        { channelId: null },
        { channelId: channelId }
      ]
    })
  }

  static async listByCategory(category: string, organizationId: string) {
    return await QuickReplyRepository.findByCategory(category, organizationId)
  }

  static async addReply(organizationId: string, data: { title: string; content: string; category: string; channelId?: string | null }) {
    if (data.channelId) await ChannelRepository.findById(data.channelId, organizationId)
    return await QuickReplyRepository.create(organizationId, data)
  }

  static async updateReply(id: string, organizationId: string, data: { title?: string; content?: string; category?: string; channelId?: string | null }) {
    if (data.channelId) await ChannelRepository.findById(data.channelId, organizationId)
    return await QuickReplyRepository.update(id, organizationId, data)
  }

  static async deleteReply(id: string, organizationId: string) {
    return await QuickReplyRepository.delete(id, organizationId)
  }
}
