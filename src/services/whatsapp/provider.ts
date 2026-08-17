import { MessageType } from '@/types/chat';

export interface WebhookMetadata {
  externalId?: string;
  fromMe?: boolean;
  quotedMessageExternalId?: string;
  quoted?: { key?: { id?: string } };
  quotedMessageSnapshot?: { quotedMessageType?: string; [key: string]: unknown };
  resolvedReplyToId?: string;
  [key: string]: unknown;
}

export interface WebhookEvent {
  type: 'MESSAGE' | 'STATUS';
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
  targetMessageId?: string;
  metadata?: WebhookMetadata;
}
