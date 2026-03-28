import { supabaseAdmin } from '@/lib/supabase-admin'

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
    const { data: newUser, error } = await supabaseAdmin
      .from('User')
      .insert([data])
      .select()
      .single()

    if (error) throw error
    return newUser
  }

  static async update(id: string, data: any) {
    const { data: updatedUser, error } = await supabaseAdmin
      .from('User')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
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
