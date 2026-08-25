import { Channel, MessageType } from "@/types/chat";
import { WhatsAppProvider } from "./whatsapp-provider";
import { WebhookEvent } from "../provider";

type MetaWebhookMessageContext = {
  id?: string;
  message_id?: string;
  messageId?: string;
  from?: string;
};

type MetaWebhookMessageWithContext = {
  context?: MetaWebhookMessageContext;
};

type MetaMessageTemplate = {
  id: string;
  name: string;
  status: string;
  category?: string;
  language: string;
  rejected_reason?: string;
};

type MetaMessageTemplatePage = {
  data?: MetaMessageTemplate[];
  paging?: { next?: string };
  error?: unknown;
};

export class MetaCloudProvider implements WhatsAppProvider {
  private readonly graphVersion = process.env.META_GRAPH_API_VERSION || 'v25.0';

  private maskId(value: string) {
    if (!value) return '';
    if (value.length <= 6) return '***';
    return `${value.slice(0, 3)}***${value.slice(-3)}`;
  }

  private getCredentials(channel: Channel) {
    const phoneNumberId = channel.metaPhoneNumberId?.trim() || process.env.META_PHONE_NUMBER_ID?.trim();
    const accessToken = channel.metaAccessToken?.trim() || process.env.META_ACCESS_TOKEN?.trim();
    if (!phoneNumberId || !accessToken) {
      throw new Error('Canal Meta Cloud sem Phone Number ID ou Access Token configurado.');
    }

    return { phoneNumberId, accessToken };
  }

  private getTemplateCredentials(channel: Channel) {
    const wabaId = channel.metaWabaId?.trim() || process.env.META_WABA_ID?.trim();
    const accessToken = channel.metaAccessToken?.trim() || process.env.META_ACCESS_TOKEN?.trim();
    if (!wabaId || !accessToken) {
      throw new Error('Canal Meta Cloud sem WABA ID ou Access Token configurado.');
    }
    return { wabaId, accessToken };
  }

  private graphUrl(resource: string) {
    return `https://graph.facebook.com/${this.graphVersion}/${resource}`;
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

  private getQuotedMessageExternalId(message: MetaWebhookMessageWithContext): string | undefined {
    const context = message?.context;
    if (!context) return undefined;

    return context.id || context.message_id || context.messageId;
  }

  private buildQuotedMessageSnapshot(message: MetaWebhookMessageWithContext) {
    const quotedExternalId = this.getQuotedMessageExternalId(message);
    if (!quotedExternalId) return undefined;

    return {
      stanzaId: quotedExternalId,
      externalId: quotedExternalId,
      quotedText: '[Mensagem respondida]',
      quotedSender: message.context?.from || '',
      quotedMessageType: 'UNKNOWN',
    };
  }

  async sendTextMessage(channel: Channel, to: string, text: string, quotedMessageId?: string): Promise<string> {
    const { phoneNumberId, accessToken } = this.getCredentials(channel);
    const url = this.graphUrl(`${phoneNumberId}/messages`);
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
    const url = this.graphUrl(`${phoneNumberId}/messages`);
    const typeMap: Record<string, string> = {
        'IMAGE': 'image',
        'VIDEO': 'video',
        'AUDIO': 'audio',
        'DOCUMENT': 'document',
    };

    const metaType = typeMap[type] || 'document';
    const mediaObject: Record<string, string> = {
      link: mediaUrl,
    };

    if (caption && ['image', 'video', 'document'].includes(metaType)) {
      mediaObject.caption = caption;
    }

    if (fileName && metaType === 'document') {
      mediaObject.filename = fileName;
    }

    const payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/\D/g, ''),
      type: metaType,
      [metaType]: mediaObject
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
    const url = this.graphUrl(`${phoneNumberId}/messages`);
    
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

  async createMessageTemplate(channel: Channel, payload: any): Promise<any> {
    const { wabaId, accessToken } = this.getTemplateCredentials(channel);
    const url = this.graphUrl(`${wabaId}/message_templates`);

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
      throw this.buildGraphError('createMessageTemplate', response.status, data, {
        wabaId: this.maskId(wabaId),
        template: payload?.name,
      });
    }

    return data;
  }

