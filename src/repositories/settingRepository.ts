import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateId } from '@/lib/utils'

const DEFAULT_CHAT_SETTINGS = {
  autoIdentifyAgent: false,
  allowAgentNameEdit: false,
  allowAgentDeleteConversation: false,
  finishMessage: 'Seu atendimento foi finalizado. Gostaríamos de saber sua opinião sobre o nosso atendimento:',
  agentMenuVisibility: {
    conversations: true,
    funnel: true,
    reports: false,
    channels: false,
    contacts: false,
    suggestions: true,
    settings: true
  },
  defaultTriageSectorId: null
}

export class SettingRepository {
  static async findByOrganization(organizationId: string) {
    const { data: settings, error } = await supabaseAdmin
      .from('ChatSetting')
      .select('*')
      .eq('organizationId', organizationId)
      .limit(1)
      .maybeSingle()

    if (error) throw error

    if (settings) return settings

    return this.createDefaultForOrganization(organizationId)
  }

  static async getChatSettings(organizationId: string) {
    return this.findByOrganization(organizationId)
  }

  static async createDefaultForOrganization(organizationId: string) {
    const id = generateId();
    const { data: settings, error } = await supabaseAdmin
      .from('ChatSetting')
      .insert([{ ...DEFAULT_CHAT_SETTINGS, id, organizationId }])
      .select()
      .single()

    if (error) throw error
    return settings
  }

  static async updateChatSettings(id: string, organizationId: string, data: any) {
    const { data: updated, error } = await supabaseAdmin
      .from('ChatSetting')
      .update(data)
      .eq('id', id)
      .eq('organizationId', organizationId)
      .select()
      .single()

    if (error) throw error
    return updated
  }
}
