import { create } from 'zustand'
import { Conversation, Message, Channel } from '@/types/chat'

interface ChatState {
  conversations: Conversation[]
  activeConversation: Conversation | null
  replyToMessage: Message | null
  messages: Message[]
  channels: Channel[]
  selectedChannelId: string | null
  loadingConversations: boolean
  loadingMessages: boolean
  
  tags: any[]
  selectedTagId: string | null
  
  setConversations: (conversations: any[]) => void
  setActiveConversation: (conversation: any | null) => void
  setReplyToMessage: (message: any | null) => void
  setMessages: (messages: any[]) => void
  addMessage: (message: any) => void;
  upsertMessage: (message: any, tempId?: string) => void;
  removeMessage: (id: string) => void;
  
  // Ações de Exclusão de Mensagem
  deleteMessageLocally: (id: string, mode: 'me' | 'everyone') => void;
  
  setChannels: (channels: any[]) => void;
  setTags: (tags: any[]) => void;
  setSelectedChannelId: (id: string | null) => void
  setSelectedTagId: (id: string | null) => void
  setLoadingConversations: (loading: boolean) => void
  setLoadingMessages: (loading: boolean) => void
  markAsRead: (conversationId: string) => void
  markAsUnread: (conversationId: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversation: null,
  replyToMessage: null,
  messages: [],
  channels: [],
  tags: [],
  selectedChannelId: null,
  selectedTagId: null,
  loadingConversations: false,
  loadingMessages: false,

  setConversations: (conversations) => {
    const activeId = useChatStore.getState().activeConversation?.id;
    const uniqueMap = new Map();
    conversations.forEach(c => uniqueMap.set(c.id, c));
    const uniqueList = Array.from(uniqueMap.values());

    const sorted = uniqueList.map(conv => {
      if (conv.id === activeId && (conv.unreadCount || 0) > 0) {
        return { ...conv, unreadCount: 0 };
      }
      return conv;
    }).sort((a, b) => 
      new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
    );
    
    set({ conversations: sorted });
  },
  setActiveConversation: (conversation) => {
    set({ activeConversation: conversation });
    if (conversation) {
      useChatStore.getState().markAsRead(conversation.id);
    }
  },
  setReplyToMessage: (message) => set({ replyToMessage: message }),
  setMessages: (messages) => {
    const uniqueMap = new Map();
    messages.forEach(m => uniqueMap.set(m.id, m));
    set({ messages: Array.from(uniqueMap.values()) });
  },
  addMessage: (message) => set((state) => {
    if (!message || !message.id) return state
    
    // Evitar Duplicação
    const isDuplicate = state.messages.some(m => m.id === message.id)
    if (isDuplicate) return state
    
    // Substituir temporária se houver
    let tempMessageToReplace = null;
    if (message.senderType === 'AGENT') {
      tempMessageToReplace = state.messages.find(m => 
        m.id.startsWith('temp-') && 
        (m.content.trim() === message.content.trim()) && 
        m.conversationId === message.conversationId
      );
    }

    let nextMessages = [...state.messages];
    if (tempMessageToReplace) {
      nextMessages = state.messages.map(m => m.id === tempMessageToReplace!.id ? message : m);
    } else {
      if (state.activeConversation?.id === message.conversationId) {
        nextMessages = [...state.messages, message];
      }
    }
    
    // Atualizar conversa
    const existingConvMap = new Map();
    state.conversations.forEach(c => existingConvMap.set(c.id, c));
    const conv = existingConvMap.get(message.conversationId);
    if (conv) {
      const isFromUser = message.senderType === 'USER';
      const isNotActive = state.activeConversation?.id === conv.id ? false : true;
      const newUnread = (isFromUser && isNotActive) ? (conv.unreadCount || 0) + 1 : 0;
      
      existingConvMap.set(conv.id, {
        ...conv,
        lastMessageAt: new Date().toISOString(),
        unreadCount: newUnread,
        messages: [message]
      });
    }

    return { 
      messages: nextMessages,
      conversations: Array.from(existingConvMap.values()).sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime())
    }
  }),
  upsertMessage: (message, tempId) => set((state) => {
    if (!message || !message.id) return state
    const otherMessages = state.messages.filter(m => m.id !== message.id && (!tempId || m.id !== tempId));
    const newMessages = [...otherMessages, message].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const updatedConversations = state.conversations.map(conv => {
      if (conv.id === message.conversationId) {
        return { ...conv, lastMessageAt: new Date().toISOString(), messages: [message] };
      }
      return conv;
    }).sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());

    return { messages: newMessages, conversations: updatedConversations }
  }),
  removeMessage: (id) => set((state) => ({
    messages: state.messages.filter(m => m.id !== id)
  })),

  /**
   * Atualiza o estado visual da mensagem após exclusão (Me ou Everyone)
   */
  deleteMessageLocally: (id, mode) => set((state) => {
    if (mode === 'me') {
      return { messages: state.messages.filter(m => m.id !== id) };
    } else {
      // everyone: Mantém o balão mas altera o texto
      return { 
        messages: state.messages.map(m => 
          m.id === id ? { ...m, content: '🚫 Mensagem apagada', deletedForEveryone: true } : m
        )
      };
    }
  }),

  setChannels: (channels) => set({ channels }),
  setTags: (tags) => set({ tags }),
  setSelectedChannelId: (id) => set({ selectedChannelId: id }),
  setSelectedTagId: (id) => set({ selectedTagId: id }),
  setLoadingConversations: (loading) => set({ loadingConversations: loading }),
  setLoadingMessages: (loading) => set({ loadingMessages: loading }),

  markAsRead: (conversationId) => set((state) => {
    const conv = state.conversations.find(c => c.id === conversationId);
    if (conv && (conv.unreadCount || 0) > 0) {
      fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unreadCount: 0 })
      }).catch(console.error);
      
      return {
        conversations: state.conversations.map(c => 
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        )
      };
    }
    return state;
  }),

  markAsUnread: (conversationId) => set((state) => {
    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unreadCount: 1 })
    }).catch(console.error);

    return {
      conversations: state.conversations.map(c => 
        c.id === conversationId ? { ...c, unreadCount: 1 } : c
      )
    };
  })
}))
