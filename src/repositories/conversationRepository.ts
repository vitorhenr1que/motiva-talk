import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class ConversationRepository {
  static async findMany(where: any) {
    const limit = where.limit || 15

    let query = supabaseAdmin
      .from('Conversation')
      .select(`
        id,
        status,
        unreadCount,
        lastMessageAt,
        createdAt,
        pinnedAt,
        contactId,
        channelId,
        lastMessagePreview,
        finalizedAt,
        updatedAt,
        contact:Contact(id, name, phone, profilePictureUrl),
        channel:Channel(id, name, allowAgentNameEdit),
        tags:ConversationTag(tag:Tag(id, name, color, emoji))
      `)
      .limit(limit)

    // Cursor Pagination Logic
    if (where.cursor) {
      const { value, id, pinnedAt } = where.cursor;
      const cursorField = 'lastMessageAt';

      if (where.status === 'CLOSED') {
        // Aba Finalizadas (apenas lastMessageAt e id)
        query = query.or(`${cursorField}.lt.${value},and(${cursorField}.eq.${value},id.lt.${id})`);
      } else {
        // Abas Não Lidas / Atendimento (PinnedAt, lastMessageAt, id)
        if (pinnedAt) {
          query = query.or(
            `pinnedAt.lt.${pinnedAt},` +
            `and(pinnedAt.eq.${pinnedAt},lastMessageAt.lt.${value}),` +
            `and(pinnedAt.eq.${pinnedAt},lastMessageAt.eq.${value},id.lt.${id}),` +
            `pinnedAt.is.null`
          );
        } else {
          // Já estamos na seção de não-pinadas
          query = query.filter('pinnedAt', 'is', 'null')
                       .or(`lastMessageAt.lt.${value},and(lastMessageAt.eq.${value},id.lt.${id})`);
        }
      }
    }

    // Ordenação dinâmica (Importante: Deve ser a mesma lógica do cursor)
    if (where.status === 'CLOSED') {
      query = query.order('lastMessageAt', { ascending: false, nullsFirst: false })
                   .order('id', { ascending: false });
    } else {
      query = query
        .order('pinnedAt', { ascending: false, nullsFirst: false })
        .order('lastMessageAt', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false });
    }

    // 1. Filtro de Status e Segurança (RBAC) combinados
    if (where.status) {
      if (where.allowedChannelIds && where.currentUserId) {
        // Se for atendente, filtramos por canal E (atribuído a mim ou sem dono) dentro do status
        query = query.eq('status', where.status)
                     .in('channelId', where.allowedChannelIds)
                     .or(`assignedTo.eq.${where.currentUserId},assignedTo.is.null`);
      } else if (where.allowedChannelIds) {
        // Se for supervisor com canais limitados
        query = query.eq('status', where.status)
                     .in('channelId', where.allowedChannelIds);
      } else {
        // Admin ou sem restrição RBAC
        query = query.eq('status', where.status);
      }
    }

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

    // Filtro por termo de busca (Nome ou Telefone do Contato)
    if (where.search) {
      const { data: contacts } = await supabaseAdmin
        .from('Contact')
        .select('id')
        .or(`name.ilike.%${where.search}%,phone.ilike.%${where.search}%`);
      
      const contactIds = contacts?.map(c => c.id) || [];
      query = query.in('contactId', contactIds);
    }

    const { data, error } = await query
    if (error) throw error

    return data
  }

  static async countByStatus(where: any) {
    const statuses = ['OPEN', 'IN_PROGRESS', 'CLOSED'];
    const counts: any = { OPEN: 0, IN_PROGRESS: 0, CLOSED: 0 };

    for (const status of statuses) {
      let query = supabaseAdmin
        .from('Conversation')
        .select('*', { count: 'exact', head: true })
        .eq('status', status);

      if (where.channelId) query = query.eq('channelId', where.channelId);
      
      if (where.tagId) {
        const { data: tagConvs } = await supabaseAdmin
          .from('ConversationTag')
          .select('conversationId')
          .eq('tagId', where.tagId);
        const conversationIds = tagConvs?.map(tc => tc.conversationId) || [];
        query = query.in('id', conversationIds);
      }

      if (where.search) {
        const { data: contacts } = await supabaseAdmin
          .from('Contact')
          .select('id')
          .or(`name.ilike.%${where.search}%,phone.ilike.%${where.search}%`);
        
        const contactIds = contacts?.map(c => c.id) || [];
        query = query.in('contactId', contactIds);
      }

      if (where.allowedChannelIds) {
        query = query.in('channelId', where.allowedChannelIds);
        if (where.currentUserId) {
          query = query.or(`assignedTo.eq.${where.currentUserId},assignedTo.is.null`);
        }
      }

      const { count, error } = await query;
      if (!error) counts[status] = count || 0;
    }

    return counts;
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
