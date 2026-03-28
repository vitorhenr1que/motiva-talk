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
  loadingMore: boolean
  nextCursor: string | null
  hasMore: boolean
  
  tags: any[]
  selectedTagId: string | null
  isProfileOpen: boolean
  setIsProfileOpen: (open: boolean) => void
  kanbanData: any[]
  setKanbanData: (data: any[]) => void
  
  setConversations: (conversations: any[]) => void
  setActiveConversation: (conversation: any | null) => void
  setReplyToMessage: (message: any | null) => void
  setMessages: (data: { messages: any[], nextCursor?: string | null, hasMore?: boolean }) => void
  addMoreMessages: (data: { messages: any[], nextCursor?: string | null, hasMore?: boolean }) => void
  addMessage: (message: any) => void;
  upsertMessage: (message: any, tempId?: string) => void;
  removeMessage: (id: string) => void;
  
  // Atualização local de estado para refletir mudanças IMEDIATAMENTE na UI
  updateConversationLocally: (id: string, data: Partial<Conversation>) => void;
  deleteMessageLocally: (id: string, mode: 'me' | 'everyone') => void;
  
  setChannels: (channels: any[]) => void;
  setTags: (tags: any[]) => void;
  setSelectedChannelId: (id: string | null) => void
  setSelectedTagId: (id: string | null) => void
  setLoadingConversations: (loading: boolean) => void
  setLoadingMessages: (loading: boolean) => void
  setLoadingMore: (loading: boolean) => void
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
  loadingMore: false,
  nextCursor: null,
  hasMore: false,
  isProfileOpen: false,
  kanbanData: [],

  setIsProfileOpen: (open) => set({ isProfileOpen: open }),
  setKanbanData: (data) => set({ kanbanData: data }),

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
    } else {
      set({ isProfileOpen: false });
    }
  },
  setReplyToMessage: (message) => set({ replyToMessage: message }),
  setMessages: (data) => {
    const { messages, nextCursor = null, hasMore = false } = data;
    const uniqueMap = new Map();
    messages.forEach(m => uniqueMap.set(m.id, m));
    set({ 
      messages: Array.from(uniqueMap.values()),
      nextCursor,
      hasMore
    });
  },
  addMoreMessages: (data) => set((state) => {
    const { messages, nextCursor = null, hasMore = false } = data;
    const existingIds = new Set(state.messages.map(m => m.id));
    const newMessages = messages.filter(m => !existingIds.has(m.id));
    
    // As novas mensagens (antigas no tempo) vão pro INÍCIO (prepend)
    // Mantemos a ordem cronológica ASC
    const combined = [...newMessages, ...state.messages].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return {
      messages: combined,
      nextCursor,
      hasMore
    };
  }),
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
   * Atualiza uma conversa localmente para feedback instantâneo (Nome do contato, Observações, Status)
   */
  updateConversationLocally: (id, data) => set((state) => {
    const updatedConversations = state.conversations.map(c => 
      c.id === id ? { ...c, ...data } : c
    );
    
    const activeConv = state.activeConversation?.id === id 
      ? { ...state.activeConversation, ...data } 
      : state.activeConversation;

    // Sincronizar também com kanbanData
    const updatedKanbanData = state.kanbanData.map(item => {
       if (item.conversation?.id === id) {
          return {
             ...item,
             conversation: {
                ...item.conversation,
                ...data
             }
          }
       }
       return item;
    });

    return { 
      conversations: updatedConversations,
      activeConversation: activeConv as any,
      kanbanData: updatedKanbanData
    };
  }),

  deleteMessageLocally: (id, mode) => set((state) => {
    if (mode === 'me') {
      return { messages: state.messages.filter(m => m.id !== id) };
    } else {
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
  setLoadingConversations: (loading: boolean) => set({ loadingConversations: loading }),
  setLoadingMessages: (loading: boolean) => set({ loadingMessages: loading }),
  setLoadingMore: (loading: boolean) => set({ loadingMore: loading }),

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
