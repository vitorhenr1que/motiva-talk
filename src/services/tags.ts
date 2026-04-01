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
        // Buscamos apenas etiquetas que JÁ EXISTEM. 
        // Não queremos recriar uma etiqueta que foi excluída globalmente em uma sincronização de conversa.
        const tag = await TagRepository.findByName(name);
        if (tag) {
          await TagRepository.addToConversation(conversationId, tag.id);
        }
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

  static async update(id: string, data: any) {
    return await TagRepository.update(id, data)
  }

  static async delete(id: string) {
    return await TagRepository.delete(id)
  }
}
