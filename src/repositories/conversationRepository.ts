import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class ConversationRepository {
  static async findMany(where: any) {
    let query = supabaseAdmin
      .from('Conversation')
      .select(`
        *,
        contact:Contact(*),
        channel:Channel(*),
        agent:User(*),
        tags:ConversationTag(*, tag:Tag(*)),
        messages:Message(*)
      `)
      .order('lastMessageAt', { ascending: false, nullsFirst: false })
      .order('createdAt', { foreignTable: 'Message', ascending: false })
      .limit(1, { foreignTable: 'Message' })

    if (where.status) query = query.eq('status', where.status)
    if (where.assignedTo) query = query.eq('assignedTo', where.assignedTo)
    if (where.channelId) query = query.eq('channelId', where.channelId)
    
    // Filtro por Etiqueta (Tag)
    if (where.tagId) {
      const { data: tagConvs } = await supabaseAdmin
        .from('ConversationTag')
        .select('conversationId')
        .eq('tagId', where.tagId);
      
      const conversationIds = tagConvs?.map(tc => tc.conversationId) || [];
      query = query.in('id', conversationIds);
    }

    // Filtro de Segurança / RBAC
    if (where.allowedChannelIds) {
      query = query.in('channelId', where.allowedChannelIds)
      
      if (where.currentUserId) {
        query = query.or(`assignedTo.eq.${where.currentUserId},assignedTo.is.null`)
      }
    }

    const { data, error } = await query
    if (error) throw error

    if (data && data.length > 0) {
      console.log(`[UNREAD_DEBUG] Repositório retornou ${data.length} conversas. Primeira unreadCount: ${data[0].unreadCount}`);
      if (data[0].unreadCount === undefined) {
        console.warn(`[UNREAD_DEBUG] ALERTA: A coluna 'unreadCount' retornou UNDEFINED. Talvez o schema cache do Supabase ainda não tenha atualizado.`);
      }
    }

    return data
  }

  static async findById(id: string) {
    const { data, error } = await supabaseAdmin
      .from('Conversation')
      .select(`
        *,
        contact:Contact(*),
        channel:Channel(*),
        agent:User(*),
        tags:ConversationTag(*, tag:Tag(*))
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  static async create(data: any) {
    const { data: newConversation, error } = await supabaseAdmin
      .from('Conversation')
      .insert([{ id: generateId(), ...data }])
      .select(`
        *,
        contact:Contact(*),
        channel:Channel(*),
        agent:User(*)
      `)
      .single()

    if (error) throw error
    return newConversation
  }

  static async update(id: string, data: any) {
    const { data: updatedConversation, error } = await supabaseAdmin
      .from('Conversation')
      .update(data)
      .eq('id', id)
      .select(`
        *,
        contact:Contact(*),
        channel:Channel(*),
        agent:User(*)
      `)
      .single()

    if (error) throw error
    return updatedConversation
  }

  static async findActive(contactId: string, channelId: string) {
    const { data: conversation, error } = await supabaseAdmin
      .from('Conversation')
      .select(`
        *,
        contact:Contact(*),
        channel:Channel(*),
        agent:User(*),
        tags:ConversationTag(*, tag:Tag(*))
      `)
      .eq('contactId', contactId)
      .eq('channelId', channelId)
      .in('status', ['OPEN', 'IN_PROGRESS'])
      .order('lastMessageAt', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return conversation
  }

  static async delete(id: string) {
    // 1. Limpeza manual de tabelas relacionadas para evitar erros de FK se o CASCADE não estiver ativo
    await supabaseAdmin.from('Message').delete().eq('conversationId', id)
    await supabaseAdmin.from('ConversationTag').delete().eq('conversationId', id)
    await supabaseAdmin.from('ConversationFunnel').delete().eq('conversationId', id)
    await supabaseAdmin.from('InternalNote').delete().eq('conversationId', id)

    // 2. Exclusão da conversa
    const { error } = await supabaseAdmin
      .from('Conversation')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  }
}
