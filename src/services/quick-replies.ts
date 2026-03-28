import { QuickReplyRepository } from '@/repositories/quickReplyRepository'

export class QuickReplyService {
  /**
   * Lista respostas rápidas disponíveis por canal ou globais
   */
  static async listAvailable(channelId?: string) {
    return await QuickReplyRepository.findMany({
      OR: [
        { channelId: null },
        { channelId: channelId || undefined }
      ]
    })
  }

  static async listByCategory(category: string) {
    return await QuickReplyRepository.findByCategory(category)
  }

  static async addReply(data: { title: string; content: string; category: string; channelId?: string }) {
    const { channelId, ...rest } = data
    return await QuickReplyRepository.create({
      ...rest,
      channel: channelId ? { connect: { id: channelId } } : undefined
    })
  }

  static async updateReply(id: string, data: { title?: string; content?: string; category?: string; channelId?: string | null }) {
    const { channelId, ...rest } = data
    return await QuickReplyRepository.update(id, {
      ...rest,
      channel: channelId === null ? { disconnect: true } : (channelId ? { connect: { id: channelId } } : undefined)
    })
  }

  static async deleteReply(id: string) {
    return await QuickReplyRepository.delete(id)
  }
}
