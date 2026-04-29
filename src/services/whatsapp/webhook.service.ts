import { supabaseAdmin } from '@/lib/supabase-admin';
import { WebhookEvent } from './provider';
import { TenantChannel } from './tenant-resolver';

export class WebhookService {
  /**
   * Entry point para eventos genéricos vindos de qualquer provider de WhatsApp.
   * O channel já vem resolvido pelo route — todo organizationId daqui pra baixo
   * é confiável e vem do banco, nunca do payload.
   */
  static async processEvent(event: WebhookEvent, channel: TenantChannel) {
    const { organizationId, id: channelId } = channel;
    console.log(
      `[WEBHOOK_SERVICE] type=${event.type} org=${organizationId} channel=${channelId}`
    );

    switch (event.type) {
      case 'CONNECTION':
        await this.handleConnectionUpdate(event, channel);
        break;

      case 'MESSAGE':
        console.log(
          `[WEBHOOK_SERVICE] Incoming MESSAGE org=${organizationId} channel=${channelId} from=${event.senderPhone}`
        );
        console.log(
          `[WEBHOOK_SERVICE] Context: contentPrefix='${event.content?.substring(0, 15)}...', type=${event.messageType}`
        );
        await this.handleIncomingMessage(event, channel);
        break;

      case 'STATUS':
        if (event.metadata?.qrcode) {
          console.log(`[WEBHOOK_SERVICE] QR Code atualizado para canal ${channelId} (org=${organizationId})`);
        }
        break;
    }
  }

  private static async handleConnectionUpdate(event: WebhookEvent, channel: TenantChannel) {
    const rawStatus = event.metadata?.status;
    if (!rawStatus) return;

    const { evolutionProvider } = await import('./evolution-provider');
    const internalStatus = evolutionProvider.mapStatus(rawStatus);

    console.log(
      `[WEBHOOK] Connection Update: org=${channel.organizationId} channel=${channel.id} Raw[${rawStatus}] -> Int[${internalStatus}]`
    );

    const { error } = await supabaseAdmin
      .from('Channel')
      .update({ connectionStatus: internalStatus })
      .eq('id', channel.id)
      .eq('organizationId', channel.organizationId);

    if (error) console.error(`[WEBHOOK] Erro ao persistir status no banco: ${error.message}`);
  }

  private static async handleIncomingMessage(event: WebhookEvent, channel: TenantChannel) {
    const { WebhookIngestionService } = await import('./webhook-ingestion.service');

    // 1. Detectar se a mensagem recebida contém quoted message
    const quotedId = event.metadata?.quotedMessageExternalId || event.metadata?.quoted?.key?.id;
    const hasSnapshot = !!event.metadata?.quotedMessageSnapshot;
    const isOutbound = !!event.metadata?.fromMe;

    console.log(
      `[WEBHOOK_DEBUG] Processando Mensagem org=${channel.organizationId} channel=${channel.id}. Inbound? ${!isOutbound} | Possui contextInfo? ${!!event.metadata?.quotedMessageExternalId || hasSnapshot}`
    );

    if (quotedId) {
      console.log(`[WEBHOOK_DEBUG] Quoted Message external ID detectado: ${quotedId}`);

      // 2. Buscar a mensagem original SEMPRE escopada na organização do canal resolvido.
      const { data: originalMsg } = await supabaseAdmin
        .from('Message')
        .select('id')
        .eq('externalMessageId', quotedId)
        .eq('organizationId', channel.organizationId)
        .maybeSingle();

      if (originalMsg) {
        event.metadata.resolvedReplyToId = originalMsg.id;
        console.log(`[WEBHOOK_DEBUG] Mensagem original encontrada! Original DB ID: ${originalMsg.id}`);
      } else {
        console.log(`[WEBHOOK_DEBUG] Mensagem original [${quotedId}] não encontrada no tenant ${channel.organizationId}.`);
        if (hasSnapshot) {
          console.log(`[WEBHOOK_DEBUG] Snapshot disponível: ${event.metadata.quotedMessageSnapshot.quotedMessageType}`);
        }
      }
    } else {
      console.log(`[WEBHOOK_DEBUG] Mensagem normal sem quotedMessage.`);
    }

    try {
      await WebhookIngestionService.ingestMessage(event, channel);
    } catch (error) {
      console.error(
        `[WEBHOOK_SERVICE] Falha ao ingerir mensagem (org=${channel.organizationId} channel=${channel.id}):`,
        error
      );
    }
  }
}
