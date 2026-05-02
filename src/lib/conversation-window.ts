import type { Conversation } from '@/types/chat';

export const CONVERSATION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const CONVERSATION_WARNING_MS = 60 * 60 * 1000;

export type ConversationWindowState = {
  startedAt: string | null;
  endsAt: string | null;
  remainingMs: number;
  elapsedMs: number;
  progress: number;
  isVisible: boolean;
  isExpired: boolean;
  tone: 'green' | 'yellow' | 'red';
};

export function getConversationWindowState(
  conversation: Pick<Conversation, 'status' | 'createdAt' | 'conversationWindowStartedAt'> | null | undefined,
  nowMs = Date.now()
): ConversationWindowState {
  const startedAt = conversation?.conversationWindowStartedAt || null;
  const startMs = startedAt ? new Date(startedAt).getTime() : Number.NaN;

  if (!conversation || !startedAt || Number.isNaN(startMs)) {
    return {
      startedAt: null,
      endsAt: null,
      remainingMs: 0,
      elapsedMs: 0,
      progress: 0,
      isVisible: false,
      isExpired: true,
      tone: 'red',
    };
  }

  const elapsedMs = Math.max(0, nowMs - startMs);
  const remainingMs = Math.max(0, CONVERSATION_WINDOW_MS - elapsedMs);
  const isExpired = remainingMs <= 0;
  const isVisible = conversation.status !== 'CLOSED' && !isExpired;
  const progress = Math.min(1, elapsedMs / CONVERSATION_WINDOW_MS);

  let tone: ConversationWindowState['tone'] = 'green';
  if (remainingMs <= CONVERSATION_WARNING_MS) tone = 'red';
  else if (remainingMs <= 12 * 60 * 60 * 1000) tone = 'yellow';

  return {
    startedAt,
    endsAt: new Date(startMs + CONVERSATION_WINDOW_MS).toISOString(),
    remainingMs,
    elapsedMs,
    progress,
    isVisible,
    isExpired,
    tone,
  };
}

export function formatConversationWindowRemaining(remainingMs: number) {
  const totalMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}min`;
  return `${hours}h ${String(minutes).padStart(2, '0')}min`;
}
