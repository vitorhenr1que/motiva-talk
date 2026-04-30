import { AppError } from '@/lib/api-errors';
import {
  organizationRepository,
  type OrganizationStatus,
} from '@/repositories/organizationRepository';
import { BillingRepository } from '@/repositories/billingRepository';
import { BillingService } from '@/services/billing.service';

export interface OrganizationUsage {
  organizationId: string;
  status: OrganizationStatus;
  plan: string;
  channelCount: number;
  userCount: number;
  pendingInvitesCount: number;
  monthlyMessageCount: number;
  serviceConversationCount: number;
  maxChannels: number | null;
  maxUsers: number | null;
  maxMsgPerMonth: number | null;
  maxServiceConversationsPerCycle: number | null;
  serviceConversationQuotaEnabled: boolean;
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

    const [limits, usage] = await Promise.all([
      BillingService.getPlanLimits(organizationId),
      BillingService.getMonthlyUsage(organizationId),
    ]);

    return {
      organizationId,
      status: (org.status ?? 'ACTIVE') as OrganizationStatus,
      plan: limits.plan.code,
      channelCount: usage.channels,
      userCount: usage.users,
      pendingInvitesCount: usage.pendingInvites,
      monthlyMessageCount: usage.messages,
      serviceConversationCount: usage.serviceConversations,
      maxChannels: limits.maxChannels,
      maxUsers: limits.maxUsers,
      maxMsgPerMonth: limits.maxMessagesPerMonth,
      maxServiceConversationsPerCycle: limits.maxServiceConversationsPerCycle,
      serviceConversationQuotaEnabled: limits.serviceConversationQuotaEnabled,
    };
  }

  static async checkCanCreateChannel(organizationId: string): Promise<void> {
    await this.assertOrganizationActive(organizationId);
    await BillingService.checkChannelLimit(organizationId);
  }

  /**
   * Convites pendentes contam para o limite de usuários — evita estouro depois
   * que um lote de convites é aceito.
   */
  static async checkCanInviteUser(organizationId: string): Promise<void> {
    await this.assertOrganizationActive(organizationId);
    await BillingService.checkUserLimit(organizationId);
  }

  static async checkCanSendMessage(organizationId: string): Promise<void> {
    await this.assertOrganizationActive(organizationId);
    await BillingService.checkAgentReplyAllowed(organizationId);
  }

  static async openServiceConversationWindow(params: {
    organizationId: string;
    contactId: string;
    channelId: string;
    firstUserMessageAt: string;
    externalMessageId?: string | null;
  }) {
    await this.assertOrganizationActive(params.organizationId);
    return BillingService.openServiceConversationWindow(params);
  }

  /**
   * Versão silenciosa para o webhook de ingestão: nunca bloqueia recebimento,
   * apenas devolve informação de over-quota para logging/sinalização.
   */
  static async getMonthlyMessageStatus(organizationId: string): Promise<{
    overQuota: boolean;
    current: number;
    max: number | null;
    serviceConversations: number;
    maxServiceConversations: number | null;
  }> {
    const limits = await BillingService.getPlanLimits(organizationId);
    const { periodStart } = BillingService.getMonthRangeUtc();
    const metric = await BillingRepository.getUsageMetric(organizationId, periodStart);

    const max = limits.maxMessagesPerMonth;
    const current = metric?.value ?? 0;

    return {
      overQuota: max !== null && current >= max,
      current,
      max,
      // Mantido barato para o webhook: a cota de conversas é validada no fluxo
      // openServiceConversationWindow, não neste log informativo.
      serviceConversations: 0,
      maxServiceConversations: limits.maxServiceConversationsPerCycle,
    };
  }
}
