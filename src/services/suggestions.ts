import { SuggestionRepository } from '@/repositories/suggestionRepository'

export class SuggestionService {
  /**
   * Normaliza texto para comparação eficiente
   */
  private static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  }

  /**
   * Lógica central de sugestões baseada no conteúdo da última mensagem recebida
   * Filtra apenas sugestões que estão ATIVAS (isActive: true).
   */
  static async findSuggestions(messageContent: string, channelId?: string): Promise<any[]> {
    const input = this.normalizeText(messageContent)
    
    // Filtra por canal OU globais e que estejam ATIVAS
    const all = await SuggestionRepository.findMany({
      isActive: true,
      channelId: channelId
    })

    const scored = (all as any[]).map(sug => {
      let score = 0
      sug.triggers.forEach((t: string) => {
        if (input.includes(this.normalizeText(t))) {
          score += 1
        }
      })
      return { ...sug, score }
    })

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3) 
  }

  static async listAll(filters?: { keyword?: string; category?: string; channelId?: string; isActive?: boolean }) {
    const where: any = {}
    if (filters?.keyword) where.keyword = filters.keyword
    if (filters?.category) where.category = filters.category
    if (filters?.channelId) where.channelId = filters.channelId
    if (filters?.isActive !== undefined) where.isActive = filters.isActive

    return await SuggestionRepository.findMany(where)
  }

  static async createSuggestion(data: any) {
    const { channelId, ...rest } = data
    return await SuggestionRepository.create({
      ...rest,
      channelId: channelId || null
    })
  }

  static async updateSuggestion(id: string, data: any) {
    const { channelId, ...rest } = data
    return await SuggestionRepository.update(id, {
      ...rest,
      channelId: channelId === null ? null : (channelId || undefined)
    })
  }

  static async toggleActive(id: string, isActive: boolean) {
    return await SuggestionRepository.update(id, { isActive })
  }

  static async remove(id: string) {
    return await SuggestionRepository.delete(id)
  }
}
