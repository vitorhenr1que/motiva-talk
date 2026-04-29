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
  serviceConversationQuotaEnabled?: boolean;
  maxServiceConversationsPerCycle?: number | null;
  serviceConversationWindowHours?: number;
  serviceConversationQuotaScope?: 'billing_cycle' | 'lifetime';
  serviceConversationOveragePriceCents?: number | null;
  stripeOveragePriceId?: string | null;
  stripeOverageMeterId?: string | null;
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
  stripeOveragePriceId?: string | null;
  stripeOverageSubscriptionItemId?: string | null;
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

export interface ServiceConversationUsage {
  id: string;
  organizationId: string;
  conversationId?: string | null;
  contactId: string;
  channelId: string;
  firstUserMessageAt: string;
  windowEndsAt: string;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  planCode: PlanCode;
  quotaScope: 'billing_cycle' | 'lifetime';
  stripeSubscriptionId?: string | null;
  externalMessageId?: string | null;
  isOverage?: boolean;
  stripeUsageEventId?: string | null;
  stripeUsageRecordedAt?: string | null;
  stripeUsageError?: string | null;
}

const PLAN_SELECT = `
  id,
  code,
  name,
  description,
  priceCents:pricecents,
  currency,
  billingInterval:billinginterval,
  stripePriceId:stripepriceid,
  maxChannels:maxchannels,
  maxUsers:maxusers,
  maxMessagesPerMonth:maxmessagespermonth,
  serviceConversationQuotaEnabled:serviceconversationquotaenabled,
  maxServiceConversationsPerCycle:maxserviceconversationspercycle,
  serviceConversationWindowHours:serviceconversationwindowhours,
  serviceConversationQuotaScope:serviceconversationquotascope,
  serviceConversationOveragePriceCents:serviceconversationoveragepricecents,
  stripeOveragePriceId:stripeoveragepriceid,
  stripeOverageMeterId:stripeoveragemeterid,
  features,
  isActive:isactive,
  sortOrder:sortorder
`;

const SUBSCRIPTION_SELECT = `
  id,
  organizationId:organizationid,
  planId:planid,
  status,
  stripeCustomerId:stripecustomerid,
  stripeSubscriptionId:stripesubscriptionid,
  stripePriceId:stripepriceid,
  stripeOveragePriceId:stripeoveragepriceid,
  stripeOverageSubscriptionItemId:stripeoveragesubscriptionitemid,
  currentPeriodStart:currentperiodstart,
  currentPeriodEnd:currentperiodend,
  cancelAtPeriodEnd:cancelatperiodend,
  canceledAt:canceledat,
  trialEndsAt:trialendsat,
  plan:Plan(${PLAN_SELECT})
`;

function mapSubscriptionPayload(data: Partial<BillingSubscription> & { organizationId?: string; planId?: string }) {
  return {
    ...(data.organizationId !== undefined ? { organizationid: data.organizationId } : {}),
    ...(data.planId !== undefined ? { planid: data.planId } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.stripeCustomerId !== undefined ? { stripecustomerid: data.stripeCustomerId } : {}),
    ...(data.stripeSubscriptionId !== undefined ? { stripesubscriptionid: data.stripeSubscriptionId } : {}),
    ...(data.stripePriceId !== undefined ? { stripepriceid: data.stripePriceId } : {}),
    ...(data.stripeOveragePriceId !== undefined ? { stripeoveragepriceid: data.stripeOveragePriceId } : {}),
    ...(data.stripeOverageSubscriptionItemId !== undefined ? { stripeoveragesubscriptionitemid: data.stripeOverageSubscriptionItemId } : {}),
    ...(data.currentPeriodStart !== undefined ? { currentperiodstart: data.currentPeriodStart } : {}),
    ...(data.currentPeriodEnd !== undefined ? { currentperiodend: data.currentPeriodEnd } : {}),
    ...(data.cancelAtPeriodEnd !== undefined ? { cancelatperiodend: data.cancelAtPeriodEnd } : {}),
    ...(data.canceledAt !== undefined ? { canceledat: data.canceledAt } : {}),
    ...(data.trialEndsAt !== undefined ? { trialendsat: data.trialEndsAt } : {}),
  };
}

