import prisma from '@/lib/prisma'
import { Prisma, UserRole } from '@prisma/client'

export class UserRepository {
  static async findMany(where?: Prisma.UserWhereInput) {
    return await prisma.user.findMany({ 
      where,
      orderBy: { createdAt: 'desc' },
      include: { userChannels: { include: { channel: true } } }
    })
  }

  static async findById(id: string) {
    return await prisma.user.findUnique({ 
      where: { id },
      include: { userChannels: { include: { channel: true } } }
    })
  }

  static async create(data: Prisma.UserCreateInput) {
    return await prisma.user.create({ data })
  }

  static async update(id: string, data: Prisma.UserUpdateInput) {
    return await prisma.user.update({ where: { id }, data })
  }

  static async delete(id: string) {
    return await prisma.user.delete({ where: { id } })
  }
}
