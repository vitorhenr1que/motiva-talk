'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Command, Zap, Search, Plus, X as CloseIcon } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface QuickReply {
  id: string;
  title: string;
  content: string;
  category: string;
  channelId?: string;
}

interface QuickReplyMenuProps {
  onSelect: (content: string) => void;
  onClose: () => void;
  search: string;
  onOpenManager: () => void;
}

export const QuickReplyMenu = ({ onSelect, onClose, search, onOpenManager }: QuickReplyMenuProps) => {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalSearch, setInternalSearch] = useState(search);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const { activeConversation } = useChatStore();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchReplies = async () => {
      try {
        const channelId = activeConversation?.channel.id;
        const url = `/api/quick-replies${channelId ? `?channelId=${channelId}` : ''}`;
        const resp = await fetch(url);
        if (resp.ok) {
          const data = await resp.json();
          setReplies(data.data || []);
        }
      } catch (e) {
        console.error('Quick replies fetch failed');
      } finally {
        setLoading(false);
      }
    };
    fetchReplies();
  }, [activeConversation]);

  const filtered = replies.filter(r => {
    const s = internalSearch.trim().toLowerCase();
    return r.title.toLowerCase().includes(s) || 
           r.content.toLowerCase().includes(s) ||
           r.category.toLowerCase().includes(s);
  });

  useEffect(() => {
    setHighlightedIndex(0);
  }, [internalSearch]);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        if (filtered[highlightedIndex]) {
          e.preventDefault();
          onSelect(filtered[highlightedIndex].content);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, highlightedIndex, onSelect, onClose]);

  if (loading && internalSearch === '') return null;

  return (
    <div ref={menuRef} className="absolute bottom-full left-0 mb-3 w-[400px] overflow-hidden rounded-3xl border bg-white shadow-2xl animate-in slide-in-from-bottom-3 fade-in duration-200 ring-1 ring-slate-200 z-[100] flex flex-col">
      {/* Header with Search and Create */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 shadow-md shadow-blue-200 text-white">
               <Zap size={14} className="fill-current" />
            </div>
            <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Ações Rápidas</span>
          </div>
          <button 
            onClick={onOpenManager}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm active:scale-95"
          >
            <Plus size={12} />
            CRIAR NOVO
          </button>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            ref={inputRef}
            autoFocus
            type="text"
            placeholder="Buscar atalho..."
            value={internalSearch}
            onChange={(e) => setInternalSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl py-2 pl-9 pr-4 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-400"
          />
          {internalSearch && (
            <button 
              onClick={() => setInternalSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <CloseIcon size={12} />
            </button>
          )}
        </div>
      </div>

      <div ref={listRef} className="max-h-72 overflow-y-auto scrollbar-thin p-2">
        {filtered.map((reply, index) => (
          <button
            key={reply.id}
            onClick={() => onSelect(reply.content)}
            onMouseEnter={() => setHighlightedIndex(index)}
            className={cn(
               "flex w-full flex-col p-4 text-left rounded-[1.25rem] transition-all duration-150 group mb-1 last:mb-0",
               highlightedIndex === index ? "bg-slate-900 shadow-lg shadow-slate-200 text-white" : "hover:bg-slate-50 border border-transparent"
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={cn(
                "text-sm font-black tracking-tight uppercase",
                highlightedIndex === index ? "text-white" : "text-slate-800"
              )}>
                {reply.title}
              </span>
              <span className={cn(
                "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border",
                highlightedIndex === index 
                  ? "bg-slate-800 border-slate-700 text-slate-400" 
                  : "bg-slate-100 border-slate-200 text-slate-500"
              )}>
                {reply.category}
              </span>
            </div>
            <p className={cn(
              "text-[11px] leading-relaxed font-medium line-clamp-2",
              highlightedIndex === index ? "text-slate-400" : "text-slate-500"
            )}>
              {reply.content}
            </p>
          </button>
        ))}

        {filtered.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400 opacity-30">
            <Search size={32} className="mb-3" />
            <p className="text-[10px] font-black uppercase tracking-widest">Nenhum atalho encontrado</p>
          </div>
        )}
      </div>

      <div className="bg-slate-50/80 p-3 border-t border-slate-100 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 grayscale opacity-40">
                <kbd className="rounded-md bg-white px-1.5 py-0.5 text-[9px] font-black border shadow-sm">↑↓</kbd>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Navegar</span>
            </div>
            <div className="flex items-center gap-1.5 grayscale opacity-40">
                <kbd className="rounded-md bg-white px-1.5 py-0.5 text-[9px] font-black border shadow-sm">Enter</kbd>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Enviar</span>
            </div>
         </div>
         <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{filtered.length} Resultados</span>
      </div>
    </div>
  );
};
