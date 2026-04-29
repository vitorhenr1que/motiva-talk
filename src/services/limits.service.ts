import { supabaseAdmin } from '@/lib/supabase-admin';
import { AppError } from '@/lib/api-errors';
import {
  organizationRepository,
  type OrganizationStatus,
} from '@/repositories/organizationRepository';

export interface OrganizationUsage {
  organizationId: string;
  status: OrganizationStatus;
  plan: string;
  channelCount: number;
  userCount: number;
  pendingInvitesCount: number;
  monthlyMessageCount: number;
  maxChannels: number | null;
  maxUsers: number | null;
  maxMsgPerMonth: number | null;
}

function startOfMonthUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseFilterChain = any;

async function countRows(
  table: string,
  organizationId: string,
  extra?: (q: SupabaseFilterChain) => SupabaseFilterChain
) {
  let query: SupabaseFilterChain = supabaseAdmin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('organizationId', organizationId);

  if (extra) query = extra(query);

  const { count, error } = await query;
  if (error) throw error;
  return (count as number | null) ?? 0;
}

export class LimitsService {
  /**
   * Verifica se a organização está ativa. Caso contrário, lança ORGANIZATION_BLOCKED (403).
   * Defesa em profundidade junto com o middleware.
   */
  static async assertOrganizationActive(organizationId: string): Promise<void> {
    const org = await organizationRepository.findById(organizationId);

    if (!org) {
      throw new AppError('Organização não encontrada', 404, 'NOT_FOUND');
    }

    if ((org.status ?? 'ACTIVE') !== 'ACTIVE') {
      const reason = org.blockedReason ? ` Motivo: ${org.blockedReason}` : '';
      throw new AppError(
        `Organização ${org.status?.toLowerCase() || 'inativa'}.${reason}`.trim(),
        403,
        'ORGANIZATION_BLOCKED'
      );
    }
  }

  /**
   * Reúne uso e limites de uma organização. Contagens são feitas ao vivo;
   * tabela Message tem índice em (organizationId, createdAt).
   */
  static async getOrganizationUsage(organizationId: string): Promise<OrganizationUsage> {
    const org = await organizationRepository.findById(organizationId);
    if (!org) throw new AppError('Organização não encontrada', 404, 'NOT_FOUND');

    const monthStart = startOfMonthUtcIso();

    const [channelCount, userCount, pendingInvitesCount, monthlyMessageCount] = await Promise.all([
      countRows('Channel', organizationId),
      countRows('User', organizationId),
      countRows('Invite', organizationId, q =>
        q.is('acceptedAt', null).gt('expiresAt', new Date().toISOString())
      ),
      countRows('Message', organizationId, q => q.gte('createdAt', monthStart)),
    ]);

    return {
      organizationId,
      status: (org.status ?? 'ACTIVE') as OrganizationStatus,
      plan: org.plan,
      channelCount,
      userCount,
      pendingInvitesCount,
      monthlyMessageCount,
      maxChannels: org.maxChannels ?? null,
      maxUsers: org.maxUsers ?? null,
      maxMsgPerMonth: org.maxMsgPerMonth ?? null,
    };
  }

  static async checkCanCreateChannel(organizationId: string): Promise<void> {
    await this.assertOrganizationActive(organizationId);
    const usage = await this.getOrganizationUsage(organizationId);

    if (usage.maxChannels !== null && usage.channelCount >= usage.maxChannels) {
      throw new AppError(
        `Limite de canais atingido (${usage.channelCount}/${usage.maxChannels}). Atualize seu plano para adicionar mais canais.`,
        429,
        'QUOTA_EXCEEDED',
        { resource: 'channels', current: usage.channelCount, max: usage.maxChannels }
      );
    }
  }

  /**
   * Convites pendentes contam para o limite de usuários — evita estouro depois
   * que um lote de convites é aceito.
   */
  static async checkCanInviteUser(organizationId: string): Promise<void> {
    await this.assertOrganizationActive(organizationId);
    const usage = await this.getOrganizationUsage(organizationId);

    if (usage.maxUsers !== null) {
      const projected = usage.userCount + usage.pendingInvitesCount;
      if (projected >= usage.maxUsers) {
        throw new AppError(
          `Limite de usuários atingido (${usage.userCount} ativos + ${usage.pendingInvitesCount} convites pendentes / ${usage.maxUsers}).`,
          429,
          'QUOTA_EXCEEDED',
          {
            resource: 'users',
            current: usage.userCount,
            pendingInvites: usage.pendingInvitesCount,
            max: usage.maxUsers,
          }
        );
      }
    }
  }

  static async checkCanSendMessage(organizationId: string): Promise<void> {
    await this.assertOrganizationActive(organizationId);
    const usage = await this.getOrganizationUsage(organizationId);

    if (usage.maxMsgPerMonth !== null && usage.monthlyMessageCount >= usage.maxMsgPerMonth) {
      throw new AppError(
        `Limite mensal de mensagens atingido (${usage.monthlyMessageCount}/${usage.maxMsgPerMonth}).`,
        429,
        'QUOTA_EXCEEDED',
        {
          resource: 'messages',
          current: usage.monthlyMessageCount,
          max: usage.maxMsgPerMonth,
        }
      );
    }
  }

  /**
   * Versão silenciosa para o webhook de ingestão: nunca bloqueia recebimento,
   * apenas devolve informação de over-quota para logging/sinalização.
   */
  static async getMonthlyMessageStatus(organizationId: string): Promise<{
    overQuota: boolean;
    current: number;
    max: number | null;
  }> {
    const org = await organizationRepository.findById(organizationId);
    if (!org) return { overQuota: false, current: 0, max: null };

    const max = org.maxMsgPerMonth ?? null;
    const current = await countRows('Message', organizationId, q =>
      q.gte('createdAt', startOfMonthUtcIso())
    );

    return {
      overQuota: max !== null && current >= max,
      current,
      max,
    };
  }
}
