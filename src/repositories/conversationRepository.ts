import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'
import type { Channel } from '@/types/chat'

type MessagingConversation = {
  id: string;
  channelId: string;
  contactId: string;
  status: string;
  currentSectorId: string | null;
  conversationWindowStartedAt: string | null;
  contact: { id: string; name: string; phone: string } | null;
  channel: Channel | null;
}

export class ConversationRepository {
  private static async findHistoricalIdsViaRpc(organizationId: string, where: any, limit: number) {
    if (where.tagId || where.search || where.assignedTo || where.startDate || where.endDate || where.currentUserId) {
      return null;
    }
    if (where.allowedChannelIds && where.allowedChannelIds.length === 0) return [];

    const { data, error } = await supabaseAdmin.rpc('list_historical_conversation_ids', {
      p_organization_id: organizationId,
      p_sector_id: where.sectorId,
      p_channel_id: where.channelId || null,
      p_allowed_channel_ids: where.allowedChannelIds?.length ? where.allowedChannelIds : null,
      p_limit: limit,
      p_cursor_last_message_at: where.cursor?.value || null,
      p_cursor_id: where.cursor?.id || null,
      p_cursor_pinned_at: where.cursor?.pinnedAt || null,
    });

    if (error) {
      if (error.code !== 'PGRST202') {
        console.warn('[CONVERSA] list_historical_conversation_ids indisponível, usando fallback:', error.message);
      }
      return null;
    }

    return ((data || []) as Array<{ id: string }>).map((row) => row.id);
  }

