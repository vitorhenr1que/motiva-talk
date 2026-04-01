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

export const Sidebar = () => {
  const { 
    conversations, 
    activeConversation, 
    setActiveConversation, 
    channels, 
    selectedChannelId, 
    setSelectedChannelId,
    tags,
    setTags,
    selectedTagId,
    setSelectedTagId,
    setConversations,
    loadingConversations,
    setLoadingConversations,
    updateConversationLocally
  } = useChatStore();

  const [userRole, setUserRole] = useState<string>('AGENT');
  const [allowDeletePermission, setAllowDeletePermission] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'unread' | 'in_progress' | 'closed'>('unread');
  const [menuCoords, setMenuCoords] = useState<{ top: number, left: number } | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [search, setSearch] = useState('');

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

  useEffect(() => {
    if (!selectedChannelId) return;

    const fetchConversations = async () => {
      setLoadingConversations(true);
      try {
        let url = `/api/conversations?channelId=${selectedChannelId}`;
        if (selectedTagId) url += `&tagId=${selectedTagId}`;
        
        const res = await fetch(url);
        const data = await res.json();
        setConversations(data.data || []);
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
      } finally {
        setLoadingConversations(false);
      }
    };

    fetchConversations();
  }, [selectedChannelId, selectedTagId, setConversations, setLoadingConversations]);

  const refetchConversations = async () => {
    if (!selectedChannelId) return;
    try {
      let url = `/api/conversations?channelId=${selectedChannelId}`;
      if (selectedTagId) url += `&tagId=${selectedTagId}`;
      const res = await fetch(url);
      const data = await res.json();
      setConversations(data.data || []);
    } catch (e) {}
  };

  const handleDeleteConversation = async (e: React.MouseEvent, conversation: any) => {
    e.stopPropagation();
    setActiveMenuId(null);
    setSidebarMenuOpen(false);
    
    if (deletingId) return;
    
    const confirmText = `⚠️ AÇÃO IRREVERSÍVEL: Deseja realmente APAGAR PERMANENTEMENTE a conversa com "${conversation.contact?.name || 'este contato'}"? 
Todos os dados e mensagens serão excluídos.`;
    
    if (!window.confirm(confirmText)) return;
    
    setDeletingId(conversation.id);
    
    try {
      const resp = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'DELETE'
      });
      
      if (resp.ok) {
        if (activeConversation?.id === conversation.id) {
          useChatStore.getState().setActiveConversation(null);
        }
        await refetchConversations();
      } else {
        const error = await resp.json();
        alert(error.error || 'Erro ao excluir conversa.');
      }
    } catch (e) {
      console.error('[SIDEBAR] Failed to delete conversation:', e);
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
      const res = await fetch(`/api/conversations/${conv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (res.ok) {
        updateConversationLocally(conv.id, { status: newStatus });
      }
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
    // Posiciona o menu abaixo do botão, alinhado à direita
    setMenuCoords({
      top: rect.bottom + window.scrollY + 5,
      left: rect.left - 132 // Ajuste para alinhar à direita (w-44 ~ 176px - padding/offset)
    });
    setActiveMenuId(convId);
  };

  const handleTogglePin = async (e: React.MouseEvent, conv: any) => {
    e.stopPropagation();
    if (pinningId) return;
    
    // Inverte o estado de fixação
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
      } else {
        const err = await res.json();
        if (err.error?.includes('column "pinnedAt" does not exist')) {
          alert('⚠️ Aviso: A coluna "pinnedAt" ainda não existe no banco de dados. Por favor, execute a migração SQL antes de usar esta função.');
        }
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    } finally {
      setPinningId(null);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    // 1. Filtro de Texto
    const matchesSearch = conv.contact.name.toLowerCase().includes(search.toLowerCase()) ||
                         formatPhone(conv.contact.phone).includes(search);
    if (!matchesSearch) return false;

    // 2. Filtro de Etiquetas
    if (selectedTagId && !conv.tags?.some((t: any) => t.tagId === selectedTagId)) return false;

    // 3. Filtro de Abas
    if (activeTab === 'unread') {
      return (conv.status === 'OPEN' || (conv.unreadCount || 0) > 0) && conv.status !== 'CLOSED';
    }
    if (activeTab === 'in_progress') {
      return conv.status === 'IN_PROGRESS' && (conv.unreadCount || 0) === 0;
    }
    if (activeTab === 'closed') {
      return conv.status === 'CLOSED';
    }

    return true;
  }).sort((a, b) => {
    // 1. Fixados primeiro (pelo tempo de fixação mais recente)
    if (a.pinnedAt && !b.pinnedAt) return -1;
    if (!a.pinnedAt && b.pinnedAt) return 1;
    if (a.pinnedAt && b.pinnedAt) {
      return new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime();
    }

    // 2. Por última mensagem
    const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return dateB - dateA;
  });

  // Sincronizar aba ativa com a conversa selecionada
  useEffect(() => {
    if (!activeConversation) return;

    if (activeConversation.status === 'CLOSED') {
      setActiveTab('closed');
    } else if (activeConversation.status === 'OPEN' || (activeConversation.unreadCount || 0) > 0) {
      setActiveTab('unread');
    } else if (activeConversation.status === 'IN_PROGRESS') {
      setActiveTab('in_progress');
    }
  }, [activeConversation?.id, activeConversation?.status, activeConversation?.unreadCount]);

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
                title="Ações da conversa selecionada"
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
              "flex-1 py-1.5 text-[10px] font-black uppercase tracking-tight rounded-lg transition-all",
              activeTab === 'unread' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Não Lidas
            {conversations.filter(c => (c.status === 'OPEN' || (c.unreadCount || 0) > 0) && c.status !== 'CLOSED').length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-md text-[9px]">
                {conversations.filter(c => (c.status === 'OPEN' || (c.unreadCount || 0) > 0) && c.status !== 'CLOSED').length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('in_progress')}
            className={cn(
              "flex-1 py-1.5 text-[10px] font-black uppercase tracking-tight rounded-lg transition-all",
              activeTab === 'in_progress' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Atendimento
          </button>
          <button 
            onClick={() => setActiveTab('closed')}
            className={cn(
              "flex-1 py-1.5 text-[10px] font-black uppercase tracking-tight rounded-lg transition-all",
              activeTab === 'closed' ? "bg-white text-slate-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Finalizadas
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loadingConversations ? (
           <div className="flex flex-col gap-4 p-4 animate-pulse">
             {[1,2,3,4].map(i => (
               <div key={i} className="flex gap-3">
                 <div className="h-10 w-10 rounded-full bg-slate-100" />
                 <div className="flex-1 space-y-2 py-1">
                   <div className="h-2 bg-slate-100 rounded w-3/4" />
                   <div className="h-2 bg-slate-100 rounded w-1/2" />
                 </div>
               </div>
             ))}
           </div>
        ) : (
          <>
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => {
                  if (deletingId === conv.id) return;
                  setActiveConversation(conv);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-3 border-b p-4 transition-all hover:bg-slate-50 relative group",
                  activeConversation?.id === conv.id ? "bg-white ring-1 ring-inset ring-slate-200 shadow-sm" : "",
                  deletingId === conv.id ? "opacity-50 pointer-events-none grayscale" : ""
                )}
              >
                {deletingId === conv.id && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/20 backdrop-blur-[1px]">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  </div>
                )}
                {/* Status indicator bar */}
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-1",
                  conv.status === 'OPEN' ? "bg-amber-400" :
                  conv.status === 'FOLLOW_UP' ? "bg-blue-500" :
                  conv.status === 'CLOSED' ? "bg-slate-500" :
                  "bg-green-500"
                )} />
                <div className="relative h-12 w-12 shrink-0 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 shadow-sm transition-transform group-hover:scale-105 overflow-hidden border border-slate-100">
                  {conv.contact.profilePictureUrl ? (
                    <img src={conv.contact.profilePictureUrl} className="h-full w-full object-cover" alt={conv.contact.name} />
                  ) : (
                    conv.contact.name[0]
                  )}
                </div>
                
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={cn(
                      "truncate text-sm font-bold tracking-tight",
                      (conv.unreadCount || 0) > 0 ? "text-slate-900" : "text-slate-700"
                    )}>
                      {conv.contact.name}
                    </span>
                    
                    <div className="flex items-center gap-2 relative h-4">
                      {/* Alterna entre timestamp e menu de ações no hover */}
                      <span className={cn(
                        "text-[10px] text-slate-400 font-bold whitespace-nowrap transition-all",
                        activeMenuId === conv.id ? "opacity-0 scale-0" : "group-hover:opacity-0 group-hover:scale-0"
                      )}>
                        {conv.lastMessageAt ? formatTimeBahia(conv.lastMessageAt) : '---'}
                      </span>
                      
                      <div className={cn(
                        "absolute right-0 flex items-center gap-1 transition-all transform",
                        activeMenuId === conv.id ? "opacity-100 scale-100" : "opacity-0 scale-0 group-hover:opacity-100 group-hover:scale-100"
                      )}>
                        {/* Botão Pin */}
                        <button 
                          onClick={(e) => handleTogglePin(e, conv)}
                          disabled={!!pinningId && pinningId === conv.id}
                          className={cn(
                            "p-1 rounded-md transition-colors",
                            conv.pinnedAt ? "bg-blue-50 text-blue-600" : "hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                          )}
                          title={conv.pinnedAt ? "Desafixar do topo" : "Fixar no topo"}
                        >
                          {pinningId === conv.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill={conv.pinnedAt ? "currentColor" : "none"}
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className={cn(conv.pinnedAt ? "" : "-rotate-45")}
                            >
                              <line x1="12" y1="17" x2="12" y2="22" />
                              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                            </svg>
                          )}
                        </button>

                        <button 
                          onClick={(e) => handleOpenMenu(e, conv.id)}
                          className={cn(
                            "p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors",
                            activeMenuId === conv.id && "bg-slate-200 text-slate-600"
                          )}
                        >
                          <MoreVertical size={14} />
                        </button>
                        
                        {activeMenuId === conv.id && menuCoords && createPortal(
                          <>
                            {/* Backdrop para fechar */}
                            <div 
                              className="fixed inset-0 z-[100]" 
                              onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); setMenuCoords(null); }} 
                            />
                            
                            <div 
                              style={{ 
                                position: 'absolute',
                                top: menuCoords.top,
                                left: menuCoords.left,
                              }}
                              className="w-44 bg-white rounded-xl shadow-2xl border border-slate-100 p-1 z-[101] animate-in fade-in zoom-in-95 duration-200"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {conv.status !== 'CLOSED' ? (
                                <button 
                                  onClick={(e) => { handleToggleStatus(e, conv); setActiveMenuId(null); }}
                                  className="w-full text-left px-3 py-2 text-[11px] font-black uppercase tracking-tighter text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg flex items-center gap-2 transition-colors"
                                >
                                  <CheckCircle size={12} />
                                  Finalizar Conversa
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
                            </div>
                          </>,
                          document.body
                        )}
                      </div>
                    </div>
                  </div>
  
                  {/* Tags Badges */}
                  <div className="flex flex-wrap gap-1 mt-1 mb-2 min-h-[18px]">
                    {conv.tags?.slice(0, 3).map((ct: any) => (
                      <span 
                        key={ct.tag.id} 
                        style={{ 
                          backgroundColor: `${ct.tag.color}15`,
                          color: ct.tag.color,
                          borderColor: `${ct.tag.color}30`
                        }}
                        className="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border leading-none flex items-center gap-1 shadow-sm transition-transform hover:scale-105"
                      >
                        {ct.tag.emoji && <span className="text-[10px] grayscale-0">{ct.tag.emoji}</span>}
                        {ct.tag.name}
                      </span>
                    ))}
                    {(conv.tags?.length || 0) > 3 && (
                      <span className="px-1 py-0.5 rounded bg-slate-100 text-[8px] font-bold text-slate-400 border border-slate-200">
                        +{(conv.tags?.length || 0) - 3}
                      </span>
                    )}
                  </div>
  
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn(
                      "truncate text-[11px] flex-1",
                      (conv.unreadCount || 0) > 0 ? "text-slate-700 font-bold" : "text-slate-400"
                    )}>
                      {conv.messages?.[0]?.content?.substring(0, 40) || 'Sem mensagens...'}
                    </p>
                    
                    <div className="flex items-center gap-2">
                      {/* Unread Badge */}
                      {(conv.unreadCount || 0) > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-black text-white shadow-lg animate-in fade-in zoom-in duration-300">
                          {conv.unreadCount}
                        </span>
                      )}
                      
                      {/* Mark as Unread Button (Hover) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if ((conv.unreadCount || 0) > 0) {
                            useChatStore.getState().markAsRead(conv.id);
                          } else {
                            useChatStore.getState().markAsUnread(conv.id);
                          }
                        }}
                        className={cn(
                          "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-blue-600",
                          (conv.unreadCount || 0) > 0 && "opacity-100 text-blue-600"
                        )}
                        title={ (conv.unreadCount || 0) > 0 ? "Marcar como lida" : "Marcar como não lida" }
                      >
                        <MessageSquare size={14} fill={(conv.unreadCount || 0) > 0 ? "currentColor" : "none"} />
                      </button>

                      <div onClick={(e) => e.stopPropagation()}>
                        <TagSelector
                          conversationId={conv.id}
                          currentTags={conv.tags || []}
                          onUpdate={refetchConversations}
                          dropdownAlign="left"
                          renderButton={(toggle) => (
                            <button
                              onClick={toggle}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-indigo-600"
                              title="Gerenciar Etiquetas"
                            >
                              <TagIcon size={14} />
                            </button>
                          )}
                        />
                      </div>

                      <span className={cn(
                        "text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border tracking-tighter whitespace-nowrap",
                        conv.status === 'OPEN' ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-green-50 text-green-600 border-green-200"
                      )}>
                        {conv.status === 'OPEN' ? 'ABERTO' : 'EM ATEND.'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {filteredConversations.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-400 opacity-50 mt-10">
                <MessageSquare size={48} className="mb-2" />
                <p className="text-sm font-medium italic">Nenhum atendimento encontrado</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
