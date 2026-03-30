import React, { useEffect, useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { Search, Filter, MessageSquare, Tag as TagIcon, Plus } from 'lucide-react';
import { TagSelector } from '@/components/chat/TagSelector';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatPhone } from '@/lib/utils';
import { formatTimeBahia, parseSafeDate } from '@/lib/date-utils';

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
    setLoadingConversations
  } = useChatStore();

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

  const filteredConversations = conversations.filter(conv => 
    conv.contact.name.toLowerCase().includes(search.toLowerCase()) ||
    formatPhone(conv.contact.phone).includes(search)
  );

  return (
    <div className="flex h-full w-80 flex-col border-r bg-white flex-shrink-0">
      {/* Filters Header */}
      <div className="p-4 border-b bg-slate-50/50 space-y-3">
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
                onClick={() => setActiveConversation(conv)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 border-b p-4 transition-all hover:bg-slate-50 relative group",
                  activeConversation?.id === conv.id && "bg-blue-50/80 hover:bg-blue-50 border-l-4 border-l-blue-600 shadow-inner"
                )}
              >
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
                    <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">
                      {conv.lastMessageAt ? formatTimeBahia(conv.lastMessageAt) : '---'}
                    </span>
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
