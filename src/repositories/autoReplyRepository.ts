import { supabaseAdmin } from '@/lib/supabase-admin';
import { AutoReplySettings } from '@/types/auto-reply';

export class AutoReplyRepository {
  static async findSettings(organizationId: string, channelId: string) {
    const { data, error } = await supabaseAdmin
      .from('auto_reply_settings')
      .select('*')
      .eq('organizationId', organizationId)
      .eq('channelId', channelId)
      .maybeSingle();

    if (error) throw error;
    return data as Partial<AutoReplySettings> | null;
  }

  static async findAllSettings(organizationId: string) {
    const { data, error } = await supabaseAdmin
      .from('auto_reply_settings')
      .select('*')
      .eq('organizationId', organizationId);

    if (error) throw error;
    return (data || []) as Partial<AutoReplySettings>[];
  }

  static async findAccessibleChannels(
    organizationId: string,
    userId: string,
    isAdmin: boolean
  ) {
    let channelQuery = supabaseAdmin
      .from('Channel')
      .select('id, name, phoneNumber, isActive')
      .eq('organizationId', organizationId);

    if (!isAdmin) {
      const { data: userChannels, error } = await supabaseAdmin
        .from('UserChannel')
        .select('channelId')
        .eq('userId', userId)
        .eq('organizationId', organizationId);

      if (error) throw error;
      const allowedChannelIds = userChannels?.map(({ channelId }) => channelId) || [];
      if (allowedChannelIds.length === 0) return [];
      channelQuery = channelQuery.in('id', allowedChannelIds);
    }

    const { data, error } = await channelQuery;
    if (error) throw error;
    return data || [];
  }

  static async canAccessChannel(
    organizationId: string,
    channelId: string,
    userId: string,
    isAdmin: boolean
  ) {
    const { data: channel, error: channelError } = await supabaseAdmin
      .from('Channel')
      .select('id')
      .eq('id', channelId)
      .eq('organizationId', organizationId)
      .maybeSingle();

    if (channelError) throw channelError;
    if (!channel) return { exists: false, allowed: false };
    if (isAdmin) return { exists: true, allowed: true };

    const { data: permission, error } = await supabaseAdmin
      .from('UserChannel')
      .select('channelId')
      .eq('userId', userId)
      .eq('channelId', channelId)
      .eq('organizationId', organizationId)
      .maybeSingle();

    if (error) throw error;
    return { exists: true, allowed: Boolean(permission) };
  }

  static async upsertSettings(
    organizationId: string,
    channelId: string,
    userId: string,
    settings: AutoReplySettings
  ) {
    const { data, error } = await supabaseAdmin
      .from('auto_reply_settings')
      .upsert(
        {
          organizationId,
          channelId,
          enabled: settings.enabled,
          message: settings.message,
          cooldownHours: settings.cooldownHours,
          scheduleEnabled: settings.scheduleEnabled,
          businessHours: settings.businessHours,
          outsideHoursEnabled: settings.outsideHoursEnabled,
          outsideHoursMessage: settings.outsideHoursMessage || null,
          recessEnabled: settings.recessEnabled,
          recessStart: settings.recessStart,
          recessEnd: settings.recessEnd,
          recessMessage: settings.recessMessage || null,
          timezone: settings.timezone,
          updatedByUserId: userId,
          updatedAt: new Date().toISOString(),
        },
        { onConflict: 'channelId' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async findLastReply(organizationId: string, contactId: string, channelId: string) {
    const { data, error } = await supabaseAdmin
      .from('contact_auto_replies')
      .select('*')
      .eq('organizationId', organizationId)
      .eq('contactId', contactId)
      .eq('channelId', channelId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async recordReply(
    organizationId: string,
    contactId: string,
    channelId: string,
    sentAt: Date
  ) {
    const timestamp = sentAt.toISOString();
    const { error } = await supabaseAdmin.from('contact_auto_replies').upsert(
      {
        organizationId,
        contactId,
        channelId,
        lastAutoReplyAt: timestamp,
        updatedAt: timestamp,
      },
      { onConflict: 'contactId,channelId' }
    );

    if (error) throw error;
  }

  static async createSystemMessage(message: Record<string, unknown>) {
    const { data, error } = await supabaseAdmin
      .from('Message')
      .insert([message])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
