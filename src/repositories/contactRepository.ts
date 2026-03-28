import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class ContactRepository {
  static async findMany(where?: any) {
    let query = supabaseAdmin.from('Contact').select('*').order('name', { ascending: true })
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
}
