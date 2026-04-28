import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class QuickReplyRepository {
  static async findMany(organizationId: string, where?: any) {
    let query = supabaseAdmin
      .from('QuickReply')
      .select('*')
      .eq('organizationId', organizationId)
      .order('title', { ascending: true })
    
    if (where?.OR) {
      const orConditions = where.OR.map((cond: any) => {
        const key = Object.keys(cond)[0]
        const val = cond[key]
        if (val === null || val === undefined) return `${key}.is.null`
        return `${key}.eq.${val}`
      }).join(',')
      query = query.or(orConditions)
    } else if (where) {
       Object.entries(where).forEach(([key, val]) => {
         if (val === null || val === undefined) {
           query = query.is(key, null)
         } else {
           query = query.eq(key, val)
         }
       })
    }
    
    const { data, error } = await query
    if (error) throw error
    return data
  }

  static async findById(id: string, organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('QuickReply')
      .select('*')
      .eq('id', id)
      .eq('organizationId', organizationId)
      .single()
    if (error) throw error
    return data
  }

  static async findByCategory(category: string, organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('QuickReply')
      .select('*')
      .eq('category', category)
      .eq('organizationId', organizationId)
    if (error) throw error
    return data
  }

  static async create(organizationId: string, data: any) {
    const { data: newQuickReply, error } = await supabaseAdmin
      .from('QuickReply')
      .insert([{ id: generateId(), ...data, organizationId }])
      .select()
      .single()
    if (error) throw error
    return newQuickReply
  }

  static async update(id: string, organizationId: string, data: any) {
    const { data: updatedQuickReply, error } = await supabaseAdmin
      .from('QuickReply')
      .update(data)
      .eq('id', id)
      .eq('organizationId', organizationId)
      .select()
      .single()
    if (error) throw error
    return updatedQuickReply
  }

  static async delete(id: string, organizationId: string) {
    const { error } = await supabaseAdmin
      .from('QuickReply')
      .delete()
      .eq('id', id)
      .eq('organizationId', organizationId)
    if (error) throw error
    return { success: true }
  }
}
