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

  private static async filterSectorIdForOrganization(sectorId: string, organizationId: string) {
    if (!sectorId) return null

    const { data, error } = await supabaseAdmin
      .from('Sector')
      .select('id')
      .eq('organizationId', organizationId)
      .eq('id', sectorId)
      .maybeSingle()

    if (error) throw error
    return data?.id || null
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
    const { channelIds, sectorId, ...rest } = data;
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

    if (sectorId) {
      const validSectorId = await this.filterSectorIdForOrganization(sectorId, organizationId)
      if (validSectorId) {
        const { error: sError } = await supabaseAdmin
          .from('UserSector')
          .insert({ 
            userId: newUser.id, 
            sectorId: validSectorId,
            organizationId
          });
        if (sError) console.error('Error linking sector:', sError);
      }
    }

    return newUser
  }

  static async update(id: string, organizationId: string, data: any) {
    const { channelIds, sectorId, ...rest } = data;
    
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

    if (sectorId !== undefined) {
      // Sincronizar setor
      await supabaseAdmin.from('UserSector').delete().eq('userId', id).eq('organizationId', organizationId);
      
      if (sectorId) {
        const validSectorId = await this.filterSectorIdForOrganization(sectorId, organizationId)
        if (validSectorId) {
          const { error: sError } = await supabaseAdmin
            .from('UserSector')
            .insert({ 
              userId: id, 
              sectorId: validSectorId,
              organizationId
            });
          if (sError) console.error('Error updating sector:', sError);
        }
      }
    }

    return updatedUser
  }

  static async delete(id: string, organizationId: string) {
    await supabaseAdmin.from('UserChannel').delete().eq('userId', id).eq('organizationId', organizationId);
    await supabaseAdmin.from('UserSector').delete().eq('userId', id).eq('organizationId', organizationId);

    const { error } = await supabaseAdmin
      .from('User')
      .delete()
      .eq('id', id)
      .eq('organizationId', organizationId)

    if (error) throw error
    return { success: true }
  }
}
