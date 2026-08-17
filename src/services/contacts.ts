import { ContactRepository } from '@/repositories/contactRepository'

export class ContactService {
  static async listAll(organizationId: string) {
    return await ContactRepository.findMany(organizationId)
  }

  static async search(organizationId: string, query: string) {
    return await ContactRepository.findMany(organizationId, {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { phone: { contains: query } }
      ]
    })
  }

  static async getOrCreateContact(organizationId: string, data: { name: string; phone: string }) {
    const existing = await ContactRepository.findByPhone(data.phone, organizationId)
    if (existing) return existing
    
    return await ContactRepository.create(organizationId, data)
  }

  /**
   * Retorna a foto já armazenada. A Meta Cloud API não expõe a foto de perfil
   * de contatos como parte da integração oficial.
   */
  static async getAndUpdateProfilePicture(contactId: string, _channelId: string, organizationId: string) {
    try {
      const contact = await ContactRepository.findById(contactId, organizationId);
      if (!contact) return null;

      const now = new Date();
      await ContactRepository.update(contactId, organizationId, {
        lastProfilePictureFetchAt: now.toISOString()
      });
      return contact.profilePictureUrl;
    } catch (error) {
      console.error('[CONTACT_SERVICE] Erro ao consultar foto armazenada:', error);
      return null;
    }
  }
}
