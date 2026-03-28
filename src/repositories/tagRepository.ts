import { supabaseAdmin } from '@/lib/supabase-admin'

export class TagRepository {
  static async findMany() {
    const { data, error } = await supabaseAdmin.from('Tag').select('*').order('name', { ascending: true })
    if (error) throw error
    return data
  }

  static async findOrCreate(name: string, color?: string, emoji?: string) {
    const { data: existing, error: searchError } = await supabaseAdmin
      .from('Tag')
      .select('*')
      .eq('name', name)
      .maybeSingle()
    
    if (existing) return existing

    const { data: newTag, error: createError } = await supabaseAdmin
      .from('Tag')
      .insert([{
        name,
        color: color || '#3b82f6',
        emoji: emoji || '🏷️'
      }])
      .select()
      .single()

    if (createError) throw createError
    return newTag
  }

  static async addToConversation(conversationId: string, tagId: string) {
    const { data, error } = await supabaseAdmin
      .from('ConversationTag')
      .upsert({ conversationId, tagId }, { onConflict: 'conversationId,tagId' })
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async removeFromConversation(conversationId: string, tagId: string) {
    const { error } = await supabaseAdmin
      .from('ConversationTag')
      .delete()
      .match({ conversationId, tagId })

    if (error) throw error
    return { success: true }
  }

  static async listByConversation(conversationId: string) {
    const { data, error } = await supabaseAdmin
      .from('ConversationTag')
      .select('*, tag:Tag(*)')
      .eq('conversationId', conversationId)

    if (error) throw error
    return data
  }
}
