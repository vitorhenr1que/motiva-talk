import { AppError } from '@/lib/api-errors';
import { getStripeClient } from '@/lib/stripe';
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
  serviceConversationOveragePriceCents: number | null;
  estimatedServiceConversationOverageCents: number;
  overageServiceConversations: number;
}

type StripeSubscriptionWithPeriods = Stripe.Subscription & {
  current_period_start?: number | null;
  current_period_end?: number | null;
};

type StripeSubscriptionSyncContext = {
  organizationId?: string | null;
  planCode?: string | null;
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
    const [plan, org] = await Promise.all([
      this.getCurrentPlan(organizationId),
      organizationRepository.findById(organizationId),
    ]);

    return {
      plan,
      maxChannels: org?.maxChannels !== undefined ? org.maxChannels ?? null : plan.maxChannels ?? null,
      maxUsers: org?.maxUsers !== undefined ? org.maxUsers ?? null : plan.maxUsers ?? null,
      maxMessagesPerMonth: org?.maxMsgPerMonth !== undefined ? org.maxMsgPerMonth ?? null : plan.maxMessagesPerMonth ?? null,
      serviceConversationQuotaEnabled: plan.serviceConversationQuotaEnabled ?? true,
      maxServiceConversationsPerCycle: plan.maxServiceConversationsPerCycle ?? null,
      serviceConversationWindowHours: plan.serviceConversationWindowHours ?? 24,
      serviceConversationQuotaScope: plan.serviceConversationQuotaScope ?? (plan.code === 'FREE' ? 'lifetime' : 'billing_cycle'),
      serviceConversationOveragePriceCents: plan.serviceConversationOveragePriceCents ?? null,
      estimatedServiceConversationOverageCents: 0,
      overageServiceConversations: 0,
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

  static async getMonthlyUsage(
    organizationId: string,
    options: { includeLiveMessageCount?: boolean } = {}
  ): Promise<BillingUsage> {
    try {
      const { periodStart, periodEnd, periodStartIso } = monthRangeUtc();
      const limits = await this.getPlanLimits(organizationId);
      const servicePeriod = await this.getServiceConversationPeriod(organizationId, limits.plan.code);

      const [metric, serviceConversations, channels, users, pendingInvites] = await Promise.all([
        BillingRepository.getUsageMetric(organizationId, periodStart),
        BillingRepository.countServiceConversations(organizationId, servicePeriod.start, servicePeriod.end),
        BillingRepository.countRows('Channel', organizationId),
        BillingRepository.countRows('User', organizationId),
        BillingRepository.countPendingInvites(organizationId),
      ]);

      const metricMessages = metric?.value ?? 0;
      const liveMessages = options.includeLiveMessageCount
        ? await BillingRepository.countMessagesSince(organizationId, periodStartIso)
        : null;

      return {
        messages: liveMessages === null ? metricMessages : Math.max(metricMessages, liveMessages),
        serviceConversations: serviceConversations ?? 0,
        channels: channels ?? 0,
        users: users ?? 0,
        pendingInvites: pendingInvites ?? 0,
        periodStart,
        periodEnd,
        serviceConversationPeriodStart: servicePeriod.start,
        serviceConversationPeriodEnd: servicePeriod.end,
      };
    } catch (error: unknown) {
      console.error(`[BillingService.getMonthlyUsage] Error for org ${organizationId}:`, error);
      throw error;
    }
  }

  static async getServiceConversationOverageSummary(organizationId: string) {
    const limits = await this.getPlanLimits(organizationId);
    const servicePeriod = await this.getServiceConversationPeriod(organizationId, limits.plan.code);
    const total = await BillingRepository.countServiceConversations(organizationId, servicePeriod.start, servicePeriod.end);
    const included = limits.serviceConversationQuotaEnabled ? limits.maxServiceConversationsPerCycle : null;
    const overage = included === null ? 0 : Math.max(0, total - included);
    const priceCents = limits.serviceConversationOveragePriceCents ?? null;

    return {
      included,
      total,
      overage,
      priceCents,
      estimatedCents: priceCents ? overage * priceCents : 0,
      periodStart: servicePeriod.start,
      periodEnd: servicePeriod.end,
    };
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
      isOverage: overQuota && limits.plan.code !== 'FREE',
    });

    if (usage.isOverage) {
      this.recordServiceConversationOverageUsage(usage.id, organizationId).catch((error) => {
        console.error(`[BILLING] Overage usage record failed usage=${usage.id} org=${organizationId}:`, error);
      });
    }

    return { usage, created: true, overQuota };
  }

  static async ensureStripeOverageSubscriptionItem(subscription: Stripe.Subscription, plan: BillingPlan) {
    if (!plan.stripeOveragePriceId) return null;

    const existingItem = subscription.items.data.find((item: Stripe.SubscriptionItem) => item.price.id === plan.stripeOveragePriceId);
    if (existingItem) return existingItem.id;

    const stripe = getStripeClient();
    const item = await stripe.subscriptionItems.create({
      subscription: subscription.id,
      price: plan.stripeOveragePriceId,
      proration_behavior: 'none',
      metadata: { kind: 'service_conversation_overage', planCode: plan.code },
    });

    return item.id;
  }

  static async recordServiceConversationOverageUsage(usageId: string, organizationId: string) {
    const subscription = await BillingRepository.findActiveSubscription(organizationId);
    if (!subscription?.stripeSubscriptionId || !subscription.stripeCustomerId || subscription.plan?.code === 'FREE') return;
    if (!activeBillingStatus(subscription.status)) return;

    const plan = subscription.plan || await this.getCurrentPlan(organizationId);
    if (!plan.stripeOveragePriceId || !plan.stripeOverageMeterId || !plan.serviceConversationOveragePriceCents) return;

    const stripe = getStripeClient();
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId, {
      expand: ['items.data.price'],
    });
    const overageSubscriptionItemId = await this.ensureStripeOverageSubscriptionItem(stripeSubscription, plan);

    try {
      const event = await stripe.billing.meterEvents.create({
        event_name: `motiva_talk_service_conversation_overage_${plan.code.toLowerCase()}`,
        identifier: usageId,
        payload: {
          stripe_customer_id: subscription.stripeCustomerId,
          value: '1',
        },
      });

      await BillingRepository.markServiceConversationUsageStripeRecorded(usageId, organizationId, event.identifier);

      if (overageSubscriptionItemId && overageSubscriptionItemId !== subscription.stripeOverageSubscriptionItemId) {
        await BillingRepository.updateSubscription(subscription.id, {
          stripeOveragePriceId: plan.stripeOveragePriceId,
          stripeOverageSubscriptionItemId: overageSubscriptionItemId,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao registrar uso excedente no Stripe';
      await BillingRepository.markServiceConversationUsageStripeError(usageId, organizationId, message);
      throw error;
    }
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

  static async syncStripeSubscription(
    stripeSubscription: StripeSubscriptionWithPeriods,
    context: StripeSubscriptionSyncContext = {}
  ) {
    const stripeSubscriptionId = stripeSubscription.id as string;
    const stripeCustomerId = typeof stripeSubscription.customer === 'string'
      ? stripeSubscription.customer
      : stripeSubscription.customer?.id;
    const stripePriceIds = stripeSubscription.items?.data?.map((item) => item.price?.id).filter(Boolean) as string[] | undefined;
    const stripePriceId = stripePriceIds?.[0];

    if (!stripeSubscriptionId || !stripeCustomerId || !stripePriceIds?.length) {
      throw new AppError('Assinatura Stripe incompleta', 400, 'VALIDATION_ERROR');
    }

    const existingBySubscription = await BillingRepository.findSubscriptionByStripeSubscriptionId(stripeSubscriptionId);
    const existingByCustomer = existingBySubscription
      ? null
      : await BillingRepository.findSubscriptionByStripeCustomerId(stripeCustomerId);

    const organizationId = context.organizationId
      || stripeSubscription.metadata?.organizationId
      || existingBySubscription?.organizationId
      || existingByCustomer?.organizationId;

    if (!organizationId) {
      throw new AppError('organizationId ausente na assinatura Stripe', 400, 'VALIDATION_ERROR');
    }

    const plans = await BillingRepository.listPlans();
    const plan = plans.find((p) => p.stripePriceId && stripePriceIds.includes(p.stripePriceId))
      || await BillingRepository.findPlanByCode((context.planCode || stripeSubscription.metadata?.planCode || 'FREE') as PlanCode);
    const fixedStripePriceId = plan.stripePriceId && stripePriceIds.includes(plan.stripePriceId)
      ? plan.stripePriceId
      : stripePriceId;
    const overageItem = plan.stripeOveragePriceId
      ? stripeSubscription.items?.data?.find((item) => item.price?.id === plan.stripeOveragePriceId)
      : null;

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
      stripePriceId: fixedStripePriceId,
      stripeOveragePriceId: plan.stripeOveragePriceId ?? null,
      stripeOverageSubscriptionItemId: overageItem?.id ?? null,
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
