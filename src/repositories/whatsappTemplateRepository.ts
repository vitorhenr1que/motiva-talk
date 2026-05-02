/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

export class WhatsAppTemplateRepository {
  static async findMany(organizationId: string, where?: { channelId?: string; status?: string }) {
    let query = supabaseAdmin
      .from('WhatsAppTemplate')
      .select('*, channel:Channel(id, name, whatsappProvider)')
      .eq('organizationId', organizationId)
      .order('createdAt', { ascending: false })

    if (where?.channelId) query = query.eq('channelId', where.channelId)
    if (where?.status) query = query.eq('status', where.status)

    const { data, error } = await query
    if (error) throw error
    return data
  }

  static async findById(id: string, organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('WhatsAppTemplate')
      .select('*, channel:Channel(*)')
      .eq('id', id)
      .eq('organizationId', organizationId)
      .single()

    if (error) throw error
    return data
  }

  static async findByMetaTemplateId(metaTemplateId: string) {
    const { data, error } = await supabaseAdmin
      .from('WhatsAppTemplate')
      .select('*, channel:Channel(*)')
      .eq('metaTemplateId', metaTemplateId)
      .maybeSingle()

    if (error) throw error
    return data
  }

  static async findByName(name: string, organizationId: string, channelId?: string) {
    let query = supabaseAdmin
      .from('WhatsAppTemplate')
      .select('*, channel:Channel(*)')
      .eq('name', name)
      .eq('organizationId', organizationId)
      .limit(1)

    if (channelId) query = query.eq('channelId', channelId)

    const { data, error } = await query
    if (error) throw error
    return data?.[0] || null
  }

  static async create(organizationId: string, data: any) {
    const { data: created, error } = await supabaseAdmin
      .from('WhatsAppTemplate')
      .insert([{ id: generateId(), ...data, organizationId }])
      .select('*, channel:Channel(id, name, whatsappProvider)')
      .single()

    if (error) throw error
    return created
  }

  static async update(id: string, organizationId: string, data: any) {
    const { data: updated, error } = await supabaseAdmin
      .from('WhatsAppTemplate')
      .update(data)
      .eq('id', id)
      .eq('organizationId', organizationId)
      .select('*, channel:Channel(id, name, whatsappProvider)')
      .single()

    if (error) throw error
    return updated
  }

  static async delete(id: string, organizationId: string) {
    const { error } = await supabaseAdmin
      .from('WhatsAppTemplate')
      .delete()
      .eq('id', id)
      .eq('organizationId', organizationId)

    if (error) throw error
    return { success: true }
  }
}
