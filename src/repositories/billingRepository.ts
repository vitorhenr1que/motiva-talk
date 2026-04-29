import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateId } from '@/lib/utils';

export type PlanCode = 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';

export interface BillingPlan {
  id: string;
  code: PlanCode;
  name: string;
  description?: string | null;
  priceCents: number;
  currency: string;
  billingInterval: string;
  stripePriceId?: string | null;
  maxChannels?: number | null;
  maxUsers?: number | null;
  maxMessagesPerMonth?: number | null;
  features?: string[];
  isActive: boolean;
  sortOrder: number;
}

export interface BillingSubscription {
  id: string;
  organizationId: string;
  planId: string;
  status: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string | null;
  trialEndsAt?: string | null;
  plan?: BillingPlan;
}

export interface UsageMetric {
  id: string;
  organizationId: string;
  metric: 'messages';
  periodStart: string;
  periodEnd: string;
  value: number;
}

export class BillingRepository {
  static async findPlanByCode(code: PlanCode) {
    const { data, error } = await supabaseAdmin
      .from('Plan')
      .select('*')
      .eq('code', code)
      .eq('isActive', true)
      .single();

    if (error) throw error;
    return data as BillingPlan;
  }

  static async findPlanByStripePriceId(stripePriceId: string) {
    const { data, error } = await supabaseAdmin
      .from('Plan')
      .select('*')
      .eq('stripePriceId', stripePriceId)
      .maybeSingle();

    if (error) throw error;
    return data as BillingPlan | null;
  }

  static async listPlans() {
    const { data, error } = await supabaseAdmin
      .from('Plan')
      .select('*')
      .eq('isActive', true)
      .order('sortOrder', { ascending: true });

    if (error) throw error;
    return (data || []) as BillingPlan[];
  }

  static async findActiveSubscription(organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('Subscription')
      .select('*, plan:Plan(*)')
      .eq('organizationId', organizationId)
      .in('status', ['ACTIVE', 'TRIALING', 'PAST_DUE', 'UNPAID', 'INCOMPLETE'])
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as BillingSubscription | null;
  }

  static async findSubscriptionByStripeCustomerId(stripeCustomerId: string) {
    const { data, error } = await supabaseAdmin
      .from('Subscription')
      .select('*, plan:Plan(*)')
      .eq('stripeCustomerId', stripeCustomerId)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as BillingSubscription | null;
  }

  static async findSubscriptionByStripeSubscriptionId(stripeSubscriptionId: string) {
    const { data, error } = await supabaseAdmin
      .from('Subscription')
      .select('*, plan:Plan(*)')
      .eq('stripeSubscriptionId', stripeSubscriptionId)
      .maybeSingle();

    if (error) throw error;
    return data as BillingSubscription | null;
  }

  static async upsertSubscription(data: Partial<BillingSubscription> & { organizationId: string; planId: string }) {
    const id = data.id || generateId();
    const payload = {
      ...data,
      id,
      updatedAt: new Date().toISOString(),
    };

    const { data: subscription, error } = await supabaseAdmin
      .from('Subscription')
      .upsert(payload, { onConflict: 'id' })
      .select('*, plan:Plan(*)')
      .single();

    if (error) throw error;
    return subscription as BillingSubscription;
  }

  static async updateSubscription(id: string, data: Partial<BillingSubscription>) {
    const { data: subscription, error } = await supabaseAdmin
      .from('Subscription')
      .update({ ...data, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select('*, plan:Plan(*)')
      .single();

    if (error) throw error;
    return subscription as BillingSubscription;
  }

  static async getUsageMetric(organizationId: string, periodStart: string) {
    const { data, error } = await supabaseAdmin
      .from('UsageMetric')
      .select('*')
      .eq('organizationId', organizationId)
      .eq('metric', 'messages')
      .eq('periodStart', periodStart)
      .maybeSingle();

    if (error) throw error;
    return data as UsageMetric | null;
  }

  static async incrementUsageMetric(organizationId: string, periodStart: string, periodEnd: string) {
    const existing = await this.getUsageMetric(organizationId, periodStart);

    if (!existing) {
      const { data, error } = await supabaseAdmin
        .from('UsageMetric')
        .insert({
          id: generateId(),
          organizationId,
          metric: 'messages',
          periodStart,
          periodEnd,
          value: 1,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as UsageMetric;
    }

    const { data, error } = await supabaseAdmin
      .from('UsageMetric')
      .update({ value: existing.value + 1, updatedAt: new Date().toISOString() })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw error;
    return data as UsageMetric;
  }

  static async countRows(table: string, organizationId: string) {
    const { count, error } = await supabaseAdmin
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('organizationId', organizationId);

    if (error) throw error;
    return count ?? 0;
  }

  static async countMessagesSince(organizationId: string, since: string) {
    const { count, error } = await supabaseAdmin
      .from('Message')
      .select('*', { count: 'exact', head: true })
      .eq('organizationId', organizationId)
      .gte('createdAt', since);

    if (error) throw error;
    return count ?? 0;
  }

  static async countPendingInvites(organizationId: string) {
    const { count, error } = await supabaseAdmin
      .from('Invite')
      .select('*', { count: 'exact', head: true })
      .eq('organizationId', organizationId)
      .is('acceptedAt', null)
      .gt('expiresAt', new Date().toISOString());

    if (error) throw error;
    return count ?? 0;
  }
}
