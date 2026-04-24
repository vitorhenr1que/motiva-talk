import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Generic Realtime Service for broadcasting events to the frontend.
 * Uses Supabase Realtime Broadcast for instant updates.
 */
export class RealtimeService {
  static async publish(channelName: string, event: string, payload: any) {
    console.log(`[REALTIME_BROADCAST] Channel: ${channelName}, Event: ${event}`);
    
    try {
      const channel = supabaseAdmin.channel(channelName);
      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event,
            payload
          });
          // Cleanup
          supabaseAdmin.removeChannel(channel);
        }
      });
    } catch (err) {
      console.error(`[REALTIME_ERROR] Failed to publish on ${channelName}:`, err);
    }
  }

  static async notifyNewMessage(conversationId: string, message: any) {
    // 1. Notificar a conversa específica
    await this.publish(`conversation:${conversationId}`, 'message:new', { message });
    // 2. Notificar o inbox geral (sidebar)
    await this.publish('inbox:all', 'inbox:update', { conversationId, message });
  }

  static async notifyMessageUpdate(conversationId: string, message: any) {
    // Notifica que uma mensagem foi alterada (ex: edição)
    await this.publish(`conversation:${conversationId}`, 'message:update', { message });
  }

  static async notifyConversationUpdate(conversationId: string) {
    await this.publish('inbox', 'CONVERSATION_UPDATED', { conversationId });
  }
}
