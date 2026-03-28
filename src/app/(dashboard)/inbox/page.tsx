'use client';

import React, { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/InboxSidebar';
import { ChatWindow } from '@/components/chat/InboxChatArea';
import { MessageInput } from '@/components/chat/InboxMessageInput';
import { useChatStore } from '@/store/useChatStore';
import { useRealtimeInbox } from '@/hooks/useRealtimeInbox';

export default function InboxPage() {
  const { setConversations, setChannels, selectedChannelId, setSelectedChannelId } = useChatStore();
  
  // Realtime Subscriptions
  useRealtimeInbox();

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const res = await fetch('/api/channels');
        const data = await res.json();
        setChannels(data);
        if (data.length > 0 && !selectedChannelId) {
          setSelectedChannelId(data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch channels:', error);
      }
    };
    fetchChannels();
  }, [setChannels, setSelectedChannelId, selectedChannelId]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      {/* Nested Sidebar for Conversations */}
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-50">
        <ChatWindow />
        <MessageInput />
      </div>
    </div>
  );
}
