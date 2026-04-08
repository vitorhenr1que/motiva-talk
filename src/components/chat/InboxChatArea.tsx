'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { 
  MoreVertical, Search, MessageCircle, FileText, Reply, Trash2, 
  Loader2, Check, Pin, UserPlus, CheckCircle2, XCircle, X, ChevronDown, UserPlus as ContactIcon, 
  Mic, Play, Pause, Volume2, Eye
} from 'lucide-react';
import { TagSelector } from './TagSelector';
import { formatWhatsappText } from '@/lib/formatWhatsappText';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatPhone } from '@/lib/utils';
import { formatDateDivider, formatTimeBahia, parseSafeDate } from '@/lib/date-utils';
import { useChatFileDrop } from '@/hooks/useChatFileDrop';
import { Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const CustomAudioPlayer = ({ url, duration, fileName, mimeType, mediaUrl }: { url: string, duration?: number, fileName?: string, mimeType?: string, mediaUrl?: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const [hasError, setHasError] = useState(false);

  const formatTimeText = (time: number) => {
    if (isNaN(time) || time === Infinity || time < 0) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setTotalDuration(audioRef.current.duration);
      setHasError(false);
    }
  };

  const handleError = () => {
    if (audioRef.current) {
      console.error("Audio Load Error Details:", {
        url,
        currentSrc: audioRef.current.currentSrc,
        networkState: audioRef.current.networkState,
        readyState: audioRef.current.readyState,
        error: audioRef.current.error,
        mimeType,
        fileName,
        mediaUrl
      });
    } else {
      console.error("Audio Load Error (no ref):", {
        url,
        mimeType,
        fileName,
        mediaUrl
      });
    }
    setHasError(true);
    setIsPlaying(false);
  };

  const onTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
    setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
  };

  const onEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || hasError) return;
    const value = parseFloat(e.target.value);
    const newTime = (value / 100) * audioRef.current.duration;
    audioRef.current.currentTime = newTime;
    setProgress(value);
  };

  return (
    <div className="flex flex-col gap-1.5 min-w-[320px]">
      {fileName && (
        <div className="px-1 flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-slate-100 flex items-center justify-center text-slate-400 group-hover/audio:text-blue-500 transition-colors">
            <Volume2 size={10} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate max-w-[200px]">{fileName}</span>
        </div>
      )}
      
      <div className={twMerge(
        "flex items-center gap-3 bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm p-3 rounded-2xl border border-slate-200/60 dark:border-white/10 shadow-sm group/audio relative overflow-hidden transition-all hover:bg-white/60 dark:hover:bg-slate-800/60",
        hasError && "border-red-200/60 bg-red-50/40"
      )}>
        {url && url.startsWith('http') && (
          <audio 
            ref={audioRef} 
            onLoadedMetadata={onLoadedMetadata}
            onTimeUpdate={onTimeUpdate} 
            onEnded={onEnded} 
            onError={handleError}
            preload="auto"
            crossOrigin="anonymous"
            className="hidden" 
          >
            {mimeType && <source src={url} type={mimeType} />}
            <source src={url} type="audio/ogg" />
            <source src={url} />
          </audio>
        )}
        
        <button 
          onClick={hasError ? undefined : togglePlay}
          disabled={hasError}
          className={twMerge(
            "h-10 w-10 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all shrink-0",
            hasError ? "bg-red-100 text-red-500 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"
          )}
        >
          {hasError ? <X size={18} /> : (isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />)}
        </button>

        <div className="flex-1 flex flex-col gap-1 pr-1">
          <input 
            type="range" 
            value={progress} 
            min="0"
            max="100"
            step="0.1"
            onChange={handleProgressChange}
            disabled={hasError}
            className={twMerge(
              "w-full h-1 rounded-lg appearance-none cursor-pointer transition-all",
              hasError ? "bg-red-200 accent-red-400" : "bg-slate-200 dark:bg-slate-700 accent-blue-600 hover:accent-blue-700"
            )}
          />
          <div className={twMerge(
            "flex justify-between items-center text-[10px] font-black uppercase tracking-widest",
            hasError ? "text-red-400" : "text-slate-400"
          )}>
            <span className={isPlaying ? "text-blue-600 animate-pulse font-black" : ""}>
               {hasError ? "Não foi possível carregar este áudio" : formatTimeText(currentTime)}
            </span>
            <span>{hasError ? "!" : (totalDuration ? formatTimeText(totalDuration) : '--:--')}</span>
          </div>
        </div>

        {!hasError && (
          <div className="flex flex-col items-center gap-1 shrink-0 px-1">
            <div className="relative">
              <Mic size={16} className={isPlaying ? "text-blue-600 animate-bounce" : "text-slate-300"} />
              {isPlaying && <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 border-2 border-white animate-pulse" />}
            </div>
            <div className="text-[8px] font-black text-blue-600/40 tracking-tighter uppercase">Voz</div>
          </div>
        )}
      {hasError && (
        <div className="px-1 mt-1">
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1"
          >
            <Volume2 size={10} /> Tentar baixar áudio manualmente
          </a>
        </div>
      )}
      </div>
    </div>
  );
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MessageDateDivider = ({ date }: { date: string }) => {
  return (
    <div className="flex w-full justify-center my-6 sticky top-2 z-10 pointer-events-none">
      <div className="bg-white/80 backdrop-blur-md px-4 py-1.5 rounded-2xl shadow-sm border border-slate-100/50 flex flex-col items-center gap-0.5 animate-in fade-in slide-in-from-top-2 duration-500">
        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest leading-none">
          {date}
        </span>
      </div>
    </div>
  );
};

export const ChatWindow = () => {
  const { 
    activeConversation, 
    messages, 
    setMessages, 
    addMoreMessages,
    hasMore,
    nextCursor,
    loadingMessages, 
    setLoadingMessages,
    loadingMore,
    setLoadingMore,
    deleteMessageLocally,
    updateConversationLocally,
    isProfileOpen,
    setIsProfileOpen
  } = useChatStore();

  const { isDragging, onDragOver, onDragLeave, onDrop } = useChatFileDrop();
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // Estados de busca e destaque
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [removingTag, setRemovingTag] = useState<string | null>(null);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string, type: 'IMAGE' | 'VIDEO' | 'PDF', fileName?: string, caption?: string } | null>(null);
  const [userRole, setUserRole] = useState<string>('AGENT');
  const [allowDeletePermission, setAllowDeletePermission] = useState(false);

  const scrollToAndHighlight = (id: string) => {
    const element = document.getElementById(`msg-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(id);
      setTimeout(() => setHighlightedMessageId(null), 3000);
    }
  };

  const handleNavigateToMessage = async (msgId: string, createdAt: string) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    
    const existingMsg = messages.find(m => m.id === msgId);
    
    if (existingMsg) {
       setTimeout(() => scrollToAndHighlight(msgId), 100);
    } else {
       const targetDate = new Date(createdAt);
       targetDate.setSeconds(targetDate.getSeconds() + 2);
       const beforeCursor = targetDate.toISOString();

       try {
         setLoadingMore(true);
         const resp = await fetch(`/api/messages?conversationId=${activeConversation?.id}&limit=40&before=${encodeURIComponent(beforeCursor)}`);
         if (resp.ok) {
            const data = await resp.json();
            addMoreMessages({
              messages: data.data || [],
              nextCursor: data.nextCursor,
              hasMore: data.hasMore
            });
            setTimeout(() => scrollToAndHighlight(msgId), 300);
         }
       } catch (e) {
         console.error('Erro ao buscar contexto:', e);
       } finally {
         setLoadingMore(false);
       }
    }
  };

  const handleScrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!activeConversation || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const resp = await fetch(`/api/messages/search?conversationId=${activeConversation.id}&query=${encodeURIComponent(query)}`);
      if (resp.ok) {
        const data = await resp.json();
        setSearchResults(data.data || []);
      }
    } catch (e) {
      console.error('Erro na busca:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!activeConversation) return;
    setHeaderMenuOpen(false);
    
    const confirmText = `⚠️ AÇÃO IRREVERSÍVEL: Deseja realmente APAGAR PERMANENTEMENTE a conversa com "${activeConversation.contact?.name || 'este contato'}"? 
Todos os dados e mensagens serão excluídos.`;
    
    if (!window.confirm(confirmText)) return;
    
    try {
      const resp = await fetch(`/api/conversations/${activeConversation.id}`, {
        method: 'DELETE'
      });
      
      if (resp.ok) {
        alert('Conversa excluída com sucesso.');
        useChatStore.getState().setActiveConversation(null);
        // Recarregar a lista de conversas
        const resList = await fetch(`/api/conversations?channelId=${activeConversation.channelId}`);
        if (resList.ok) {
          const data = await resList.json();
          useChatStore.getState().setConversations(data.data || []);
        }
      } else {
        const error = await resp.json();
        alert(error.error || 'Erro ao excluir conversa.');
      }
    } catch (e) {
      console.error('Falha ao excluir conversa:', e);
      alert('Erro na conexão ao excluir conversa.');
    }
  };

  useEffect(() => {
    const handleEvents = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };
    window.addEventListener('keydown', handleEvents);
    return () => window.removeEventListener('keydown', handleEvents);
  }, []);

  const handleFinishConversation = async () => {
    if (!activeConversation) return;
    setHeaderMenuOpen(false);
    if (!confirm('Deseja finalizar este atendimento?')) return;
    try {
      const resp = await fetch(`/api/conversations/${activeConversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED' })
      });
      if (resp.ok) updateConversationLocally(activeConversation.id, { status: 'CLOSED' });
    } catch (e) {
      console.error('Falha ao finalizar conversa:', e);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !nextCursor || !activeConversation) return;
    
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const oldScrollHeight = scrollContainer.scrollHeight;
    const oldScrollTop = scrollContainer.scrollTop;

    setLoadingMore(true);
    try {
      const encodedCursor = encodeURIComponent(nextCursor);
      const resp = await fetch(`/api/messages?conversationId=${activeConversation.id}&limit=20&before=${encodedCursor}`);
      if (resp.ok) {
        const data = await resp.json();
        addMoreMessages({
          messages: data.data || [],
          nextCursor: data.nextCursor,
          hasMore: data.hasMore
        });
        
        setTimeout(() => {
          if (scrollContainer) {
            const newScrollHeight = scrollContainer.scrollHeight;
            const heightDiff = newScrollHeight - oldScrollHeight;
            const finalScrollTop = oldScrollTop + heightDiff;
            scrollContainer.scrollTop = finalScrollTop;
          }
        }, 10);
      }
    } catch (e) {
      console.error('Erro ao buscar mais mensagens:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (loadingMessages || loadingMore) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop < 100) {
      handleLoadMore();
    }
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceToBottom > 300);
  };

  const handleUpdateContactName = async () => {
    if (!activeConversation || !activeConversation.contact) return;
    setHeaderMenuOpen(false);
    const newName = prompt('Novo nome para o contato:', activeConversation.contact.name);
    if (!newName || newName === activeConversation.contact.name) return;
    try {
      const resp = await fetch(`/api/contacts/${activeConversation.contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      if (resp.ok) {
        updateConversationLocally(activeConversation.id, { 
          contact: { ...activeConversation.contact, name: newName } 
        });
      }
    } catch (e) {
      console.error('Falha ao atualizar contato:', e);
    }
  };

  const handleUpdatePinnedNote = async () => {
    if (!activeConversation) return;
    setHeaderMenuOpen(false);
    const newNote = prompt('Observação (será fixada no topo):', activeConversation.pinnedNote || '');
    if (newNote === null) return;
    try {
      const resp = await fetch(`/api/conversations/${activeConversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinnedNote: newNote || null })
      });
      if (resp.ok) updateConversationLocally(activeConversation.id, { pinnedNote: newNote || undefined });
    } catch (e) {
      console.error('Falha ao atualizar observação:', e);
    }
  };

  const handleDeletePinnedNote = async () => {
    if (!activeConversation) return;
    if (!confirm('Deseja remover esta observação fixa?')) return;
    try {
      const resp = await fetch(`/api/conversations/${activeConversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinnedNote: null })
      });
      if (resp.ok) updateConversationLocally(activeConversation.id, { pinnedNote: undefined });
    } catch (e) {
      console.error('Falha ao excluir observação:', e);
    }
  };

  const handleDeleteMessage = async (id: string, mode: 'me' | 'everyone') => {
    if (deletingMsgId) return;
    setDeletingMsgId(id);
    setDeleteMenuId(null);
    const confirmText = mode === 'everyone' ? 'Deseja apagar esta mensagem para TODOS?' : 'Deseja remover esta mensagem apenas para você?';
    if (!confirm(confirmText)) {
      setDeletingMsgId(null);
      return;
    }
    try {
      const resp = await fetch(`/api/messages/${id}/delete`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }) 
      });
      if (resp.ok) deleteMessageLocally(id, mode);
    } catch (e) {
      console.error('Erro ao deletar msg:', e);
    } finally {
      setDeletingMsgId(null);
    }
  };

  useEffect(() => {
    if (!activeConversation) return;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const resp = await fetch(`/api/messages?conversationId=${activeConversation.id}&limit=20`);
        if (resp.ok) {
          const data = await resp.json();
          setMessages({
            messages: data.data || [],
            nextCursor: data.nextCursor,
            hasMore: data.hasMore
          });
        }
      } catch (e) {
        console.error('Erro ao buscar mensagens:', e);
      } finally {
        setLoadingMessages(false);
      }
    };
    fetchMessages();
  }, [activeConversation?.id, setMessages, setLoadingMessages]);

  // Busca papel do usuário e permissões globais
  useEffect(() => {
    const fetchPerms = async () => {
      try {
        // 1. Papel do usuário
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const resUser = await fetch(`/api/users/${session.user.id}`);
          const userData = await resUser.json();
          if (userData.success) setUserRole(userData.data.role);
        }

        // 2. Configurações globais
        const resSettings = await fetch('/api/settings/chat');
        const settingsData = await resSettings.json();
        if (settingsData.success) {
          setAllowDeletePermission(settingsData.data.allowAgentDeleteConversation);
        }
      } catch (e) {
        console.error('Erro ao buscar permissões:', e);
      }
    };
    fetchPerms();
  }, []);

  // Efeito para disparar a busca da foto de perfil (estratégia de cache)
  useEffect(() => {
    if (!activeConversation?.contact?.id || !activeConversation?.channelId) return;

    const contact = activeConversation.contact;
    const lastFetch = contact.lastProfilePictureFetchAt ? new Date(contact.lastProfilePictureFetchAt) : null;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Só dispara se não tiver URL ou se o cache expirou (> 24h)
    if (!contact.profilePictureUrl || !lastFetch || lastFetch < twentyFourHoursAgo) {
      const triggerFetch = async () => {
        try {
          console.log(`[UI_DEBUG] Disparando busca de foto para: ${contact.phone}`);
          const res = await fetch(`/api/contacts/${contact.id}/profile-picture`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId: activeConversation.channelId })
          });
          const data = await res.json();
          if (data.success && data.profilePictureUrl) {
            updateConversationLocally(activeConversation.id, {
               contact: { 
                 ...contact, 
                 profilePictureUrl: data.profilePictureUrl, 
                 lastProfilePictureFetchAt: new Date().toISOString() 
               }
            });
          }
        } catch (e) {
          console.error('[PROFILE_PICTURE_TRIGGER] Falha:', e);
        }
      };
      triggerFetch();
    }
  }, [activeConversation?.id, activeConversation?.contact?.id, activeConversation?.channelId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loadingMessages]);

  const refetchConversations = async () => {
    if (!activeConversation) return;
    try {
      const res = await fetch(`/api/conversations?channelId=${activeConversation.channelId}`);
      const data = await res.json();
      const conversations = data.data || [];
      useChatStore.getState().setConversations(conversations);
      const updated = conversations.find((c: any) => c.id === activeConversation.id);
      if (updated) useChatStore.getState().setActiveConversation(updated);
    } catch (e) {}
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!activeConversation || removingTag) return;
    setRemovingTag(tagName);
    const currentTags = activeConversation.tags || [];
    const nextTags = currentTags.map(ct => ct.tag.name).filter(n => n !== tagName);
    try {
      const res = await fetch(`/api/conversations/${activeConversation.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: nextTags })
      });
      if (res.ok) await refetchConversations();
    } catch (e) {
      console.error('Falha ao remover etiqueta:', e);
    } finally {
      setRemovingTag(null);
    }
  };

  if (!activeConversation) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center bg-slate-50 text-slate-400 p-10 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-xl ring-1 ring-slate-100 mb-6 animate-bounce duration-[2000ms]">
          <MessageCircle size={40} className="text-blue-100" />
        </div>
        <h2 className="text-xl font-bold text-slate-700">Bem-vindo ao Motiva Talk</h2>
        <p className="mt-2 text-sm max-w-xs text-slate-400 font-medium">Selecione uma conversa na lateral para começar a atender seus alunos e candidatos.</p>
      </div>
    );
  }

  const isClosed = activeConversation.status === 'CLOSED';

  return (
    <div 
      className="flex flex-1 flex-col bg-[#efeae2] relative overflow-hidden"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drag & Drop Global Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-blue-600/10 backdrop-blur-md pointer-events-none animate-in fade-in duration-300">
           <div className="bg-white p-12 rounded-[48px] shadow-2xl border-4 border-dashed border-blue-400 flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300">
              <div className="h-24 w-24 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-200">
                <Send size={48} className="-rotate-12" />
              </div>
              <div className="text-center">
                <p className="text-blue-600 font-black uppercase tracking-[0.3em] text-xl">Solte para Enviar</p>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">Imagem • Vídeo • Áudio • PDF</p>
              </div>
           </div>
        </div>
      )}

      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b bg-white px-6 shadow-sm z-30 shrink-0 relative">
        {isSearchOpen ? (
          <div className="flex-1 flex items-center gap-4 animate-in slide-in-from-right-4 duration-300">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar mensagens na conversa..."
                className="w-full h-10 pl-10 pr-4 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                autoFocus
              />
            </div>
            <button 
              onClick={() => { setIsSearchOpen(false); setSearchQuery(''); setSearchResults([]); }}
              className="px-4 py-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
            >
              Cancelar
            </button>
            
            {searchQuery.trim().length >= 2 && (
              <div className="absolute top-14 left-0 right-0 bg-white shadow-2xl rounded-2xl border border-slate-100 max-h-[400px] overflow-y-auto z-50 p-2 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2 border-b border-slate-50 flex justify-between items-center">
                   <span className="text-[10px] font-black uppercase text-slate-400">Resultados para "{searchQuery}"</span>
                   <span className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1 rounded-lg font-black">{searchResults.length} {searchResults.length === 1 ? 'encontrado' : 'encontrados'}</span>
                </div>
                {searchResults.length === 0 && !isSearching ? (
                  <div className="p-10 text-center flex flex-col items-center gap-2">
                    <Search size={32} className="text-slate-100" />
                    <p className="text-sm font-bold text-slate-400">Nenhuma mensagem encontrada</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 mt-1">
                    {searchResults.map(res => (
                      <div 
                        key={res.id} 
                        onClick={() => handleNavigateToMessage(res.id, res.createdAt)}
                        className="p-3 hover:bg-slate-50 rounded-xl cursor-pointer group transition-colors border-b border-transparent hover:border-blue-100"
                      >
                         <div className="flex justify-between items-start mb-1">
                            <span className={cn("text-[9px] font-black uppercase tracking-tighter", res.senderType === 'USER' ? "text-blue-500" : "text-green-600")}>
                               {res.senderType === 'USER' ? (activeConversation.contact?.name || 'Cliente') : 'Atendente'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold">{formatTimeBahia(res.createdAt)}</span>
                         </div>
                         <p className="text-[12px] text-slate-700 font-medium line-clamp-2 leading-tight">{res.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 overflow-hidden">
              <div onClick={() => setIsProfileOpen(!isProfileOpen)} className={cn("flex items-center gap-4 cursor-pointer px-2 py-1 rounded-xl transition-all hover:bg-slate-50 group/header-profile shrink-0", isProfileOpen && "bg-slate-50 shadow-inner")}>
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shadow-sm overflow-hidden text-lg font-bold text-slate-500">
                   {activeConversation.contact?.profilePictureUrl ? (
                     <img src={activeConversation.contact.profilePictureUrl} className="h-full w-full object-cover" alt={activeConversation.contact.name} />
                   ) : (
                     <span className="uppercase">{activeConversation.contact?.name?.[0] || '?'}</span>
                   )}
                </div>
                <div className="leading-tight">
                  <div className="flex items-center gap-2">
                     <h3 className="text-sm font-bold text-slate-800 tracking-tight transition-colors truncate max-w-[150px]">{activeConversation.contact?.name}</h3>
                     {activeConversation.contact?.phone && <span className="text-[10px] text-slate-400 font-mono tracking-tighter opacity-0 group-hover/header-profile:opacity-100 transition-opacity whitespace-nowrap">{formatPhone(activeConversation.contact.phone)}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn("h-2 w-2 rounded-full", isClosed ? "bg-red-500" : "bg-green-500 animate-pulse")} />
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">{isClosed ? 'Atendimento Finalizado' : (activeConversation.channel?.name || 'Inbox')}</span>
                  </div>
                </div>
              </div>
              <div className="h-4 w-px bg-slate-100 mx-1 shrink-0" />
              <div className="flex gap-1 items-center overflow-x-auto no-scrollbar max-w-[300px]">
                  {activeConversation.tags?.map((ct, idx) => (
                    <div key={`${ct.tagId}-${idx}`} className="relative group/tag-badge flex items-center">
                      <span 
                        style={{ 
                          color: ct.tag.color, 
                          backgroundColor: `${ct.tag.color}15`, 
                          borderColor: `${ct.tag.color}30` 
                        }} 
                        className="px-2.5 py-1 rounded-xl text-[9px] font-black uppercase border whitespace-nowrap shadow-sm transition-all group-hover/tag-badge:pr-7 group-hover/tag-badge:bg-white"
                      >
                         {ct.tag.emoji && <span className="mr-1">{ct.tag.emoji}</span>}
                         {ct.tag.name}
                      </span>
                      <button 
                        disabled={removingTag === ct.tag.name}
                        onClick={(e) => { e.stopPropagation(); handleRemoveTag(ct.tag.name); }} 
                        className={cn(
                          "absolute right-1.5 h-4 w-4 rounded-full flex items-center justify-center opacity-0 group-hover/tag-badge:opacity-100 scale-0 group-hover/tag-badge:scale-100 transition-all text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50",
                          removingTag === ct.tag.name && "opacity-100 scale-100"
                        )}
                        title="Remover etiqueta"
                      >
                        {removingTag === ct.tag.name ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <X size={10} strokeWidth={3} />
                        )}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <TagSelector conversationId={activeConversation.id} currentTags={activeConversation.tags || []} onUpdate={refetchConversations} />
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
              >
                <Search size={20} />
              </button>
              <div className="relative">
                <button onClick={() => setHeaderMenuOpen(!headerMenuOpen)} className={cn("rounded-xl p-2 transition-all", headerMenuOpen ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600")}><MoreVertical size={20} /></button>
                {headerMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <button onClick={handleUpdateContactName} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors"><UserPlus size={16} className="text-blue-500" />Identificar Contato</button>
                    <button onClick={handleUpdatePinnedNote} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors"><Pin size={16} className="text-orange-500" />Adicionar Observação</button>
                    <div className="h-px bg-slate-100 my-1 mx-2" />
                    <button disabled={isClosed} onClick={handleFinishConversation} className={cn("w-full text-left px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-3 transition-colors", isClosed ? "text-slate-300 cursor-not-allowed" : "text-amber-600 hover:bg-amber-50")}><CheckCircle2 size={16} className={isClosed ? "text-slate-300" : "text-amber-500"} />Finalizar Conversa</button>
                    {(userRole === 'ADMIN' || userRole === 'SUPERVISOR' || allowDeletePermission) && (
                      <>
                        <div className="h-px bg-red-50 my-1 mx-2" />
                        <button 
                          onClick={handleDeleteConversation} 
                          className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-3 transition-colors"
                        >
                          <Trash2 size={16} className="text-red-500" />
                          Apagar Conversa
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Pinned Note */}
      {activeConversation.pinnedNote && (
        <div className="bg-orange-50/90 backdrop-blur-sm border-b border-orange-100 px-6 py-2 flex items-center justify-between z-20 shadow-sm animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0"><Pin size={12} className="text-orange-600 fill-orange-600" /></div>
            <p className="text-[11px] font-bold text-orange-800 truncate italic">"{activeConversation.pinnedNote}"</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleUpdatePinnedNote()} className="text-[10px] font-black uppercase tracking-tighter text-orange-600/40 hover:text-orange-600 transition-colors">Editar</button>
            <button onClick={handleDeletePinnedNote} className="p-1.5 rounded-full hover:bg-orange-100 text-orange-400 hover:text-red-500 transition-all"><X size={14} /></button>
          </div>
        </div>
      )}

      <div 
        ref={scrollRef} 
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6"
      >
        {loadingMessages ? (
          <div className="flex flex-col gap-6">
            <div className="flex justify-start"><div className="h-12 w-48 bg-white/50 rounded-lg animate-pulse" /></div>
            <div className="flex justify-end"><div className="h-12 w-64 bg-blue-100/50 rounded-lg animate-pulse" /></div>
          </div>
        ) : (
          <>
            {showScrollBottom && (
              <button 
                onClick={handleScrollToBottom}
                className="fixed bottom-[108px] right-10 z-30 h-10 w-10 flex items-center justify-center bg-white border border-slate-100 shadow-2xl rounded-full text-blue-500 hover:bg-blue-600 hover:text-white transition-all transform hover:scale-110 active:scale-95 animate-in slide-in-from-bottom-5 duration-300"
                title="Ir para o final"
              >
                <ChevronDown size={20} className="animate-bounce" />
              </button>
            )}
            {loadingMore && (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
              </div>
            )}
            {messages.map((msg: any, index: number) => {
              const isSentByUs = msg.senderType === 'AGENT' || msg.senderType === 'SYSTEM';
              const isEveryoneDeleted = msg.deletedForEveryone;
              const currentMsgDate = parseSafeDate(msg.createdAt);
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const prevMsgDate = prevMsg ? parseSafeDate(prevMsg.createdAt) : null;
              const showDivider = !prevMsgDate || currentMsgDate.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' }) !== prevMsgDate.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' });

              return (
                <React.Fragment key={msg.id}>
                  {showDivider && <MessageDateDivider date={formatDateDivider(currentMsgDate)} />}
                  <div 
                    id={`msg-${msg.id}`}
                    className={cn(
                      "flex w-full group anim-fade-in transition-all duration-1000 p-1 rounded-2xl", 
                      isSentByUs ? "justify-end" : "justify-start",
                      highlightedMessageId === msg.id && "bg-yellow-100/50 shadow-inner ring-2 ring-yellow-200"
                    )}
                  >
                    <div className={cn("relative max-w-[80%] md:max-w-[70%] rounded-2xl p-1.5 shadow-sm transition-all hover:shadow-md", isSentByUs ? "bg-[#d9fdd3] text-slate-800 rounded-tr-none" : "bg-white text-slate-800 rounded-tl-none border border-slate-100", msg.status === 'sending' && "opacity-60 grayscale-[0.2]")}>
                      <div className="px-2.5 py-1">
                        {msg.replyToMessage && !(isEveryoneDeleted || msg.deletedForMe) && (
                          <div className="mb-2 border-l-4 border-blue-400 bg-black/10 p-2 rounded-r-lg text-[11px] opacity-90 cursor-pointer hover:bg-black/20 transition-colors">
                            <span className="block font-bold text-blue-600 mb-0.5">{msg.replyToMessage.senderType === 'USER' ? activeConversation.contact?.name : 'Você'}</span>
                            <span className="block truncate max-w-xs italic text-slate-500">{msg.replyToMessage.content}</span>
                          </div>
                        )}

                        {(isEveryoneDeleted || msg.deletedForMe) ? (
                          <div className="flex items-center gap-2 py-1.5 italic text-slate-400 text-[12px] opacity-80 min-w-[200px]">
                            <Trash2 size={12} className="opacity-40" />
                            <span>
                              {isEveryoneDeleted 
                                ? "Esta mensagem foi apagada" 
                                : (isSentByUs ? "Você apagou esta mensagem" : "O usuário apagou esta mensagem")}
                            </span>
                          </div>
                        ) : (
                          <>
                            {msg.type === 'TEXT' && <p className="whitespace-pre-wrap leading-relaxed text-[13px]">{formatWhatsappText(msg.content)}</p>}
                            {msg.type === 'IMAGE' && (
                               <div className="flex flex-col gap-2">
                                 <img 
                                   src={msg.mediaUrl || msg.content} 
                                   alt="Anexo" 
                                   className="max-h-80 w-auto rounded-xl cursor-pointer hover:opacity-95 transition-opacity duration-300 border border-black/5" 
                                   onClick={() => setLightboxMedia({ url: msg.mediaUrl || msg.content, type: 'IMAGE', caption: msg.mediaUrl ? msg.content : msg.metadata?.caption })} 
                                 />
                                 {(msg.mediaUrl ? msg.content : msg.metadata?.caption) && (
                                   <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{formatWhatsappText(msg.mediaUrl ? msg.content : msg.metadata?.caption)}</p>
                                 )}
                               </div>
                             )}
                             {msg.type === 'AUDIO' && (
                               <div className="flex flex-col gap-2">
                                 <CustomAudioPlayer url={msg.mediaUrl || msg.content} duration={msg.duration} fileName={msg.fileName} mimeType={msg.mimeType} mediaUrl={msg.mediaUrl} />
                               </div>
                             )}
                             {msg.type === 'VIDEO' && (
                               <div className="flex flex-col gap-2">
                                 <div 
                                   className="relative max-w-[300px] overflow-hidden rounded-xl border border-black/5 cursor-pointer group/video hover:opacity-95 transition-all shadow-sm"
                                   onClick={() => setLightboxMedia({ url: msg.mediaUrl || msg.content, type: 'VIDEO', caption: msg.mediaUrl ? msg.content : msg.metadata?.caption })}
                                 >
                                   {msg.thumbnailUrl ? (
                                      <div className="relative">
                                        <img src={msg.thumbnailUrl} className="w-full h-auto max-h-[400px] object-cover" alt="Video preview" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/video:bg-black/40 transition-all">
                                           <div className="h-14 w-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/40 shadow-2xl scale-110 group-hover/video:scale-125 transition-transform"><ChevronDown size={32} className="-rotate-90 ml-1" /></div>
                                        </div>
                                      </div>
                                   ) : (
                                      <video src={msg.mediaUrl || msg.content} className="w-full h-auto max-h-[400px] pointer-events-none" />
                                   )}
                                   <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[9px] font-black text-white uppercase tracking-widest border border-white/10 shadow-lg">Vídeo</div>
                                 </div>
                                 {(msg.mediaUrl ? msg.content : msg.metadata?.caption) && (
                                   <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{formatWhatsappText(msg.mediaUrl ? msg.content : msg.metadata?.caption)}</p>
                                 )}
                               </div>
                             )}
                            {msg.type === 'CONTACT' && (
                               <div className="flex flex-col gap-3 rounded-xl bg-white border border-slate-100 p-4 min-w-[240px] shadow-sm">
                                  <div className="flex items-center gap-4">
                                     <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><ContactIcon size={24} /></div>
                                     <div className="flex-1 overflow-hidden">
                                        <p className="text-sm font-black text-slate-800 truncate">{msg.metadata?.contact?.fullName || 'Sem Nome'}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{msg.metadata?.contact?.wuid ? formatPhone(msg.metadata.contact.wuid) : 'Sem Número'}</p>
                                     </div>
                                  </div>
                                  <div className="h-px bg-slate-50" />
                                  <a href={`https://wa.me/${msg.metadata?.contact?.wuid}`} target="_blank" className="w-full py-1.5 text-center text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 transition-colors">Conversar via WhatsApp</a>
                               </div>
                            )}
                            {msg.type === 'DOCUMENT' && (
                             <div className="flex flex-col gap-2">
                               <button 
                                 onClick={() => {
                                    const isPdf = msg.mimeType?.includes('pdf') || msg.fileName?.toLowerCase().endsWith('.pdf');
                                    if (isPdf) {
                                      setLightboxMedia({ url: msg.mediaUrl || msg.content, type: 'PDF', fileName: msg.fileName || 'Documento.pdf' });
                                    } else {
                                      window.open(msg.mediaUrl || msg.content, '_blank');
                                    }
                                 }}
                                 className="flex items-center gap-4 group/doc rounded-xl bg-black/5 p-4 hover:bg-slate-100 transition-all border border-black/5 min-w-[240px] max-w-full text-left no-underline w-full"
                               >
                                 <div className={cn(
                                   "p-3 rounded-2xl text-white shadow-lg group-hover/doc:scale-105 transition-transform shrink-0",
                                   (msg.mimeType?.includes('pdf') || msg.fileName?.toLowerCase().endsWith('.pdf')) ? "bg-red-500" : "bg-blue-600"
                                 )}>
                                   <FileText size={24} />
                                 </div>
                                 <div className="flex-1 overflow-hidden">
                                   <p className="text-[12px] font-black text-slate-800 truncate leading-tight group-hover/doc:text-blue-600 transition-colors">{msg.fileName || msg.metadata?.fileName || 'Documento'}</p>
                                   <div className="flex items-center gap-2 mt-1 whitespace-nowrap overflow-hidden">
                                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{msg.fileSize ? `${(msg.fileSize / 1024 / 1024).toFixed(2)} MB` : (msg.mimeType?.split('/').pop()?.toUpperCase() || msg.metadata?.mimeType?.split('/').pop()?.toUpperCase() || 'ARQUIVO')}</span>
                                      <span className="h-1 w-1 rounded-full bg-slate-300 shrink-0" />
                                      <span className="text-[9px] font-black uppercase text-blue-600">{(msg.mimeType?.includes('pdf') || msg.fileName?.toLowerCase().endsWith('.pdf')) ? 'Visualizar' : 'Baixar'}</span>
                                   </div>
                                 </div>
                               </button>
                               
                               {(msg.mimeType?.includes('pdf') || msg.fileName?.toLowerCase().endsWith('.pdf')) && (
                                  <div 
                                    onClick={() => setLightboxMedia({ url: msg.mediaUrl || msg.content, type: 'PDF', fileName: msg.fileName || 'Documento.pdf' })}
                                    className="rounded-xl overflow-hidden border border-black/5 bg-white/40 backdrop-blur-sm cursor-pointer hover:bg-white/60 transition-all relative group/pdf-mini"
                                  >
                                     <div className="aspect-[3/4] max-h-[140px] w-full flex items-center justify-center bg-slate-100/50">
                                        <iframe 
                                          src={`${msg.mediaUrl}#view=FitH&toolbar=0&navpanes=0&scrollbar=0`} 
                                          className="w-full h-full border-none pointer-events-none scale-100"
                                          title="Mini PDF Preview"
                                        />
                                        <div className="absolute inset-0 bg-transparent" />
                                     </div>
                                     <div className="absolute inset-0 bg-black/0 group-hover/pdf-mini:bg-black/5 flex items-center justify-center transition-all">
                                        <div className="bg-white/90 p-2 rounded-full shadow-lg opacity-0 group-hover/pdf-mini:opacity-100 transition-all transform scale-90 group-hover/pdf-mini:scale-100">
                                           <Eye size={18} className="text-blue-600" />
                                        </div>
                                     </div>
                                  </div>
                               )}
                             </div>
                            )}
                          </>
                        )}
                        <div className="mt-1 flex items-center justify-end gap-1.5">
                          <span className="text-[9px] text-slate-400 font-bold opacity-60">{formatTimeBahia(msg.createdAt)}</span>
                          {isSentByUs && !(isEveryoneDeleted || msg.deletedForMe) && <Check size={10} className={cn("opacity-60", msg.status === 'sending' ? "animate-pulse" : "text-blue-500")} />}
                        </div>
                      </div>

                      {!(isEveryoneDeleted || msg.deletedForMe) && !isClosed && (
                        <div className={cn(
                          "absolute top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all z-[30]", 
                          isSentByUs ? "right-full mr-2" : "left-full ml-2"
                        )}>
                           <button 
                             onClick={() => useChatStore.getState().setReplyToMessage(msg)} 
                             className="p-2 rounded-xl bg-white shadow-md border border-slate-100 text-slate-400 hover:bg-blue-600 hover:text-white transition-all transform hover:scale-110" 
                             title="Responder"
                           >
                             <Reply size={16} />
                           </button>
                           <div className="relative">
                              <button 
                                disabled={deletingMsgId === msg.id}
                                onClick={() => setDeleteMenuId(deleteMenuId === msg.id ? null : msg.id)} 
                                className={cn(
                                  "p-2 rounded-xl bg-white shadow-md border border-slate-100 transition-all transform hover:scale-110",
                                  (deleteMenuId === msg.id || deletingMsgId === msg.id) ? "bg-red-500 text-white" : "text-slate-400 hover:bg-red-50 hover:text-red-600"
                                )}
                                title="Opções de exclusão"
                              >
                                {deletingMsgId === msg.id ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                              </button>
                              {deleteMenuId === msg.id && (
                                <div className={cn(
                                  "absolute bottom-full mb-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[100] animate-in fade-in zoom-in-95 duration-200", 
                                  isSentByUs ? "right-0" : "left-0"
                                )}>
                                  <button onClick={() => handleDeleteMessage(msg.id, 'me')} className="w-full text-left px-4 py-2.5 text-[11px] font-black uppercase tracking-tight text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-2 transition-colors">Apagar para mim</button>
                                  {msg.senderType === 'AGENT' && (
                                    <button onClick={() => handleDeleteMessage(msg.id, 'everyone')} className="w-full text-left px-4 py-2.5 text-[11px] font-black uppercase tracking-tight text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 transition-colors">Apagar para todos</button>
                                  )}
                                </div>
                              )}
                           </div>
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>

      {/* Lightbox Modal (Image & Video & PDF) */}
      {lightboxMedia && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 md:p-12 animate-in fade-in duration-300">
          <button 
            onClick={() => setLightboxMedia(null)}
            className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all z-[110]"
          >
            <X size={28} />
          </button>
          
          <div className="relative w-full max-w-5xl h-full flex flex-col items-center justify-center gap-6">
            {lightboxMedia.type === 'IMAGE' ? (
              <img 
                src={lightboxMedia.url} 
                alt="Ampliada" 
                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-500"
              />
            ) : lightboxMedia.type === 'VIDEO' ? (
              <video 
                src={lightboxMedia.url} 
                controls 
                autoPlay
                className="max-w-full max-h-[80vh] rounded-xl shadow-2xl animate-in zoom-in-95 duration-500 bg-black"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
                <div className="w-full max-w-4xl h-[80vh] bg-white rounded-3xl overflow-hidden shadow-2xl border-4 border-white/5 relative group/pdf-full">
                  <iframe 
                    src={lightboxMedia.url} 
                    className="w-full h-full border-none"
                    title="PDF Viewer"
                  />
                </div>
                {lightboxMedia.fileName && (
                   <div className="mt-4 px-6 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 text-white text-[10px] font-black uppercase tracking-widest">
                     {lightboxMedia.fileName}
                   </div>
                )}
              </div>
            )}
            
            {lightboxMedia.caption && (
              <div className="max-w-2xl bg-black/40 backdrop-blur-md p-6 rounded-[24px] border border-white/10 text-center animate-in slide-in-from-bottom-4 duration-500">
                 <p className="text-white text-lg font-medium leading-relaxed">{formatWhatsappText(lightboxMedia.caption)}</p>
              </div>
            )}
            <div className="flex gap-4">
              <a 
                href={lightboxMedia.url} 
                download
                target="_blank"
                className="px-6 py-2.5 bg-white text-slate-900 rounded-xl font-black uppercase text-xs hover:bg-slate-100 transition-all shadow-lg active:scale-95"
              >
                Abrir Original
              </a>
              <button 
                onClick={() => setLightboxMedia(null)}
                className="px-6 py-2.5 bg-white/10 text-white border border-white/20 rounded-xl font-black uppercase text-xs hover:bg-white/20 transition-all shadow-lg active:scale-95"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Closed Warning */}
      {isClosed && (
        <div className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between z-40 shadow-2xl animate-in slide-in-from-bottom duration-300">
           <div className="flex items-center gap-3"><XCircle size={18} className="text-red-400" /><p className="text-xs font-bold uppercase tracking-widest">Atendimento Finalizado</p></div>
           <button onClick={async () => {
               try {
                 await fetch(`/api/conversations/${activeConversation.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'OPEN' }) });
                 updateConversationLocally(activeConversation.id, { status: 'OPEN' });
               } catch (e) {}
             }} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-[10px] font-black uppercase transition-all">Reabrir Atendimento</button>
        </div>
      )}
    </div>
  );
};
