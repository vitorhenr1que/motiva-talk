import { AppError } from '@/lib/api-errors';
import { organizationRepository } from '@/repositories/organizationRepository';
import { BillingRepository, type BillingPlan, type PlanCode } from '@/repositories/billingRepository';
import type Stripe from 'stripe';

export interface BillingUsage {
  messages: number;
  channels: number;
  users: number;
  pendingInvites: number;
  periodStart: string;
  periodEnd: string;
}

export interface PlanLimits {
  plan: BillingPlan;
  maxChannels: number | null;
  maxUsers: number | null;
  maxMessagesPerMonth: number | null;
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
    };
  }

  static async getMonthlyUsage(organizationId: string): Promise<BillingUsage> {
    const { periodStart, periodEnd, periodStartIso } = monthRangeUtc();
    const [metric, liveMessages, channels, users, pendingInvites] = await Promise.all([
      BillingRepository.getUsageMetric(organizationId, periodStart),
      BillingRepository.countMessagesSince(organizationId, periodStartIso),
      BillingRepository.countRows('Channel', organizationId),
      BillingRepository.countRows('User', organizationId),
      BillingRepository.countPendingInvites(organizationId),
    ]);

    return {
      messages: Math.max(metric?.value ?? 0, liveMessages),
      channels,
      users,
      pendingInvites,
      periodStart,
      periodEnd,
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
