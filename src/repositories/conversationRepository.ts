import prisma from '@/lib/prisma'
import { ConversationStatus, Prisma } from '@prisma/client'

export class ConversationRepository {
  static async findMany(where: Prisma.ConversationWhereInput) {
    return await prisma.conversation.findMany({
      where,
      include: {
        contact: true,
        channel: true,
        agent: true,
        tags: { include: { tag: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 }
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  static async findById(id: string) {
    return await prisma.conversation.findUnique({
      where: { id },
      include: {
        contact: true,
        channel: true,
        agent: true,
        tags: { include: { tag: true } }
      }
    })
  }

  static async create(data: Prisma.ConversationCreateInput) {
    return await prisma.conversation.create({ data })
  }

  static async update(id: string, data: Prisma.ConversationUpdateInput) {
    return await prisma.conversation.update({
      where: { id },
      data,
      include: { contact: true, channel: true, agent: true }
    })
  }
}
