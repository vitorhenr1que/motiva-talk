import { supabaseAdmin } from '@/lib/supabase-admin';
import { WebhookEvent } from './provider';

export class WebhookIngestionService {
  /**
   * Main entry point for ingesting incoming messages from WhatsApp.
   */
  static async ingestMessage(event: WebhookEvent) {
    const { channelId, senderPhone, senderName, content, messageType, metadata } = event;
    const externalMessageId = metadata?.key?.id;

    if (!senderPhone || !content) {
      console.warn('Skipping message ingestion: missing senderPhone or content');
      return;
    }

    try {
      // 1. Identify Channel (handles UUID dash differences)
      const { data: channels } = await supabaseAdmin
        .from('Channel')
        .select('*')

      const channel = channels?.find(c => 
        c.id === channelId || 
        c.id.replace(/-/g, '') === channelId ||
        c.providerSessionId === channelId
      );

      if (!channel) {
        console.error(`Channel with ID ${channelId} not found for message ingestion.`);
        return;
      }

      // 2. Deduplicate
      if (externalMessageId) {
        const { data: existing } = await supabaseAdmin
          .from('Message')
          .select('id')
          .eq('externalMessageId', externalMessageId)
          .maybeSingle()
        
        if (existing) {
          console.log(`Duplicate message ${externalMessageId} ignored.`);
          return;
        }
      }

      // 3. Identify or Create Contact
      const { data: contact, error: contactError } = await supabaseAdmin
        .from('Contact')
        .upsert({ 
          phone: senderPhone, 
          name: senderName || senderPhone 
        }, { onConflict: 'phone' })
        .select()
        .single()

      if (contactError || !contact) throw contactError || new Error('Failed to identify contact');

      // 4. Identify or Create Open Conversation
      let { data: conversation } = await supabaseAdmin
        .from('Conversation')
        .select('*')
        .eq('contactId', contact.id)
        .eq('channelId', channel.id)
        .in('status', ['OPEN', 'IN_PROGRESS'])
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!conversation) {
        const { data: newConv, error: newConvError } = await supabaseAdmin
          .from('Conversation')
          .insert([{
            contactId: contact.id,
            channelId: channel.id,
            status: 'OPEN',
            lastMessageAt: new Date().toISOString()
          }])
          .select()
          .single()
        
        if (newConvError) throw newConvError
        conversation = newConv
      }

      // 5. Save Message
      const { data: newMessage, error: msgError } = await supabaseAdmin
        .from('Message')
        .insert([{
          conversationId: conversation.id,
          channelId: channel.id,
          senderType: 'USER',
          content: content,
          type: messageType || 'TEXT',
          externalMessageId: externalMessageId,
        }])
        .select()
        .single()

      if (msgError) throw msgError

      // 6. Update Conversation lastActivity
      await supabaseAdmin
        .from('Conversation')
        .update({ lastMessageAt: new Date().toISOString() })
        .eq('id', conversation.id)

      // 7. Success & Realtime Notification
      console.log(`Message from ${senderPhone} ingested successfully into conversation ${conversation.id}`);
      
      const { RealtimeService } = await import('@/services/realtime.service');
      await RealtimeService.notifyNewMessage(conversation.id, newMessage);

      return { conversation, message: newMessage };

    } catch (error) {
      console.error('CRITICAL: Message ingestion failed:', error);
      throw error;
    }
  }
}
