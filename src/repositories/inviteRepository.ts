import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateId } from '@/lib/utils';

export interface Invite {
  id: string;
  organizationId: string;
  email: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'AGENT';
  token: string;
  channelIds?: string[];
  sectorId?: string;
  expiresAt: string;
  acceptedAt?: string | null;
  createdAt: string;
}

export const inviteRepository = {
  async create(data: Partial<Invite>) {
    const id = generateId();
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const { data: invite, error } = await supabaseAdmin
      .from('Invite')
      .insert({
        id,
        token,
        expiresAt: expiresAt.toISOString(),
        ...data
      })
      .select()
      .single();

    if (error) throw error;
    return invite;
  },

  async findByToken(token: string) {
    const { data: invite, error } = await supabaseAdmin
      .from('Invite')
      .select('*, organization:Organization(*)')
      .eq('token', token)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return invite;
  },

  async findByOrganization(organizationId: string) {
    const { data: invites, error } = await supabaseAdmin
      .from('Invite')
      .select('*')
      .eq('organizationId', organizationId)
      .is('acceptedAt', null)
      .gt('expiresAt', new Date().toISOString())
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return invites;
  },

  async accept(id: string) {
    const { data: invite, error } = await supabaseAdmin
      .from('Invite')
      .update({ acceptedAt: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return invite;
  },

  async delete(id: string, organizationId: string) {
    const { error } = await supabaseAdmin
      .from('Invite')
      .delete()
      .eq('id', id)
      .eq('organizationId', organizationId);

    if (error) throw error;
    return { success: true };
  }
};
