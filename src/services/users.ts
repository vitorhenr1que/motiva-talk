import { UserRepository } from '@/repositories/userRepository'

export class UserService {
  static async listAll() {
    return await UserRepository.findMany()
  }

  static async getById(id: string) {
    return await UserRepository.findById(id)
  }

  static async registerUser(data: { name: string; email: string; role: any }) {
    return await UserRepository.create(data)
  }

  static async updateUser(id: string, data: any) {
    return await UserRepository.update(id, data)
  }

  static async removeUser(id: string) {
    return await UserRepository.delete(id)
  }
}
