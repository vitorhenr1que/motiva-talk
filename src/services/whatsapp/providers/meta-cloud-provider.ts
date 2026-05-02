import { Channel, MessageType } from "@/types/chat";
import { WhatsAppProvider } from "./whatsapp-provider";
import { WebhookEvent } from "../provider";

export class MetaCloudProvider implements WhatsAppProvider {
  private maskId(value: string) {
    if (!value) return '';
    if (value.length <= 6) return '***';
    return `${value.slice(0, 3)}***${value.slice(-3)}`;
  }

  private getCredentials(channel: Channel) {
    if (!channel.metaPhoneNumberId || !channel.metaAccessToken) {
      throw new Error('Canal Meta Cloud sem Phone Number ID ou Access Token configurado.');
    }

    return {
      phoneNumberId: channel.metaPhoneNumberId.trim(),
      accessToken: channel.metaAccessToken.trim()
    };
  }

  private buildGraphError(action: string, status: number, data: any, context: Record<string, unknown>) {
    const error = data?.error || {};
    const details = error?.error_data?.details || error?.error_user_msg || error?.message;
    const parts = [
      `${action} falhou na Meta Cloud API`,
      `http=${status}`,
      error.code ? `code=${error.code}` : null,
      error.error_subcode ? `subcode=${error.error_subcode}` : null,
      error.type ? `type=${error.type}` : null,
      error.fbtrace_id ? `fbtrace_id=${error.fbtrace_id}` : null,
      details ? `details=${details}` : null,
    ].filter(Boolean);

    console.error('[META_CLOUD_PROVIDER] Graph API error:', {
      action,
      status,
      code: error.code,
      subcode: error.error_subcode,
      type: error.type,
      message: error.message,
      details,
      fbtraceId: error.fbtrace_id,
      ...context,
    });

    return new Error(parts.join(' | '));
  }