export class BillingRepository {
  static async findPlanByCode(code: PlanCode) {
    const { data, error } = await supabaseAdmin
      .from('Plan')
      .select(PLAN_SELECT)
      .eq('code', code)
      .eq('isactive', true)
      .single();

    if (error) throw error;
    return data as BillingPlan;
  }

  static async findPlanByStripePriceId(stripePriceId: string) {
    const { data, error } = await supabaseAdmin
      .from('Plan')
      .select(PLAN_SELECT)
      .eq('stripepriceid', stripePriceId)
      .maybeSingle();

    if (error) throw error;
    return data as BillingPlan | null;
  }

  static async listPlans() {
    const { data, error } = await supabaseAdmin
      .from('Plan')
      .select(PLAN_SELECT)
      .eq('isactive', true)
      .order('sortorder', { ascending: true });

    if (error) throw error;
    return (data || []) as BillingPlan[];
  }

  static async updatePlanPrice(code: PlanCode, priceCents: number, stripePriceId: string) {
    const { data, error } = await supabaseAdmin
      .from('Plan')
      .update({ pricecents: priceCents, stripepriceid: stripePriceId, updatedat: new Date().toISOString() })
      .eq('code', code)
      .select(PLAN_SELECT)
      .single();

    if (error) throw error;
    return data as BillingPlan;
  }

  static async updatePlanOveragePrice(code: PlanCode, overagePriceCents: number, stripeOveragePriceId: string, stripeOverageMeterId: string) {
    const { data, error } = await supabaseAdmin
      .from('Plan')
      .update({
        serviceconversationoveragepricecents: overagePriceCents,
        stripeoveragepriceid: stripeOveragePriceId,
        stripeoveragemeterid: stripeOverageMeterId,
        updatedat: new Date().toISOString(),
      })
      .eq('code', code)
      .select(PLAN_SELECT)
      .single();

    if (error) throw error;
    return data as BillingPlan;
  }

  static async updatePlanFeatures(code: PlanCode, features: string[]) {
    const { data, error } = await supabaseAdmin
      .from('Plan')
      .update({ features, updatedat: new Date().toISOString() })
      .eq('code', code)
      .select(PLAN_SELECT)
      .single();

    if (error) throw error;
    return data as BillingPlan;
  }

  static async updatePlanLimits(
    code: PlanCode,
    limits: { 
      maxChannels?: number | null; 
      maxUsers?: number | null; 
      maxMessagesPerMonth?: number | null;
      maxServiceConversationsPerCycle?: number | null;
      serviceConversationWindowHours?: number | null;
      serviceConversationQuotaScope?: string | null;
    }
  ) {
    const { data, error } = await supabaseAdmin
      .from('Plan')
      .update({
        maxchannels: limits.maxChannels,
        maxusers: limits.maxUsers,
        maxmessagespermonth: limits.maxMessagesPerMonth,
        maxserviceconversationspercycle: limits.maxServiceConversationsPerCycle,
        serviceconversationwindowhours: limits.serviceConversationWindowHours,
        serviceconversationquotascope: limits.serviceConversationQuotaScope,
        updatedat: new Date().toISOString(),
      })
      .eq('code', code)
      .select(PLAN_SELECT)
      .single();

    if (error) throw error;
    return data as BillingPlan;
  }

