import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useChatStore } from '@/store/useChatStore';
import { MoreVertical, Trash2, Loader2, Search, Filter, MessageSquare, Tag as TagIcon, Plus, CheckCircle, RefreshCw } from 'lucide-react';
import { TagSelector } from '@/components/chat/TagSelector';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatPhone } from '@/lib/utils';
import { formatTimeBahia, parseSafeDate } from '@/lib/date-utils';
import { supabase } from '@/lib/supabase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MemoizedConversationItem = React.memo(({ conv, activeId, isDeleting, onSelect, onOpenMenu, onUpdateCounts }: any) => {
  return (
    <div
      onClick={() => onSelect(conv)}
      className={cn(
        "flex cursor-pointer items-center gap-3 border-b p-4 transition-all hover:bg-slate-50 relative group",
        activeId === conv.id ? "bg-blue-50/50 ring-1 ring-inset ring-blue-100/50 shadow-sm" : "bg-white",
        isDeleting ? "opacity-50 pointer-events-none grayscale" : ""
      )}
    >
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 transition-all",
        activeId === conv.id ? "w-1.5 bg-blue-600" : (
          conv.status === 'OPEN' ? "bg-amber-400" :
          conv.status === 'FOLLOW_UP' ? "bg-blue-500" :
          conv.status === 'CLOSED' ? "bg-slate-500" :
          "bg-emerald-500"
        )
      )} />
      <div className="relative h-12 w-12 shrink-0 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 shadow-sm transition-transform group-hover:scale-105 overflow-hidden border border-slate-100">
        {conv.contact.profilePictureUrl ? (
          <img src={conv.contact.profilePictureUrl} className="h-full w-full object-cover" alt={conv.contact.name} />
        ) : (
          conv.contact.name?.[0] || '?'
        )}
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-0.5">
          <span className={cn("truncate text-sm font-bold tracking-tight", (conv.unreadCount || 0) > 0 || activeId === conv.id ? "text-slate-900" : "text-slate-700")}>
            {conv.contact.name}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">
              {conv.lastMessageAt ? formatTimeBahia(conv.lastMessageAt) : '---'}
            </span>
            <button 
              onClick={(e) => { e.stopPropagation(); onOpenMenu(e, conv.id); }} 
              className="p-1 rounded-md hover:bg-slate-200 text-slate-400"
            >
              <MoreVertical size={14} />
            </button>
          </div>
        </div>
        <p className="truncate text-[11px] text-slate-400 whitespace-pre">
          {conv.lastMessagePreview || 'Sem mensagens...'}
        </p>
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-1 overflow-hidden mr-2">
            {conv.tags?.slice(0, 3).map((ct: any) => (
              <span 
                key={`${ct.tag.id}-${ct.id}`} 
                style={{ 
                  color: ct.tag.color, 
                  backgroundColor: `${ct.tag.color}15`,
                  borderColor: `${ct.tag.color}20`
                }}
                className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase border whitespace-nowrap flex items-center gap-1"
              >
                <span className="text-[10px]">{ct.tag.emoji}</span>
                {ct.tag.name}
              </span>
            ))}
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0">
             {/* Tag Action Botão */}
             <TagSelector 
               conversationId={conv.id} 
               currentTags={conv.tags || []} 
               onUpdate={() => onUpdateCounts?.()}
               renderButton={(toggle) => (
                 <button 
                   onClick={(e) => { e.stopPropagation(); toggle(); }}
                   className="p-1 rounded-md text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100"
                   title="Etiquetar"
                 >
                   <TagIcon size={14} />
                 </button>
               )}
             />

             {/* Mark as Unread Botão */}
             <button 
               onClick={(e) => { e.stopPropagation(); useChatStore.getState().markAsUnread(conv.id); }}
               className="p-1 rounded-md text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-all opacity-0 group-hover:opacity-100"
               title="Marcar como não lida"
             >
               <MessageSquare size={14} />
             </button>

             {(conv.unreadCount || 0) > 0 && (
               <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-black text-white">
                 {conv.unreadCount}
               </span>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.activeId === next.activeId && 
         prev.isDeleting === next.isDeleting &&
         prev.conv.id === next.conv.id &&
         prev.conv.lastMessageAt === next.conv.lastMessageAt &&
         prev.conv.status === next.conv.status &&
         prev.conv.unreadCount === next.conv.unreadCount &&
         prev.conv.lastMessagePreview === next.conv.lastMessagePreview &&
         prev.conv.pinnedAt === next.conv.pinnedAt;
});

