import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class QuickReplyRepository {
  static async findMany(where?: any) {
    let query = supabaseAdmin.from('QuickReply').select('*').order('title', { ascending: true })
    const { data, error } = await query
    if (error) throw error
    return data
  }

  static async findById(id: string) {
    const { data, error } = await supabaseAdmin.from('QuickReply').select('*').eq('id', id).single()
    if (error) throw error
    return data
  }

  static async findByCategory(category: string) {
    const { data, error } = await supabaseAdmin.from('QuickReply').select('*').eq('category', category)
    if (error) throw error
    return data
  }

  static async create(data: any) {
    const { data: newQuickReply, error } = await supabaseAdmin
      .from('QuickReply')
      .insert([{ id: generateId(), ...data }])
      .select()
      .single()
    if (error) throw error
    return newQuickReply
  }

  static async update(id: string, data: any) {
    const { data: updatedQuickReply, error } = await supabaseAdmin.from('QuickReply').update(data).eq('id', id).select().single()
    if (error) throw error
    return updatedQuickReply
  }

  static async delete(id: string) {
    const { error } = await supabaseAdmin.from('QuickReply').delete().eq('id', id)
    if (error) throw error
    return { success: true }
  }
}
