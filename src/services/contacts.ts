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
}