export const Sidebar = () => {
  const { 
    activeConversation, 
    setActiveConversation, 
    channels, 
    selectedChannelId, 
    setSelectedChannelId,
    tags,
    setTags,
    selectedTagId,
    setSelectedTagId,
    updateConversationLocally,
    upsertConversationLocally,
    tabData,
    setTabData,
    resetTabs,
    tabCounts,
    setTabCounts,
    activeTab, // Do store
    setActiveTab // Do store
  } = useChatStore();

  const [userRole, setUserRole] = useState<string>('AGENT');
  const [allowDeletePermission, setAllowDeletePermission] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number, left: number } | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const bottomRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(handler);
  }, [search]);

  // Status mapping for API
  const getTabStatus = (tab: string) => {
     if (tab === 'unread') return 'OPEN';
     if (tab === 'in_progress') return 'IN_PROGRESS';
     if (tab === 'closed') return 'CLOSED';
     return undefined;
  };

  const fetchCounts = async () => {
    if (!selectedChannelId) return;
    try {
      let url = `/api/conversations/counts?channelId=${selectedChannelId}`;
      if (selectedTagId) url += `&tagId=${selectedTagId}`;
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
      
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setTabCounts({
          unread: data.data.OPEN,
          in_progress: data.data.IN_PROGRESS,
          closed: data.data.CLOSED
        });
      }
    } catch (e) {
      console.error('Error fetching counts:', e);
    }
  };

  const fetchTabItems = async (tab: 'unread' | 'in_progress' | 'closed', append = false) => {
    if (!selectedChannelId) return;
    
    const currentTab = tabData[tab];
    // Evita requisições duplicadas
    if (currentTab.loading || currentTab.loadingMore) return;

    const lastItem = append ? currentTab.list[currentTab.list.length - 1] : null;

    setTabData(tab, { [append ? 'loadingMore' : 'loading']: true });
    try {
      const status = getTabStatus(tab);
      let url = `/api/conversations?channelId=${selectedChannelId}&status=${status}&limit=15`;
      
      if (lastItem) {
         const value = lastItem.lastMessageAt;
         url += `&cursorValue=${encodeURIComponent(value || '')}&cursorId=${lastItem.id}`;
         if (lastItem.pinnedAt) url += `&cursorPinnedAt=${encodeURIComponent(lastItem.pinnedAt)}`;
      }

      if (selectedTagId) url += `&tagId=${selectedTagId}`;
      if (debouncedSearch) url += `&search=${encodeURIComponent(debouncedSearch)}`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      const newList = data.data || [];
      setTabData(tab, { 
        list: newList, 
        hasMore: newList.length === 15,
        loading: false,
        loadingMore: false,
        initialized: true
      }, append);
    } catch (e) {
      console.error('Fetch error:', e);
      setTabData(tab, { loading: false, loadingMore: false });
    }
  };

  const prevFiltersRef = useRef({ channel: selectedChannelId, tag: selectedTagId, search: debouncedSearch });

  // Efeito principal: troca de aba, canal, etiqueta ou busca
  useEffect(() => {
    if (!selectedChannelId) return;
    
    // Verifica se o que mudou foi um filtro (canal, tag ou busca) em vez de apenas a aba
    const filtersChanged = 
      prevFiltersRef.current.channel !== selectedChannelId ||
      prevFiltersRef.current.tag !== selectedTagId ||
      prevFiltersRef.current.search !== debouncedSearch;

    if (filtersChanged) {
       // Se o filtro mudou, limpamos as abas antes de buscar
       resetTabs();
       prevFiltersRef.current = { channel: selectedChannelId, tag: selectedTagId, search: debouncedSearch };
       // O resetTabs zera o initialized, então o fetchTabItems abaixo vai carregar do zero
    }

    // Sempre atualiza os contadores
    fetchCounts();

    // Busca itens da aba atual
    fetchTabItems(activeTab);
  }, [activeTab, selectedChannelId, selectedTagId, debouncedSearch]);

  // Infinite Scroll com Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const currentTab = tabData[activeTab];
        if (currentTab.hasMore && !currentTab.loading && !currentTab.loadingMore && currentTab.list.length > 0) {
           fetchTabItems(activeTab, true);
        }
      }
    }, { threshold: 0.1, rootMargin: '100px' });

    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [activeTab, tabData[activeTab].hasMore, tabData[activeTab].loading, tabData[activeTab].loadingMore]);

  useEffect(() => {
    const fetchTags = async () => {
      const res = await fetch('/api/tags');
      const data = await res.json();
      setTags(data.data || []);
    };
    fetchTags();
  }, [setTags]);

  useEffect(() => {
    const fetchPerms = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const resUser = await fetch(`/api/users/${session.user.id}`);
          const userData = await resUser.json();
          if (userData.success) setUserRole(userData.data.role);
        }

        const resSettings = await fetch('/api/settings/chat');
        const settingsData = await resSettings.json();
        if (settingsData.success) {
          setAllowDeletePermission(settingsData.data.allowAgentDeleteConversation);
        }
      } catch (e) {
        console.error('[SIDEBAR] Error fetching perms:', e);
      }
    };
    fetchPerms();
  }, []);

  const handleDeleteConversation = async (e: React.MouseEvent, conversation: any) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setSidebarMenuOpen(false);
    if (deletingId) return;
    const confirmText = `⚠️ AÇÃO IRREVERSÍVEL: Deseja realmente APAGAR PERMANENTEMENTE a conversa com "${conversation.contact?.name || 'este contato'}"?\nTodos os dados e mensagens serão excluídos.`;
    if (!window.confirm(confirmText)) return;
    setDeletingId(conversation.id);
    try {
      const resp = await fetch(`/api/conversations/${conversation.id}`, { method: 'DELETE' });
      if (resp.ok) {
        if (activeConversation?.id === conversation.id) {
          useChatStore.getState().setActiveConversation(null);
        }
        // removeConversationLocally já cuida de tudo sem refetch
        useChatStore.getState().removeConversationLocally(conversation.id);
      } else {
        const error = await resp.json();
        alert(error.error || 'Erro ao excluir conversa.');
      }
    } catch (e) {
      alert('Erro na conexão ao excluir conversa.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (e: React.MouseEvent, conv: any) => {
    e.stopPropagation();
    setActiveMenuId(null);
    const newStatus = conv.status === 'CLOSED' ? 'OPEN' : 'CLOSED';
    try {
      // Otimismo: Movemos localmente imediatamente
      upsertConversationLocally({ id: conv.id, status: newStatus });
      
      const res = await fetch(`/api/conversations/${conv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      // useRealtimeInbox + trigger DB vão confirmar a mudança depois
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  const handleOpenMenu = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    if (activeMenuId === convId) {
      setActiveMenuId(null);
      setMenuCoords(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuCoords({
      top: rect.bottom + window.scrollY + 5,
      left: rect.left - 132
    });
    setActiveMenuId(convId);
  };

  const handleTogglePin = async (e: React.MouseEvent, conv: any) => {
    e.stopPropagation();
    if (pinningId) return;
    const isCurrentlyPinned = !!conv.pinnedAt;
    const newPinnedAt = isCurrentlyPinned ? null : new Date().toISOString();
    setPinningId(conv.id);
    try {
      const res = await fetch(`/api/conversations/${conv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinnedAt: newPinnedAt })
      });
      if (res.ok) {
        updateConversationLocally(conv.id, { pinnedAt: newPinnedAt });
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    } finally {
      setPinningId(null);
    }
  };

  const currentTabList = tabData[activeTab].list;

  return (
    <div className="flex h-full w-80 flex-col border-r bg-white flex-shrink-0">
      {/* Filters Header */}
      <div className="p-4 border-b bg-slate-50/50 space-y-3 relative group/sidebar-header">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block px-1">Atendimentos</label>
          {(userRole === 'ADMIN' || userRole === 'SUPERVISOR' || allowDeletePermission) && activeConversation && (
            <div className="relative">
              <button 
                onClick={() => setSidebarMenuOpen(!sidebarMenuOpen)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
              >
                <MoreVertical size={16} />
              </button>
              {sidebarMenuOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[60] animate-in fade-in zoom-in-95 duration-200">
                  <header className="px-3 py-1.5 border-b border-slate-50 mb-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Conversa Selecionada</p>
                    <p className="text-[11px] font-bold text-slate-700 truncate">{activeConversation.contact?.name}</p>
                  </header>
                  <button 
                    onClick={(e) => { setSidebarMenuOpen(false); handleDeleteConversation(e, activeConversation); }}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-3 transition-colors"
                  >
                    <Trash2 size={16} />
                    Apagar Conversa
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block px-1">Canal</label>
            <select 
              value={selectedChannelId || ''} 
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="w-full rounded-xl border border-slate-100 bg-white py-2 px-2.5 text-[11px] font-black text-slate-700 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            >
              {channels.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
              {channels.length === 0 && <option value="">Nenhum canal</option>}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block px-1">Etiquetas</label>
            <select 
              value={selectedTagId || ''} 
              onChange={(e) => setSelectedTagId(e.target.value)}
              className="w-full rounded-xl border border-slate-100 bg-white py-2 px-2.5 text-[11px] font-black text-slate-700 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="">🎯 Todas</option>
              {tags.map(t => (
                <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Buscar atendimento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg bg-white border border-slate-200 py-1.5 pl-9 pr-4 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>

        {/* Tabs */}
        <div className="flex p-0.5 bg-slate-200/50 rounded-xl mt-1">
          <button 
            onClick={() => setActiveTab('unread')}
            className={cn(
               "flex-1 py-1.5 text-[10px] font-black uppercase tracking-tight rounded-lg transition-all flex items-center justify-center gap-1.5",
               activeTab === 'unread' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Não Lidas
            {tabCounts.unread > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-100 px-1 text-[9px] font-black text-blue-600">
                {tabCounts.unread}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('in_progress')}
            className={cn(
               "flex-1 py-1.5 text-[10px] font-black uppercase tracking-tight rounded-lg transition-all flex items-center justify-center gap-1.5",
               activeTab === 'in_progress' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Atendimento
            {tabCounts.in_progress > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-100 px-1 text-[9px] font-black text-emerald-600">
                {tabCounts.in_progress}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('closed')}
            className={cn(
               "flex-1 py-1.5 text-[10px] font-black uppercase tracking-tight rounded-lg transition-all flex items-center justify-center gap-1.5",
               activeTab === 'closed' ? "bg-white text-slate-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Finalizadas
            {tabCounts.closed > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-slate-200 px-1 text-[9px] font-black text-slate-600">
                {tabCounts.closed}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {tabData[activeTab].loading && currentTabList.length === 0 && (
          <div className="p-4 space-y-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-12 w-12 rounded-full bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 bg-slate-100 rounded" />
                  <div className="h-2 w-full bg-slate-50 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {currentTabList.map((conv) => (
          <MemoizedConversationItem 
            key={conv.id} 
            conv={conv}
            activeId={activeConversation?.id}
            isDeleting={deletingId === conv.id}
            onSelect={setActiveConversation}
            onOpenMenu={handleOpenMenu}
            onUpdateCounts={fetchCounts}
          />
        ))}

        {tabData[activeTab].loadingMore && (
          <div className="p-4 flex justify-center border-t border-slate-50 bg-slate-50/30">
            <Loader2 className="animate-spin text-blue-500/50" size={20} />
          </div>
        )}

        {/* Elemento sentinela para o Infinite Scroll */}
        <div ref={bottomRef} className="h-4 w-full" />

        {currentTabList.length === 0 && tabData[activeTab].initialized && !tabData[activeTab].loading && (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-400 opacity-50 mt-10">
            <MessageSquare size={48} className="mb-2" />
            <p className="text-sm font-medium italic">Nenhum atendimento encontrado</p>
          </div>
        )}
      </div>
      
      {activeMenuId && menuCoords && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => { setActiveMenuId(null); setMenuCoords(null); }} />
          <div 
            style={{ 
              position: 'absolute', 
              top: menuCoords.top, 
              left: menuCoords.left,
              pointerEvents: 'auto'
            }}
            className="w-44 bg-white rounded-xl shadow-2xl border border-slate-100 p-1 z-[101] animate-in fade-in zoom-in-95 duration-200"
          >
            {(() => {
              const conv = currentTabList.find(c => c.id === activeMenuId);
              if (!conv) return null;
              return (
                <>
                  <header className="px-3 py-1.5 border-b border-slate-50 mb-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ações da Conversa</p>
                    <p className="text-[11px] font-bold text-slate-700 truncate">{conv.contact?.name}</p>
                  </header>

                  {conv.status !== 'CLOSED' ? (
                    <button 
                      onClick={(e) => { handleToggleStatus(e, conv); setActiveMenuId(null); }}
                      className="w-full text-left px-3 py-2 text-[11px] font-black uppercase tracking-tighter text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <CheckCircle size={12} />
                      Finalizar Atendimento
                    </button>
                  ) : (
                    <button 
                      onClick={(e) => { handleToggleStatus(e, conv); setActiveMenuId(null); }}
                      className="w-full text-left px-3 py-2 text-[11px] font-black uppercase tracking-tighter text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <RefreshCw size={12} />
                      Reabrir Atendimento
                    </button>
                  )}

                  <button 
                    onClick={(e) => { e.stopPropagation(); useChatStore.getState().markAsUnread(conv.id); setActiveMenuId(null); }}
                    className="w-full text-left px-3 py-2 text-[11px] font-black uppercase tracking-tighter text-slate-600 hover:bg-amber-50 hover:text-amber-600 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <MessageSquare size={12} />
                    Marcar como não lida
                  </button>

                  <div className="px-1 py-1">
                    <TagSelector 
                      conversationId={conv.id} 
                      currentTags={conv.tags || []} 
                      onUpdate={fetchCounts}
                      compact={true}
                    />
                  </div>

                  {(userRole === 'ADMIN' || userRole === 'SUPERVISOR' || allowDeletePermission) && (
                    <>
                      <div className="h-px bg-slate-50 my-1 mx-1" />
                      <button 
                        onClick={(e) => { handleDeleteConversation(e, conv); setActiveMenuId(null); }}
                        className="w-full text-left px-3 py-2 text-[11px] font-black uppercase tracking-tighter text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <Trash2 size={12} />
                        Apagar Conversa
                      </button>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};
