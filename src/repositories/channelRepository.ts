import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class ChannelRepository {
  static async findMany(organizationId: string, where?: any) {
    let query = supabaseAdmin.from('Channel').select('*').eq('organizationId', organizationId)
    if (where) {
      if (where.isActive !== undefined) query = query.eq('isActive', where.isActive)
      if (where.providerSessionId) query = query.eq('providerSessionId', where.providerSessionId)
    }
    const { data, error } = await query
    if (error) throw error
    return data
  }

  static async findByUserId(userId: string, organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('UserChannel')
      .select('channel:Channel(*)')
      .eq('userId', userId)
      .eq('organizationId', organizationId)
    
    if (error) throw error
    
    // Supondo que a estrutura retornada pelo select dependa de como o Supabase lida com joins.
    // O retorno será algo como [{ channel: { id, name... } }, { channel: ... }]
    return (data || [])
      .map((item: any) => item.channel)
      .filter((ch: any) => ch !== null && ch.isActive && ch.organizationId === organizationId);
  }

  static async findById(id: string, organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('Channel')
      .select('*')
      .eq('id', id)
      .eq('organizationId', organizationId)
      .single()
    if (error) throw error
    return data
  }

  static async findByMetaPhoneNumberId(metaPhoneNumberId: string) {
    const { data, error } = await supabaseAdmin
      .from('Channel')
      .select('*')
      .eq('metaPhoneNumberId', metaPhoneNumberId)
      .eq('whatsappProvider', 'META_CLOUD')
      .eq('isActive', true)
      .single()
    if (error) return null
    return data
  }

  static async findByMetaWebhookVerifyToken(metaWebhookVerifyToken: string) {
    const { data, error } = await supabaseAdmin
      .from('Channel')
      .select('*')
      .eq('metaWebhookVerifyToken', metaWebhookVerifyToken)
      .eq('whatsappProvider', 'META_CLOUD')
      .eq('isActive', true)
      .limit(1)

    if (error) return null
    return data?.[0] || null
  }

  static async create(organizationId: string, data: any) {
    const { data: newChannel, error } = await supabaseAdmin
      .from('Channel')
      .insert([{ id: generateId(), ...data, organizationId }])
      .select()
      .single()
    if (error) throw error
    return newChannel
  }

  static async update(id: string, organizationId: string, data: any) {
    const { data: updatedChannel, error } = await supabaseAdmin
      .from('Channel')
      .update(data)
      .eq('id', id)
      .eq('organizationId', organizationId)
      .select()
      .single()
    if (error) throw error
    return updatedChannel
  }
}
