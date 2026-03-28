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
  setChannels: (channels: any[]) => void;
  setTags: (tags: any[]) => void; // Novo
  setSelectedChannelId: (id: string | null) => void
  setSelectedTagId: (id: string | null) => void // Novo
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
    
    // Deduplicação por ID para evitar erro de chaves duplicadas no React
    const uniqueMap = new Map();
    conversations.forEach(c => uniqueMap.set(c.id, c));
    const uniqueList = Array.from(uniqueMap.values());

    const sorted = uniqueList.map(conv => {
      // Regra de Ouro: Se eu estou na conversa, ela deve aparecer com 0 no meu inbox local
      if (conv.id === activeId && (conv.unreadCount || 0) > 0) {
        console.log(`[UNREAD_DEBUG] Sincronização: Forçando 0 não lidas para conversa ATIVA ${conv.id}`);
        return { ...conv, unreadCount: 0 };
      }
      return conv;
    }).sort((a, b) => 
      new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
    );
    
    if (uniqueList.length < conversations.length) {
      console.warn(`[UNREAD_DEBUG] Deduplicação aplicada: ${conversations.length} -> ${uniqueList.length} conversas.`);
    }

    set({ conversations: sorted });
  },
  setActiveConversation: (conversation) => {
    set({ activeConversation: conversation });
    if (conversation) {
      useChatStore.getState().markAsRead(conversation.id);
    }
  },
  setReplyToMessage: (message) => set({ replyToMessage: message }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => {
    if (!message || !message.id) return state
    const isDuplicate = state.messages.some(m => m.id === message.id)
    if (isDuplicate) return state
    
    // Atualizar lista de conversas (mover para o topo e incrementar unread se necessário)
    const updatedConversations = state.conversations.map(conv => {
      if (conv.id === message.conversationId) {
        const isFromUser = message.senderType === 'USER';
        const isNotActive = state.activeConversation?.id !== conv.id;
        
        // Se estiver ativa, forçamos o valor para 0 para não incomodar o atendente
        const newUnread = (isFromUser && isNotActive) ? (conv.unreadCount || 0) + 1 : 0;
        
        if (isFromUser && !isNotActive) {
          console.log(`[UNREAD_DEBUG] Mensagem recebida na conversa ATIVA. Mantendo unreadCount em 0.`);
          // Opcionalmente: disparar markAsRead para o servidor aqui para sincronizar o DB
          useChatStore.getState().markAsRead(conv.id);
        } else if (isFromUser) {
          console.log(`[UNREAD_DEBUG] Conversa ${conv.id} movida para o topo via Mensagem. Unread: ${conv.unreadCount} -> ${newUnread}`);
        }
        
        return {
          ...conv,
          lastMessageAt: new Date().toISOString(),
          unreadCount: newUnread,
          messages: [message] // Atualiza o preview na lista lateral
        };
      }
      return conv;
    }).sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());

    // 2. Só adicionar no array global de mensagens SE for da conversa ativa
    const shouldAddGlobal = state.activeConversation?.id === message.conversationId;
    const newMessages = shouldAddGlobal ? [...state.messages, message] : state.messages;

    return { 
      messages: newMessages,
      conversations: updatedConversations
    }
  }),
  upsertMessage: (message, tempId) => set((state) => {
    if (!message || !message.id) return state
    
    let newMessages = [...state.messages];
    const exists = state.messages.some(m => (tempId && m.id === tempId) || m.id === message.id);
    
    if (exists) {
      newMessages = state.messages.map(m => ((tempId && m.id === tempId) || m.id === message.id) ? message : m);
    } else {
      newMessages.push(message);
    }

    // Ordenar conversas
    const updatedConversations = state.conversations.map(conv => {
      if (conv.id === message.conversationId) {
        return { ...conv, lastMessageAt: new Date().toISOString() };
      }
      return conv;
    }).sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());

    return { 
      messages: newMessages,
      conversations: updatedConversations
    }
  }),
  removeMessage: (id) => set((state) => ({
    messages: state.messages.filter(m => m.id !== id)
  })),
  setChannels: (channels) => set({ channels }),
  setTags: (tags) => set({ tags }),
  setSelectedChannelId: (id) => set({ selectedChannelId: id }),
  setSelectedTagId: (id) => set({ selectedTagId: id }),
  setLoadingConversations: (loading) => set({ loadingConversations: loading }),
  setLoadingMessages: (loading) => set({ loadingMessages: loading }),

  markAsRead: (conversationId) => set((state) => {
    const conv = state.conversations.find(c => c.id === conversationId);
    if (conv && (conv.unreadCount || 0) > 0) {
      console.log(`[UNREAD_DEBUG] Zerando não lidas para conversa: ${conversationId}`);
      fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
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
    console.log(`[UNREAD_DEBUG] Marcando manualmente como NÃO LIDA: ${conversationId}`);
    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ unreadCount: 1 })
    }).catch(console.error);

    return {
      conversations: state.conversations.map(c => 
        c.id === conversationId ? { ...c, unreadCount: 1 } : c
      )
    };
  })
}))
