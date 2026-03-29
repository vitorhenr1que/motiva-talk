import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class ContactRepository {
  static async findMany(where?: { OR: any[] } | any) {
    let query = supabaseAdmin.from('Contact').select('*').order('name', { ascending: true })
    
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

  static async findById(id: string) {
    const { data, error } = await supabaseAdmin.from('Contact').select('*').eq('id', id).single()
    if (error) throw error
    return data
  }

  static async findByPhone(phone: string) {
    const { data, error } = await supabaseAdmin.from('Contact').select('*').eq('phone', phone).maybeSingle()
    if (error) throw error
    return data
  }

  static async create(data: any) {
    const { data: newContact, error } = await supabaseAdmin
      .from('Contact')
      .insert([{ id: generateId(), ...data }])
      .select()
      .single()
    if (error) throw error
    return newContact
  }

  static async update(id: string, data: any) {
    const { data: updatedContact, error } = await supabaseAdmin.from('Contact').update(data).eq('id', id).select().single()
    if (error) throw error
    return updatedContact
  }

  static async findOrCreateByPhone(phone: string, name: string) {
    const existing = await this.findByPhone(phone)
    if (existing) return existing

    return this.create({ phone, name })
  }
}
