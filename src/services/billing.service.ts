import { AppError } from '@/lib/api-errors';
import { organizationRepository } from '@/repositories/organizationRepository';
import { BillingRepository, type BillingPlan, type PlanCode } from '@/repositories/billingRepository';
import type Stripe from 'stripe';

export interface BillingUsage {
  messages: number;
  serviceConversations: number;
  channels: number;
  users: number;
  pendingInvites: number;
  periodStart: string;
  periodEnd: string;
  serviceConversationPeriodStart: string | null;
  serviceConversationPeriodEnd: string | null;
}

export interface PlanLimits {
  plan: BillingPlan;
  maxChannels: number | null;
  maxUsers: number | null;
  maxMessagesPerMonth: number | null;
  serviceConversationQuotaEnabled: boolean;
  maxServiceConversationsPerCycle: number | null;
  serviceConversationWindowHours: number;
  serviceConversationQuotaScope: 'billing_cycle' | 'lifetime';
}

type StripeSubscriptionWithPeriods = Stripe.Subscription & {
  current_period_start?: number | null;
  current_period_end?: number | null;
};

const STRIPE_STATUS_TO_INTERNAL: Record<string, string> = {
  active: 'ACTIVE',
  trialing: 'TRIALING',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  unpaid: 'UNPAID',
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'INCOMPLETE_EXPIRED',
};

function monthRangeUtc(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
    periodStartIso: start.toISOString(),
  };
}

