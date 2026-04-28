import { UserRepository } from '@/repositories/userRepository'

export class UserService {
  static async listAll(organizationId: string) {
    return await UserRepository.findMany(organizationId)
  }

  static async getById(id: string, organizationId: string) {
    return await UserRepository.findById(id, organizationId)
  }

  static async registerUser(organizationId: string, data: { name: string; email: string; role: any }) {
    return await UserRepository.create(organizationId, data)
  }

  static async updateUser(id: string, organizationId: string, data: any) {
    return await UserRepository.update(id, organizationId, data)
  }

  static async removeUser(id: string, organizationId: string) {
    return await UserRepository.delete(id, organizationId)
  }
}
