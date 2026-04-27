'use client';

import React, { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/InboxSidebar';
import { ChatWindow } from '@/components/chat/InboxChatArea';
import { MessageInput } from '@/components/chat/InboxMessageInput';
import { useChatStore } from '@/store/useChatStore';
import { useRealtimeInbox } from '@/hooks/useRealtimeInbox';

import { ContactProfileSidebar } from '@/components/chat/ContactProfileSidebar';

export default function InboxPage() {
  const {
    setConversations,
    setChannels,
    selectedChannelId,
    setSelectedChannelId,
    isProfileOpen
  } = useChatStore();

  // Realtime Subscriptions
  useRealtimeInbox();

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const res = await fetch('/api/channels');
        const data = await res.json();
        const channels = data.data || [];
        setChannels(channels);
        if (channels.length > 0 && !selectedChannelId) {
          setSelectedChannelId(channels[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch channels:', error);
      }
    };
    fetchChannels();
  }, [setChannels, setSelectedChannelId, selectedChannelId]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      {/* 1. Conversas */}
      <Sidebar />

      {/* 2. Área Central do Chat */}
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-50">
        <ChatWindow />
        <MessageInput />
      </div>

      {/* 3. Perfil do Contato (CRM) */}
      {isProfileOpen && <ContactProfileSidebar />}
    </div>
  );
}