function activeBillingStatus(status?: string | null) {
  return ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(status || '');
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export class BillingService {
  static async listPlans() {
    return BillingRepository.listPlans();
  }

  static async getCurrentPlan(organizationId: string) {
    const subscription = await BillingRepository.findActiveSubscription(organizationId);
    if (subscription?.plan && activeBillingStatus(subscription.status)) return subscription.plan;

    const org = await organizationRepository.findById(organizationId);
    const orgPlan = (org?.plan || 'FREE') as PlanCode;

    try {
      return await BillingRepository.findPlanByCode(orgPlan);
    } catch {
      return BillingRepository.findPlanByCode('FREE');
    }
  }

  static async getPlanLimits(organizationId: string): Promise<PlanLimits> {
    const plan = await this.getCurrentPlan(organizationId);

    return {
      plan,
      maxChannels: plan.maxChannels ?? null,
      maxUsers: plan.maxUsers ?? null,
      maxMessagesPerMonth: plan.maxMessagesPerMonth ?? null,
      serviceConversationQuotaEnabled: plan.serviceConversationQuotaEnabled ?? true,
      maxServiceConversationsPerCycle: plan.maxServiceConversationsPerCycle ?? null,
      serviceConversationWindowHours: plan.serviceConversationWindowHours ?? 24,
      serviceConversationQuotaScope: plan.serviceConversationQuotaScope ?? (plan.code === 'FREE' ? 'lifetime' : 'billing_cycle'),
    };
  }

  static async getServiceConversationPeriod(organizationId: string, planCode?: PlanCode) {
    if (planCode === 'FREE') {
      return { start: null as string | null, end: null as string | null, scope: 'lifetime' as const, subscription: null };
    }

    const subscription = await BillingRepository.findActiveSubscription(organizationId);
    if (subscription?.currentPeriodStart && subscription.currentPeriodEnd && activeBillingStatus(subscription.status)) {
      return {
        start: subscription.currentPeriodStart,
        end: subscription.currentPeriodEnd,
        scope: 'billing_cycle' as const,
        subscription,
      };
    }

    const { periodStartIso } = monthRangeUtc();
    const fallbackEnd = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString();
    return { start: periodStartIso, end: fallbackEnd, scope: 'billing_cycle' as const, subscription };
  }

  static async getMonthlyUsage(organizationId: string): Promise<BillingUsage> {
    try {
      const { periodStart, periodEnd, periodStartIso } = monthRangeUtc();
      const limits = await this.getPlanLimits(organizationId);
      const servicePeriod = await this.getServiceConversationPeriod(organizationId, limits.plan.code);

      const [metric, liveMessages, serviceConversations, channels, users, pendingInvites] = await Promise.all([
        BillingRepository.getUsageMetric(organizationId, periodStart),
        BillingRepository.countMessagesSince(organizationId, periodStartIso),
        BillingRepository.countServiceConversations(organizationId, servicePeriod.start, servicePeriod.end),
        BillingRepository.countRows('Channel', organizationId),
        BillingRepository.countRows('User', organizationId),
        BillingRepository.countPendingInvites(organizationId),
      ]);

      return {
        messages: Math.max(metric?.value ?? 0, liveMessages),
        serviceConversations: serviceConversations ?? 0,
        channels: channels ?? 0,
        users: users ?? 0,
        pendingInvites: pendingInvites ?? 0,
        periodStart,
        periodEnd,
        serviceConversationPeriodStart: servicePeriod.start,
        serviceConversationPeriodEnd: servicePeriod.end,
      };
    } catch (error: any) {
      console.error(`[BillingService.getMonthlyUsage] Error for org ${organizationId}:`, error);
      
      // Se o erro não tiver mensagem, garante que pelo menos tenhamos algo para logar
      if (error && typeof error === 'object' && !error.message) {
        error.message = 'Erro ao buscar métricas de uso no banco de dados';
      }
      
      throw error;
    }
  }

  static async incrementMessageUsage(organizationId: string) {
    const { periodStart, periodEnd } = monthRangeUtc();
    return BillingRepository.incrementUsageMetric(organizationId, periodStart, periodEnd);
  }

  static async checkMessageLimit(organizationId: string): Promise<void> {
    const [limits, usage] = await Promise.all([
      this.getPlanLimits(organizationId),
      this.getMonthlyUsage(organizationId),
    ]);

    if (limits.maxMessagesPerMonth !== null && usage.messages >= limits.maxMessagesPerMonth) {
      throw new AppError(
        `Limite mensal de mensagens atingido (${usage.messages}/${limits.maxMessagesPerMonth}).`,
        429,
        'QUOTA_EXCEEDED',
        { resource: 'messages', current: usage.messages, max: limits.maxMessagesPerMonth }
      );
    }
  }

  static async openServiceConversationWindow(params: {
    organizationId: string;
    contactId: string;
    channelId: string;
    firstUserMessageAt: string;
    externalMessageId?: string | null;
  }) {
    const { organizationId, contactId, channelId, firstUserMessageAt, externalMessageId } = params;
    const existingWindow = await BillingRepository.findActiveServiceConversationWindow(
      organizationId,
      contactId,
      channelId,
      firstUserMessageAt
    );

    if (existingWindow) return { usage: existingWindow, created: false };

    const limits = await this.getPlanLimits(organizationId);
    const servicePeriod = await this.getServiceConversationPeriod(organizationId, limits.plan.code);
    const current = await BillingRepository.countServiceConversations(organizationId, servicePeriod.start, servicePeriod.end);
    const overQuota = limits.serviceConversationQuotaEnabled
      && limits.maxServiceConversationsPerCycle !== null
      && current >= limits.maxServiceConversationsPerCycle;

    const firstMessageDate = new Date(firstUserMessageAt);
    const usage = await BillingRepository.createServiceConversationUsage({
      organizationId,
      conversationId: null,
      contactId,
      channelId,
      firstUserMessageAt,
      windowEndsAt: addHours(firstMessageDate, limits.serviceConversationWindowHours).toISOString(),
      billingPeriodStart: servicePeriod.start,
      billingPeriodEnd: servicePeriod.end,
      planCode: limits.plan.code,
      quotaScope: limits.serviceConversationQuotaScope,
      stripeSubscriptionId: servicePeriod.subscription?.stripeSubscriptionId ?? null,
      externalMessageId: externalMessageId ?? null,
    });

    return { usage, created: true, overQuota };
  }

  static async checkAgentReplyAllowed(organizationId: string): Promise<void> {
    const limits = await this.getPlanLimits(organizationId);
    if (limits.plan.code !== 'FREE') return;
    if (!limits.serviceConversationQuotaEnabled || limits.maxServiceConversationsPerCycle === null) return;

    const servicePeriod = await this.getServiceConversationPeriod(organizationId, limits.plan.code);
    const current = await BillingRepository.countServiceConversations(organizationId, servicePeriod.start, servicePeriod.end);

    if (current >= limits.maxServiceConversationsPerCycle) {
      throw new AppError(
        `Limite total de conversas do plano FREE atingido (${current}/${limits.maxServiceConversationsPerCycle}). Faça upgrade para responder novas mensagens.`,
        429,
        'QUOTA_EXCEEDED',
        {
          resource: 'service_conversations',
          current,
          max: limits.maxServiceConversationsPerCycle,
          scope: limits.serviceConversationQuotaScope,
          upgradeRequired: true,
        }
      );
    }
  }

  static async checkChannelLimit(organizationId: string): Promise<void> {
    const [limits, usage] = await Promise.all([
      this.getPlanLimits(organizationId),
      this.getMonthlyUsage(organizationId),
    ]);

    if (limits.maxChannels !== null && usage.channels >= limits.maxChannels) {
      throw new AppError(
        `Limite de canais atingido (${usage.channels}/${limits.maxChannels}). Atualize seu plano para adicionar mais canais.`,
        429,
        'QUOTA_EXCEEDED',
        { resource: 'channels', current: usage.channels, max: limits.maxChannels }
      );
    }
  }

  static async checkUserLimit(organizationId: string): Promise<void> {
    const [limits, usage] = await Promise.all([
      this.getPlanLimits(organizationId),
      this.getMonthlyUsage(organizationId),
    ]);

    if (limits.maxUsers !== null) {
      const projected = usage.users + usage.pendingInvites;
      if (projected >= limits.maxUsers) {
        throw new AppError(
          `Limite de usuários atingido (${usage.users} ativos + ${usage.pendingInvites} convites pendentes / ${limits.maxUsers}).`,
          429,
          'QUOTA_EXCEEDED',
          { resource: 'users', current: usage.users, pendingInvites: usage.pendingInvites, max: limits.maxUsers }
        );
      }
    }
  }

  static normalizeStripeStatus(status: string) {
    return STRIPE_STATUS_TO_INTERNAL[status] || 'INCOMPLETE';
  }

  static async syncStripeSubscription(stripeSubscription: StripeSubscriptionWithPeriods) {
    const stripeSubscriptionId = stripeSubscription.id as string;
    const stripeCustomerId = typeof stripeSubscription.customer === 'string'
      ? stripeSubscription.customer
      : stripeSubscription.customer?.id;
    const stripePriceId = stripeSubscription.items?.data?.[0]?.price?.id as string | undefined;

    if (!stripeSubscriptionId || !stripeCustomerId || !stripePriceId) {
      throw new AppError('Assinatura Stripe incompleta', 400, 'VALIDATION_ERROR');
    }

    const existingBySubscription = await BillingRepository.findSubscriptionByStripeSubscriptionId(stripeSubscriptionId);
    const existingByCustomer = existingBySubscription
      ? null
      : await BillingRepository.findSubscriptionByStripeCustomerId(stripeCustomerId);

    const organizationId = stripeSubscription.metadata?.organizationId
      || existingBySubscription?.organizationId
      || existingByCustomer?.organizationId;

    if (!organizationId) {
      throw new AppError('organizationId ausente na assinatura Stripe', 400, 'VALIDATION_ERROR');
    }

    const plan = await BillingRepository.findPlanByStripePriceId(stripePriceId)
      || await BillingRepository.findPlanByCode((stripeSubscription.metadata?.planCode || 'FREE') as PlanCode);

    const status = this.normalizeStripeStatus(stripeSubscription.status);
    const currentPeriodStart = stripeSubscription.current_period_start
      ? new Date(stripeSubscription.current_period_start * 1000).toISOString()
      : null;
    const currentPeriodEnd = stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
      : null;
    const canceledAt = stripeSubscription.canceled_at
      ? new Date(stripeSubscription.canceled_at * 1000).toISOString()
      : null;
    const trialEndsAt = stripeSubscription.trial_end
      ? new Date(stripeSubscription.trial_end * 1000).toISOString()
      : null;

    const subscription = await BillingRepository.upsertSubscription({
      id: existingBySubscription?.id || existingByCustomer?.id,
      organizationId,
      planId: plan.id,
      status,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: !!stripeSubscription.cancel_at_period_end,
      canceledAt,
      trialEndsAt,
    });

    const effectivePlan = activeBillingStatus(status) ? plan : await BillingRepository.findPlanByCode('FREE');
    await organizationRepository.update(organizationId, {
      plan: effectivePlan.code,
      maxChannels: effectivePlan.maxChannels ?? null,
      maxUsers: effectivePlan.maxUsers ?? null,
      maxMsgPerMonth: effectivePlan.maxMessagesPerMonth ?? null,
      status: 'ACTIVE',
    });

    return subscription;
  }

  static getMonthRangeUtc = monthRangeUtc;
}