  async listMessageTemplates(channel: Channel): Promise<MetaMessageTemplate[]> {
    const { wabaId, accessToken } = this.getTemplateCredentials(channel);
    const fields = 'id,name,status,category,language,rejected_reason';
    let url: string | null = this.graphUrl(
      `${wabaId}/message_templates?fields=${encodeURIComponent(fields)}&limit=250`
    );
    const templates: MetaMessageTemplate[] = [];

    while (url) {
      const response: Response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      const data: MetaMessageTemplatePage = await response.json();

      if (!response.ok) {
        throw this.buildGraphError('listMessageTemplates', response.status, data, {
          wabaId: this.maskId(wabaId),
        });
      }

      templates.push(...(Array.isArray(data?.data) ? data.data : []));
      url = typeof data?.paging?.next === 'string' ? data.paging.next : null;
    }

    return templates;
  }

  async updateMessageTemplate(channel: Channel, metaTemplateId: string, payload: any): Promise<any> {
    const accessToken = channel.metaAccessToken?.trim() || process.env.META_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      throw new Error('Canal Meta Cloud sem Access Token configurado.');
    }

    const url = this.graphUrl(metaTemplateId);
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
      throw this.buildGraphError('updateMessageTemplate', response.status, data, {
        templateId: this.maskId(metaTemplateId),
      });
    }

    return data;
  }

  async deleteMessageTemplate(channel: Channel, name: string): Promise<any> {
    const { wabaId, accessToken } = this.getTemplateCredentials(channel);
    const url = this.graphUrl(`${wabaId}/message_templates?name=${encodeURIComponent(name)}`);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw this.buildGraphError('deleteMessageTemplate', response.status, data, {
        wabaId: this.maskId(wabaId),
        template: name,
      });
    }

    return data;
  }

  async sendTemplateMessage(
    channel: Channel,
    to: string,
    template: { name: string; language: string; components?: any[] }
  ): Promise<string> {
    const { phoneNumberId, accessToken } = this.getCredentials(channel);
    const url = this.graphUrl(`${phoneNumberId}/messages`);
    const payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/\D/g, ''),
      type: "template",
      template: {
        name: template.name,
        language: { code: template.language },
      }
    };

    if (template.components?.length) {
      payload.template.components = template.components;
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
      throw this.buildGraphError('sendTemplateMessage', response.status, data, {
        phoneNumberId: this.maskId(phoneNumberId),
        to: this.maskId(payload.to),
        template: template.name,
      });
    }

    const messageId = data.messages?.[0]?.id;
    if (!messageId) throw new Error('Meta Cloud API não retornou o ID da mensagem de template.');
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
    const isBusinessAppEcho = change?.field === 'smb_message_echoes';
    const message = value?.messages?.[0] || value?.message_echoes?.[0];
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

    const senderPhone = isBusinessAppEcho ? message.to : message.from;
    const senderName = contact?.profile?.name || senderPhone;
    
    let content = '';
    let type: MessageType = 'TEXT';
    let mediaFields: any = {};
    const quotedMessageExternalId = this.getQuotedMessageExternalId(message);
    const quotedMessageSnapshot = this.buildQuotedMessageSnapshot(message);

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
        fromMe: isBusinessAppEcho,
        quotedMessageExternalId,
        quotedMessageSnapshot
      },
      ...mediaFields
    };
  }

  async downloadMedia(channel: Channel, mediaId: string): Promise<Buffer> {
    const { accessToken } = this.getCredentials(channel);
    const url = this.graphUrl(mediaId);
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
    const url = this.graphUrl(`${phoneNumberId}/messages`);
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
    // A edição de mensagens ainda não faz parte do fluxo adotado neste projeto.
    throw new Error('Editing messages is not supported in Meta Cloud API yet.');
  }

  async sendReaction(channel: Channel, to: string, externalId: string, fromMe: boolean, emoji: string): Promise<any> {
    const { phoneNumberId, accessToken } = this.getCredentials(channel);
    const url = this.graphUrl(`${phoneNumberId}/messages`);
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
