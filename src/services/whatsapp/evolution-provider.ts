import { Channel, MessageType } from '@/types/chat';
import { WhatsAppProvider, SessionStatus, QrCodeData, WebhookEvent } from './provider';
import { evolutionApi } from '@/lib/evolution-api-client';

export class EvolutionProvider implements WhatsAppProvider {
  /**
   * Translates Evolution API status to our internal SessionStatus
   */
  public mapStatus(evolutionStatus: string): SessionStatus['status'] {
    const raw = (evolutionStatus || '').toLowerCase();
    let internal: SessionStatus['status'] = 'PENDING';

    switch (raw) {
      case 'open':
      case 'connected':
        internal = 'CONNECTED';
        break;
      case 'connecting':
        internal = 'CONNECTING';
        break;
      case 'qrcode':
      case 'qr':
        internal = 'QR_CODE';
        break;
      case 'close':
      case 'disconnected':
      case 'unpaired':
        internal = 'DISCONNECTED';
        break;
      case 'refused':
      case 'error':
      case 'failed':
        internal = 'ERROR';
        break;
      default:
        internal = 'PENDING';
    }

    console.log(`[EVO_DEBUG] mapStatus: Ext[${raw}] -> Int[${internal}]`);
    return internal;
  }

  /**
   * Instance name is based on the channel ID for uniqueness and consistency.
   */
  public getInstanceName(channel: Channel): string {
    if (channel.providerSessionId) return channel.providerSessionId;
    return `${channel.id.replace(/[^a-zA-Z0-9]/g, '')}`;
  }

  async createSession(channel: Channel): Promise<void> {
    const instanceName = this.getInstanceName(channel);
    console.log(`[EVO_PROVIDER] Chamando createSession para: ${instanceName}`);
    
    try {
      let exists = false;
      try {
        await evolutionApi.getInstance(instanceName);
        exists = true;
      } catch (e: any) {
        if (e.message !== 'NOT_FOUND') throw e;
      }

      if (!exists) {
        try {
          await evolutionApi.createInstance({
            instanceName,
            token: instanceName,
            webhook: {
              url: process.env.EVOLUTION_WEBHOOK_URL!,
              enabled: true,
              webhookBase64: true,
              webhookByEvents: true,
              events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT']
            }
          });
        } catch (e: any) {
          if (!e.message?.toLowerCase().includes('already in use')) throw e;
        }
      }

      await evolutionApi.setWebhook(instanceName, {
        enabled: true,
        url: process.env.EVOLUTION_WEBHOOK_URL!,
        webhookByEvents: true,
        webhookBase64: true,
        events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT']
      });

      console.log(`[EVO_PROVIDER] Sessão e Webhook prontos para ${instanceName}`);
    } catch (error: any) {
      console.error(`[EVO_PROVIDER] Falha crítica em createSession (${instanceName}): ${error.message}`);
      throw error;
    }
  }

  async getQrCode(channel: Channel): Promise<QrCodeData> {
    const instanceName = this.getInstanceName(channel);
    try {
      const data = await evolutionApi.getQrCode(instanceName);
      if (!data?.base64) throw new Error('QR Code não retornado pela API.');
      return { base64: data.base64, code: data.code || '' };
    } catch (error: any) {
      console.error(`[EVO_PROVIDER] Falha em getQrCode (${instanceName}): ${error.message}`);
      throw error;
    }
  }

  async getSessionStatus(channel: Channel): Promise<SessionStatus> {
    const instanceName = this.getInstanceName(channel);
    try {
      const state: any = await evolutionApi.getConnectionState(instanceName);
      const rawStatus = state.status || state.state || state.instance?.status || state.instance?.state || state.connection || 'DISCONNECTED';
      return { status: this.mapStatus(rawStatus) };
    } catch (e: any) {
      return { status: 'DISCONNECTED', details: e.message || 'Instância não encontrada' };
    }
  }

  async disconnectSession(channel: Channel): Promise<void> {
    const instanceName = this.getInstanceName(channel);
    try {
      await evolutionApi.logoutInstance(instanceName);
    } catch (e: any) {
      console.error(`[EVO_PROVIDER] Falha em disconnectSession (${instanceName})`);
    }
  }

  async deleteSession(channel: Channel): Promise<void> {
    const instanceName = this.getInstanceName(channel);
    try {
      await evolutionApi.deleteInstance(instanceName);
    } catch (e: any) {
      console.error(`[EVO_PROVIDER] Falha em deleteSession (${instanceName})`);
      throw e;
    }
  }

  async sendMessage(
    channel: Channel, 
    recipient: string, 
    content: string, 
    type: MessageType = 'TEXT',
    quoted?: { id: string, content: string, fromMe: boolean, type?: string }
  ): Promise<any> {
    const instanceName = this.getInstanceName(channel);
    const cleanNumber = recipient.replace(/\D/g, '');
    
    if (type !== 'TEXT') throw new Error(`Tipo de mensagem ${type} ainda não implementado.`);

    const payload: any = { number: cleanNumber, text: content };

    if (quoted) {
      let quotedMessage: any = { conversation: quoted.content };
      if (quoted.type === 'IMAGE') quotedMessage = { imageMessage: { caption: quoted.content } };
      else if (quoted.type === 'AUDIO') quotedMessage = { audioMessage: { caption: 'Áudio' } };
      else if (quoted.type === 'VIDEO') quotedMessage = { videoMessage: { caption: quoted.content } };
      else if (quoted.type === 'DOCUMENT') quotedMessage = { documentMessage: { caption: 'Documento' } };

      payload.quoted = {
        key: { 
          id: quoted.id,
          fromMe: quoted.fromMe,
          remoteJid: `${cleanNumber}@s.whatsapp.net`
        },
        message: quotedMessage
      };
    }

    return evolutionApi.sendMessage(instanceName, payload);
  }

