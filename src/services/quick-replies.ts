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

  static async addReply(data: { title: string; content: string; category: string; channelId?: string | null }) {
    return await QuickReplyRepository.create(data)
  }

  static async updateReply(id: string, data: { title?: string; content?: string; category?: string; channelId?: string | null }) {
    return await QuickReplyRepository.update(id, data)
  }

  static async deleteReply(id: string) {
    return await QuickReplyRepository.delete(id)
  }
}
