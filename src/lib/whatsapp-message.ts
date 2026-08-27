type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === 'object' ? value as UnknownRecord : undefined;
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export function getWhatsAppReplyContent(metadata: unknown): string | undefined {
  const message = asRecord(metadata);
  const messageType = String(message?.type || '').trim().toLowerCase();

  if (messageType === 'button') {
    const button = asRecord(message?.button);
    return firstText(button?.text, button?.payload);
  }

  if (messageType === 'interactive') {
    const interactive = asRecord(message?.interactive);
    const reply = asRecord(interactive?.button_reply) || asRecord(interactive?.list_reply);
    return firstText(reply?.title, reply?.id);
  }

  return undefined;
}

export function normalizeStoredWhatsAppMessage<T extends {
  content?: string;
  type?: string;
  metadata?: unknown;
}>(message: T): T {
  const replyContent = getWhatsAppReplyContent(message.metadata);
  if (!replyContent) return message;

  return {
    ...message,
    content: replyContent,
    type: 'TEXT',
  };
}
