import { supabaseAdmin } from '@/lib/supabase-admin'

export class SettingRepository {
  static async getChatSettings() {
    const { data: settings, error } = await supabaseAdmin
      .from('ChatSetting')
      .select('*')
      .single()

    if (error && error.code === 'PGRST116') return null
    if (error) throw error
    return settings
  }

  static async updateChatSettings(id: string, data: any) {
    const { data: updated, error } = await supabaseAdmin
      .from('ChatSetting')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return updated
  }
}
