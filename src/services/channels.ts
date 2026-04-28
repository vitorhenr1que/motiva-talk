import { ChannelRepository } from '@/repositories/channelRepository'

export class ChannelService {
  static async listActive(organizationId: string, userId?: string) {
    if (userId) {
      return await ChannelRepository.findByUserId(userId, organizationId)
    }
    return await ChannelRepository.findMany(organizationId, { isActive: true })
  }

  static async getById(id: string, organizationId: string) {
    return await ChannelRepository.findById(id, organizationId)
  }

  static async registerChannel(organizationId: string, data: { name: string; phoneNumber: string }) {
    return await ChannelRepository.create(organizationId, {
      ...data,
      isActive: true
    })
  }
}
