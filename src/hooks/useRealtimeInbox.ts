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
   * SUBSCRIPTION: MESSAGES
   */
  useEffect(() => {
    if (!activeConversation) return;

    console.log(`[REALTIME_SUB] Iniciando escuta de Mensagens para conversa: ${activeConversation.id}`);

    const channel = supabase
      .channel(`public:Message:conversationId=eq.${activeConversation.id}`)
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
          console.log(`[REALTIME_EVENT] Nova mensagem detectada!`, newMessage.content.substring(0, 20) + '...');
          
          // Adicionar no chat se for a conversa atual
          addMessage(newMessage); 
          
          // E também disparar refresh da lista lateral (sidebar) para atualizar o preview
          if (selectedChannelId) {
            refreshConversations(selectedChannelId);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[REALTIME_STATUS] Mensagens Subscription Status: ${status}`);
      });

    return () => {
      console.log(`[REALTIME_SUB] Encerrando escuta de Mensagens: ${activeConversation.id}`);
      supabase.removeChannel(channel);
    };
  }, [activeConversation?.id, selectedChannelId, addMessage]);
};
