'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { 
  MoreVertical, Search, MessageCircle, FileText, Reply, Trash2, 
  Loader2, Check, Pin, UserPlus, CheckCircle2, XCircle, X, ChevronDown, UserPlus as ContactIcon
} from 'lucide-react';
import { TagSelector } from './TagSelector';
import { formatWhatsappText } from '@/lib/formatWhatsappText';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatPhone } from '@/lib/utils';
import { formatDateDivider, formatTimeBahia, parseSafeDate } from '@/lib/date-utils';

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
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // Estados de busca e destaque
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const scrollToAndHighlight = (id: string) => {
    const element = document.getElementById(`msg-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(id);
      console.log(`[SEARCH_DEBUG] Scroll executado para msg: ${id}`);
      setTimeout(() => setHighlightedMessageId(null), 3000);
    } else {
      console.warn(`[SEARCH_DEBUG] Elemento msg-${id} não encontrado no DOM.`);
    }
  };

  const handleNavigateToMessage = async (msgId: string, createdAt: string) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    
    console.log(`[SEARCH_DEBUG] Navegando para id: ${msgId}`);

    const existingMsg = messages.find(m => m.id === msgId);
    
    if (existingMsg) {
       console.log(`[SEARCH_DEBUG] Mensagem já está carregada na lista.`);
       setTimeout(() => scrollToAndHighlight(msgId), 100);
    } else {
       console.log(`[SEARCH_DEBUG] Mensagem não carregada. Buscando contexto...`);
       // Buscamos um pouco após a data da msg para garantir que ela venha no lote DESC
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
            console.log(`[SEARCH_DEBUG] Contexto carregado. Tentando scroll...`);
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
    console.log(`[UI_SEARCH] Termo digitado: ${query}`);
    try {
      const resp = await fetch(`/api/messages/search?conversationId=${activeConversation.id}&query=${encodeURIComponent(query)}`);
      if (resp.ok) {
        const data = await resp.json();
        setSearchResults(data.data || []);
        console.log(`[UI_SEARCH] Busca disparada | Resultados: ${data.data?.length || 0}`);
      }
    } catch (e) {
      console.error('Erro na busca:', e);
    } finally {
      setIsSearching(false);
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
      console.log(`[PAGINATION_DEBUG] [UI] Carregando mensagens antes de: ${nextCursor}`);
      const encodedCursor = encodeURIComponent(nextCursor);
      const resp = await fetch(`/api/messages?conversationId=${activeConversation.id}&limit=20&before=${encodedCursor}`);
      if (resp.ok) {
        const data = await resp.json();
        addMoreMessages({
          messages: data.data || [],
          nextCursor: data.nextCursor,
          hasMore: data.hasMore
        });
        
        // Ajuste de Scroll para evitar salto (Jitter Prevention)
        setTimeout(() => {
          if (scrollContainer) {
            const newScrollHeight = scrollContainer.scrollHeight;
            const heightDiff = newScrollHeight - oldScrollHeight;
            const finalScrollTop = oldScrollTop + heightDiff;
            
            console.log(`[SCROLL_DEBUG] Ajustando: OldH: ${oldScrollHeight} | NewH: ${newScrollHeight} | Diff: ${heightDiff} | Scroll: ${finalScrollTop}`);
            
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
    // Se estiver carregando inicialmente ou rolando para baixo, ignoramos a paginação reverso
    if (loadingMessages || loadingMore) return;
    
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    // Paginação para cima (reverso)
    if (scrollTop < 100) {
      handleLoadMore();
    }

    // Mostrar ou esconder botão de scroll para baixo (distância do fundo > 300px)
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
    setDeleteMenuId(null);
    const confirmText = mode === 'everyone' ? 'Deseja apagar esta mensagem para TODOS?' : 'Deseja remover esta mensagem apenas para você?';
    if (!confirm(confirmText)) return;
    try {
      const resp = await fetch(`/api/messages/${id}/delete`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }) 
      });
      if (resp.ok) deleteMessageLocally(id, mode);
    } catch (e) {
      console.error('Erro ao deletar msg:', e);
    }
  };

  useEffect(() => {
    if (!activeConversation) return;
    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        console.log(`[PAGINATION_DEBUG] [UI] Carregamento inicial da conversa: ${activeConversation.id}`);
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
    if (!activeConversation) return;
    const currentTags = activeConversation.tags || [];
    const nextTags = currentTags.map(ct => ct.tag.name).filter(n => n !== tagName);
    try {
      const res = await fetch(`/api/conversations/${activeConversation.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: nextTags })
      });
      if (res.ok) refetchConversations();
    } catch (e) {
      console.error('Falha ao remover etiqueta:', e);
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
    <div className="flex flex-1 flex-col bg-[#efeae2] relative overflow-hidden">
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
            
            {/* Resultados da Busca (Dropdown flutuante) */}
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
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shadow-sm overflow-hidden">
                   <span className="font-bold text-slate-500 uppercase text-lg">{activeConversation.contact?.name?.[0] || '?'}</span>
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
                 {activeConversation.tags?.map((ct) => (
                    <div key={ct.tagId} className="relative group/tag-badge flex items-center">
                      <span style={{ color: ct.tag.color, backgroundColor: `${ct.tag.color}10`, borderColor: `${ct.tag.color}30` }} className="px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase border whitespace-nowrap">
                         {ct.tag.emoji && <span className="mr-0.5">{ct.tag.emoji}</span>}
                         {ct.tag.name}
                      </span>
                      <button onClick={(e) => { e.stopPropagation(); handleRemoveTag(ct.tag.name); }} className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/tag-badge:opacity-100 scale-0 group-hover/tag-badge:scale-100 transition-all shadow-sm z-10 hover:bg-red-600"><X size={8} /></button>
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
                    <button disabled={isClosed} onClick={handleFinishConversation} className={cn("w-full text-left px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-3 transition-colors", isClosed ? "text-slate-300 cursor-not-allowed" : "text-red-600 hover:bg-red-50")}><CheckCircle2 size={16} className={isClosed ? "text-slate-300" : "text-red-500"} />Finalizar Conversa</button>
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
                        {msg.replyToMessage && !isEveryoneDeleted && (
                          <div className="mb-2 border-l-4 border-blue-400 bg-black/10 p-2 rounded-r-lg text-[11px] opacity-90 cursor-pointer hover:bg-black/20 transition-colors">
                            <span className="block font-bold text-blue-600 mb-0.5">{msg.replyToMessage.senderType === 'USER' ? activeConversation.contact?.name : 'Você'}</span>
                            <span className="block truncate max-w-xs italic text-slate-500">{msg.replyToMessage.content}</span>
                          </div>
                        )}
                        {isEveryoneDeleted ? (
                          <div className="flex items-center gap-2 py-0.5 italic text-slate-400 text-[12px] opacity-70"><Trash2 size={12} className="opacity-40" /><span>Esta mensagem foi apagada</span></div>
                        ) : (
                          <>
                            {msg.type === 'TEXT' && <p className="whitespace-pre-wrap leading-relaxed text-[13px]">{formatWhatsappText(msg.content)}</p>}
                            {msg.type === 'IMAGE' && <img src={msg.content} alt="Anexo" className="max-h-80 w-auto rounded-xl cursor-pointer" onClick={() => window.open(msg.content, '_blank')} />}
                            {msg.type === 'AUDIO' && <audio src={msg.content} controls className="h-8 w-full py-2 min-w-[200px]" />}
                            {msg.type === 'VIDEO' && <div className="max-w-[300px] overflow-hidden rounded-xl border border-black/5"><video src={msg.content} controls className="w-full h-auto max-h-[400px]" /></div>}
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
                              <a href={msg.content} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg bg-black/5 p-3 text-blue-600 font-bold decoration-none"><FileText size={20} /><span className="text-xs truncate max-w-[150px]">{msg.metadata?.fileName || 'Documento'}</span></a>
                            )}
                          </>
                        )}
                        <div className="mt-1 flex items-center justify-end gap-1.5">
                          <span className="text-[9px] text-slate-400 font-bold opacity-60">{formatTimeBahia(msg.createdAt)}</span>
                          {isSentByUs && !isEveryoneDeleted && <Check size={10} className={cn("opacity-60", msg.status === 'sending' ? "animate-pulse" : "text-blue-500")} />}
                        </div>
                      </div>
                      {!isEveryoneDeleted && !isClosed && (
                        <div className={cn("absolute top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all z-20", isSentByUs ? "-left-12 pr-2" : "-right-12 pl-2")}>
                           <button onClick={() => useChatStore.getState().setReplyToMessage(msg)} className="p-2 rounded-xl bg-white shadow-sm hover:bg-blue-600 hover:text-white transition-all transform hover:scale-110" title="Responder"><Reply size={16} /></button>
                           <div className="relative">
                              <button onClick={() => setDeleteMenuId(deleteMenuId === msg.id ? null : msg.id)} className="p-2 rounded-xl bg-white shadow-sm hover:text-red-600 hover:bg-red-50 transition-colors" title="Opções de exclusão"><Trash2 size={16} /></button>
                              {deleteMenuId === msg.id && (
                                <div className={cn("absolute bottom-full mb-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[100]", isSentByUs ? "right-0" : "left-0")}>
                                  <button onClick={() => handleDeleteMessage(msg.id, 'me')} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-2">Apagar para mim</button>
                                  <button onClick={() => handleDeleteMessage(msg.id, 'everyone')} className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2">Apagar para todos</button>
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
