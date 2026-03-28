import { create } from 'zustand'
import { Conversation, Message, Channel } from '@/types/chat'

interface ChatState {
  conversations: Conversation[]
  activeConversation: Conversation | null
  messages: Message[]
  channels: Channel[]
  selectedChannelId: string | null
  loadingConversations: boolean
  loadingMessages: boolean
  
  tags: any[]
  selectedTagId: string | null
  
  setConversations: (conversations: any[]) => void
  setActiveConversation: (conversation: any | null) => void
  setMessages: (messages: any[]) => void
  addMessage: (message: any) => void;
  removeMessage: (id: string) => void;
  setChannels: (channels: any[]) => void;
  setTags: (tags: any[]) => void; // Novo
  setSelectedChannelId: (id: string | null) => void
  setSelectedTagId: (id: string | null) => void // Novo
  setLoadingConversations: (loading: boolean) => void
  setLoadingMessages: (loading: boolean) => void
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  channels: [],
  tags: [],
  selectedChannelId: null,
  selectedTagId: null,
  loadingConversations: false,
  loadingMessages: false,

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (conversation) => set({ activeConversation: conversation }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => {
    const isDuplicate = state.messages.some(m => m.id === message.id)
    if (isDuplicate) return state
    return { messages: [...state.messages, message] }
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
}))
