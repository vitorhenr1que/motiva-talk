import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export class QuickReplyRepository {
  static async findMany(where?: Prisma.QuickReplyWhereInput) {
    return await prisma.quickReply.findMany({ 
      where, 
      orderBy: { title: 'asc' } 
    })
  }

  static async findById(id: string) {
    return await prisma.quickReply.findUnique({ where: { id } })
  }

  static async findByCategory(category: string) {
    return await prisma.quickReply.findMany({ where: { category } })
  }

  static async create(data: Prisma.QuickReplyCreateInput) {
    return await prisma.quickReply.create({ data })
  }

  static async update(id: string, data: Prisma.QuickReplyUpdateInput) {
    return await prisma.quickReply.update({ where: { id }, data })
  }

  static async delete(id: string) {
    return await prisma.quickReply.delete({ where: { id } })
  }
}
