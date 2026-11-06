import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'
import { getContactPhoneVariants } from '@/lib/contact-phone'
import { buildContactPage, escapeContactSearch, type ContactCursor, type ContactListItem } from '@/lib/contact-pagination'

export class ContactRepository {
  static async findPage(organizationId: string, search: string, cursor: ContactCursor | null, signal: AbortSignal) {
    const { data, error } = await supabaseAdmin.rpc('list_contact_page', {
      p_organization_id: organizationId,
      p_search: escapeContactSearch(search),
      p_after_name: cursor?.name ?? null,
      p_after_id: cursor?.id ?? null,
    }).abortSignal(signal)
    if (error) throw error
    return buildContactPage((data || []) as ContactListItem[], search)
  }

  static async findMany(organizationId: string, where?: { OR: any[] } | any) {
    let query = supabaseAdmin
      .from('Contact')
      .select('*')
      .eq('organizationId', organizationId)
      .order('name', { ascending: true })
    
    // Suporte básico para o filtro OR usado no service (name or phone)
    if (where?.OR) {
      const nameFilter = where.OR.find((f: any) => f.name)?.name?.contains;
      const phoneFilter = where.OR.find((f: any) => f.phone)?.phone?.contains;
      
      if (nameFilter && phoneFilter) {
        query = query.or(`name.ilike.%${nameFilter}%,phone.ilike.%${phoneFilter}%`)
      } else if (nameFilter) {
        query = query.ilike('name', `%${nameFilter}%`)
      } else if (phoneFilter) {
        query = query.ilike('phone', `%${phoneFilter}%`)
      }
    }
    
    const { data, error } = await query
    if (error) throw error
    return data
  }

  static async findById(id: string, organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('Contact')
      .select('*')
      .eq('id', id)
      .eq('organizationId', organizationId)
      .single()
    if (error) throw error
    return data
  }

  static async findAllByPhone(phone: string, organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('Contact')
      .select('*')
      .in('phone', getContactPhoneVariants(phone))
      .eq('organizationId', organizationId)
    if (error) throw error
    return data || []
  }

  static async findByPhone(phone: string, organizationId: string) {
    const contacts = await this.findAllByPhone(phone, organizationId)
    const digits = phone.replace(/\D/g, '')
    return contacts.find(contact => contact.phone === digits) || contacts[0] || null
  }

  static async create(organizationId: string, data: any) {
    const { data: newContact, error } = await supabaseAdmin
      .from('Contact')
      .insert([{ id: generateId(), ...data, organizationId }])
      .select()
      .single()
    if (error) throw error
    return newContact
  }

  static async update(id: string, organizationId: string, data: any) {
    const { data: updatedContact, error } = await supabaseAdmin
      .from('Contact')
      .update(data)
      .eq('id', id)
      .eq('organizationId', organizationId)
      .select()
      .single()
    if (error) throw error
    return updatedContact
  }

  static async findOrCreateByPhone(phone: string, name: string, organizationId: string) {
    const existing = await this.findByPhone(phone, organizationId)
    if (existing) return existing

    return this.create(organizationId, { phone: phone.replace(/\D/g, ''), name })
  }
}
