import prisma from '@/lib/prisma'
import { KeywordSuggestion, Prisma } from '@prisma/client'

export class SuggestionRepository {
  static async findMany(where?: Prisma.KeywordSuggestionWhereInput) {
    return await prisma.keywordSuggestion.findMany({ 
      where,
      include: { channel: true }
    })
  }

  static async findById(id: string) {
    return await prisma.keywordSuggestion.findUnique({ 
      where: { id },
      include: { channel: true }
    })
  }

  static async create(data: Prisma.KeywordSuggestionCreateInput) {
    return await prisma.keywordSuggestion.create({ data })
  }

  static async update(id: string, data: Prisma.KeywordSuggestionUpdateInput) {
    return await prisma.keywordSuggestion.update({ where: { id }, data })
  }

  static async delete(id: string) {
    return await prisma.keywordSuggestion.delete({ where: { id } })
  }
}
