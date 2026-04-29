import { Channel, MessageType } from "@/types/chat";
import { WebhookEvent } from "../provider";

export interface WhatsAppProvider {
  sendTextMessage(channel: Channel, to: string, text: string, quotedMessageId?: string): Promise<string>;
  sendMediaMessage(
    channel: Channel,
    to: string,
    mediaUrl: string,
    type: MessageType,
    fileName?: string,
    caption?: string,
    quotedMessageId?: string
  ): Promise<string>;
  parseIncomingWebhook(body: any): Promise<WebhookEvent>;
  getConnectionStatus(channel: Channel): Promise<'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'>;
  connect(channel: Channel): Promise<any>;
  disconnect(channel: Channel): Promise<void>;
  
  // Additional methods for full compatibility
  deleteMessage(channel: Channel, to: string, externalId: string, fromMe: boolean): Promise<void>;
  sendPresence(channel: Channel, to: string, presence: 'composing' | 'paused'): Promise<void>;
  editMessage(channel: Channel, to: string, externalId: string, fromMe: boolean, newContent: string): Promise<any>;
  sendReaction(channel: Channel, to: string, externalId: string, fromMe: boolean, emoji: string): Promise<any>;
}
