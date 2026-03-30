import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class ChannelRepository {
  static async findMany(where?: any) {
    let query = supabaseAdmin.from('Channel').select('*')
    if (where) {
      if (where.isActive !== undefined) query = query.eq('isActive', where.isActive)
      if (where.providerSessionId) query = query.eq('providerSessionId', where.providerSessionId)
    }
    const { data, error } = await query
    if (error) throw error
    return data
  }

  static async findByUserId(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('UserChannel')
      .select('channel:Channel(*)')
      .eq('userId', userId)
    
    if (error) throw error
    
    // Supondo que a estrutura retornada pelo select dependa de como o Supabase lida com joins.
    // O retorno será algo como [{ channel: { id, name... } }, { channel: ... }]
    return (data || []).map((item: any) => item.channel).filter((ch: any) => ch !== null && ch.isActive);
  }

  static async findById(id: string) {
    const { data, error } = await supabaseAdmin.from('Channel').select('*').eq('id', id).single()
    if (error) throw error
    return data
  }

  static async create(data: any) {
    const { data: newChannel, error } = await supabaseAdmin
      .from('Channel')
      .insert([{ id: generateId(), ...data }])
      .select()
      .single()
    if (error) throw error
    return newChannel
  }

  static async update(id: string, data: any) {
    const { data: updatedChannel, error } = await supabaseAdmin.from('Channel').update(data).eq('id', id).select().single()
    if (error) throw error
    return updatedChannel
  }
}
