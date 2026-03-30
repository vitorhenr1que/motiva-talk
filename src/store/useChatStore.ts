import { create } from 'zustand'
import { Conversation, Message, Channel } from '@/types/chat'

interface ChatState {
  conversations: Conversation[]
  activeConversation: Conversation | null
  replyToMessage: Message | null
  pendingFile: any | null
  mediaCaption: string
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
  setPendingFile: (file: any | null) => void
  setMediaCaption: (caption: string) => void
  setMessages: (data: { messages: any[], nextCursor?: string | null, hasMore?: boolean }) => void
  addMoreMessages: (data: { messages: any[], nextCursor?: string | null, hasMore?: boolean }) => void
  addMessage: (message: any) => void;
  upsertMessage: (message: any, tempId?: string) => void;
  removeMessage: (id: string) => void;
  
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
  pendingFile: null,
  mediaCaption: '',
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
  setPendingFile: (file) => set({ pendingFile: file }),
  setMediaCaption: (caption) => set({ mediaCaption: caption }),
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
    
    const isDuplicate = state.messages.some(m => m.id === message.id)
    if (isDuplicate) return state
    
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
      
      let newStatus = conv.status;
      
      // Se AGENTE responde e estava ABERTO, passa para EM ATENDIMENTO
      if (message.senderType === 'AGENT' && conv.status === 'OPEN') {
        newStatus = 'IN_PROGRESS';
        fetch(`/api/conversations/${conv.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'IN_PROGRESS' })
        }).catch(console.error);
      }

      existingConvMap.set(conv.id, {
        ...conv,
        lastMessageAt: new Date().toISOString(),
        unreadCount: newUnread,
        status: newStatus,
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

  updateConversationLocally: (id, data) => set((state) => {
    const updatedConversations = state.conversations.map(c => 
      c.id === id ? { ...c, ...data } : c
    );
    
    const activeConv = state.activeConversation?.id === id 
      ? { ...state.activeConversation, ...data } 
      : state.activeConversation;

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
    const isReplyingToThis = state.replyToMessage?.id === id;
    return {
      replyToMessage: isReplyingToThis ? null : state.replyToMessage,
      messages: state.messages.map(m => {
        if (m.id !== id) return m;
        
        if (mode === 'everyone') {
           return { ...m, content: '🚫 Esta mensagem foi apagada', deletedForEveryone: true, mediaUrl: undefined };
        } else {
           return { ...m, deletedForMe: true, mediaUrl: undefined };
        }
      })
    };
  }),

  setChannels: (channels) => set({ channels }),
  setTags: (tags) => set({ tags }),
  setSelectedChannelId: (id) => set({ selectedChannelId: id }),
  setSelectedTagId: (id) => set({ selectedTagId: id }),
  setLoadingConversations: (loading) => set({ loadingConversations: loading }),
  setLoadingMessages: (loading) => set({ loadingMessages: loading }),
  setLoadingMore: (loading) => set({ loadingMore: loading }),

  markAsRead: (conversationId) => set((state) => {
    const conv = state.conversations.find(c => c.id === conversationId);
    if (conv) {
      const updates: any = { unreadCount: 0 };
      
      if (conv.status === 'OPEN') {
        updates.status = 'IN_PROGRESS';
      }

      if ((conv.unreadCount || 0) > 0 || updates.status) {
        fetch(`/api/conversations/${conversationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        }).catch(console.error);
        
        return {
          conversations: state.conversations.map(c => 
            c.id === conversationId ? { ...c, ...updates } : c
          ),
          activeConversation: state.activeConversation?.id === conversationId 
            ? { ...state.activeConversation, ...updates } 
            : state.activeConversation
        };
      }
    }
    return state;
  }),

  markAsUnread: (conversationId) => set((state) => {
    const conv = state.conversations.find(c => c.id === conversationId);
    if (!conv) return state;

    const updates: any = { unreadCount: 1 };
    
    if (conv.status !== 'CLOSED') {
      updates.status = 'OPEN';
    }

    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }).catch(console.error);

    return {
      conversations: state.conversations.map(c => 
        c.id === conversationId ? { ...c, ...updates } : c
      ),
      activeConversation: state.activeConversation?.id === conversationId 
        ? { ...state.activeConversation, ...updates } 
        : state.activeConversation
    };
  })
}))
