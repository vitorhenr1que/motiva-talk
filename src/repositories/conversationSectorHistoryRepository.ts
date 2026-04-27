import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateId } from '@/lib/utils';

export interface SectorTenureRange {
  enteredAt: string;
  leftAt: string | null;
  sectorId: string | null;
}

export class ConversationSectorHistoryRepository {
  /**
   * Insere um novo tenure (período de propriedade do setor).
   * Por convenção do schema (uq_csh_conv_active), só pode haver UM tenure
   * ativo por conversa. Sempre feche o tenure anterior antes (closeActive).
   */
  static async insert(data: {
    conversationId: string;
    sectorId: string | null;
    enteredAt?: string;
    transferredById?: string | null;
  }) {
    const row = {
      id: generateId(),
      conversationId: data.conversationId,
      sectorId: data.sectorId,
      enteredAt: data.enteredAt || new Date().toISOString(),
      leftAt: null,
      transferredById: data.transferredById || null
    };
    const { data: inserted, error } = await supabaseAdmin
      .from('ConversationSectorHistory')
      .insert([row])
      .select()
      .single();
    if (error) throw error;
    return inserted;
  }

  /**
   * Marca o tenure ativo da conversa como encerrado.
   * Retorna a linha atualizada (ou null se não havia tenure ativo).
   */
  static async closeActive(conversationId: string, leftAt?: string) {
    const ts = leftAt || new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('ConversationSectorHistory')
      .update({ leftAt: ts })
      .eq('conversationId', conversationId)
      .is('leftAt', null)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Retorna o tenure mais recente daquele setor naquela conversa.
   * - Se sector é o atual: leftAt === null.
   * - Se é antigo: leftAt é o instante em que saiu.
   * - Retorna null se aquele setor nunca cuidou da conversa.
   */
  static async findLatestRangeForSector(
    conversationId: string,
    sectorId: string
  ): Promise<SectorTenureRange | null> {
    const { data, error } = await supabaseAdmin
      .from('ConversationSectorHistory')
      .select('enteredAt, leftAt, sectorId')
      .eq('conversationId', conversationId)
      .eq('sectorId', sectorId)
      .order('enteredAt', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as SectorTenureRange | null;
  }

  /**
   * Lista todos os tenures de uma conversa, em ordem cronológica.
   */
  static async listForConversation(conversationId: string) {
    const { data, error } = await supabaseAdmin
      .from('ConversationSectorHistory')
      .select('*')
      .eq('conversationId', conversationId)
      .order('enteredAt', { ascending: true });
    if (error) throw error;
    return data;
  }

  /**
   * Retorna o tenure ativo (leftAt NULL) da conversa, ou null.
   */
  static async findActive(conversationId: string) {
    const { data, error } = await supabaseAdmin
      .from('ConversationSectorHistory')
      .select('*')
      .eq('conversationId', conversationId)
      .is('leftAt', null)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
}
