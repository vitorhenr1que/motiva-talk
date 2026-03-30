'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Tag as TagIcon, X, Plus, Check, Search, Loader2 } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { createPortal } from 'react-dom';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TagSelectorProps {
  conversationId: string;
  currentTags: any[];
  onUpdate: () => void;
  renderButton?: (toggle: () => void) => React.ReactNode;
  dropdownAlign?: 'left' | 'right';
}

export const TagSelector = ({ conversationId, currentTags, onUpdate, renderButton, dropdownAlign = 'right' }: TagSelectorProps) => {
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const { tags, setTags } = useChatStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [newEmoji, setNewEmoji] = useState('🏷️');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingTagName, setSyncingTagName] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const left = dropdownAlign === 'right' ? rect.right - 288 : rect.left;
      setCoords({ top: rect.bottom + 8, left });
      setSearchTerm('');
    }
  }, [isOpen, dropdownAlign]);

  const currentNames = currentTags.map(ct => ct.tag.name);
  const emojis = [
    '🏷️', '💰', '✅', '⚠️', '🎓', '🏢', '🙋‍♂️', '📋', '💬', '📧', '🛠️', '💡', '🔥', '💎', '🚀', 
    '📅', '⏰', '⭐️', '🏆', '📌', '📎', '🔒', '🔓', '🔴', '🟢', '🟡', '🔵', '💜', '🖤', 
    '🚨', '🆘', '🛑', '🆗', '🆒', '🆕', '🔄', '✔️', '✖️', '➕', '➖', '❓', '❗️', '💯', '💢',
    '🤝', '📞', '🎧', '📱', '💻', '📈', '📉', '🛒', '🛍️', '📦', '🎁', '🎈', '🎉', '🎊', '✨',
    '👑', '🎖️', '🏅', '🥇', '🥈', '🥉', '🏳️', '🏴', '🏁', '🚩', '🔋', '🔌', '🔦', '🔗', '📐'
  ];
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags');
      const data = await res.json();
      setTags(data.data || []);
    } catch (e) {
      console.error('Failed to fetch tags');
    }
  };

  useEffect(() => {
    if (isOpen) fetchTags();
  }, [isOpen]);

  const toggleTag = async (tagName: string, color?: string, emoji?: string) => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    setSyncingTagName(tagName);

    let nextTags = [];
    if (currentNames.includes(tagName)) {
      nextTags = currentNames.filter((n: string) => n !== tagName);
    } else {
      nextTags = [...currentNames, tagName];
    }

    try {
      const res = await fetch(`/api/conversations/${conversationId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tags: nextTags,
          newTagMeta: !currentNames.includes(tagName) ? { name: tagName, color, emoji } : undefined
        })
      });
      if (res.ok) {
        onUpdate();
        fetchTags(); 
      }
    } catch (e) {
      console.error('Failed to sync tags');
    } finally {
      setIsSyncing(false);
      setSyncingTagName(null);
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim() || isSyncing) return;
    await toggleTag(newTagName.trim(), newColor, newEmoji);
    setNewTagName('');
    setSearchTerm('');
  };

  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <div className="relative inline-block" ref={triggerRef}>
      {renderButton ? renderButton(() => setIsOpen(!isOpen)) : (
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
          title="Gerenciar Etiquetas"
        >
          <TagIcon size={20} />
        </button>
      )}

      {isOpen && (coords.top > 0) && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[9998] bg-black/10 backdrop-blur-[2px]" 
            onClick={() => { if (!isSyncing) { setIsOpen(false); setCoords({ top: 0, left: 0 }); } }} 
          />
          
          {/* Dropdown Menu */}
          <div 
            style={{ 
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            className="w-72 z-[9999] rounded-[2rem] bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 overflow-hidden"
          >
             <header className="mb-4 space-y-3">
                <div className="flex items-center justify-between">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Gerenciar Etiquetas</h4>
                   <button 
                     disabled={isSyncing}
                     onClick={() => setIsOpen(false)} 
                     className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                   >
                     <X size={14} />
                   </button>
                </div>
                
                <div className="relative group">
                   <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                   <input 
                     disabled={isSyncing}
                     placeholder="Buscar ou filtrar..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 focus:bg-white focus:border-blue-200 outline-none transition-all shadow-inner placeholder:text-slate-300 disabled:opacity-50"
                   />
                </div>
             </header>

             <div className="flex flex-wrap gap-2 mb-4 max-h-48 overflow-y-auto pr-1 personalized-scrollbar">
               {filteredTags.map(tag => (
                 <button
                   key={tag.id}
                   disabled={isSyncing}
                   onClick={() => toggleTag(tag.name)}
                   style={{ 
                     color: currentNames.includes(tag.name) ? 'white' : tag.color,
                     backgroundColor: currentNames.includes(tag.name) ? tag.color : `${tag.color}15`,
                     borderColor: currentNames.includes(tag.name) ? 'transparent' : `${tag.color}30`
                   }}
                   className={cn(
                     "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all shadow-sm relative overflow-hidden",
                     !isSyncing && "hover:scale-105 active:scale-95",
                     currentNames.includes(tag.name) ? "shadow-md" : "hover:bg-opacity-25",
                     isSyncing && syncingTagName !== tag.name && "opacity-50 grayscale",
                     isSyncing && syncingTagName === tag.name && "animate-pulse ring-2 ring-blue-200 ring-offset-1"
                   )}
                 >
                   {syncingTagName === tag.name ? (
                     <Loader2 size={10} className="animate-spin" />
                   ) : (
                     <span>{tag.emoji}</span>
                   )}
                   {tag.name}
                   {!isSyncing && currentNames.includes(tag.name) && <Check size={10} className="stroke-[3]" />}
                 </button>
               ))}
               
               {filteredTags.length === 0 && searchTerm && !isSyncing && (
                 <div className="w-full py-4 text-center opacity-40">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Nenhum resultado</p>
                 </div>
               )}
             </div>

             <form onSubmit={handleCreateNew} className="pt-5 border-t border-slate-50 space-y-4">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Nova Etiqueta</p>
                <div className={cn("flex items-center gap-2", isSyncing && "opacity-50 pointer-events-none")}>
                   <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-all text-lg shadow-inner"
                      >
                        {newEmoji}
                      </button>

                      {showEmojiPicker && (
                        <div className="absolute bottom-full left-0 mb-3 w-56 max-h-56 overflow-y-auto rounded-2xl bg-white p-3 shadow-2xl border border-slate-100 grid grid-cols-5 gap-1.5 z-[10000] animate-in fade-in slide-in-from-bottom-2">
                          {emojis.map((e, idx) => (
                            <button
                              key={`${e}-${idx}`}
                              type="button"
                              onClick={() => { setNewEmoji(e); setShowEmojiPicker(false); }}
                              className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-slate-50 text-base transition-colors"
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      )}
                   </div>

                   <input 
                     type="text"
                     placeholder="Ex: Aluno VIP"
                     value={newTagName}
                     onChange={(e) => setNewTagName(e.target.value)}
                     className="flex-1 rounded-xl bg-slate-50 border border-slate-100 py-2.5 px-4 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none transition-all shadow-inner"
                   />
                </div>
                
                <div className={cn("flex items-center justify-between gap-1 pt-1", isSyncing && "opacity-50 pointer-events-none")}>
                   <div className="flex gap-2">
                      {colors.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewColor(c)}
                          style={{ backgroundColor: c }}
                          className={cn(
                            "h-5 w-5 rounded-full ring-offset-2 transition-all shadow-sm",
                            newColor === c ? "ring-2 ring-slate-400 scale-110" : "opacity-40 hover:opacity-100"
                          )}
                        />
                      ))}
                   </div>
                   <button 
                     disabled={isSyncing || !newTagName.trim()}
                     type="submit" 
                     className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                   >
                     {isSyncing && syncingTagName === newTagName ? (
                        <Loader2 size={18} className="animate-spin text-white" />
                     ) : (
                        <Plus size={18} strokeWidth={3} />
                     )}
                   </button>
                </div>
             </form>
          </div>
        </>,
        document.body
      )
      }
    </div>
  );
};
