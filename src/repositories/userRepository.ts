import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class UserRepository {
  static async findMany(where?: any) {
    let query = supabaseAdmin
      .from('User')
      .select('*, userChannels:UserChannel(*, channel:Channel(*))')
      .order('createdAt', { ascending: false })

    if (where?.email) {
      query = query.eq('email', where.email)
    }

    const { data, error } = await query
    if (error) throw error
    return data
  }

  static async findById(id: string) {
    const { data, error } = await supabaseAdmin
      .from('User')
      .select('*, userChannels:UserChannel(*, channel:Channel(*))')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  static async create(data: any) {
    const { channelIds, ...rest } = data;
    const id = rest.id || generateId();
    
    const { data: newUser, error } = await supabaseAdmin
      .from('User')
      .insert([{ ...rest, id }])
      .select()
      .single()

    if (error) throw error

    if (channelIds && channelIds.length > 0) {
      const { error: chError } = await supabaseAdmin
        .from('UserChannel')
        .insert(channelIds.map((cid: string) => ({ 
          userId: newUser.id, 
          channelId: cid 
        })));
      if (chError) console.error('Error linking channels:', chError);
    }

    return newUser
  }

  static async update(id: string, data: any) {
    const { channelIds, ...rest } = data;
    
    const { data: updatedUser, error } = await supabaseAdmin
      .from('User')
      .update(rest)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    if (channelIds !== undefined) {
      // Sincronizar canais
      await supabaseAdmin.from('UserChannel').delete().eq('userId', id);
      
      if (channelIds.length > 0) {
        const { error: chError } = await supabaseAdmin
          .from('UserChannel')
          .insert(channelIds.map((cid: string) => ({ 
            userId: id, 
            channelId: cid 
          })));
        if (chError) console.error('Error updating channels:', chError);
      }
    }

    return updatedUser
  }

  static async delete(id: string) {
    const { error } = await supabaseAdmin
      .from('User')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true }
  }
}
