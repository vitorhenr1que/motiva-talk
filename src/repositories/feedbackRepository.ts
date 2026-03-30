import { supabaseAdmin } from '@/lib/supabase-admin'

export interface FeedbackData {
  conversationId?: string;
  contactId: string;
  contactPhone: string;
  agentId?: string | null;
  agentName?: string | null;
  score?: number;
  categoryOptions?: string[];
  comment?: string;
  token: string;
  status?: string;
  expiresAt: string;
  submittedAt?: string;
}

export class FeedbackRepository {
  static async create(data: FeedbackData) {
    const { data: feedback, error } = await supabaseAdmin
      .from('Feedback')
      .insert([data])
      .select()
      .single()

    if (error) throw error
    return feedback
  }

  static async findByToken(token: string) {
    const { data: feedback, error } = await supabaseAdmin
      .from('Feedback')
      .select(`
        *,
        conversation:Conversation(*, agent:User(*)),
        contact:Contact(*)
      `)
      .eq('token', token)
      .single()

    if (error && error.code === 'PGRST116') return null
    if (error) throw error
    return feedback
  }

  static async findLastByContact(contactId: string) {
    const { data: feedback, error } = await supabaseAdmin
      .from('Feedback')
      .select('*')
      .eq('contactId', contactId)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return feedback
  }

  static async update(id: string, data: Partial<FeedbackData>) {
    const { data: updated, error } = await supabaseAdmin
      .from('Feedback')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return updated
  }

  static async findLastSubmittedByContact(contactId: string, contactPhone?: string) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    let query = supabaseAdmin
      .from('Feedback')
      .select('*')
      .eq('status', 'SUBMITTED')
      .gte('submittedAt', yesterday);

    if (contactPhone) {
      query = query.or(`contactId.eq.${contactId},contactPhone.eq.${contactPhone}`);
    } else {
      query = query.eq('contactId', contactId);
    }

    const { data: feedback, error } = await query
      .order('submittedAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error
    return feedback
  }

  static async findAll(filters: { 
    startDate?: string, 
    endDate?: string, 
    minScore?: number, 
    maxScore?: number,
    agentId?: string | null
  }) {
    let query = supabaseAdmin
      .from('Feedback')
      .select(`
        *,
        contact:Contact(id, name, phone),
        conversation:Conversation(id, status, agent:User(id, name))
      `)
      .eq('status', 'SUBMITTED')
      .order('submittedAt', { ascending: false });

    if (filters.startDate) {
      query = query.gte('submittedAt', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('submittedAt', filters.endDate);
    }
    if (filters.minScore !== undefined) {
      query = query.gte('score', filters.minScore);
    }
    if (filters.maxScore !== undefined) {
      query = query.lte('score', filters.maxScore);
    }
    if (filters.agentId) {
      query = query.eq('agentId', filters.agentId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  static async getSummary(filters: { startDate?: string, endDate?: string, agentId?: string | null }) {
    let query = supabaseAdmin
      .from('Feedback')
      .select('score')
      .eq('status', 'SUBMITTED');

    if (filters.startDate) {
      query = query.gte('submittedAt', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('submittedAt', filters.endDate);
    }
    if (filters.agentId) {
      query = query.eq('agentId', filters.agentId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const total = data.length;
    const scores = data.map(f => f.score || 0);
    const average = total > 0 ? scores.reduce((a, b) => a + b, 0) / total : 0;
    
    const detractor = data.filter(f => (f.score || 0) <= 6).length;
    const neutral = data.filter(f => (f.score || 0) >= 7 && (f.score || 0) <= 8).length;
    const promoter = data.filter(f => (f.score || 0) >= 9).length;

    return {
      total,
      average,
      counts: {
        detractor,
        neutral,
        promoter
      }
    };
  }

  static async nullifyConversation(conversationId: string) {
    const { error } = await supabaseAdmin
      .from('Feedback')
      .update({ conversationId: null })
      .eq('conversationId', conversationId);
    
    if (error) {
      console.error('[FEEDBACK_REPO] Erro ao desvincular feedbacks:', error);
      // Não lançamos erro aqui para não travar a exclusão da conversa se o feedback não for crítico
    }
  }
}
