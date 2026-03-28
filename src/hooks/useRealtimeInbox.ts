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
    conversations,
    loadingConversations,
    setLoadingConversations
  } = useChatStore();

  /**
   * REFRESH CONVERSATIONS:
   * Re-fetch the conversation list when there's an update in the channel.
   * We do a re-fetch because Prisma might have changed multiple related fields (includes, tags, etc)
   * which are hard to normalize from the raw Supabase payload.
   */
  const refreshConversations = async (channelId: string) => {
    try {
      const res = await fetch(`/api/conversations?channelId=${channelId}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (e) {
      console.error('Realtime: Error refreshing conversations');
    }
  };

  /**
   * SUBSCRIPTION: CONVERSATIONS
   * Listen for status or assignment changes in the selected channel.
   */
  useEffect(() => {
    if (!selectedChannelId) return;

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
        () => {
          refreshConversations(selectedChannelId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChannelId]);

  /**
   * SUBSCRIPTION: MESSAGES
   * Listen for new messages in the ACTIVE conversation.
   */
  useEffect(() => {
    if (!activeConversation) return;

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
          
          // Only add if it's NOT from the AGENT (since AGENT messages are optimisticly added locally)
          // Wait, better to check by ID to avoid duplicates if optimistic UI is used
          addMessage(newMessage); // The store logic should handle deduplication if needed
          
          // Also refresh conversation list to show the "last message" correctly
          if (selectedChannelId) refreshConversations(selectedChannelId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversation, selectedChannelId]);
};