  async sendTextMessage(channel: Channel, to: string, text: string, quotedMessageId?: string): Promise<string> {
    const { phoneNumberId, accessToken } = this.getCredentials(channel);
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/\D/g, ''),
      type: "text",
      text: { body: text }
    };

    if (quotedMessageId) {
      payload.context = { message_id: quotedMessageId };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw this.buildGraphError('sendTextMessage', response.status, data, {
        phoneNumberId: this.maskId(phoneNumberId),
        to: this.maskId(payload.to),
      });
    }

    const messageId = data.messages?.[0]?.id;
    if (!messageId) throw new Error('Meta Cloud API não retornou o ID da mensagem enviada.');
    return messageId;
  }

  async sendMediaMessage(
    channel: Channel,
    to: string,
    mediaUrl: string,
    type: MessageType,
    fileName?: string,
    caption?: string,
    quotedMessageId?: string
  ): Promise<string> {
    const { phoneNumberId, accessToken } = this.getCredentials(channel);
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const typeMap: Record<string, string> = {
        'IMAGE': 'image',
        'VIDEO': 'video',
        'AUDIO': 'audio',
        'DOCUMENT': 'document',
    };

    const metaType = typeMap[type] || 'document';
    const payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/\D/g, ''),
      type: metaType,
      [metaType]: {
        link: mediaUrl,
        caption: caption,
        filename: fileName
      }
    };

    if (quotedMessageId) {
      payload.context = { message_id: quotedMessageId };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
        throw this.buildGraphError('sendMediaMessage', response.status, data, {
          phoneNumberId: this.maskId(phoneNumberId),
          to: this.maskId(payload.to),
          type: metaType,
        });
    }

    const messageId = data.messages?.[0]?.id;
    if (!messageId) throw new Error('Meta Cloud API não retornou o ID da mídia enviada.');
    return messageId;
  }

  async sendContactMessage(
    channel: Channel,
    to: string,
    contact: { fullName: string; phoneNumber: string; wuid?: string },
    quotedMessageId?: string
  ): Promise<string> {
    const { phoneNumberId, accessToken } = this.getCredentials(channel);
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    
    // Meta Cloud API contacts format
    const payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/\D/g, ''),
      type: "contacts",
      contacts: [{
        name: {
          first_name: contact.fullName.split(' ')[0],
          formatted_name: contact.fullName,
          last_name: contact.fullName.split(' ').slice(1).join(' ') || ''
        },
        phones: [{
          phone: contact.phoneNumber.replace(/\D/g, ''),
          type: "WORK",
          wa_id: (contact.wuid || contact.phoneNumber).replace(/\D/g, '')
        }]
      }]
    };
    
    if (quotedMessageId) {
      payload.context = { message_id: quotedMessageId };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw this.buildGraphError('sendContactMessage', response.status, data, {
        phoneNumberId: this.maskId(phoneNumberId),
        to: this.maskId(payload.to),
      });
    }

    const messageId = data.messages?.[0]?.id;
    if (!messageId) throw new Error('Meta Cloud API não retornou o ID do contato enviado.');
    return messageId;
  }

  verifyWebhookChallenge(token: string, query: any): string | null {
    const mode = query['hub.mode'];
    const verifyToken = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && verifyToken === token) {
      return challenge;
    }
    return null;
  }

  async parseIncomingWebhook(body: any): Promise<WebhookEvent> {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];
    const phone_number_id = value?.metadata?.phone_number_id;

    if (!message) {
      const status = value?.statuses?.[0];
      if (status) {
          return {
              type: 'STATUS',
              channelId: phone_number_id,
              timestamp: Date.now(),
              metadata: status
          };
      }

      return {
        type: 'STATUS',
        channelId: phone_number_id || '',
        timestamp: Date.now(),
        metadata: body
      };
    }

    const senderPhone = message.from;
    const senderName = contact?.profile?.name || senderPhone;
    
    let content = '';
    let type: MessageType = 'TEXT';
    let mediaFields: any = {};

    switch (message.type) {
        case 'text':
            content = message.text?.body;
            type = 'TEXT';
            break;
        case 'image':
            type = 'IMAGE';
            content = message.image?.caption || '';
            mediaFields = {
                mediaUrl: message.image?.id,
                mimeType: message.image?.mime_type,
            };
            break;
        case 'video':
            type = 'VIDEO';
            content = message.video?.caption || '';
            mediaFields = {
                mediaUrl: message.video?.id,
                mimeType: message.video?.mime_type,
            };
            break;
        case 'audio':
            type = 'AUDIO';
            mediaFields = {
                mediaUrl: message.audio?.id,
                mimeType: message.audio?.mime_type,
            };
            break;
        case 'document':
            type = 'DOCUMENT';
            content = message.document?.caption || '';
            mediaFields = {
                mediaUrl: message.document?.id,
                fileName: message.document?.filename,
                mimeType: message.document?.mime_type,
            };
            break;
        case 'sticker':
            type = 'STICKER';
            mediaFields = {
                mediaUrl: message.sticker?.id,
                mimeType: message.sticker?.mime_type,
            };
            break;
        case 'location':
            type = 'LOCATION';
            content = `📍 ${message.location?.name || 'Localização'}: ${message.location?.address || ''} (${message.location?.latitude}, ${message.location?.longitude})`;
            break;
        case 'reaction':
            type = 'REACTION';
            content = message.reaction?.emoji || '';
            break;
        default:
            type = 'SYSTEM';
            content = `[Mensagem do tipo ${message.type} não suportada]`;
    }

    return {
      type: 'MESSAGE',
      channelId: phone_number_id,
      senderPhone,
      senderName,
      content,
      messageType: type,
      timestamp: parseInt(message.timestamp) * 1000,
      targetMessageId: message.reaction?.message_id,
      metadata: {
        ...message,
        externalId: message.id,
        fromMe: false,
        quotedMessageExternalId: message.context?.id
      },
      ...mediaFields
    };
  }

  async downloadMedia(channel: Channel, mediaId: string): Promise<Buffer> {
    const { accessToken } = this.getCredentials(channel);
    const url = `https://graph.facebook.com/v18.0/${mediaId}`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data = await response.json();
    const downloadUrl = data.url;

    if (!downloadUrl) throw new Error('Could not get download URL for Meta media');

    const mediaResponse = await fetch(downloadUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    return Buffer.from(await mediaResponse.arrayBuffer());
  }

  async getConnectionStatus(channel: Channel): Promise<'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'> {
    return 'CONNECTED';
  }

  async connect(channel: Channel): Promise<any> {
    return { success: true };
  }

  async disconnect(channel: Channel): Promise<void> {
  }

  async deleteMessage(channel: Channel, to: string, externalId: string, fromMe: boolean): Promise<void> {
    // Meta Cloud API supports deleting messages sent by the business
    if (!fromMe) return;

    const { phoneNumberId, accessToken } = this.getCredentials(channel);
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      status: "deleted",
      message_id: externalId
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const data = await response.json();
        throw this.buildGraphError('deleteMessage', response.status, data, {
          phoneNumberId: this.maskId(phoneNumberId),
        });
    }
  }

  async sendPresence(channel: Channel, to: string, presence: 'composing' | 'paused'): Promise<void> {
    // Meta Cloud doesn't have a direct equivalent to "typing" indicator in the same way,
    // but some versions of the API support it. For now we skip or mock.
  }

  async editMessage(channel: Channel, to: string, externalId: string, fromMe: boolean, newContent: string): Promise<any> {
    // Meta Cloud API support for editing messages is limited and might require a different endpoint or version.
    // As of v18.0, it's not a standard "edit" like Evolution API.
    throw new Error('Editing messages is not supported in Meta Cloud API yet.');
  }

  async sendReaction(channel: Channel, to: string, externalId: string, fromMe: boolean, emoji: string): Promise<any> {
    const { phoneNumberId, accessToken } = this.getCredentials(channel);
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/\D/g, ''),
      type: "reaction",
      reaction: {
        message_id: externalId,
        emoji: emoji
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const data = await response.json();
        throw this.buildGraphError('sendReaction', response.status, data, {
          phoneNumberId: this.maskId(phoneNumberId),
          to: this.maskId(payload.to),
        });
    }
  }
}

export const metaCloudProvider = new MetaCloudProvider();
