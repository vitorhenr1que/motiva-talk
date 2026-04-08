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
  loadingMore: boolean,
  nextCursor: string | null,
  hasMore: boolean,
  activeTab: 'unread' | 'in_progress' | 'closed',
  setActiveTab: (tab: 'unread' | 'in_progress' | 'closed') => void;
  
  tabData: {
    unread: { list: Conversation[], hasMore: boolean, loading: boolean, loadingMore: boolean, initialized: boolean },
    in_progress: { list: Conversation[], hasMore: boolean, loading: boolean, loadingMore: boolean, initialized: boolean },
    closed: { list: Conversation[], hasMore: boolean, loading: boolean, loadingMore: boolean, initialized: boolean },
  }
  
  tabCounts: {
    unread: number,
    in_progress: number,
    closed: number
  }

  setTabCounts: (counts: { unread?: number, in_progress?: number, closed?: number }) => void;
  incrementCount: (tab: 'unread' | 'in_progress' | 'closed') => void;
  decrementCount: (tab: 'unread' | 'in_progress' | 'closed') => void;
  
  setTabData: (tab: 'unread' | 'in_progress' | 'closed', data: Partial<{ list: Conversation[], hasMore: boolean, loading: boolean, loadingMore: boolean, initialized: boolean }>, append?: boolean) => void;
  resetTabs: () => void;
  
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
  removeConversationLocally: (id: string) => void;
  upsertConversationLocally: (conversation: Partial<Conversation> & { id: string }) => Promise<void>;
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
  activeTab: 'unread',
  setActiveTab: (tab) => set({ activeTab: tab }),
  isProfileOpen: false,
  kanbanData: [],
  tabData: {
    unread: { list: [], hasMore: true, loading: false, loadingMore: false, initialized: false },
    in_progress: { list: [], hasMore: true, loading: false, loadingMore: false, initialized: false },
    closed: { list: [], hasMore: true, loading: false, loadingMore: false, initialized: false },
  },
  tabCounts: {
    unread: 0,
    in_progress: 0,
    closed: 0
  },

  setTabCounts: (counts) => set((state) => ({
    tabCounts: { ...state.tabCounts, ...counts }
  })),

  incrementCount: (tab) => set((state) => ({
    tabCounts: { ...state.tabCounts, [tab]: state.tabCounts[tab] + 1 }
  })),

  decrementCount: (tab) => set((state) => ({
    tabCounts: { ...state.tabCounts, [tab]: Math.max(0, state.tabCounts[tab] - 1) }
  })),

  setTabData: (tab, data, append = false) => set((state) => {
    const current = state.tabData[tab];
    
    // Se não enviou lista, apenas atualiza flags (loading, hasMore, etc) mantendo a lista atual
    if (data.list === undefined) {
      return {
        tabData: {
          ...state.tabData,
          [tab]: { ...current, ...data }
        }
      };
    }

    const newList = data.list;
    let combinedList = append ? [...current.list, ...newList] : newList;
    
    const uniqueMap = new Map();
    combinedList.forEach(c => uniqueMap.set(c.id, c));
    combinedList = Array.from(uniqueMap.values());

    return {
      tabData: {
        ...state.tabData,
        [tab]: {
          ...current,
          ...data,
          list: combinedList
        }
      }
    };
  }),

  resetTabs: () => set({
    tabData: {
      unread: { list: [], hasMore: true, loading: false, loadingMore: false, initialized: false },
      in_progress: { list: [], hasMore: true, loading: false, loadingMore: false, initialized: false },
      closed: { list: [], hasMore: true, loading: false, loadingMore: false, initialized: false },
    },
    tabCounts: { unread: 0, in_progress: 0, closed: 0 }
  }),

  removeConversationLocally: (id) => set((state) => {
    const nextTabData = { ...state.tabData };
    const nextTabCounts = { ...state.tabCounts };
    
    (['unread', 'in_progress', 'closed'] as const).forEach(tabKey => {
      const tab = nextTabData[tabKey];
      const conv = tab.list.find(c => c.id === id);
      if (conv) {
         tab.list = tab.list.filter(c => c.id !== id);
         nextTabCounts[tabKey] = Math.max(0, nextTabCounts[tabKey] - 1);
      }
    });

    return { 
      tabData: nextTabData, 
      tabCounts: nextTabCounts,
      activeConversation: state.activeConversation?.id === id ? null : state.activeConversation
    };
  }),

  setIsProfileOpen: (open) => set({ isProfileOpen: open }),
  setKanbanData: (data) => set({ kanbanData: data }),

  setConversations: (conversations) => set({ conversations }),
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
    
    // 1. Evitar duplicatas no histórico de mensagens (chat window)
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
    
    // 2. Atualizar conversa de forma otimista na Sidebar
    const nextTabData = { ...state.tabData };
    const nextTabCounts = { ...state.tabCounts };
    let conversationFound = false;

    // Determinar preview amigável
    const preview = message.type === 'TEXT' ? (message.content?.substring(0, 100) || '...') : (
      message.type === 'IMAGE' ? '📷 Foto' : (
      message.type === 'AUDIO' ? '🎵 Áudio' : (
      message.type === 'VIDEO' ? '🎥 Vídeo' : '📎 Mídia'))
    );

    (['unread', 'in_progress', 'closed'] as const).forEach(tabKey => {
       const tab = nextTabData[tabKey];
       const idx = tab.list.findIndex(c => c.id === message.conversationId);
       
       if (idx !== -1) {
          conversationFound = true;
          const conv = tab.list[idx];
          const isFromUser = message.senderType === 'USER';
          const isNotActive = state.activeConversation?.id === conv.id ? false : true;
          
          let newStatus = conv.status;
          if (message.senderType === 'AGENT' && conv.status === 'OPEN') {
             newStatus = 'IN_PROGRESS';
             
             // Move entre abas localmente
             nextTabData.unread.list = nextTabData.unread.list.filter(c => c.id !== conv.id);
             nextTabCounts.unread = Math.max(0, nextTabCounts.unread - 1);
             
             const updated = { 
               ...conv, 
               status: 'IN_PROGRESS' as any, 
               lastMessagePreview: preview, 
               lastMessageAt: message.createdAt,
               unreadCount: 0
             };
             nextTabData.in_progress.list = [updated, ...nextTabData.in_progress.list].sort((a,b) => 
               new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
             );
             nextTabCounts.in_progress += 1;

             fetch(`/api/conversations/${conv.id}`, {
               method: 'PATCH',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ status: 'IN_PROGRESS' })
             }).catch(console.error);
          } else {
             // Atualização simples
             tab.list[idx] = {
               ...conv,
               lastMessageAt: message.createdAt,
               lastMessagePreview: preview,
               unreadCount: (isFromUser && isNotActive) ? (conv.unreadCount || 0) + 1 : 0
             };
             tab.list.sort((a,b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
          }
       }
    });

    if (!conversationFound && message.senderType === 'USER') {
      nextTabCounts.unread += 1;
      nextTabData.unread.initialized = false; // Força recarregamento ao abrir aba se for nova conversa
    }

    return { 
      messages: nextMessages, 
      tabData: nextTabData, 
      tabCounts: nextTabCounts 
    }
  }),

  upsertMessage: (message, tempId) => set((state) => {
    if (!message || !message.id) return state
    const otherMessages = state.messages.filter(m => m.id !== message.id && (!tempId || m.id !== tempId));
    const newMessages = [...otherMessages, message].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return { messages: newMessages }
  }),

  removeMessage: (id) => set((state) => ({
    messages: state.messages.filter(m => m.id !== id)
  })),

  updateConversationLocally: (id, data) => set((state) => {
    const nextTabData = { ...state.tabData };
    const nextTabCounts = { ...state.tabCounts };
    let statusChanged = false;

    (['unread', 'in_progress', 'closed'] as const).forEach(tabKey => {
      const tab = nextTabData[tabKey];
      const convIndex = tab.list.findIndex(c => c.id === id);
      if (convIndex !== -1) {
        const oldStatus = tab.list[convIndex].status;
        if (data.status && data.status !== oldStatus) {
            statusChanged = true;
            
            if (oldStatus === 'OPEN') nextTabCounts.unread = Math.max(0, nextTabCounts.unread - 1);
            else if (oldStatus === 'IN_PROGRESS') nextTabCounts.in_progress = Math.max(0, nextTabCounts.in_progress - 1);
            else if (oldStatus === 'CLOSED') nextTabCounts.closed = Math.max(0, nextTabCounts.closed - 1);

            const newStatus = data.status;
            const newTab = newStatus === 'OPEN' ? 'unread' : (newStatus === 'IN_PROGRESS' ? 'in_progress' : 'closed');
            nextTabCounts[newTab] += 1;

            const conv = tab.list[convIndex];
            const updatedConv = { ...conv, ...data };
            tab.list = tab.list.filter(c => c.id !== id);
            nextTabData[newTab].list = [updatedConv, ...nextTabData[newTab].list.filter(c => c.id !== id)];
            nextTabData[newTab].list.sort((a,b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
            
            state.setActiveTab(newTab);
        } else {
           tab.list[convIndex] = { ...tab.list[convIndex], ...data } as any;
        }
      }
    });

    if (statusChanged) {
       nextTabData.unread.initialized = false;
       nextTabData.in_progress.initialized = false;
       nextTabData.closed.initialized = false;
    }
    
    return { 
      tabData: nextTabData,
      tabCounts: nextTabCounts,
      activeConversation: state.activeConversation?.id === id 
        ? { ...state.activeConversation, ...data } as any
        : state.activeConversation
    };
  }),

  upsertConversationLocally: async (conversation) => {
    const { id } = conversation;
    const state = useChatStore.getState();
    const nextTabData = { ...state.tabData };
    const nextTabCounts = { ...state.tabCounts };
    let found = false;
    let statusChanged = false;
    let oldStatus: any = null;

    (['unread', 'in_progress', 'closed'] as const).forEach(tabKey => {
      const tab = nextTabData[tabKey];
      const idx = tab.list.findIndex(c => c.id === id);
      if (idx !== -1) {
        found = true;
        const existing = tab.list[idx];
        oldStatus = existing.status;
        
        if (conversation.status && conversation.status !== oldStatus) {
           statusChanged = true;
           tab.list = tab.list.filter(c => c.id !== id);
        } else {
           tab.list[idx] = { ...existing, ...conversation };
           tab.list.sort((a,b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
        }
      }
    });

    if (statusChanged && oldStatus) {
       const oldTab = oldStatus === 'OPEN' ? 'unread' : (oldStatus === 'IN_PROGRESS' ? 'in_progress' : 'closed');
       nextTabCounts[oldTab] = Math.max(0, nextTabCounts[oldTab] - 1);
       const newTab = conversation.status === 'OPEN' ? 'unread' : (conversation.status === 'IN_PROGRESS' ? 'in_progress' : 'closed');
       nextTabCounts[newTab] += 1;

       try {
          const res = await fetch(`/api/conversations/${id}`);
          const fullConv = await res.json();
          if (fullConv.success) {
             const tabToInsert = nextTabData[newTab];
             tabToInsert.list = [fullConv.data, ...tabToInsert.list.filter(c => c.id !== id)];
             tabToInsert.list.sort((a,b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
          }
       } catch (e) { console.error(e); }
    } else if (!found) {
       const newStatus = conversation.status || 'OPEN';
       const newTab = newStatus === 'OPEN' ? 'unread' : (newStatus === 'IN_PROGRESS' ? 'in_progress' : 'closed');
       nextTabCounts[newTab] += 1;

       try {
          const res = await fetch(`/api/conversations/${id}`);
          const fullConv = await res.json();
          if (fullConv.success) {
            const tabToInsert = nextTabData[newTab];
            tabToInsert.list = [fullConv.data, ...tabToInsert.list.filter(c => c.id !== id)];
            tabToInsert.list.sort((a,b) => 
               new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
            );
          }
       } catch (e) { console.error(e); }
    }

    set({ tabData: nextTabData, tabCounts: nextTabCounts });

    if (state.activeConversation?.id === id) {
       set({ activeConversation: { ...state.activeConversation, ...conversation } as any });
    }
  },

  deleteMessageLocally: (id, mode) => set((state) => ({
    replyToMessage: state.replyToMessage?.id === id ? null : state.replyToMessage,
    messages: state.messages.map(m => {
      if (m.id !== id) return m;
      return mode === 'everyone' 
        ? { ...m, content: '🚫 Esta mensagem foi apagada', deletedForEveryone: true, mediaUrl: undefined }
        : { ...m, deletedForMe: true, mediaUrl: undefined };
    })
  })),

  setChannels: (channels) => set({ channels }),
  setTags: (tags) => set({ tags }),
  setSelectedChannelId: (id) => set({ selectedChannelId: id }),
  setSelectedTagId: (id) => set({ selectedTagId: id }),
  setLoadingConversations: (loading) => set({ loadingConversations: loading }),
  setLoadingMessages: (loading) => set({ loadingMessages: loading }),
  setLoadingMore: (loading) => set({ loadingMore: loading }),

  markAsRead: (conversationId) => set((state) => {
    const nextTabData = { ...state.tabData };
    const nextTabCounts = { ...state.tabCounts };
    let found = false;
    let statusChanged = false;

    (['unread', 'in_progress', 'closed'] as const).forEach(tabKey => {
      const tab = nextTabData[tabKey];
      const convIndex = tab.list.findIndex(c => c.id === conversationId);
      
      if (convIndex !== -1) {
        found = true;
        const conv = tab.list[convIndex];
        const updates: any = { unreadCount: 0 };
        
        if (conv.status === 'OPEN') {
          updates.status = 'IN_PROGRESS';
          statusChanged = true;
          
          // Lógica de Movimentação Instantânea:
          // 1. Remove da lista atual (unread)
          tab.list = tab.list.filter(c => c.id !== conversationId);
          nextTabCounts.unread = Math.max(0, nextTabCounts.unread - 1);
          
          // 2. Adiciona na lista de destino (in_progress)
          const updatedConv = { ...conv, ...updates };
          nextTabData.in_progress.list = [updatedConv, ...nextTabData.in_progress.list.filter(c => c.id !== conversationId)];
          nextTabData.in_progress.list.sort((a,b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
          nextTabCounts.in_progress += 1;

          // AUTO-SWITCH TAB
          state.setActiveTab('in_progress');
        } else {
          // Se já está no atendimento, apenas zera o count
          tab.list[convIndex] = { ...conv, ...updates };
        }

        if ((conv.unreadCount || 0) > 0 || updates.status) {
           fetch(`/api/conversations/${conversationId}`, {
             method: 'PATCH',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(updates)
           }).catch(console.error);
        }
      }
    });

    if (statusChanged) {
       nextTabData.unread.initialized = false;
       nextTabData.in_progress.initialized = false;
    }

    return found ? {
      tabData: nextTabData,
      tabCounts: nextTabCounts,
      activeConversation: state.activeConversation?.id === conversationId 
        ? { ...state.activeConversation, unreadCount: 0, status: (statusChanged ? 'IN_PROGRESS' : state.activeConversation.status) as any } 
        : state.activeConversation
    } : state;
  }),

  markAsUnread: (conversationId) => set((state) => {
    const nextTabData = { ...state.tabData };
    const nextTabCounts = { ...state.tabCounts };
    let found = false;

    (['unread', 'in_progress', 'closed'] as const).forEach(tabKey => {
      const tab = nextTabData[tabKey];
      const convIndex = tab.list.findIndex(c => c.id === conversationId);
      
      if (convIndex !== -1) {
        found = true;
        const conv = tab.list[convIndex];
        const oldStatus = conv.status;
        const updates: any = { unreadCount: 1, status: 'OPEN' };
        
        // 1. Remove da lista atual se não for unread
        if (tabKey !== 'unread') {
           tab.list = tab.list.filter(c => c.id !== conversationId);
           
           if (oldStatus === 'IN_PROGRESS') nextTabCounts.in_progress = Math.max(0, nextTabCounts.in_progress - 1);
           else if (oldStatus === 'CLOSED') nextTabCounts.closed = Math.max(0, nextTabCounts.closed - 1);
           
           // 2. Adiciona em unread
           nextTabCounts.unread += 1;
           const updatedConv = { ...conv, ...updates };
           nextTabData.unread.list = [updatedConv, ...nextTabData.unread.list.filter(c => c.id !== conversationId)];
           nextTabData.unread.list.sort((a,b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
        } else {
           // Se já está em unread, apenas atualiza
           tab.list[convIndex] = { ...conv, ...updates };
        }

        fetch(`/api/conversations/${conversationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        }).catch(console.error);
        
        // AUTO-SWITCH TAB
        state.setActiveTab('unread');
      }
    });

    if (found) {
       nextTabData.unread.initialized = false;
       nextTabData.in_progress.initialized = false;
       nextTabData.closed.initialized = false;
    }

    return found ? {
      tabData: nextTabData,
      tabCounts: nextTabCounts,
      activeConversation: state.activeConversation?.id === conversationId 
        ? { ...state.activeConversation, unreadCount: 1, status: 'OPEN' as any } 
        : state.activeConversation
    } : state;
  })
}))
