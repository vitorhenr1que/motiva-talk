import { supabaseAdmin } from '@/lib/supabase-admin';

export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'CANCELED';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId?: string | null;
  plan: string;
  createdAt?: string;
  status?: OrganizationStatus;
  maxChannels?: number | null;
  maxUsers?: number | null;
  maxMsgPerMonth?: number | null;
  trialEndsAt?: string | null;
  blockedReason?: string | null;
  enterprisePriceCents?: number | null;
  enterpriseStripePriceId?: string | null;
  enterpriseStripeProductId?: string | null;
}

export const organizationRepository = {
  async create(data: Partial<Organization>) {
    const { data: org, error } = await supabaseAdmin
      .from('Organization')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return org as Organization;
  },

  async findBySlug(slug: string) {
    const { data: org, error } = await supabaseAdmin
      .from('Organization')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return org as Organization | null;
  },

  async findById(id: string) {
    const { data: org, error } = await supabaseAdmin
      .from('Organization')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return org as Organization | null;
  },

  async findAll() {
    const { data, error } = await supabaseAdmin
      .from('Organization')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return (data || []) as Organization[];
  },

  async update(id: string, data: Partial<Organization>) {
    const { data: org, error } = await supabaseAdmin
      .from('Organization')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return org as Organization;
  }
};
