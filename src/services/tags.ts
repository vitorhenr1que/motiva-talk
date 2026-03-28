import { TagRepository } from '@/repositories/tagRepository'

export class TagService {
  static async getAll() {
    return await TagRepository.findMany()
  }

  static async syncConversationTags(conversationId: string, tagNames: string[]) {
    // 1. Obter tags atuais vinculadas
    const currentTags = await TagRepository.listByConversation(conversationId)
    const currentNames = currentTags.map(ct => ct.tag.name)

    // 2. Adicionar as que não estão lá
    for (const name of tagNames) {
      if (!currentNames.includes(name)) {
        const tag = await TagRepository.findOrCreate(name)
        await TagRepository.addToConversation(conversationId, tag.id)
      }
    }

    // 3. Remover as que não estão no novo array
    for (const ct of currentTags) {
      if (!tagNames.includes(ct.tag.name)) {
        await TagRepository.removeFromConversation(conversationId, ct.tag.id)
      }
    }

    return true
  }
}
