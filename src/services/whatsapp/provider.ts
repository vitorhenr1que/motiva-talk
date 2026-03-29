import { Channel, SenderType, MessageType } from '@/types/chat';

export interface SessionStatus {
  status: 'PENDING' | 'QR_CODE' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  details?: string;
}

export interface QrCodeData {
  base64: string;
  code: string;
}

export interface WebhookEvent {
  type: 'MESSAGE' | 'STATUS' | 'CONNECTION';
  channelId: string;
  senderPhone?: string;
  senderName?: string;
  content?: string;
  messageType?: MessageType;
  timestamp: number;
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  duration?: number;
  base64?: string;
  thumbnailUrl?: string;
  metadata?: any;
}

/**
 * Generic interface for WhatsApp providers.
 * Allows decoupling the core logic from specific APIs like Evolution API.
 */
export interface WhatsAppProvider {
  /**
   * Initializes or creates a new session for a channel.
   */
  createSession(channel: Channel): Promise<void>;

  /**
   * Fetches the current QR code for a session that is in 'QRCODE' state.
   */
  getQrCode(channel: Channel): Promise<QrCodeData>;

  /**
   * Retrieves the current connectivity status of a session.
   */
  getSessionStatus(channel: Channel): Promise<SessionStatus>;

  /**
   * Logs out from WhatsApp but keeps the instance/session created in the provider.
   */
  disconnectSession(channel: Channel): Promise<void>;

  /**
   * Completely removes the instance/session from the provider.
   */
  deleteSession(channel: Channel): Promise<void>;

  /**
   * Standardizes incoming webhook payloads from the provider into a common format.
   */
  parseIncomingWebhook(payload: any): Promise<WebhookEvent>;

  /**
   * Sends a message through the provider.
   */
  sendMessage(channel: Channel, recipient: string, content: string, type?: MessageType): Promise<any>;

  /**
   * Configures the webhook for the session to receive real-time notifications.
   */
  setWebhook(channel: Channel, url: string, events: string[]): Promise<void>;
}
