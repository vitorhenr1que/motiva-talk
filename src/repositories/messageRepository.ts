import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class MessageRepository {
  static async findMany(organizationId: string, where: {
    conversationId?: string;
    before?: string;
    limit?: number;
    allowedSectorIds?: string[];
    /** Lower bound (inclusive) baseado no enteredAt do tenure */
    afterCreatedAt?: string;
    /** Upper bound (exclusivo) baseado no leftAt do tenure */
    untilCreatedAt?: string;
  }) {
    // OTIMIZAÇÃO: SELECT explícito (a tabela Message tem ~30 colunas).
    // Removidos: scheduledAt, sentAt, isScheduled, cancelOnReply, transferredToChannelId
    // (usados apenas em fluxos específicos, não no chat principal).
    let query = supabaseAdmin
      .from('Message')
      .select(`
        id, conversationId, channelId, sectorId, senderType, content, type,
        createdAt, externalMessageId, replyToMessageId,
        deletedForMe, deletedForEveryone, isInternal, isForwarded, forwardedFromMessageId,
        mediaUrl, fileName, mimeType, fileSize, thumbnailUrl, duration,
        metadata, reactions, sendStatus, errorMessage,
        replyToMessage:replyToMessageId (
          id,
          content,
          senderType,
          type,
          externalMessageId
        ),
        sector:Sector(id, name)
      `)
      .eq('organizationId', organizationId)

    if (where.conversationId) query = query.eq('conversationId', where.conversationId);

    // Range do tenure: limita as mensagens ao período em que aquele setor cuidou da conversa.
    if (where.afterCreatedAt) query = query.gte('createdAt', where.afterCreatedAt);
    if (where.untilCreatedAt) query = query.lt('createdAt', where.untilCreatedAt);

    if (where.allowedSectorIds && where.allowedSectorIds.length > 0) {
       // Filtra para mostrar apenas as mensagens do setor permitido OU mensagens enviadas sem setor
       query = query.or(`sectorId.in.(${where.allowedSectorIds.join(',')}),sectorId.is.null`);
    }

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

  static async findAllByConversation(conversationId: string, organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('Message')
      .select('*')
      .eq('conversationId', conversationId)
      .eq('organizationId', organizationId);
    
    if (error) throw error;
    return data;
  }

  static async findMediaByConversation(conversationId: string, organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('Message')
      .select('id, mediaUrl, thumbnailUrl')
      .eq('conversationId', conversationId)
      .eq('organizationId', organizationId);

    if (error) throw error;
    return data;
  }

  static async countByConversation(conversationId: string, organizationId: string) {
    const { count, error } = await supabaseAdmin
      .from('Message')
      .select('id', { count: 'exact', head: true })
      .eq('conversationId', conversationId)
      .eq('organizationId', organizationId);

    if (error) throw error;
    return count ?? 0;
  }

  static async findById(id: string, organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('Message')
      .select('*')
      .eq('id', id)
      .eq('organizationId', organizationId)
      .single()
    if (error) throw error
    return data
  }

  static async create(organizationId: string, data: any) {
    const { data: newMessage, error } = await supabaseAdmin
      .from('Message')
      .insert([{ id: generateId(), ...data, organizationId }])
      .select('*, replyToMessage:replyToMessageId(*)')
      .single()
    if (error) throw error
    return newMessage
  }

  /**
   * Atualiza uma mensagem pelo ID
   */
  static async update(id: string, organizationId: string, data: any) {
    const { data: updated, error } = await supabaseAdmin
      .from('Message')
      .update(data)
      .eq('id', id)
      .eq('organizationId', organizationId)
      .select()
      .single()
    
    if (error) throw error
    return updated
  }

  static async delete(id: string, organizationId: string) {
    const { error } = await supabaseAdmin
      .from('Message')
      .delete()
      .eq('id', id)
      .eq('organizationId', organizationId)
    if (error) throw error
    return { success: true }
  }

  static async findLastByConversation(conversationId: string, organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('Message')
      .select('*')
      .eq('conversationId', conversationId)
      .eq('organizationId', organizationId)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data
  }

  static async search(
    organizationId: string,
    conversationId: string,
    queryText: string,
    range?: { afterCreatedAt?: string; untilCreatedAt?: string }
  ) {
    let query = supabaseAdmin
      .from('Message')
      .select('id, content, createdAt, senderType, conversationId, deletedForEveryone')
      .eq('organizationId', organizationId)
      .eq('conversationId', conversationId)
      .ilike('content', `%${queryText}%`);

    if (range?.afterCreatedAt) query = query.gte('createdAt', range.afterCreatedAt);
    if (range?.untilCreatedAt) query = query.lt('createdAt', range.untilCreatedAt);

    const { data, error } = await query
      .order('createdAt', { ascending: false })
      .limit(50);

    if (error) throw error
    return data
  }

  /**
   * Busca mensagens agendadas que já deveriam ter sido enviadas
   */
  static async findScheduledReady(organizationId: string, limit: number = 10) {
    const { data, error } = await supabaseAdmin
      .from('Message')
      .select(`
        id, conversationId, channelId, content, type, mediaUrl, fileName,
        mimeType, fileSize, thumbnailUrl, duration, metadata, replyToMessageId,
        replyToMessage:replyToMessageId(externalMessageId)
      `)
      .eq('organizationId', organizationId)
      .eq('sendStatus', 'scheduled')
      .lte('scheduledAt', new Date().toISOString())
      .order('scheduledAt', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data;
  }
}
