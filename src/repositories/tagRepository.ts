import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export class TagRepository {
  static async findMany() {
    return await prisma.tag.findMany({ 
      orderBy: { name: 'asc' } 
    })
  }

  static async findOrCreate(name: string, color?: string, emoji?: string) {
    const existing = await prisma.tag.findFirst({ where: { name } })
    if (existing) return existing
    return await prisma.tag.create({
      data: { 
        name, 
        color: color || '#3b82f6', 
        emoji: emoji || '🏷️' 
      }
    })
  }

  static async addToConversation(conversationId: string, tagId: string) {
    return await prisma.conversationTag.upsert({
      where: {
        conversationId_tagId: { conversationId, tagId }
      },
      update: {},
      create: { conversationId, tagId }
    })
  }

  static async removeFromConversation(conversationId: string, tagId: string) {
    return await prisma.conversationTag.delete({
      where: {
        conversationId_tagId: { conversationId, tagId }
      }
    })
  }

  static async listByConversation(conversationId: string) {
    return await prisma.conversationTag.findMany({
      where: { conversationId },
      include: { tag: true }
    })
  }
}
