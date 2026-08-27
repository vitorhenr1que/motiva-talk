import { supabaseAdmin } from '@/lib/supabase-admin';
import { WebhookEvent } from './provider';
import { TenantChannel } from './tenant-resolver';

export class WebhookService {
  /**
   * Entry point para eventos vindos da Meta Cloud API.
   * O channel já vem resolvido pelo route — todo organizationId daqui pra baixo
   * é confiável e vem do banco, nunca do payload.
   */
  static async processEvent(event: WebhookEvent, channel: TenantChannel) {
    const { organizationId, id: channelId } = channel;
    console.log(
      `[WEBHOOK_SERVICE] type=${event.type} org=${organizationId} channel=${channelId}`
    );

    switch (event.type) {
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
        break;
    }
  }

  private static async handleIncomingMessage(event: WebhookEvent, channel: TenantChannel) {
    const { WebhookIngestionService } = await import('./webhook-ingestion.service');
    const metadata = event.metadata;

    // 1. Detectar se a mensagem recebida contém quoted message
    const quotedId = metadata?.quotedMessageExternalId || metadata?.quoted?.key?.id;
    const hasSnapshot = !!metadata?.quotedMessageSnapshot;
    const isOutbound = !!metadata?.fromMe;

    console.log(
      `[WEBHOOK_DEBUG] Processando Mensagem org=${channel.organizationId} channel=${channel.id}. Inbound? ${!isOutbound} | Possui contextInfo? ${!!metadata?.quotedMessageExternalId || hasSnapshot}`
    );

    if (quotedId) {
      console.log(`[WEBHOOK_DEBUG] Quoted Message external ID detectado: ${quotedId}`);

      // 2. Buscar a mensagem original SEMPRE escopada na organização do canal resolvido.
      let { data: originalMsg } = await supabaseAdmin
        .from('Message')
        .select('id, content, senderType, type')
        .eq('externalMessageId', quotedId)
        .eq('organizationId', channel.organizationId)
        .maybeSingle();

      if (!originalMsg) {
        const { data: metadataMsg } = await supabaseAdmin
          .from('Message')
          .select('id, content, senderType, type')
          .filter('metadata->>id', 'eq', quotedId)
          .eq('organizationId', channel.organizationId)
          .maybeSingle();
        originalMsg = metadataMsg;
      }

      if (originalMsg) {
        if (metadata) {
          metadata.resolvedReplyToId = originalMsg.id;

          // O webhook da Meta traz somente o ID da mensagem respondida.
          // Enriquecemos o snapshot com a fonte de verdade do banco para que
          // o realtime e o histórico exibam o conteúdo original imediatamente.
          metadata.quotedMessageSnapshot = {
            ...(metadata.quotedMessageSnapshot || {}),
            stanzaId: quotedId,
            externalId: quotedId,
            quotedText: originalMsg.content,
            quotedSender: originalMsg.senderType === 'USER' ? 'Contato' : 'Você',
            quotedMessageType: originalMsg.type,
          };
        }
        console.log(`[WEBHOOK_DEBUG] Mensagem original encontrada! Original DB ID: ${originalMsg.id}`);
      } else {
        console.log(`[WEBHOOK_DEBUG] Mensagem original [${quotedId}] não encontrada no tenant ${channel.organizationId}.`);
        if (hasSnapshot) {
          console.log(`[WEBHOOK_DEBUG] Snapshot disponível: ${metadata?.quotedMessageSnapshot?.quotedMessageType}`);
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
