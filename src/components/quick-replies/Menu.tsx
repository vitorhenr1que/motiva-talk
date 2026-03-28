'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Command, Zap, Search } from 'lucide-react';
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
}

export const QuickReplyMenu = ({ onSelect, onClose, search }: QuickReplyMenuProps) => {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const { activeConversation } = useChatStore();
  const listRef = useRef<HTMLDivElement>(null);

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

  const filtered = replies.filter(r => 
    r.title.toLowerCase().includes(search.toLowerCase()) || 
    r.content.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[highlightedIndex]) {
          onSelect(filtered[highlightedIndex].content);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, highlightedIndex, onSelect, onClose]);

  if (loading && search === '') return null;

  return (
    <div className="absolute bottom-full left-0 mb-3 w-[350px] overflow-hidden rounded-2xl border bg-white shadow-2xl animate-in slide-in-from-bottom-3 fade-in duration-200 ring-1 ring-slate-200 z-[100]">
      <div className="flex items-center gap-2 bg-slate-50 border-b border-slate-100 p-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
           <Zap size={14} className="fill-current" />
        </div>
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex-1">Comandos Rápidos</span>
        {search && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">/{search}</span>}
      </div>

      <div ref={listRef} className="max-h-72 overflow-y-auto scrollbar-thin p-1.5">
        {filtered.map((reply, index) => (
          <button
            key={reply.id}
            onClick={() => onSelect(reply.content)}
            onMouseEnter={() => setHighlightedIndex(index)}
            className={cn(
               "flex w-full flex-col p-3 text-left rounded-xl transition-all duration-150 group",
               highlightedIndex === index ? "bg-blue-600 shadow-lg shadow-blue-200" : "hover:bg-slate-50"
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={cn(
                "text-sm font-bold tracking-tight",
                highlightedIndex === index ? "text-white" : "text-slate-800"
              )}>
                {reply.title}
              </span>
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                highlightedIndex === index 
                  ? "bg-blue-500 border-blue-400 text-blue-50" 
                  : "bg-slate-100 border-slate-200 text-slate-500"
              )}>
                {reply.category}
              </span>
            </div>
            <p className={cn(
              "truncate text-[11px] leading-relaxed",
              highlightedIndex === index ? "text-blue-100" : "text-slate-500"
            )}>
              {reply.content}
            </p>
          </button>
        ))}

        {filtered.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center p-8 text-slate-400">
            <Search size={24} className="mb-2 opacity-20" />
            <p className="text-xs italic font-medium">Nenhum atalho encontrado</p>
          </div>
        )}
      </div>

      <div className="bg-slate-50/50 p-2 border-t border-slate-100 flex items-center gap-4">
         <div className="flex items-center gap-1.5 opacity-50">
            <kbd className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold border shadow-sm">↑↓</kbd>
            <span className="text-[10px] font-medium text-slate-500">Navegar</span>
         </div>
         <div className="flex items-center gap-1.5 opacity-50">
            <kbd className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold border shadow-sm">Enter</kbd>
            <span className="text-[10px] font-medium text-slate-500">Selecionar</span>
         </div>
      </div>
    </div>
  );
};
