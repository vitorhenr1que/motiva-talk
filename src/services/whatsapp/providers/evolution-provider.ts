import { Channel, MessageType } from "@/types/chat";
import { WhatsAppProvider } from "./whatsapp-provider";
import { WebhookEvent } from "../provider";
import { evolutionProvider as legacyEvolutionProvider, EvolutionProvider as LegacyEvolutionProvider } from "../evolution-provider";

export class EvolutionProviderAdapter implements WhatsAppProvider {
  private legacy: LegacyEvolutionProvider;

  constructor() {
    this.legacy = legacyEvolutionProvider;
  }

  async sendTextMessage(channel: Channel, to: string, text: string, quotedMessageId?: string): Promise<string> {
    const quoted = quotedMessageId ? { id: quotedMessageId, content: '', fromMe: false } : undefined;
    const result = await this.legacy.sendMessage(channel, to, text, 'TEXT', quoted as any);
    return result?.key?.id || result?.message?.key?.id || result?.id;
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
    const quoted = quotedMessageId ? { id: quotedMessageId, content: '', fromMe: false } : undefined;
    const result = await this.legacy.sendMessage(channel, to, caption || mediaUrl, type, quoted as any, {
      mediaUrl,
      fileName,
      caption
    });
    return result?.key?.id || result?.message?.key?.id || result?.id;
  }

  async parseIncomingWebhook(body: any): Promise<WebhookEvent> {
    return this.legacy.parseIncomingWebhook(body);
  }

  async getConnectionStatus(channel: Channel): Promise<'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'> {
    const status = await this.legacy.getSessionStatus(channel);
    if (status.status === 'CONNECTED') return 'CONNECTED';
    if (status.status === 'CONNECTING') return 'CONNECTING';
    return 'DISCONNECTED';
  }

  async connect(channel: Channel): Promise<any> {
    return this.legacy.createSession(channel);
  }

  async disconnect(channel: Channel): Promise<void> {
    return this.legacy.disconnectSession(channel);
  }

  async deleteMessage(channel: Channel, to: string, externalId: string, fromMe: boolean): Promise<void> {
    return this.legacy.deleteMessage(channel, to, externalId, fromMe);
  }

  async sendPresence(channel: Channel, to: string, presence: 'composing' | 'paused'): Promise<void> {
    return this.legacy.sendPresence(channel, to, presence);
  }

  async editMessage(channel: Channel, to: string, externalId: string, fromMe: boolean, newContent: string): Promise<any> {
    return this.legacy.editMessage(channel, to, externalId, fromMe, newContent);
  }

  async sendReaction(channel: Channel, to: string, externalId: string, fromMe: boolean, emoji: string): Promise<any> {
    return this.legacy.sendReaction(channel, to, externalId, fromMe, emoji);
  }
}

export const evolutionProvider = new EvolutionProviderAdapter();
