import { Channel, MessageType } from '@/types/chat';
import { WhatsAppProvider, SessionStatus, QrCodeData, WebhookEvent } from './provider';
import { evolutionApi } from '@/lib/evolution-api-client';
import { formatPhone } from '@/lib/utils';

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
    quoted?: { id: string, content: string, fromMe: boolean, type?: string },
    metadata?: any
  ): Promise<any> {
    const instanceName = this.getInstanceName(channel);
    const cleanNumber = recipient.replace(/\D/g, '');

    // Formata o quoted para os formatos da Evolution API
    let quotedPayload: any = undefined;
    if (quoted) {
      let quotedMessage: any = { conversation: quoted.content };
      if (quoted.type === 'IMAGE') quotedMessage = { imageMessage: { caption: quoted.content } };
      else if (quoted.type === 'AUDIO') quotedMessage = { audioMessage: { caption: 'Áudio' } };
      else if (quoted.type === 'VIDEO') quotedMessage = { videoMessage: { caption: quoted.content } };
      else if (quoted.type === 'DOCUMENT') quotedMessage = { documentMessage: { caption: 'Documento' } };

      quotedPayload = {
        key: { 
          id: quoted.id,
          fromMe: quoted.fromMe,
          remoteJid: `${cleanNumber}@s.whatsapp.net`
        },
        message: quotedMessage
      };
    }

    // Envio baseado no tipo
    if (type === 'TEXT') {
      return evolutionApi.sendMessage(instanceName, { 
        number: cleanNumber, 
        text: content,
        quoted: quotedPayload 
      });
    }

    if (type === 'IMAGE' || type === 'VIDEO' || type === 'AUDIO' || type === 'DOCUMENT') {
      const mediatype = type.toLowerCase() as any;
      const media = metadata?.mediaUrl || content; 
      
      return evolutionApi.sendMedia(instanceName, {
        number: cleanNumber,
        mediatype,
        media: media,
        fileName: metadata?.fileName || (type === 'VIDEO' ? 'video.mp4' : (type === 'IMAGE' ? 'imagem.jpg' : 'arquivo')),
        caption: (type !== 'AUDIO') ? (metadata?.caption || (media === content ? '' : content) || '') : undefined,
        ptt: type === 'AUDIO', // Send audio as voice note (ptt)
        quoted: quotedPayload
      });
    }

    if (type === 'CONTACT') {
      const contactInfo = metadata?.contact || { fullName: 'Contato', wuid: cleanNumber };
      const finalContact = {
        fullName: contactInfo.fullName,
        wuid: contactInfo.wuid || cleanNumber,
        phoneNumber: contactInfo.phoneNumber || contactInfo.wuid || cleanNumber
      };

      return evolutionApi.sendContact(instanceName, {
        number: cleanNumber,
        contact: [finalContact],
        quoted: quotedPayload
      });
    }
    throw new Error(`Tipo de mensagem ${type} ainda não implementado no provider.`);
  }

  async editMessage(channel: Channel, recipient: string, externalId: string, fromMe: boolean, newContent: string): Promise<any> {
    const instanceName = this.getInstanceName(channel);
    const cleanNumber = recipient.replace(/\D/g, '');
    const remoteJid = recipient.includes('@') ? recipient : `${cleanNumber}@s.whatsapp.net`;

    console.log(`[EVO_PROVIDER] Editando mensagem: Inst[${instanceName}] MsgID[${externalId}]`);

    try {
      return await evolutionApi.editMessage(instanceName, {
        number: cleanNumber,
        text: newContent,
        key: {
          remoteJid,
          fromMe,
          id: externalId
        }
      });
    } catch (error: any) {
      console.error(`[EVO_PROVIDER] Falha ao editar mensagem via API: ${error.message}`);
      throw error;
    }
  }

  async sendReaction(channel: Channel, recipient: string, externalId: string, fromMe: boolean, emoji: string): Promise<any> {
    const instanceName = this.getInstanceName(channel);
    const cleanNumber = recipient.replace(/\D/g, '');
    const remoteJid = recipient.includes('@') ? recipient : `${cleanNumber}@s.whatsapp.net`;

    return evolutionApi.sendReaction(instanceName, {
      number: cleanNumber,
      reaction: emoji,
      key: {
        remoteJid,
        fromMe,
        id: externalId
      }
    });
  }

  /**
   * Apaga uma mensagem para todos (via Evolution API)
   */
  async deleteMessage(channel: Channel, recipient: string, externalId: string, fromMe: boolean): Promise<void> {
    const instanceName = this.getInstanceName(channel);
    const cleanNumber = recipient.replace(/\D/g, '');
    
    console.log(`[EVO_PROVIDER] Apagando mensagem para todos: Inst[${instanceName}] MsgID[${externalId}]`);
    
    try {
      const remoteJid = recipient.includes('@') ? recipient : `${recipient.replace(/\D/g, '')}@s.whatsapp.net`;
      await evolutionApi.deleteMessage(instanceName, {
        remoteJid,
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
   * Busca a URL da foto de perfil de um contato
   */
  async fetchProfilePictureUrl(channel: Channel, recipient: string): Promise<string | null> {
    const instanceName = this.getInstanceName(channel);
    const cleanNumber = recipient.replace(/\D/g, '');
    
    try {
      return await evolutionApi.fetchProfilePictureUrl(instanceName, cleanNumber);
    } catch (e) {
      return null;
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
    
    // ATENÇÃO: Se a mensagem foi enviada pelo próprio sistema/atendente (fromMe = true),
    // o "pushName" retornado pelo Webhook seria o NOSSO nome de perfil, e não o do cliente final.
    // Portanto, para "fromMe", descartamos o pushName e usamos o número do cliente destino.
    const senderName = fromMe 
       ? formatPhone(senderPhone) 
       : (rawMessage.pushName || data.pushName || formatPhone(senderPhone));
       
    const fullJid = jid;

    // Content/Caption discovery
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
        m.documentWithCaptionMessage?.message?.documentMessage?.caption ||
        ''
      );
    };

    let content = getMessageContent(message);
    if (!content && message.message) content = getMessageContent(message.message);

    // Media & Type discovery
    let type: MessageType = 'TEXT';
    let mediaFields: { 
      mediaUrl?: string, 
      fileName?: string, 
      mimeType?: string, 
      fileSize?: number, 
      duration?: number,
      thumbnailUrl?: string,
      base64?: string,
      targetMessageId?: string 
    } = {};

    let inner = message.message || message;
    
    // Unwrap documentWithCaptionMessage which WhatsApp uses for documents with captions
    if (inner.documentWithCaptionMessage?.message) {
      inner = inner.documentWithCaptionMessage.message;
    }
    
    if (inner.imageMessage) {
      type = 'IMAGE';
      mediaFields = {
        mediaUrl: inner.imageMessage.url,
        mimeType: inner.imageMessage.mimetype,
        fileSize: inner.imageMessage.fileLength,
        thumbnailUrl: inner.imageMessage.jpegThumbnail ? `data:image/jpeg;base64,${inner.imageMessage.jpegThumbnail}` : undefined,
        base64: inner.imageMessage.base64
      };
    } else if (inner.videoMessage) {
      type = 'VIDEO';
      mediaFields = {
        mediaUrl: inner.videoMessage.url,
        mimeType: inner.videoMessage.mimetype,
        fileSize: inner.videoMessage.fileLength,
        duration: inner.videoMessage.seconds,
        thumbnailUrl: inner.videoMessage.jpegThumbnail ? `data:image/jpeg;base64,${inner.videoMessage.jpegThumbnail}` : undefined,
        base64: inner.videoMessage.base64
      };
    } else if (inner.audioMessage) {
      type = 'AUDIO';
      mediaFields = {
        mediaUrl: inner.audioMessage.url,
        mimeType: inner.audioMessage.mimetype,
        fileSize: inner.audioMessage.fileLength,
        duration: inner.audioMessage.seconds,
        base64: inner.audioMessage.base64
      };
      console.log(`[EVO_WEBHOOK] Áudio detectado! Base64: ${!!mediaFields.base64}, Duração: ${mediaFields.duration}s`);
    } else if (inner.documentMessage) {
      type = 'DOCUMENT';
      mediaFields = {
        mediaUrl: inner.documentMessage.url,
        fileName: inner.documentMessage.fileName || 'arquivo.pdf',
        mimeType: inner.documentMessage.mimetype,
        fileSize: inner.documentMessage.fileLength,
        base64: inner.documentMessage.base64
      };
    } else if (inner.reactionMessage) {
      type = 'REACTION';
      content = inner.reactionMessage.text;
      mediaFields = {
        targetMessageId: inner.reactionMessage.key?.id
      };
    } else if (inner.contactMessage || inner.contactsArrayMessage) {
      type = 'CONTACT';
    }

    let quotedMessageExternalId: string | null = null;
    let quotedMessageSnapshot: any = null;
    const contextInfo = rawMessage.contextInfo ||
                        data.contextInfo ||
                        inner.contextInfo || 
                        inner.extendedTextMessage?.contextInfo ||
                        inner.imageMessage?.contextInfo || 
                        inner.videoMessage?.contextInfo ||
                        inner.audioMessage?.contextInfo || 
                        inner.documentMessage?.contextInfo;
    
    if (contextInfo?.stanzaId) {
      quotedMessageExternalId = contextInfo.stanzaId;
      
      if (contextInfo.quotedMessage) {
        let qType = 'TEXT';
        let qText = '';
        let qFileName = '';
        const qMsg = contextInfo.quotedMessage;
        
        if (qMsg.conversation || qMsg.extendedTextMessage) {
          qType = 'TEXT';
          qText = qMsg.conversation || qMsg.extendedTextMessage?.text || '';
        } else if (qMsg.imageMessage) {
          qType = 'IMAGE';
          qText = qMsg.imageMessage.caption || '';
        } else if (qMsg.videoMessage) {
          qType = 'VIDEO';
          qText = qMsg.videoMessage.caption || '';
        } else if (qMsg.audioMessage) {
          qType = 'AUDIO';
        } else if (qMsg.documentMessage) {
          qType = 'DOCUMENT';
          qFileName = qMsg.documentMessage.fileName || 'Documento';
          qText = qMsg.documentMessage.caption || '';
        }
        
        quotedMessageSnapshot = {
          quotedText: qText || `[${qType}]`,
          quotedSender: contextInfo.participant?.split('@')[0] || '',
          quotedMessageType: qType,
          quotedFileName: qFileName
        };
      }
    }

    const rawTimestamp = rawMessage.messageTimestamp || data.messageTimestamp;
    const timestamp = rawTimestamp ? rawTimestamp * 1000 : Date.now();

    return {
      instanceName,
      externalMessageId,
      senderPhone,
      senderName,
      content: content || (type === 'TEXT' ? '' : `[${type}]`),
      type,
      timestamp,
      fromMe,
      quotedMessageExternalId,
      quotedMessageSnapshot,
      fullJid,
      ...mediaFields,
      raw: rawMessage
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
          mediaUrl: (normalized as any).mediaUrl,
          fileName: (normalized as any).fileName,
          mimeType: (normalized as any).mimeType,
          fileSize: (normalized as any).fileSize,
          duration: (normalized as any).duration,
          base64: (normalized as any).base64,
          thumbnailUrl: (normalized as any).thumbnailUrl,
          targetMessageId: normalized.targetMessageId,
          metadata: { 
            ...normalized.raw, 
            externalId: normalized.externalMessageId,
            fromMe: normalized.fromMe,
            quotedMessageExternalId: normalized.quotedMessageExternalId,
            quotedMessageSnapshot: (normalized as any).quotedMessageSnapshot,
            jid: normalized.fullJid
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