  static async findActiveSubscription(organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('Subscription')
      .select(SUBSCRIPTION_SELECT)
      .eq('organizationid', organizationId)
      .in('status', ['ACTIVE', 'TRIALING', 'PAST_DUE', 'UNPAID', 'INCOMPLETE'])
      .order('createdat', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as unknown as BillingSubscription | null;
  }

  static async findSubscriptionByStripeCustomerId(stripeCustomerId: string) {
    const { data, error } = await supabaseAdmin
      .from('Subscription')
      .select(SUBSCRIPTION_SELECT)
      .eq('stripecustomerid', stripeCustomerId)
      .order('createdat', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as unknown as BillingSubscription | null;
  }

  static async findSubscriptionByStripeSubscriptionId(stripeSubscriptionId: string) {
    const { data, error } = await supabaseAdmin
      .from('Subscription')
      .select(SUBSCRIPTION_SELECT)
      .eq('stripesubscriptionid', stripeSubscriptionId)
      .maybeSingle();

    if (error) throw error;
    return data as unknown as BillingSubscription | null;
  }

  static async upsertSubscription(data: Partial<BillingSubscription> & { organizationId: string; planId: string }) {
    const id = data.id || generateId();
    const payload = {
      ...mapSubscriptionPayload(data),
      id,
      updatedat: new Date().toISOString(),
    };

    const { data: subscription, error } = await supabaseAdmin
      .from('Subscription')
      .upsert(payload, { onConflict: 'id' })
      .select(SUBSCRIPTION_SELECT)
      .single();

    if (error) throw error;
    return subscription as unknown as BillingSubscription;
  }

  static async updateSubscription(id: string, data: Partial<BillingSubscription>) {
    const { data: subscription, error } = await supabaseAdmin
      .from('Subscription')
      .update({ ...mapSubscriptionPayload(data), updatedat: new Date().toISOString() })
      .eq('id', id)
      .select(SUBSCRIPTION_SELECT)
      .single();

    if (error) throw error;
    return subscription as unknown as BillingSubscription;
  }

  static async getUsageMetric(organizationId: string, periodStart: string) {
    const { data, error } = await supabaseAdmin
      .from('UsageMetric')
      .select('*')
      .eq('organizationid', organizationId)
      .eq('metric', 'messages')
      .eq('periodstart', periodStart)
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
          organizationid: organizationId,
          metric: 'messages',
          periodstart: periodStart,
          periodend: periodEnd,
          value: 1,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as UsageMetric;
    }

    const { data, error } = await supabaseAdmin
      .from('UsageMetric')
      .update({ value: existing.value + 1, updatedat: new Date().toISOString() })
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

  static async findActiveServiceConversationWindow(organizationId: string, contactId: string, channelId: string, at: string) {
    const { data, error } = await supabaseAdmin
      .from('ServiceConversationUsage')
      .select('*')
      .eq('organizationId', organizationId)
      .eq('contactId', contactId)
      .eq('channelId', channelId)
      .gt('windowEndsAt', at)
      .order('windowEndsAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as ServiceConversationUsage | null;
  }

  static async countServiceConversations(organizationId: string, since?: string | null, until?: string | null) {
    let query = supabaseAdmin
      .from('ServiceConversationUsage')
      .select('*', { count: 'exact', head: true })
      .eq('organizationId', organizationId);

    if (since) query = query.gte('firstUserMessageAt', since);
    if (until) query = query.lt('firstUserMessageAt', until);

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  static async countOverageServiceConversations(organizationId: string, since?: string | null, until?: string | null) {
    let query = supabaseAdmin
      .from('ServiceConversationUsage')
      .select('*', { count: 'exact', head: true })
      .eq('organizationId', organizationId)
      .eq('isOverage', true);

    if (since) query = query.gte('firstUserMessageAt', since);
    if (until) query = query.lt('firstUserMessageAt', until);

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  static async createServiceConversationUsage(data: Omit<ServiceConversationUsage, 'id'>) {
    const { data: usage, error } = await supabaseAdmin
      .from('ServiceConversationUsage')
      .insert({ id: generateId(), ...data })
      .select('*')
      .single();

    if (error) throw error;
    return usage as ServiceConversationUsage;
  }

  static async attachServiceConversationUsage(id: string, organizationId: string, conversationId: string) {
    const { error } = await supabaseAdmin
      .from('ServiceConversationUsage')
      .update({ conversationId, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .eq('organizationId', organizationId);

    if (error) throw error;
  }

  static async markServiceConversationUsageStripeRecorded(id: string, organizationId: string, stripeUsageEventId: string) {
    const { error } = await supabaseAdmin
      .from('ServiceConversationUsage')
      .update({
        stripeUsageEventId,
        stripeUsageRecordedAt: new Date().toISOString(),
        stripeUsageError: null,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organizationId', organizationId)
      .is('stripeUsageRecordedAt', null);

    if (error) throw error;
  }

  static async markServiceConversationUsageStripeError(id: string, organizationId: string, message: string) {
    const { error } = await supabaseAdmin
      .from('ServiceConversationUsage')
      .update({
        stripeUsageError: message.slice(0, 500),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organizationId', organizationId)
      .is('stripeUsageRecordedAt', null);

    if (error) throw error;
  }
}
