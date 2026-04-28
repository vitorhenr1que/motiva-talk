import { TagRepository } from '@/repositories/tagRepository'
import { ConversationRepository } from '@/repositories/conversationRepository'

export class TagService {
  static async getAll(organizationId: string) {
    return await TagRepository.findMany(organizationId)
  }

  static async syncConversationTags(conversationId: string, tagNames: string[], organizationId: string) {
    await ConversationRepository.findById(conversationId, organizationId)

    // 1. Obter tags atuais vinculadas
    const currentTags = await TagRepository.listByConversation(conversationId, organizationId)
    const currentNames = currentTags.map(ct => ct.tag.name)

    // 2. Adicionar as que não estão lá
    for (const name of tagNames) {
      if (!currentNames.includes(name)) {
        // Buscamos apenas etiquetas que JÁ EXISTEM. 
        // Não queremos recriar uma etiqueta que foi excluída globalmente em uma sincronização de conversa.
        const tag = await TagRepository.findByName(name, organizationId);
        if (tag) {
          await TagRepository.addToConversation(conversationId, tag.id, organizationId);
        }
      }
    }

    // 3. Remover as que não estão no novo array
    for (const ct of currentTags) {
      if (!tagNames.includes(ct.tag.name)) {
        await TagRepository.removeFromConversation(conversationId, ct.tag.id, organizationId)
      }
    }

    return true
  }

  static async update(id: string, organizationId: string, data: any) {
    return await TagRepository.update(id, organizationId, data)
  }

  static async delete(id: string, organizationId: string) {
    return await TagRepository.delete(id, organizationId)
  }
}
