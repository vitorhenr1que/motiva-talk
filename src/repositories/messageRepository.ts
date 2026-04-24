import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class MessageRepository {
  static async findMany(where: { conversationId?: string; before?: string; limit?: number }) {
    let query = supabaseAdmin
      .from('Message')
      .select(`
        *,
        replyToMessage:replyToMessageId (
          id,
          content,
          senderType,
          type,
          externalMessageId
        )
      `)

    if (where.conversationId) query = query.eq('conversationId', where.conversationId);
    
    if (where.before) {
      query = query.lt('createdAt', where.before);
    }

    // Ordenação DESC para pegar as mais recentes antes do cursor
    query = query.order('createdAt', { ascending: false });

    if (where.limit) {
      query = query.limit(where.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  static async findAllByConversation(conversationId: string) {
    const { data, error } = await supabaseAdmin
      .from('Message')
      .select('*')
      .eq('conversationId', conversationId);
    
    if (error) throw error;
    return data;
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
      .select('*, replyToMessage:replyToMessageId(*)')
      .single()
    if (error) throw error
    return newMessage
  }

  /**
   * Atualiza uma mensagem pelo ID
   */
  static async update(id: string, data: any) {
    const { data: updated, error } = await supabaseAdmin
      .from('Message')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return updated
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

  static async search(conversationId: string, queryText: string) {
    const { data, error } = await supabaseAdmin
      .from('Message')
      .select('id, content, createdAt, senderType, conversationId, deletedForEveryone')
      .eq('conversationId', conversationId)
      .ilike('content', `%${queryText}%`)
      .order('createdAt', { ascending: false })
      .limit(50)

    if (error) throw error
    return data
  }

  /**
   * Busca mensagens agendadas que já deveriam ter sido enviadas
   */
  static async findScheduledReady(limit: number = 10) {
    const { data, error } = await supabaseAdmin
      .from('Message')
      .select('*')
      .eq('sendStatus', 'scheduled')
      .lte('scheduledAt', new Date().toISOString())
      .order('scheduledAt', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data;
  }
}
