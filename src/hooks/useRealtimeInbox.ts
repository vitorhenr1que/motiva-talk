import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useChatStore } from '@/store/useChatStore';
import { Message, Conversation } from '@/types/chat';

export const useRealtimeInbox = () => {
  const {
    activeConversation,
    addMessage,
    upsertMessage,
    selectedChannelId,
    selectedSectorId,
    upsertConversationLocally,
    removeConversationLocally
  } = useChatStore();

  // Helper: bloqueia eventos de mensagens cujo sectorId não bate com o setor selecionado.
  // Quando o usuário não tem filtro de setor (selectedSectorId=null), passa tudo.
  const matchesSelectedSector = (msg: Partial<Message> | undefined | null) => {
    if (!selectedSectorId) return true;
    if (!msg) return false;
    // Mensagens sem setor (ex.: legado) só passam se não houver filtro
    return msg.sectorId === selectedSectorId;
  };

  /**
   * SUBSCRIPTION: CONVERSATIONS (Essential for the Sidebar)
   * Listens to the denormalized Conversation table.
   * This is lightweight as it only fires when a conversation record changes.
   */
  useEffect(() => {
    if (!selectedChannelId) return;

    const channel = supabase
      .channel(`sidebar:${selectedChannelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Conversation',
          filter: `channelId=eq.${selectedChannelId}`
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any)?.id;
            if (deletedId) removeConversationLocally(deletedId);
            return;
          }

          const conversationData = payload.new as Conversation;

          // O store aplica matchesConversationFilters: se a conversa casa com os filtros
          // atuais (canal/setor), faz upsert/insert; caso contrário REMOVE da lista.
          // Isso garante que conversas/mensagens de outro setor nunca apareçam aqui em realtime.
          upsertConversationLocally(conversationData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChannelId, selectedSectorId, upsertConversationLocally, removeConversationLocally]);

  /**
   * SUBSCRIPTION: MESSAGES (Essential for the ACTIVE CHAT Window)
   * This is a dynamic subscription that only listens to messages of the open conversation.
   */
  useEffect(() => {
    if (!activeConversation?.id) return;

    const channel = supabase
      .channel(`active_chat:${activeConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
          filter: `conversationId=eq.${activeConversation.id}`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          // Bloqueia mensagens de outros setores quando há filtro ativo
          if (!matchesSelectedSector(newMessage)) return;
          addMessage(newMessage);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'Message',
          filter: `conversationId=eq.${activeConversation.id}`
        },
        (payload) => {
          const updated = payload.new as Message;
          if (!matchesSelectedSector(updated)) return;
          upsertMessage(updated);
        }
      )
      // Also listen to broadcast if available (faster UX)
      .on('broadcast', { event: 'message:new' }, (payload) => {
        const { message } = payload.payload;
        if (!matchesSelectedSector(message)) return;
        addMessage(message);
      })
      .on('broadcast', { event: 'message:update' }, (payload) => {
        const { message } = payload.payload;
        if (!matchesSelectedSector(message)) return;
        upsertMessage(message);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversation?.id, selectedSectorId, addMessage, upsertMessage]);
};
