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
   *
   * Fase 2: filtro server-side por currentSectorId quando há setor selecionado
   * (reduz volume de eventos em horário de pico). Ouve também o broadcast
   * `conversation_left_sector` em `sector:<id>` para retirar conversas que foram
   * transferidas para outro setor — esses UPDATEs não passariam pelo filtro de
   * setor server-side.
   */
  useEffect(() => {
    if (!selectedChannelId) return;

    // 'UNASSIGNED' (currentSectorId IS NULL) não é compatível com filter eq.null,
    // então caímos para o filtro por canal nesse caso.
    const useSectorFilter = !!selectedSectorId && selectedSectorId !== 'UNASSIGNED';
    const topic = useSectorFilter
      ? `sector:${selectedSectorId}`
      : `sidebar:${selectedChannelId}`;
    const filter = useSectorFilter
      ? `currentSectorId=eq.${selectedSectorId}`
      : `channelId=eq.${selectedChannelId}`;

    const channel = supabase.channel(topic).on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'Conversation',
        filter
      },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) removeConversationLocally(deletedId);
          return;
        }

        const conversationData = payload.new as Conversation;

        // matchesConversationFilters no store ainda atua como guard client-side
        // (cobre, por ex., cross-channel quando filtro server é por setor).
        upsertConversationLocally(conversationData);
      }
    );

    if (useSectorFilter) {
      channel.on(
        'broadcast',
        { event: 'conversation_left_sector' },
        (payload) => {
          const cid = (payload.payload as any)?.conversationId;
          if (cid) removeConversationLocally(cid);
        }
      );
    }

    channel.subscribe();

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
