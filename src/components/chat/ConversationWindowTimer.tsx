import React from 'react';
import { Clock } from 'lucide-react';
import type { Conversation } from '@/types/chat';
import {
  CONVERSATION_WARNING_MS,
  formatConversationWindowRemaining,
  getConversationWindowState,
} from '@/lib/conversation-window';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const toneClasses = {
  green: {
    stroke: 'stroke-emerald-500',
    text: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
  },
  yellow: {
    stroke: 'stroke-amber-400',
    text: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
  },
  red: {
    stroke: 'stroke-red-500',
    text: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-100',
  },
};

export function ConversationWindowAvatar({
  conversation,
  nowMs,
  size = 40,
  className,
  children,
}: {
  conversation: Conversation;
  nowMs: number;
  size?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const windowState = getConversationWindowState(conversation, nowMs);
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - windowState.progress);
  const wrapperSize = size + 8;

  if (!windowState.isVisible) {
    return (
      <div className={cn('shrink-0 overflow-hidden', className)} style={{ height: size, width: size }}>
        {children}
      </div>
    );
  }

  return (
    <div
      className="relative shrink-0"
      style={{ height: wrapperSize, width: wrapperSize }}
      title={`Janela encerra em ${formatConversationWindowRemaining(windowState.remainingMs)}`}
    >
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 52 52" aria-hidden="true">
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          strokeWidth="3"
          className="stroke-slate-100"
        />
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className={cn(toneClasses[windowState.tone].stroke, 'transition-all duration-700')}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div
        className={cn('absolute left-1 top-1 overflow-hidden', className)}
        style={{ height: size, width: size }}
      >
        {children}
      </div>
    </div>
  );
}

export function ConversationWindowCountdown({
  conversation,
  nowMs,
  compact = false,
}: {
  conversation: Conversation;
  nowMs: number;
  compact?: boolean;
}) {
  const windowState = getConversationWindowState(conversation, nowMs);
  if (!windowState.isVisible) return null;

  const tone = toneClasses[windowState.tone];
  const isCritical = windowState.remainingMs <= CONVERSATION_WARNING_MS;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-black leading-none',
        tone.bg,
        tone.border,
        tone.text,
        isCritical && 'animate-pulse'
      )}
      title="Tempo restante da janela de atendimento"
    >
      <Clock size={compact ? 10 : 11} />
      {formatConversationWindowRemaining(windowState.remainingMs)}
    </span>
  );
}

export function ConversationWindowWarning({
  conversation,
  nowMs,
}: {
  conversation: Conversation;
  nowMs: number;
}) {
  const windowState = getConversationWindowState(conversation, nowMs);
  if (!windowState.isVisible || windowState.remainingMs > CONVERSATION_WARNING_MS) return null;

  return (
    <div className="bg-red-50 text-red-700 px-6 py-2 flex items-center justify-between z-40 border-t border-red-100 shadow-sm">
      <div className="flex items-center gap-2">
        <Clock size={15} className="text-red-500" />
        <p className="text-[11px] font-black uppercase tracking-widest">
          Esta conversa encerra em {formatConversationWindowRemaining(windowState.remainingMs)}
        </p>
      </div>
    </div>
  );
}
