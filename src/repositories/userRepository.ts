import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class UserRepository {
  private static async filterChannelIdsForOrganization(channelIds: string[], organizationId: string) {
    if (channelIds.length === 0) return []

    const { data, error } = await supabaseAdmin
      .from('Channel')
      .select('id')
      .eq('organizationId', organizationId)
      .in('id', channelIds)

    if (error) throw error
    return (data || []).map(channel => channel.id)
  }

  static async findMany(organizationId: string, where?: any) {
    let query = supabaseAdmin
      .from('User')
      .select('*, userChannels:UserChannel(*, channel:Channel(*))')
      .eq('organizationId', organizationId)
      .order('createdAt', { ascending: false })

    if (where?.email) {
      query = query.eq('email', where.email)
    }

    const { data, error } = await query
    if (error) throw error
    return data
  }

  static async findById(id: string, organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('User')
      .select('*, userChannels:UserChannel(*, channel:Channel(*))')
      .eq('id', id)
      .eq('organizationId', organizationId)
      .single()

    if (error) throw error
    return data
  }

  static async create(organizationId: string, data: any) {
    const { channelIds, ...rest } = data;
    const id = rest.id || generateId();
    
    const { data: newUser, error } = await supabaseAdmin
      .from('User')
      .insert([{ ...rest, id, organizationId }])
      .select()
      .single()

    if (error) throw error

    if (channelIds && channelIds.length > 0) {
      const validChannelIds = await this.filterChannelIdsForOrganization(channelIds, organizationId)
      if (validChannelIds.length > 0) {
        const { error: chError } = await supabaseAdmin
          .from('UserChannel')
          .insert(validChannelIds.map((cid: string) => ({ 
            userId: newUser.id, 
            channelId: cid,
            organizationId
          })));
        if (chError) console.error('Error linking channels:', chError);
      }
    }

    return newUser
  }

  static async update(id: string, organizationId: string, data: any) {
    const { channelIds, ...rest } = data;
    
    const { data: updatedUser, error } = await supabaseAdmin
      .from('User')
      .update(rest)
      .eq('id', id)
      .eq('organizationId', organizationId)
      .select()
      .single()

    if (error) throw error

    if (channelIds !== undefined) {
      // Sincronizar canais
      await supabaseAdmin.from('UserChannel').delete().eq('userId', id).eq('organizationId', organizationId);
      
      if (channelIds.length > 0) {
        const validChannelIds = await this.filterChannelIdsForOrganization(channelIds, organizationId)
        if (validChannelIds.length > 0) {
          const { error: chError } = await supabaseAdmin
            .from('UserChannel')
            .insert(validChannelIds.map((cid: string) => ({ 
              userId: id, 
              channelId: cid,
              organizationId
            })));
          if (chError) console.error('Error updating channels:', chError);
        }
      }
    }

    return updatedUser
  }

  static async delete(id: string, organizationId: string) {
    await supabaseAdmin.from('UserChannel').delete().eq('userId', id).eq('organizationId', organizationId);

    const { error } = await supabaseAdmin
      .from('User')
      .delete()
      .eq('id', id)
      .eq('organizationId', organizationId)

    if (error) throw error
    return { success: true }
  }
}
