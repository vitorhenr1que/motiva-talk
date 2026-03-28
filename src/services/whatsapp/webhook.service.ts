import prisma from '@/lib/prisma';
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
    
    // Find channel by ID or providerSessionId
    const channel = await prisma.channel.findFirst({
      where: {
        OR: [
          { id: event.channelId },
          { providerSessionId: event.channelId }
        ]
      }
    });

    if (channel) {
      await prisma.channel.update({
        where: { id: channel.id },
        data: { connectionStatus: status }
      });
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
