'use client';

import { useEffect } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { subscribeToMessages } from '@/lib/supabase-utils';

export const useRealtimeMessages = (conversationId: string | undefined) => {
  const { addMessage } = useChatStore();

  useEffect(() => {
    if (!conversationId) return;

    const subscription = subscribeToMessages(conversationId, (payload) => {
      const newMessage = payload.new as any;
      // Garante que não adicionamos mensagens que o próprio agente enviou (já adicionadas otimisticamente)
      if (newMessage.senderType !== 'AGENT') {
        addMessage(newMessage);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [conversationId, addMessage]);
};
