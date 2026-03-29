import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useChatStore } from '@/store/useChatStore';
import { Message, Conversation } from '@/types/chat';

export const useRealtimeInbox = () => {
  const { 
    activeConversation, 
    addMessage, 
    selectedChannelId, 
    setConversations, 
    loadingConversations,
    setLoadingConversations
  } = useChatStore();

  const refreshConversations = async (channelId: string) => {
    try {
      console.log(`[REALTIME_SYNC] Sincronizando lista de conversas para o canal: ${channelId}`);
      const res = await fetch(`/api/conversations?channelId=${channelId}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.data || []);
        console.log(`[REALTIME_SYNC] Lista de conversas atualizada com ${data.data?.length} registros.`);
      }
    } catch (e) {
      console.error('[REALTIME_SYNC] Erro ao atualizar lista de conversas:', e);
    }
  };

  /**
   * SUBSCRIPTION: CONVERSATIONS
   */
  useEffect(() => {
    if (!selectedChannelId) return;

    console.log(`[REALTIME_SUB] Iniciando escuta de Conversas para canal: ${selectedChannelId}`);
    
    const channel = supabase
      .channel(`public:Conversation:channelId=eq.${selectedChannelId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'Conversation',
          filter: `channelId=eq.${selectedChannelId}`
        },
        (payload) => {
          console.log(`[REALTIME_EVENT] Mudança na tabela Conversation detectada (${payload.eventType})`, payload.new);
          refreshConversations(selectedChannelId);
        }
      )
      .subscribe((status) => {
        console.log(`[REALTIME_STATUS] Conversas Subscription Status: ${status}`);
      });

    return () => {
      console.log(`[REALTIME_SUB] Encerrando escuta de Conversas: ${selectedChannelId}`);
      supabase.removeChannel(channel);
    };
  }, [selectedChannelId]);

  /**
   * SUBSCRIPTION: BROADCAST (Direct messages and inbox updates)
   */
  useEffect(() => {
    // 1. Escuta Global do Inbox (para atualizar a ordem lateral e previews)
    const inboxChannel = supabase
      .channel('inbox:all')
      .on('broadcast', { event: 'inbox:update' }, (payload) => {
        console.log('[REALTIME_BROADCAST] Inbox update received:', payload.payload);
        // Recarregar lista para garantir ordem e metadados atualizados
        if (selectedChannelId) refreshConversations(selectedChannelId);
      })
      .subscribe();

    // 2. Escuta da Conversa Ativa (para adicionar mensagem na tela instantaneamente)
    let convChannel: any = null;
    if (activeConversation?.id) {
      console.log(`[REALTIME_BROADCAST] Subscribed to active conversation: ${activeConversation.id}`);
      convChannel = supabase
        .channel(`conversation:${activeConversation.id}`)
        .on('broadcast', { event: 'message:new' }, (payload) => {
          const { message } = payload.payload;
          console.log('[REALTIME_BROADCAST] New message received for active chat:', message.id);
          addMessage(message);
        })
        .subscribe();
    }

    return () => {
      supabase.removeChannel(inboxChannel);
      if (convChannel) supabase.removeChannel(convChannel);
    };
  }, [selectedChannelId, activeConversation?.id, addMessage]);

  /**
   * SUBSCRIPTION: MESSAGES (Listen to ALL messages for the selected channel - Postgres Changes)
   */
  useEffect(() => {
    if (!selectedChannelId) return;

    console.log(`[REALTIME_SUB] Iniciando escuta de Mensagens (DB) para o CANAL: ${selectedChannelId}`);

    const channel = supabase
      .channel(`public:Message:channelId=eq.${selectedChannelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
          filter: `channelId=eq.${selectedChannelId}`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          console.log(`[REALTIME_DB] Nova mensagem via DB insert:`, newMessage.id);
          
          // O addMessage já tem proteção contra duplicatas, então podemos chamar sem medo.
          // Isso serve como backup (o broadcast é mais rápido, o DB é a verdade final)
          addMessage(newMessage); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChannelId, addMessage]);
};
