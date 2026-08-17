import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateId } from '@/lib/utils';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId?: string | null;
  createdAt?: string;
}

export const organizationRepository = {
  async create(data: Partial<Organization>) {
    const id = data.id || generateId();
    const { data: org, error } = await supabaseAdmin
      .from('Organization')
      .insert({ ...data, id })
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
