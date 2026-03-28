import prisma from '@/lib/prisma'
import { Prisma, SenderType, MessageType } from '@prisma/client'

export class MessageRepository {
  static async findMany(where: Prisma.MessageWhereInput) {
    return await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' }
    })
  }

  static async findById(id: string) {
    return await prisma.message.findUnique({ where: { id } })
  }

  static async create(data: Prisma.MessageCreateInput) {
    return await prisma.message.create({ data })
  }

  static async delete(id: string) {
    return await prisma.message.delete({ where: { id } })
  }

  static async findLastByConversation(conversationId: string) {
    return await prisma.message.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' }
    })
  }
}
