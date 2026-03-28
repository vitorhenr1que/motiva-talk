import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class FunnelRepository {
  /**
   * Lista todas as etapas do funil ordenadas
   */
  static async listStages() {
    const { data, error } = await supabaseAdmin
      .from('FunnelStage')
      .select('*')
      .order('order', { ascending: true })
    
    if (error) throw error
    return data
  }

  /**
   * Cria uma nova etapa no funil
   */
  static async createStage(data: any) {
    const { data: stage, error } = await supabaseAdmin
      .from('FunnelStage')
      .insert([{ id: generateId(), ...data }])
      .select()
      .single()
    
    if (error) throw error
    return stage
  }

  /**
   * Atualiza uma etapa existente
   */
  static async updateStage(id: string, data: any) {
    const { data: stage, error } = await supabaseAdmin
      .from('FunnelStage')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return stage
  }

  /**
   * Remove uma etapa do funil
   */
  static async deleteStage(id: string) {
    const { error } = await supabaseAdmin
      .from('FunnelStage')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    return { success: true }
  }

  /**
   * Busca o estado do funil para uma conversa específica
   */
  static async getConversationFunnel(conversationId: string) {
    const { data, error } = await supabaseAdmin
      .from('ConversationFunnel')
      .select('*, stage:FunnelStage(*)')
      .eq('conversationId', conversationId)
    
    if (error) throw error
    return data
  }

  /**
   * Define uma etapa para uma conversa.
   * Regra: Se for tipo 'STEP', remove etapas 'STEP' anteriores. 
   * Se for 'SELECT', apenas insere/atualiza.
   */
  static async setConversationStage(conversationId: string, stageId: string, value: string | null, rank: number | null = null) {
    // 1. Verificar tipo da etapa
    const { data: stage } = await supabaseAdmin
      .from('FunnelStage')
      .select('type')
      .eq('id', stageId)
      .single()

    if (!stage) throw new Error('Etapa não encontrada')

    if (stage.type === 'STEP') {
      // Remover outros 'STEP' da mesma conversa
      const { data: otherSteps } = await supabaseAdmin
        .from('FunnelStage')
        .select('id')
        .eq('type', 'STEP')

      const stepIds = otherSteps?.map(s => s.id) || []
      
      await supabaseAdmin
        .from('ConversationFunnel')
        .delete()
        .eq('conversationId', conversationId)
        .in('stageId', stepIds)
    }

    // 2. Calcular Rank (se não fornecido, coloca no FINAL da coluna)
    let calculatedRank = rank;
    if (!calculatedRank) {
       const { data: maxRankData } = await supabaseAdmin
          .from('ConversationFunnel')
          .select('rank')
          .eq('stageId', stageId)
          .order('rank', { ascending: false })
          .limit(1)
          .maybeSingle();
       
       calculatedRank = maxRankData ? (maxRankData.rank || 0) + 1000.0 : 1000.0;
    }

    // 3. Upsert da etapa atual
    const { data, error } = await supabaseAdmin
      .from('ConversationFunnel')
      .upsert({
        id: generateId(),
        conversationId,
        stageId,
        value,
        rank: calculatedRank,
        completedAt: new Date().toISOString()
      }, { onConflict: 'conversationId,stageId' })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Remove uma etapa específica de uma conversa (desmarcar)
   */
  static async removeConversationStage(conversationId: string, stageId: string) {
    const { error } = await supabaseAdmin
      .from('ConversationFunnel')
      .delete()
      .eq('conversationId', conversationId)
      .eq('stageId', stageId)
    
    if (error) throw error
    return { success: true }
  }

  /**
   * Busca dados formatados para o Kanban
   */
  static async getKanbanData(startDate?: string, endDate?: string) {
    let query = supabaseAdmin
      .from('ConversationFunnel')
      .select(`
        id,
        value,
        completedAt,
        stageId,
        rank,
        stage:FunnelStage(*),
        conversation:Conversation(
          id,
          status,
          pinnedNote,
          channelId,
          contact:Contact(*),
          tags:ConversationTag(*, tag:Tag(*))
        )
      `)
      .order('rank', { ascending: true })
      .order('completedAt', { ascending: false })

    if (startDate) {
      query = query.gte('completedAt', startDate)
    }
    if (endDate) {
      query = query.lte('completedAt', endDate)
    }

    const { data, error } = await query
    if (error) throw error

    // Filtrar apenas se tiver conversation (pode haver inconsistência se remover conversa)
    return (data || []).filter((item: any) => item.conversation && item.conversation.contact);
  }
}
