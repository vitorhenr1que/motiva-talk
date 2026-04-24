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
    upsertConversationLocally,
    removeConversationLocally
  } = useChatStore();

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
          // upsertConversationLocally is efficient and doesn't trigger full refetch unless status changes
          upsertConversationLocally(conversationData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChannelId, upsertConversationLocally, removeConversationLocally]);

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
          upsertMessage(updated);
        }
      )
      // Also listen to broadcast if available (faster UX)
      .on('broadcast', { event: 'message:new' }, (payload) => {
        const { message } = payload.payload;
        addMessage(message);
      })
      .on('broadcast', { event: 'message:update' }, (payload) => {
        const { message } = payload.payload;
        upsertMessage(message);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversation?.id, addMessage, upsertMessage]);
};
