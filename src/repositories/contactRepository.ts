import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class ContactRepository {
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

  static async findByPhone(phone: string, organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('Contact')
      .select('*')
      .eq('phone', phone)
      .eq('organizationId', organizationId)
      .maybeSingle()
    if (error) throw error
    return data
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

    return this.create(organizationId, { phone, name })
  }
}
