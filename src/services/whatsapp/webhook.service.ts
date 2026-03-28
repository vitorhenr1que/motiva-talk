import { supabaseAdmin } from '@/lib/supabase-admin';
import { WebhookEvent } from './provider';

export class WebhookService {
  /**
   * Main entry point for processing generic session/message events 
   * arriving from any WhatsApp provider.
   */
  static async processEvent(event: WebhookEvent) {
    console.log(`Processing ${event.type} event for channel ${event.channelId}`);

    switch (event.type) {
      case 'CONNECTION':
        await this.handleConnectionUpdate(event);
        break;
      
      case 'MESSAGE':
        await this.handleIncomingMessage(event);
        break;

      case 'STATUS':
        // Status updates like QR code changed
        if (event.metadata?.qrcode) {
           console.log(`QR Code updated for canal ${event.channelId}`);
        }
        break;
    }
  }

  private static async handleConnectionUpdate(event: WebhookEvent) {
    const status = event.metadata?.status;
    if (!status) return;

    console.log(`Updating connection status for ${event.channelId} to ${status}`);
    
    // Find channel by ID or providerSessionId (handles UUID dash differences)
    const { data: channels } = await supabaseAdmin
      .from('Channel')
      .select('id, providerSessionId')

    const channel = channels?.find(c => 
      c.id === event.channelId || 
      c.id.replace(/-/g, '') === event.channelId ||
      c.providerSessionId === event.channelId
    );

    if (channel) {
      console.log(`Canal encontrado! Atualizando ID ${channel.id} para status ${status}`);
      const { error } = await supabaseAdmin
        .from('Channel')
        .update({ connectionStatus: status })
        .eq('id', channel.id)
      
      if (error) console.error(`Erro ao atualizar banco: ${error.message}`);
    } else {
      console.error(`Canal NÃO encontrado para o ID de evento: ${event.channelId}`);
    }
  }

  private static async handleIncomingMessage(event: WebhookEvent) {
    const { WebhookIngestionService } = await import('./webhook-ingestion.service');
    
    try {
      await WebhookIngestionService.ingestMessage(event);
    } catch (error) {
      console.error('Failed to ingest incoming message from webhook:', error);
    }
  }
}
