import { Channel, MessageType } from "@/types/chat";
import { WhatsAppProvider } from "./whatsapp-provider";
import { WebhookEvent } from "../provider";

export class MetaCloudProvider implements WhatsAppProvider {
  private getCredentials(channel: Channel) {
    if (!channel.metaPhoneNumberId || !channel.metaAccessToken) {
      throw new Error('Canal Meta Cloud sem Phone Number ID ou Access Token configurado.');
    }

    return {
      phoneNumberId: channel.metaPhoneNumberId,
      accessToken: channel.metaAccessToken
    };
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
      throw new Error(data?.error?.message || 'Failed to send Meta Cloud message');
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
        throw new Error(data?.error?.message || 'Failed to send Meta Cloud media message');
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
      throw new Error(data?.error?.message || 'Failed to send Meta Cloud contact message');
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
      metadata: {
        ...message,
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
        throw new Error(data?.error?.message || 'Failed to delete Meta Cloud message');
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
        throw new Error(data?.error?.message || 'Failed to send Meta Cloud reaction');
    }
  }
}

export const metaCloudProvider = new MetaCloudProvider();
