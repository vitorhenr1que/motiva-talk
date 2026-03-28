import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class MessageRepository {
  static async findMany(where: any) {
    let query = supabaseAdmin
      .from('Message')
      .select('*')
      .order('createdAt', { ascending: true })

    if (where.conversationId) query = query.eq('conversationId', where.conversationId)

    const { data, error } = await query
    if (error) throw error
    return data
  }

  static async findById(id: string) {
    const { data, error } = await supabaseAdmin.from('Message').select('*').eq('id', id).single()
    if (error) throw error
    return data
  }

  static async create(data: any) {
    const { data: newMessage, error } = await supabaseAdmin
      .from('Message')
      .insert([{ id: generateId(), ...data }])
      .select()
      .single()
    if (error) throw error
    return newMessage
  }

  static async delete(id: string) {
    const { error } = await supabaseAdmin.from('Message').delete().eq('id', id)
    if (error) throw error
    return { success: true }
  }

  static async findLastByConversation(conversationId: string) {
    const { data, error } = await supabaseAdmin
      .from('Message')
      .select('*')
      .eq('conversationId', conversationId)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data
  }
}
