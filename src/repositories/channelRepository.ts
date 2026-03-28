import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export class ChannelRepository {
  static async findMany(where?: Prisma.ChannelWhereInput) {
    return await prisma.channel.findMany({ where })
  }

  static async findById(id: string) {
    return await prisma.channel.findUnique({ where: { id } })
  }

  static async create(data: Prisma.ChannelCreateInput) {
    return await prisma.channel.create({ data })
  }

  static async update(id: string, data: Prisma.ChannelUpdateInput) {
    return await prisma.channel.update({ where: { id }, data })
  }
}
