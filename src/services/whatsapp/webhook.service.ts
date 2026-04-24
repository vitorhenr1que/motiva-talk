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
        console.log(`[WEBHOOK_SERVICE] Incoming MESSAGE for channel ${event.channelId} from ${event.senderPhone}`);
        console.log(`[WEBHOOK_SERVICE] Context: contentPrefix='${event.content?.substring(0, 15)}...', type=${event.messageType}`);
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
    const rawStatus = event.metadata?.status;
    if (!rawStatus) return;

    // Sincronizar com o mapeamento centralizado do provider
    const { evolutionProvider } = await import('./evolution-provider');
    const internalStatus = evolutionProvider.mapStatus(rawStatus);

    console.log(`[WEBHOOK] Connection Update: Channel[${event.channelId}] Raw[${rawStatus}] -> Int[${internalStatus}]`);
    
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
      console.log(`[WEBHOOK] Aplicando status ${internalStatus} ao canal ${channel.id}`);
      const { error } = await supabaseAdmin
        .from('Channel')
        .update({ connectionStatus: internalStatus })
        .eq('id', channel.id)
      
      if (error) console.error(`[WEBHOOK] Erro ao persistir no banco: ${error.message}`);
    } else {
      console.error(`[WEBHOOK] Canal NÃO encontrado para evento: ${event.channelId}`);
    }
  }

  private static async handleIncomingMessage(event: WebhookEvent) {
    const { WebhookIngestionService } = await import('./webhook-ingestion.service');
    
    // 1. Detectar se a mensagem recebida contém quoted message
    const quotedId = event.metadata?.quotedMessageExternalId || event.metadata?.quoted?.key?.id;
    const hasSnapshot = !!event.metadata?.quotedMessageSnapshot;
    const isOutbound = !!event.metadata?.fromMe;
    
    console.log(`[WEBHOOK_DEBUG] Processando Mensagem. Inbound? ${!isOutbound} | Possui contextInfo? ${!!event.metadata?.quotedMessageExternalId || hasSnapshot}`);
    
    if (quotedId) {
      console.log(`[WEBHOOK_DEBUG] Quoted Message external ID detectado: ${quotedId}`);
      console.log(`[WEBHOOK_DEBUG] Valor de stanzaId (quotedId): ${quotedId}`);
      
      // 2. Buscar no banco a mensagem original pelo externalMessageId
      const { data: originalMsg } = await supabaseAdmin
        .from('Message')
        .select('id')
        .eq('externalMessageId', quotedId)
        .maybeSingle();
      
      if (originalMsg) {
        // Encontrou! Guardamos no metadata para o ingestMessage usar
        event.metadata.resolvedReplyToId = originalMsg.id;
        console.log(`[WEBHOOK_DEBUG] Mensagem original encontrada no banco! Original DB ID: ${originalMsg.id}`);
      } else {
        console.log(`[WEBHOOK_DEBUG] Mensagem original [${quotedId}] não encontrada no banco.`);
        if (hasSnapshot) {
           console.log(`[WEBHOOK_DEBUG] Salvando snapshot da citação. Snapshot info: ${event.metadata.quotedMessageSnapshot.quotedMessageType}`);
        }
      }
    } else {
      console.log(`[WEBHOOK_DEBUG] Mensagem normal sem quotedMessage.`);
    }

    try {
      await WebhookIngestionService.ingestMessage(event);
    } catch (error) {
      console.error('Failed to ingest incoming message from webhook:', error);
    }
  }
}
