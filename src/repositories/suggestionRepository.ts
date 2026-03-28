import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class SuggestionRepository {
  static async findMany(where?: any) {
    let query = supabaseAdmin.from('KeywordSuggestion').select('*, channel:Channel(*)');
    
    if (where?.isActive !== undefined) {
      query = query.eq('isActive', where.isActive);
    }
    
    if (where?.channelId) {
      query = query.or(`channelId.eq.${where.channelId},channelId.is.null`);
    } else if (where?.channelId === null) {
      query = query.is('channelId', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  static async findById(id: string) {
    const { data, error } = await supabaseAdmin.from('KeywordSuggestion').select('*, channel:Channel(*)').eq('id', id).single()
    if (error) throw error
    return data
  }

  static async create(data: any) {
    const { data: newSuggestion, error } = await supabaseAdmin
      .from('KeywordSuggestion')
      .insert([{ id: generateId(), ...data }])
      .select()
      .single()
    if (error) throw error
    return newSuggestion
  }

  static async update(id: string, data: any) {
    const { data: updatedSuggestion, error } = await supabaseAdmin.from('KeywordSuggestion').update(data).eq('id', id).select().single()
    if (error) throw error
    return updatedSuggestion
  }

  static async delete(id: string) {
    const { error } = await supabaseAdmin.from('KeywordSuggestion').delete().eq('id', id)
    if (error) throw error
    return { success: true }
  }
}
