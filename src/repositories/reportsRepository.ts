import { supabaseAdmin } from '@/lib/supabase-admin'

export interface ReportsFilter {
  startDate?: string;
  endDate?: string;
  stageIds?: string[]; // IDs das etapas principais (STEP)
  tagIds?: string[];   // IDs das etiquetas
  fieldFilters?: {
    stageId: string;
    values: string[];
  }[];
}

export class ReportsRepository {
  /**
   * Busca métricas agregadas baseadas nos filtros fornecidos.
   * Garante que cada lead apareça apenas uma vez e atenda a TODOS os filtros.
   */
  static async getMetrics(filters: ReportsFilter) {
    // 1. Buscar dados brutos do Funil
    // NOTA: Buscamos todas as etapas concluídas no período para capturar leads ativos
    let query = supabaseAdmin
      .from('ConversationFunnel')
      .select(`
        conversationId,
        value,
        completedAt,
        stageId,
        stage:FunnelStage(*),
        conversation:Conversation(
          id,
          status,
          createdAt,
          contact:Contact(*),
          tags:ConversationTag(tagId, tag:Tag(*))
        )
      `)
      .order('completedAt', { ascending: false });

    if (filters.startDate) {
      query = query.gte('completedAt', `${filters.startDate}T00:00:00`);
    }
    if (filters.endDate) {
      query = query.lte('completedAt', `${filters.endDate}T23:59:59`);
    }

    const { data: rawData, error } = await query;
    if (error) throw error;

    // 2. Agrupar dados por Lead (ConversationId)
    const leadsMap = new Map<string, any>();

    (rawData || []).forEach((item: any) => {
      if (!item.conversation || !item.conversation.contact) return;
      
      const convId = item.conversationId;
      if (!leadsMap.has(convId)) {
        leadsMap.set(convId, {
          id: convId,
          createdAt: item.conversation.createdAt,
          contact: item.conversation.contact,
          tags: item.conversation.tags?.map((t: any) => ({ id: t.tagId, ...t.tag })) || [],
          stages: {}, // Mapeia stageId -> value
          lastInteraction: item.completedAt,
          currentStageName: 'Nenhuma' // Será definido pela etapa mais recente ou de ordem maior
        });
      }

      const lead = leadsMap.get(convId);
      lead.stages[item.stageId] = item.value || true;
      
      // Atualizar etapa atual baseada na ordem se for uma etapa principal (STEP)
      if (item.stage?.type === 'STEP') {
        if (!lead.currentStageOrder || item.stage.order > lead.currentStageOrder) {
          lead.currentStageOrder = item.stage.order;
          lead.currentStageName = item.stage.name;
        }
      }
    });

    const allLeads = Array.from(leadsMap.values());

    // 3. Aplicar Filtros com lógica "E" (AND) entre categorias e "OU" (OR) dentro da categoria
    let filteredLeads = allLeads.filter(lead => {
      // Filtro de Tags ( must have AT LEAST ONE of selected tags)
      if (filters.tagIds && filters.tagIds.length > 0) {
        const hasTag = lead.tags.some((t: any) => filters.tagIds!.includes(t.id));
        if (!hasTag) return false;
      }

      // Filtro de Etapa Principal ( must be AT one of these stages )
      if (filters.stageIds && filters.stageIds.length > 0) {
        const hasStage = filters.stageIds!.some(sid => lead.stages[sid]);
        if (!hasStage) return false;
      }

      // Filtros de Campos Específicos ( must satisfy ALL field groups )
      if (filters.fieldFilters && filters.fieldFilters.length > 0) {
        const matchesAllFields = filters.fieldFilters.every(ff => {
          const leadValue = lead.stages[ff.stageId];
          // Se o lead não tem essa etapa concluída ou o valor não está entre os selecionados
          return leadValue && ff.values.includes(leadValue);
        });
        if (!matchesAllFields) return false;
      }

      return true;
    });

    // 4. Calcular Métricas sobre os Leads Filtrados
    const totalLeads = filteredLeads.length;
    
    const stepStagesRaw = (rawData || [])
      .filter(r => {
        const stage = r.stage;
        const type = Array.isArray(stage) ? stage[0]?.type : (stage as any)?.type;
        return type === 'STEP';
      })
      .map(r => {
        const stage = r.stage;
        return Array.isArray(stage) ? stage[0]?.order : (stage as any)?.order;
      });
    const minStepOrder = stepStagesRaw.length > 0 ? Math.min(...stepStagesRaw) : 0;

    // Leads que avançaram além da etapa inicial
    const retainedLeadsCount = filteredLeads.filter(lead => 
      lead.currentStageOrder > minStepOrder
    ).length;

    const funnelRetention = totalLeads > 0 ? (retainedLeadsCount / totalLeads) * 100 : 0;

    // Contagem por Etapa Atual
    const stagesCount: Record<string, number> = {};
    filteredLeads.forEach(lead => {
      stagesCount[lead.currentStageName] = (stagesCount[lead.currentStageName] || 0) + 1;
    });

    // Contagem de Matrículas (Leads que possuem a etapa "Matrícula realizada")
    const enrolledLeads = filteredLeads.filter(lead => 
      Object.keys(lead.stages).some(sid => {
        const row = rawData?.find(r => r.stageId === sid);
        const stage = row?.stage;
        const stageName = Array.isArray(stage) ? stage[0]?.name : (stage as any)?.name;
        return stageName === 'Matrícula realizada';
      })
    ).length;

    const conversionRate = totalLeads > 0 ? (enrolledLeads / totalLeads) * 100 : 0;

    // Contagem de Cursos (stage_2)
    const coursesCount: Record<string, number> = {};
    filteredLeads.forEach(lead => {
      const courseValue = lead.stages['stage_2'];
      if (typeof courseValue === 'string') {
        coursesCount[courseValue] = (coursesCount[courseValue] || 0) + 1;
      }
    });

    return {
      summary: {
        totalLeads,
        enrolledLeads,
        conversionRate,
        funnelRetention,
      },
      stages: Object.entries(stagesCount).map(([name, count]) => ({ name, count })),
      courses: Object.entries(coursesCount).map(([name, count]) => ({ name, count })),
      leads: filteredLeads.slice(0, 50).map(lead => ({
        id: lead.id,
        contactName: lead.contact.name,
        contactPhone: lead.contact.phone,
        stage: lead.currentStageName,
        value: lead.stages['stage_2'] || lead.stages['stage_4'] || '--',
        completedAt: lead.lastInteraction,
        tags: lead.tags
      }))
    };
  }
}
