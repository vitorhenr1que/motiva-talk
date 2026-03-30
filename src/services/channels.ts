import { ChannelRepository } from '@/repositories/channelRepository'

export class ChannelService {
  static async listActive(userId?: string) {
    if (userId) {
      return await ChannelRepository.findByUserId(userId)
    }
    return await ChannelRepository.findMany({ isActive: true })
  }

  static async getById(id: string) {
    return await ChannelRepository.findById(id)
  }

  static async registerChannel(data: { name: string; phoneNumber: string }) {
    return await ChannelRepository.create({
      ...data,
      isActive: true
    })
  }
}
