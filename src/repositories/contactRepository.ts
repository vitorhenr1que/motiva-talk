import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export class ContactRepository {
  static async findMany(where?: Prisma.ContactWhereInput) {
    return await prisma.contact.findMany({ where, orderBy: { name: 'asc' } })
  }

  static async findById(id: string) {
    return await prisma.contact.findUnique({ where: { id } })
  }

  static async findByPhone(phone: string) {
    return await prisma.contact.findUnique({ where: { phone } })
  }

  static async create(data: Prisma.ContactCreateInput) {
    return await prisma.contact.create({ data })
  }

  static async update(id: string, data: Prisma.ContactUpdateInput) {
    return await prisma.contact.update({ where: { id }, data })
  }
}
