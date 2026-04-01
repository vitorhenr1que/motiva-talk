import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class TagRepository {
  static async findMany() {
    const { data, error } = await supabaseAdmin.from('Tag').select('*').order('name', { ascending: true })
    if (error) throw error
    return data
  }

  static async findByName(name: string) {
    const { data: list, error } = await supabaseAdmin
      .from('Tag')
      .select('*')
      .eq('name', name)
      .limit(1);
    
    if (error) throw error;
    return list?.[0] || null;
  }

  static async findOrCreate(name: string, color?: string, emoji?: string) {
    const { data: existingList, error: searchError } = await supabaseAdmin
      .from('Tag')
      .select('*')
      .eq('name', name)
      .limit(1);
    
    if (searchError) {
      console.error('[DATABASE] Error searching for tag:', name, searchError);
      throw searchError;
    }

    const existing = existingList?.[0];
    if (existing) return existing;

    const { data: newTag, error: createError } = await supabaseAdmin
      .from('Tag')
      .insert([{
        id: generateId(),
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

  static async update(id: string, data: any) {
    const { data: updatedTag, error } = await supabaseAdmin
      .from('Tag')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return updatedTag
  }

  static async delete(id: string) {
    try {
      // 1. Identify the tag by ID to get its name (to handle any duplicates with same name)
      const { data: tagInfo, error: fetchError } = await supabaseAdmin
        .from('Tag')
        .select('name')
        .eq('id', id)
        .maybeSingle();

      const tagName = tagInfo?.name;

      if (tagName) {
        // 2. Find ALL tag IDs with this same name to ensure global cleanup
        const { data: duplicateTags } = await supabaseAdmin
          .from('Tag')
          .select('id')
          .eq('name', tagName);
        
        const tagIds = duplicateTags?.map(t => t.id) || [id];

        // 3. Clean bridge table for ALL identified IDs
        const { error: bridgeError } = await supabaseAdmin
          .from('ConversationTag')
          .delete()
          .in('tagId', tagIds);

        if (bridgeError) {
          console.error('[DATABASE] Error cleaning bridge table for tag deletion:', bridgeError);
          throw bridgeError;
        }

        // 4. Delete ALL tags with this name permanently
        const { error: tagError } = await supabaseAdmin
          .from('Tag')
          .delete()
          .eq('name', tagName);

        if (tagError) {
          console.error('[DATABASE] Error deleting tags by name:', tagName, tagError);
          throw tagError;
        }
      } else {
        // Fallback: delete only the specific ID if name lookup fails
        await supabaseAdmin.from('ConversationTag').delete().eq('tagId', id);
        await supabaseAdmin.from('Tag').delete().eq('id', id);
      }

      return { success: true };
    } catch (e) {
      console.error('[DATABASE] Critical failure in tag deletion workflow:', e);
      throw e;
    }
  }
}
