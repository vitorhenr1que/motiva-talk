'use client';

import React, { useState, useEffect } from 'react';
import { Tag as TagIcon, X, Plus, Check } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';

interface TagSelectorProps {
  conversationId: string;
  currentTags: any[];
  onUpdate: () => void;
}

export const TagSelector = ({ conversationId, currentTags, onUpdate }: TagSelectorProps) => {
  const { tags, setTags } = useChatStore();
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [newEmoji, setNewEmoji] = useState('🏷️');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const currentNames = currentTags.map(ct => ct.tag.name);
  const emojis = [
    '🏷️', '💰', '✅', '⚠️', '🎓', '🏢', '🙋‍♂️', '📋', '💬', '📧', '🛠️', '💡', '🔥', '💎', '🚀', 
    '📅', '⏰', '⭐️', '🏆', '📌', '📎', '🔒', '🔓', '🔴', '🟢', '🟡', '🔵', '💜', '🖤', '✅',
    '🚨', '🆘', '🛑', '🆗', '🆒', '🆕', '🔄', '✔️', '✖️', '➕', '➖', '❓', '❗️', '💯', '💢',
    '🤝', '📞', '🎧', '📱', '💻', '📈', '📉', '🛒', '🛍️', '📦', '🎁', '🎈', '🎉', '🎊', '✨',
    '👑', '🎖️', '🏅', '🥇', '🥈', '🥉', '🏳️', '🏴', '🏁', '🚩', '🔋', '🔌', '🔦', '🔗', '📐'
  ];
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

  const fetchTags = async () => {
    const res = await fetch('/api/tags');
    const data = await res.json();
    setTags(data.data || []);
  };

  useEffect(() => {
    if (isOpen) fetchTags();
  }, [isOpen]);

  const toggleTag = async (tagName: string, color?: string, emoji?: string) => {
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
        fetchTags(); // Atualiza a lista local do menu
      }
    } catch (e) {
      console.error('Failed to sync tags');
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    await toggleTag(newTagName.trim(), newColor, newEmoji);
    setNewTagName('');
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
        title="Gerenciar Etiquetas"
      >
        <TagIcon size={20} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 z-50 rounded-2xl bg-white p-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
             <div className="mb-3 flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Etiquetas da Conversa</h4>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
             </div>

             <div className="flex flex-wrap gap-2 mb-4 max-h-40 overflow-y-auto pr-1">
               {tags.map(tag => (
                 <button
                   key={tag.id}
                   onClick={() => toggleTag(tag.name)}
                   style={{ 
                     color: currentNames.includes(tag.name) ? 'white' : tag.color,
                     backgroundColor: currentNames.includes(tag.name) ? tag.color : 'white',
                     borderColor: tag.color + '40'
                   }}
                   className={(`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                     !currentNames.includes(tag.name) && 'hover:bg-slate-50'
                   }`)}
                 >
                   <span>{tag.emoji}</span>
                   {tag.name}
                   {currentNames.includes(tag.name) && <Check size={10} />}
                 </button>
               ))}
             </div>

             <form onSubmit={handleCreateNew} className="pt-4 border-t space-y-4">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="flex h-9 w-10 items-center justify-center rounded-lg bg-slate-50 border border-slate-100 hover:border-blue-200 transition-all text-lg"
                    >
                      {newEmoji}
                    </button>

                    {showEmojiPicker && (
                      <div className="absolute bottom-full left-0 mb-2 w-48 max-h-48 overflow-y-auto rounded-xl bg-white p-2 shadow-xl border border-slate-100 grid grid-cols-5 gap-1 z-50 animate-in fade-in slide-in-from-bottom-2 scrollbar-thin">
                        {emojis.map((e, idx) => (
                          <button
                            key={`${e}-${idx}`}
                            type="button"
                            onClick={() => { setNewEmoji(e); setShowEmojiPicker(false); }}
                            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-50 text-base transition-colors"
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <input 
                    type="text"
                    placeholder="Nome da etiqueta..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="flex-1 rounded-lg bg-slate-50 border border-slate-100 py-2 px-3 text-xs focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                
                <div className="flex items-center justify-between gap-1">
                  <div className="flex gap-2">
                    {colors.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewColor(c)}
                        style={{ backgroundColor: c }}
                        className={`h-4 w-4 rounded-full ring-offset-2 transition-all ${newColor === c ? 'ring-2 ring-slate-300 scale-110' : 'opacity-80 hover:opacity-100'}`}
                      />
                    ))}
                  </div>
                  <button type="submit" className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition-all shadow-blue-200 hover:shadow-lg">
                    <Plus size={18} />
                  </button>
                </div>
             </form>
          </div>
        </>
      )}
    </div>
  );
};