  static async findMany(organizationId: string, where: any) {
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
        currentSectorId,
        finalizedBySectorId,
        lastMessagePreview,
        finalizedAt,
        conversationWindowStartedAt,
        updatedAt,
        contact:Contact(id, name, phone, profilePictureUrl),
        channel:Channel(id, name, allowAgentNameEdit, whatsappProvider),
        sector:Sector!Conversation_currentSectorId_fkey(id, name),
        tags:ConversationTag(tag:Tag(id, name, color, emoji))
      `)
      .eq('organizationId', organizationId)
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
        const channelsAllSectors = where.channelsWithAllSectorsAccess || [];
        const channelsRestricted = where.allowedChannelIds.filter((id: string) => !channelsAllSectors.includes(id));
        const conditions = [];
        
        // Condição 1: Canais com acesso total a setores (Atribuído a mim ou Sem Dono)
        if (channelsAllSectors.length > 0) {
          conditions.push(`and(channelId.in.(${channelsAllSectors.join(',')}),or(assignedTo.eq.${where.currentUserId},assignedTo.is.null))`);
        }

        // Condição 2: Canais restritos (Setores permitidos E (Atribuído a mim ou Sem Dono))
        if (channelsRestricted.length > 0) {
          const sectorFilter = where.allowedSectorIds && where.allowedSectorIds.length > 0
            ? `or(currentSectorId.in.(${where.allowedSectorIds.join(',')}),currentSectorId.is.null)`
            : 'currentSectorId.is.null';
          
          conditions.push(`and(channelId.in.(${channelsRestricted.join(',')}),or(assignedTo.eq.${where.currentUserId},assignedTo.is.null),${sectorFilter})`);
        }

        if (conditions.length > 0) {
          query = query.eq('status', where.status).or(conditions.join(','));
        } else {
          query = query.eq('status', where.status).is('id', 'null');
        }
      } else if (where.allowedChannelIds) {
        // Se for supervisor com canais limitados
        query = query.eq('status', where.status)
                     .in('channelId', where.allowedChannelIds);
      } else {
        // Admin ou sem restrição RBAC
        query = query.eq('status', where.status);
      }
    }

    if (where.assignedTo) {
      if (where.assignedTo === 'UNASSIGNED') {
        query = query.is('assignedTo', null);
      } else {
        query = query.eq('assignedTo', where.assignedTo);
      }
    }
    if (where.channelId) query = query.eq('channelId', where.channelId);
    
    // Filtros de Setor:
    // - Padrão: visibilidade ESTRITA por currentSectorId (fila ativa).
    // - historical=true: apenas conversas com tenure passado naquele setor (leftAt IS NOT NULL),
    //   excluindo as que ainda estão na fila ativa do setor (currentSectorId !== sectorId).
    if (where.sectorId) {
      if (where.sectorId === 'UNASSIGNED') {
        query = query.is('currentSectorId', null);
      } else if (where.historical) {
        const rpcIds = await this.findHistoricalIdsViaRpc(organizationId, where, limit);
        let pastIds = rpcIds;
        if (pastIds === null) {
          const { data: pastRows } = await supabaseAdmin
            .from('ConversationSectorHistory')
            .select('conversationId')
            .eq('organizationId', organizationId)
            .eq('sectorId', where.sectorId)
            .not('leftAt', 'is', null);
          pastIds = Array.from(new Set((pastRows || []).map((r: any) => r.conversationId)));
        }
        if (pastIds.length === 0) return [];
        query = query.in('id', pastIds).neq('currentSectorId', where.sectorId);
      } else if (where.status === 'CLOSED') {
        // Aba Finalizadas: filtro pelo setor que finalizou
        query = query.eq('finalizedBySectorId', where.sectorId);
      } else {
        query = query.eq('currentSectorId', where.sectorId);
      }
    }
    
    if (where.startDate) {
      query = query.gte('createdAt', where.startDate);
    }
    if (where.endDate) {
      query = query.lte('createdAt', where.endDate);
    }
    
    // Filtro por Etiqueta (Tag)
    if (where.tagId) {
      const { data: tagConvs } = await supabaseAdmin
        .from('ConversationTag')
        .select('conversationId')
        .eq('organizationId', organizationId)
        .eq('tagId', where.tagId);
      
      const conversationIds = tagConvs?.map(tc => tc.conversationId) || [];
      query = query.in('id', conversationIds);
    }

    // Filtro por termo de busca (Nome ou Telefone do Contato)
    if (where.search) {
      const { data: contacts } = await supabaseAdmin
        .from('Contact')
        .select('id')
        .eq('organizationId', organizationId)
        .or(`name.ilike.%${where.search}%,phone.ilike.%${where.search}%`);
      
      const contactIds = contacts?.map(c => c.id) || [];
      query = query.in('contactId', contactIds);
    }

    const { data, error } = await query
    if (error) throw error

    return data
  }

  /**
   * Conta conversas com tenures PASSADOS no setor selecionado (aba "Histórico"),
   * excluindo as que ainda estão na fila ativa daquele setor.
   * Retorna 0 quando não há sectorId específico ou for UNASSIGNED.
   *
   * Implementação via RPC com EXISTS correlacionado (Fase 4) — evita transportar
   * o array completo de IDs do ConversationSectorHistory para o cliente.
   */
  static async countHistorical(organizationId: string, where: any): Promise<number> {
    if (!where.sectorId || where.sectorId === 'UNASSIGNED') return 0;
    if (where.allowedChannelIds && where.allowedChannelIds.length === 0) return 0;

    const { data: rpcCount, error: rpcError } = await supabaseAdmin.rpc('count_historical_conversations', {
      p_organization_id: organizationId,
      p_sector_id: where.sectorId,
      p_channel_id: where.channelId || null,
      p_allowed_channel_ids: where.allowedChannelIds?.length ? where.allowedChannelIds : null,
    });

    if (!rpcError && rpcCount !== null && rpcCount !== undefined) {
      return Number(rpcCount) || 0;
    }

    if (rpcError && rpcError.code !== 'PGRST202') {
      console.warn('[CONVERSA] count_historical_conversations indisponível, usando fallback:', rpcError.message);
    }

    const { data: pastRows, error: pastError } = await supabaseAdmin
      .from('ConversationSectorHistory')
      .select('conversationId')
      .eq('organizationId', organizationId)
      .eq('sectorId', where.sectorId)
      .not('leftAt', 'is', null);

    if (pastError) {
      console.error('[CONVERSA] countHistorical lookup falhou:', pastError);
      return 0;
    }
    const pastIds = Array.from(new Set((pastRows || []).map((r: any) => r.conversationId)));
    if (pastIds.length === 0) return 0;

    let q = supabaseAdmin
      .from('Conversation')
      .select('id', { count: 'exact', head: true })
      .eq('organizationId', organizationId)
      .in('id', pastIds)
      .neq('currentSectorId', where.sectorId);

    if (where.channelId) q = q.eq('channelId', where.channelId);
    if (where.allowedChannelIds && where.allowedChannelIds.length > 0) {
      q = q.in('channelId', where.allowedChannelIds);
    }

    const { count, error } = await q;
    if (error) {
      console.error('[CONVERSA] countHistorical count falhou:', error);
      return 0;
    }
    return count || 0;
  }

  /**
   * Lê contagens de OPEN/IN_PROGRESS/CLOSED a partir da tabela materializada
   * "ConversationCount" (Fase 1). Retorna null quando há filtros que a materializada
   * não consegue cobrir — neste caso o caller deve usar countByStatus como fallback.
   *
   * Suportado: channelId, sectorId (incl. UNASSIGNED), allowedChannelIds (modo supervisor).
   * Fallback: tagId, search, assignedTo, currentUserId (modo agente — assignedTo é dinâmico).
   *
   * Caso especial: quando sectorId específico é passado, a contagem CLOSED da
   * materializada é por currentSectorId. O original usa finalizedBySectorId nesse
   * status, então a contagem CLOSED é refeita via SELECT count direto.
   */
  static async countFromMaterialized(organizationId: string, where: any): Promise<{ OPEN: number; IN_PROGRESS: number; CLOSED: number } | null> {
    if (where.tagId || where.search || where.assignedTo) return null;
    if (where.currentUserId) return null;

    if (where.allowedChannelIds && where.allowedChannelIds.length === 0) {
      return { OPEN: 0, IN_PROGRESS: 0, CLOSED: 0 };
    }

    let q = supabaseAdmin
      .from('ConversationCount')
      .select('channelId, sectorId, status, count')
      .eq('organizationId', organizationId);

    if (where.channelId) q = q.eq('channelId', where.channelId);
    if (where.allowedChannelIds && where.allowedChannelIds.length > 0) {
      q = q.in('channelId', where.allowedChannelIds);
    }
    if (where.sectorId === 'UNASSIGNED') {
      q = q.is('sectorId', null);
    } else if (where.sectorId) {
      q = q.eq('sectorId', where.sectorId);
    }

    const { data, error } = await q;
    if (error) {
      console.error('[CONVERSA] countFromMaterialized falhou:', error);
      return null;
    }

    const counts = { OPEN: 0, IN_PROGRESS: 0, CLOSED: 0 };
    for (const row of (data || []) as Array<{ status: string; count: number }>) {
      if (row.status === 'OPEN') counts.OPEN += row.count;
      else if (row.status === 'IN_PROGRESS') counts.IN_PROGRESS += row.count;
      else if (row.status === 'CLOSED') counts.CLOSED += row.count;
    }

    // CLOSED com sectorId específico precisa usar finalizedBySectorId — sobrescreve.
    if (where.sectorId && where.sectorId !== 'UNASSIGNED') {
      let cq = supabaseAdmin
        .from('Conversation')
        .select('id', { count: 'exact', head: true })
        .eq('organizationId', organizationId)
        .eq('status', 'CLOSED')
        .eq('finalizedBySectorId', where.sectorId);
      if (where.channelId) cq = cq.eq('channelId', where.channelId);
      if (where.allowedChannelIds && where.allowedChannelIds.length > 0) {
        cq = cq.in('channelId', where.allowedChannelIds);
      }
      const { count: closedCount, error: cerr } = await cq;
      if (cerr) {
        console.error('[CONVERSA] countFromMaterialized CLOSED override falhou:', cerr);
        return null;
      }
      counts.CLOSED = closedCount || 0;
    }

    return counts;
  }

  static async countByStatus(organizationId: string, where: any) {
    // OTIMIZAÇÃO: pré-busca de sub-queries (tagId, search, historical) UMA vez só.
    // Antes: cada status (3 vezes) refazia o mesmo lookup de tags/contatos → 6+ round-trips.
    // Agora: 1 lookup compartilhado + 3 contagens em paralelo.

    let tagFilterIds: string[] | null = null;
    if (where.tagId) {
      const { data: tagConvs } = await supabaseAdmin
        .from('ConversationTag')
        .select('conversationId')
        .eq('organizationId', organizationId)
        .eq('tagId', where.tagId);
      tagFilterIds = tagConvs?.map(tc => tc.conversationId) || [];
    }

    let searchFilterIds: string[] | null = null;
    if (where.search) {
      const { data: contacts } = await supabaseAdmin
        .from('Contact')
        .select('id')
        .eq('organizationId', organizationId)
        .or(`name.ilike.%${where.search}%,phone.ilike.%${where.search}%`);
      searchFilterIds = contacts?.map(c => c.id) || [];
    }

    const buildBase = (status: string) => {
      let q = supabaseAdmin
        .from('Conversation')
        .select('id', { count: 'exact', head: true })
        .eq('organizationId', organizationId)
        .eq('status', status);

      if (where.channelId) q = q.eq('channelId', where.channelId);
      if (tagFilterIds !== null) q = q.in('id', tagFilterIds);
      if (searchFilterIds !== null) q = q.in('contactId', searchFilterIds);

      if (where.sectorId) {
        if (where.sectorId === 'UNASSIGNED') {
          q = q.is('currentSectorId', null);
        } else if (status === 'CLOSED') {
          q = q.eq('finalizedBySectorId', where.sectorId);
        } else {
          q = q.eq('currentSectorId', where.sectorId);
        }
      }

      if (where.assignedTo) {
        if (where.assignedTo === 'UNASSIGNED') q = q.is('assignedTo', null);
        else q = q.eq('assignedTo', where.assignedTo);
      }

      if (where.allowedChannelIds) {
        if (where.currentUserId) {
          const channelsAllSectors = where.channelsWithAllSectorsAccess || [];
          const channelsRestricted = where.allowedChannelIds.filter((id: string) => !channelsAllSectors.includes(id));
          const conditions: string[] = [];

          if (channelsAllSectors.length > 0) {
            conditions.push(`and(channelId.in.(${channelsAllSectors.join(',')}),or(assignedTo.eq.${where.currentUserId},assignedTo.is.null))`);
          }
          if (channelsRestricted.length > 0) {
            const sectorFilter = where.allowedSectorIds && where.allowedSectorIds.length > 0
              ? `or(currentSectorId.in.(${where.allowedSectorIds.join(',')}),currentSectorId.is.null)`
              : 'currentSectorId.is.null';
            conditions.push(`and(channelId.in.(${channelsRestricted.join(',')}),or(assignedTo.eq.${where.currentUserId},assignedTo.is.null),${sectorFilter})`);
          }

          if (conditions.length > 0) q = q.or(conditions.join(','));
        } else {
          q = q.in('channelId', where.allowedChannelIds);
        }
      }
      return q;
    };

    const [openR, ipR, closedR] = await Promise.all([
      buildBase('OPEN'),
      buildBase('IN_PROGRESS'),
      buildBase('CLOSED')
    ]);

    return {
      OPEN: openR.error ? 0 : (openR.count || 0),
      IN_PROGRESS: ipR.error ? 0 : (ipR.count || 0),
      CLOSED: closedR.error ? 0 : (closedR.count || 0)
    };
  }

  static async findById(id: string, organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('Conversation')
      .select(`
        *,
        contact:Contact(*),
        channel:Channel(*),
        agent:User(*),
        sector:Sector!Conversation_currentSectorId_fkey(*),
        tags:ConversationTag(*, tag:Tag(*))
      `)
      .eq('id', id)
      .eq('organizationId', organizationId)
      .single()

    if (error) throw error
    return data
  }

  /**
   * Versão enxuta de findById (Fase 3) — usada apenas quando uma conversa NOVA
   * aparece via realtime e o cliente precisa popular contato/canal/setor/tags.
   * Não traz colunas raramente lidas pela sidebar (ex.: pinnedNote completo, internalNotes).
   */
  static async findByIdSlim(id: string, organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('Conversation')
      .select(`
        id, channelId, contactId, status, currentSectorId,
        finalizedBySectorId, pinnedAt, lastMessageAt, lastMessagePreview,
        unreadCount, assignedTo, createdAt, updatedAt, finalizedAt, conversationWindowStartedAt,
        contact:Contact(id, name, phone, profilePictureUrl),
        channel:Channel(id, name, allowAgentNameEdit, whatsappProvider),
        sector:Sector!Conversation_currentSectorId_fkey(id, name),
        tags:ConversationTag(tag:Tag(id, name, color, emoji))
      `)
      .eq('id', id)
      .eq('organizationId', organizationId)
      .single()

    if (error) throw error
    return data
  }

  static async findByIdForMessaging(id: string, organizationId: string): Promise<MessagingConversation> {
    const { data, error } = await supabaseAdmin
      .from('Conversation')
      .select(`
        id, channelId, contactId, status, currentSectorId, conversationWindowStartedAt,
        contact:Contact(id, name, phone),
        channel:Channel(*)
      `)
      .eq('id', id)
      .eq('organizationId', organizationId)
      .single()

    if (error) throw error
    return data as unknown as MessagingConversation
  }

  static async findExpiredActiveWindowIds(organizationId: string, limit = 25) {
    const expiresBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from('Conversation')
      .select('id')
      .eq('organizationId', organizationId)
      .in('status', ['OPEN', 'IN_PROGRESS'])
      .not('conversationWindowStartedAt', 'is', null)
      .lte('conversationWindowStartedAt', expiresBefore)
      .limit(limit);

    if (error) throw error;
    return (data || []).map((row: any) => row.id as string);
  }

  static async create(organizationId: string, data: any) {
    const { data: newConversation, error } = await supabaseAdmin
      .from('Conversation')
      .insert([{ id: generateId(), ...data, organizationId }])
      .select(`
        *,
        contact:Contact(*),
        channel:Channel(*),
        agent:User(*),
        sector:Sector!Conversation_currentSectorId_fkey(*)
      `)
      .single()

    if (error) throw error
    return newConversation
  }

  static async update(id: string, organizationId: string, data: any) {
    const { data: updatedConversation, error } = await supabaseAdmin
      .from('Conversation')
      .update(data)
      .eq('id', id)
      .eq('organizationId', organizationId)
      .select(`
        *,
        contact:Contact(*),
        channel:Channel(*),
        agent:User(*),
        sector:Sector!Conversation_currentSectorId_fkey(*)
      `)
      .single()

    if (error) throw error
    return updatedConversation
  }

  static async updateFields(id: string, organizationId: string, data: any) {
    const { error } = await supabaseAdmin
      .from('Conversation')
      .update(data)
      .eq('id', id)
      .eq('organizationId', organizationId)

    if (error) throw error
    return true
  }

  static async findActive(contactId: string, channelId: string, organizationId: string) {
    const { data: conversation, error } = await supabaseAdmin
      .from('Conversation')
      .select(`
        *,
        contact:Contact(*),
        channel:Channel(*),
        agent:User(*),
        sector:Sector!Conversation_currentSectorId_fkey(*),
        tags:ConversationTag(*, tag:Tag(*))
      `)
      .eq('organizationId', organizationId)
      .eq('contactId', contactId)
      .eq('channelId', channelId)
      .in('status', ['OPEN', 'IN_PROGRESS'])
      .order('lastMessageAt', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return conversation
  }

  static async delete(id: string, organizationId: string) {
    // 1. Limpeza manual de tabelas relacionadas para evitar erros de FK se o CASCADE não estiver ativo
    await supabaseAdmin.from('Message').delete().eq('conversationId', id).eq('organizationId', organizationId)
    await supabaseAdmin.from('ConversationTag').delete().eq('conversationId', id).eq('organizationId', organizationId)
    await supabaseAdmin.from('ConversationFunnel').delete().eq('conversationId', id).eq('organizationId', organizationId)
    await supabaseAdmin.from('InternalNote').delete().eq('conversationId', id).eq('organizationId', organizationId)

    // 2. Exclusão da conversa
    const { error } = await supabaseAdmin
      .from('Conversation')
      .delete()
      .eq('id', id)
      .eq('organizationId', organizationId)

    if (error) throw error
    return true
  }
}