  /**
   * Apaga uma mensagem para todos (via Evolution API)
   */
  async deleteMessage(channel: Channel, recipient: string, externalId: string, fromMe: boolean): Promise<void> {
    const instanceName = this.getInstanceName(channel);
    const cleanNumber = recipient.replace(/\D/g, '');
    
    console.log(`[EVO_PROVIDER] Apagando mensagem para todos: Inst[${instanceName}] MsgID[${externalId}]`);
    
    try {
      await evolutionApi.deleteMessage(instanceName, {
        number: cleanNumber,
        id: externalId,
        fromMe: fromMe
      });
    } catch (error: any) {
      console.error(`[EVO_PROVIDER] Falha ao apagar mensagem via API: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envia status de presença (digitando/parado)
   */
  async sendPresence(channel: Channel, recipient: string, presence: 'composing' | 'paused'): Promise<void> {
    const instanceName = this.getInstanceName(channel);
    const cleanNumber = recipient.replace(/\D/g, '');

    try {
      await evolutionApi.sendPresence(instanceName, {
        number: cleanNumber,
        presence: presence
      });
    } catch (error: any) {
      // Silencioso para não poluir logs de UI se falhar presença
    }
  }

  /**
   * Normaliza o payload bruto da Evolution API para um formato padronizado interno.
   */
  private normalizeIncomingEvolutionMessage(payload: any) {
    const data = payload.data || payload;
    const instanceName = payload.instance || data.instanceName || payload.instanceName || '';
    const rawMessage = data.messages?.[0] || data;
    const key = rawMessage.key || data.key;
    const message = rawMessage.message || data.message;

    if (!key || !message) return null;

    const externalMessageId = key.id;
    const fromMe = !!key.fromMe;
    const jid = key.remoteJid || key.participant || '';
    const senderPhone = jid.split('@')[0];
    const senderName = rawMessage.pushName || data.pushName || 'Contato WhatsApp';

    const getMessageContent = (m: any): string => {
      if (!m) return '';
      if (typeof m === 'string') return m;
      return (
        m.conversation || 
        m.extendedTextMessage?.text || 
        m.imageMessage?.caption || 
        m.videoMessage?.caption || 
        m.audioMessage?.caption ||
        m.documentMessage?.caption ||
        ''
      );
    };

    let content = getMessageContent(message);
    if (!content && message.message) content = getMessageContent(message.message);

    let type: MessageType = 'TEXT';
    const inner = message.message || message;
    if (inner.imageMessage) type = 'IMAGE';
    else if (inner.audioMessage) type = 'AUDIO';
    else if (inner.documentMessage) type = 'DOCUMENT';

    let quotedMessageExternalId: string | null = null;
    const contextInfo = inner.contextInfo || (inner.imageMessage?.contextInfo) || (inner.audioMessage?.contextInfo) || (inner.documentMessage?.contextInfo);
    if (contextInfo?.stanzaId) quotedMessageExternalId = contextInfo.stanzaId;

    const timestamp = (rawMessage.messageTimestamp || data.messageTimestamp || Date.now()) * 1000;

    return {
      instanceName,
      externalMessageId,
      senderPhone,
      senderName,
      content: content || '[Mensagem sem conteúdo textual]',
      type,
      timestamp,
      fromMe,
      quotedMessageExternalId,
      raw: payload
    };
  }

  async parseIncomingWebhook(payload: any): Promise<WebhookEvent> {
    const eventType = payload.event || payload.type;
    const data = payload.data || payload; 
    const instanceName = payload.instance || data.instanceName || payload.instanceName || '';
    
    const base: WebhookEvent = {
      channelId: instanceName,
      timestamp: Date.now(),
      type: 'STATUS',
      metadata: data
    };

    switch (eventType) {
      case 'MESSAGES_UPSERT':
      case 'messages.upsert': {
        const normalized = this.normalizeIncomingEvolutionMessage(payload);
        if (!normalized) return base;
        return {
          ...base,
          type: 'MESSAGE',
          senderPhone: normalized.senderPhone,
          senderName: normalized.senderName,
          content: normalized.content,
          messageType: normalized.type,
          metadata: { 
            ...normalized.raw, 
            externalId: normalized.externalMessageId,
            fromMe: normalized.fromMe,
            quotedMessageExternalId: normalized.quotedMessageExternalId
          }
        };
      }
      case 'CONNECTION_UPDATE':
      case 'connection.update': {
        const state = data.state || data.status || data.connection;
        return { ...base, type: 'CONNECTION', metadata: { status: this.mapStatus(state) } };
      }
      case 'QRCODE_UPDATED':
      case 'qrcode.updated': {
        const qrcode = data.qrcode?.base64 || data.base64 || data.code;
        return { ...base, type: 'STATUS', metadata: { qrcode } };
      }
      default:
        return base;
    }
  }

  async setWebhook(channel: Channel, url: string, events: string[]): Promise<void> {
    const instanceName = this.getInstanceName(channel);
    try {
      await evolutionApi.setWebhook(instanceName, { url, enabled: true, webhookByEvents: true, webhookBase64: true, events });
    } catch (error: any) {
      console.error(`[EVO_PROVIDER] Erro ao configurar webhook para ${instanceName}`);
      throw error;
    }
  }
}

export const evolutionProvider = new EvolutionProvider();
