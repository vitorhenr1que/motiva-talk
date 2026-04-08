'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Tag as TagIcon, X, Plus, Check, Search, Loader2, Edit2, Trash2 } from 'lucide-react';
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
  compact?: boolean;
}

export const TagSelector = ({ conversationId, currentTags, onUpdate, renderButton, dropdownAlign = 'right', compact = false }: TagSelectorProps) => {
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const { tags, setTags, selectedTagId, setSelectedTagId } = useChatStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [newEmoji, setNewEmoji] = useState('🏷️');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingTagName, setSyncingTagName] = useState<string | null>(null);
  
  // Management states
  const [editingTag, setEditingTag] = useState<{ id: string, name: string, emoji: string, color: string } | null>(null);
  const [isManaging, setIsManaging] = useState(false);

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
    
    if (editingTag) {
      await handleUpdateTag();
    } else {
      await toggleTag(newTagName.trim(), newColor, newEmoji);
    }
    
    setNewTagName('');
    setSearchTerm('');
    setEditingTag(null);
  };

  const handleUpdateTag = async () => {
    if (!editingTag || !newTagName.trim()) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/tags/${editingTag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newTagName.trim(),
          color: newColor,
          emoji: newEmoji
        })
      });
      if (res.ok) {
        fetchTags();
        onUpdate();
      }
    } catch (e) {
      console.error('Failed to update tag');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteTag = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja excluir esta etiqueta permanentemente de todas as conversas?')) return;
    
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/tags/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        // 1. Atualizar lista global de etiquetas
        fetchTags();
        
        // 2. Notificar componente pai (refetch do Sidebar/ChatArea)
        onUpdate();
        
        // 3. Remover manualmente de TODAS as conversas no estado global para feedback instantâneo
        const state = useChatStore.getState();
        const updatedConversations = state.conversations.map(conv => ({
          ...conv,
          tags: conv.tags?.filter((ct: any) => ct.tagId !== id)
        }));
        state.setConversations(updatedConversations);
        
        // Se a etiqueta apagada era o filtro ativo, removemos o filtro
        if (selectedTagId === id) {
          setSelectedTagId(null);
        }

        // Se a etiqueta estava na conversa ativa, removemos localmente também
        if (state.activeConversation && state.activeConversation.tags?.some((ct: any) => ct.tagId === id)) {
           state.setActiveConversation({
             ...state.activeConversation,
             tags: state.activeConversation.tags.filter((ct: any) => ct.tagId !== id)
           });
        }
      } else {
        const err = await res.json();
        alert(err.message || 'Erro ao excluir etiqueta permanentemente.');
      }
    } catch (e) {
      console.error('Failed to delete tag');
    } finally {
      setIsSyncing(false);
    }
  };

  const startEdit = (tag: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTag(tag);
    setNewTagName(tag.name);
    setNewEmoji(tag.emoji);
    setNewColor(tag.color);
  };

  const cancelEdit = () => {
    setEditingTag(null);
    setNewTagName('');
    setNewEmoji('🏷️');
    setNewColor('#3b82f6');
  };

  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <div className="relative inline-block" ref={triggerRef}>
      {renderButton ? renderButton(() => setIsOpen(!isOpen)) : (
        <button 
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          className={cn(
             "text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-2",
             compact ? "w-full text-left px-2.5 py-2 text-[11px] font-black uppercase tracking-tighter text-slate-600 rounded-lg" : "p-2 rounded-xl"
          )}
          title="Gerenciar Etiquetas"
        >
          <TagIcon size={compact ? 12 : 20} />
          {compact && <span>Etiquetas / Tags</span>}
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
            className="w-80 z-[9999] rounded-[2rem] bg-white p-5 shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 overflow-hidden"
          >
             <header className="mb-4 space-y-3">
                <div className="flex items-center justify-between">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Gerenciar Etiquetas</h4>
                   <div className="flex items-center gap-1">
                      <button 
                        onClick={() => { setIsManaging(!isManaging); setEditingTag(null); }}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all shadow-sm border",
                          isManaging 
                            ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600" 
                            : "bg-white text-slate-400 border-slate-100 hover:text-blue-600 hover:border-blue-100"
                        )}
                      >
                        {isManaging ? 'Concluir' : 'Editar'}
                      </button>
                      <button 
                        disabled={isSyncing}
                        onClick={() => setIsOpen(false)} 
                        className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        <X size={14} />
                      </button>
                   </div>
                </div>
                
                {!isManaging && (
                  <div className="relative group">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      disabled={isSyncing}
                      placeholder="Buscar etiquetas..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 focus:bg-white focus:border-blue-200 outline-none transition-all shadow-inner placeholder:text-slate-300 disabled:opacity-50"
                    />
                  </div>
                )}
             </header>

             <div className={cn(
                "mb-4 max-h-60 overflow-y-auto pr-1 personalized-scrollbar transition-all",
                isManaging ? "flex flex-col gap-1.5" : "flex flex-wrap gap-2"
              )}>
                {filteredTags.map(tag => {
                  if (isManaging) {
                    return (
                      <div 
                        key={tag.id} 
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/50 border border-slate-100 hover:border-blue-100 hover:bg-white hover:shadow-sm transition-all group/manage-item"
                      >
                        <div className="flex items-center gap-3">
                           <div 
                             style={{ backgroundColor: `${tag.color}15`, color: tag.color }}
                             className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shadow-sm border border-white"
                           >
                              {tag.emoji}
                           </div>
                           <div className="leading-tight">
                              <p className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{tag.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                 <div style={{ backgroundColor: tag.color }} className="h-2 w-2 rounded-full ring-1 ring-white" />
                                 <span className="text-[9px] font-bold text-slate-400 font-mono tracking-tighter capitalize">{tag.color}</span>
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/manage-item:opacity-100 transition-opacity">
                           <button 
                             type="button"
                             onClick={(e) => startEdit(tag, e)}
                             className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-600 hover:shadow-sm transition-all"
                             title="Editar"
                           >
                             <Edit2 size={14} />
                           </button>
                           <button 
                             type="button"
                             onClick={(e) => handleDeleteTag(tag.id, e)}
                             className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 hover:shadow-sm transition-all"
                             title="Excluir"
                           >
                             <Trash2 size={14} />
                           </button>
                        </div>
                      </div>
                    );
                  }

                  return (
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
                  );
                })}
                
                {filteredTags.length === 0 && (
                  <div className="w-full py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {searchTerm ? 'Nenhuma etiqueta encontrada' : 'Nenhuma etiqueta cadastrada'}
                     </p>
                  </div>
                )}
             </div>

             <form onSubmit={handleCreateNew} className={cn(
                "pt-5 border-t border-slate-100 space-y-4",
                editingTag && "bg-blue-50/30 -mx-5 px-5 pb-5 -mb-5 border-t-blue-100"
             )}>
                <div className="flex items-center justify-between">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       {editingTag ? (
                         <>
                           <Edit2 size={10} className="text-blue-500" />
                           Editando Etiqueta
                         </>
                       ) : (
                         <>
                           <Plus size={10} className="text-slate-300" />
                           Nova Etiqueta
                         </>
                       )}
                   </p>
                   {editingTag && (
                     <button 
                       type="button" 
                       onClick={cancelEdit}
                       className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:underline hover:text-rose-600 transition-colors"
                     >
                       Cancelar
                     </button>
                   )}
                </div>
                
                <div className={cn("flex items-center gap-2", isSyncing && "opacity-50 pointer-events-none")}>
                   <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-slate-200 hover:border-blue-200 hover:shadow-sm transition-all text-xl shadow-inner active:scale-95"
                      >
                        {newEmoji}
                      </button>

                      {showEmojiPicker && (
                        <div className="absolute bottom-full left-0 mb-3 w-64 max-h-60 overflow-y-auto rounded-[2rem] bg-white p-4 shadow-[0_10px_40px_rgba(0,0,0,0.2)] border border-slate-100 grid grid-cols-5 gap-2 z-[10000] animate-in fade-in slide-in-from-bottom-2 duration-200 personalized-scrollbar">
                          {emojis.map((e, idx) => (
                            <button
                              key={`${e}-${idx}`}
                              type="button"
                              onClick={() => { setNewEmoji(e); setShowEmojiPicker(false); }}
                              className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-slate-50 text-lg transition-colors active:scale-90"
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
                     className="flex-1 h-11 rounded-xl bg-white border border-slate-200 py-2.5 px-4 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all shadow-inner placeholder:text-slate-300"
                   />
                </div>
                
                <div className={cn("flex items-center justify-between gap-1 pt-1", isSyncing && "opacity-50 pointer-events-none")}>
                   <div className="flex gap-2.5 bg-slate-50/50 p-1.5 rounded-full border border-slate-100">
                      {colors.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewColor(c)}
                          style={{ backgroundColor: c }}
                          className={cn(
                            "h-5 w-5 rounded-full ring-offset-2 transition-all shadow-sm",
                            newColor === c ? "ring-2 ring-slate-400 scale-110 shadow-md" : "opacity-40 hover:opacity-100 hover:scale-105"
                          )}
                        />
                      ))}
                   </div>
                   <button 
                     disabled={isSyncing || !newTagName.trim()}
                     type="submit" 
                     className={cn(
                       "flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100",
                       editingTag ? "bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700" : "bg-blue-600 shadow-blue-100 hover:bg-blue-700 hover:-translate-y-0.5"
                     )}
                   >
                     {isSyncing ? (
                        <Loader2 size={18} className="animate-spin text-white" />
                     ) : (
                        editingTag ? <Check size={20} strokeWidth={3} /> : <Plus size={20} strokeWidth={3} />
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
