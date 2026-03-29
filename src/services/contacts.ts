import { ContactRepository } from '@/repositories/contactRepository'

export class ContactService {
  static async listAll() {
    return await ContactRepository.findMany()
  }

  static async search(query: string) {
    return await ContactRepository.findMany({
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query } }
      ]
    })
  }

  static async getOrCreateContact(data: { name: string; phone: string }) {
    const existing = await ContactRepository.findByPhone(data.phone)
    if (existing) return existing
    
    return await ContactRepository.create(data)
  }

  /**
   * Obtém a foto de perfil do contato, buscando na Evolution API apenas se o cache estiver expirado (> 24h)
   */
  static async getAndUpdateProfilePicture(contactId: string, channelId: string) {
    try {
      const contact = await ContactRepository.findById(contactId);
      if (!contact) return null;

      // Lógica de Cache: Se já buscou há menos de 24 horas, retorna a existente
      const lastFetch = contact.lastProfilePictureFetchAt ? new Date(contact.lastProfilePictureFetchAt) : null;
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

      if (contact.profilePictureUrl && lastFetch && lastFetch > twentyFourHoursAgo) {
        return contact.profilePictureUrl;
      }

      // Se expirou ou não tem, busca na Evolution API
      const { evolutionProvider } = await import('@/services/whatsapp/evolution-provider');
      const { ChannelRepository } = await import('@/repositories/channelRepository');
      const channel = await ChannelRepository.findById(channelId);
      
      if (!channel) return contact.profilePictureUrl;

      const newUrl = await evolutionProvider.fetchProfilePictureUrl(channel, contact.phone);

      // Sempre atualiza o timestamp da tentativa, mesmo se for null
      await ContactRepository.update(contactId, {
        profilePictureUrl: newUrl || contact.profilePictureUrl,
        lastProfilePictureFetchAt: now.toISOString()
      });

      return newUrl || contact.profilePictureUrl;
    } catch (error) {
      console.error('[CONTACT_SERVICE] Erro ao buscar/atualizar foto:', error);
      return null;
    }
  }
}
