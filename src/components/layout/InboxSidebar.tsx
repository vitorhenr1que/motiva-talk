import React, { useEffect, useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { Search, Filter, MessageSquare, Tag as TagIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

  const filteredConversations = conversations.filter(conv => 
    conv.contact.name.toLowerCase().includes(search.toLowerCase()) ||
    conv.contact.phone.includes(search)
  );

  return (
    <div className="flex h-full w-80 flex-col border-r bg-white flex-shrink-0">
      {/* Filters Header */}
      <div className="p-4 border-b bg-slate-50/50 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {/* ... selects remain same ... */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Canal</label>
            <select 
              value={selectedChannelId || ''} 
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="w-full rounded-lg border-slate-200 bg-white py-1.5 px-2 text-[11px] font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
            >
              {channels.map(ch => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
              {channels.length === 0 && <option value="">Nenhum canal</option>}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Etiqueta</label>
            <select 
              value={selectedTagId || ''} 
              onChange={(e) => setSelectedTagId(e.target.value)}
              className="w-full rounded-lg border-slate-200 bg-white py-1.5 px-2 text-[11px] font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
            >
              <option value="">Todas</option>
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
                  "flex cursor-pointer items-center gap-3 border-b p-4 transition-all hover:bg-slate-50",
                  activeConversation?.id === conv.id && "bg-blue-50 hover:bg-blue-50 border-l-4 border-l-blue-600"
                )}
              >
                <div className="relative h-10 w-10 shrink-0 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">
                  {conv.contact.name[0]}
                </div>
                
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-bold text-slate-700">{conv.contact.name}</span>
                    <span className="text-[9px] text-slate-400 font-medium">
                      {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                    </span>
                  </div>
 
                  {/* Tags Badges */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {conv.tags?.map((ct: any) => (
                      <span 
                        key={ct.tag.id} 
                        style={{ 
                          backgroundColor: ct.tag.color + '15',
                          color: ct.tag.color,
                          borderColor: ct.tag.color + '30'
                        }}
                        className="px-1.5 py-0.5 rounded-md text-[8px] font-extrabold uppercase border flex items-center gap-1"
                      >
                        {ct.tag.emoji && <span>{ct.tag.emoji}</span>}
                        {ct.tag.name}
                      </span>
                    ))}
                  </div>
 
                  <div className="flex items-center justify-between mt-1">
                    <p className="truncate text-[11px] text-slate-400">
                      {conv.messages?.[0]?.content || 'Sem mensagens...'}
                    </p>
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                      conv.status === 'OPEN' ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"
                    )}>
                      {conv.status === 'OPEN' ? 'ABERTO' : 'EM ATEND.'}
                    </span>
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
