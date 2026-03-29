'use client';

import React, { useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { 
  User, Phone, Calendar, Tag as TagIcon, Edit3, 
  MapPin, Mail, ChevronRight, Share2, Star,
  ShieldCheck, Loader2, Check, X, ExternalLink,
  MessageSquare, Clock as TimeIcon, Zap, MoreHorizontal,
  Flame, TrendingUp, History, Download, Settings2, 
  StickyNote, Pin, Trash2
} from 'lucide-react';
import { TagSelector } from './TagSelector';
import { SalesFunnel } from './SalesFunnel';
import { FunnelManagerModal } from './FunnelManagerModal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatPhone } from '@/lib/utils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ContactProfileSidebar = () => {
  const { activeConversation, updateConversationLocally } = useChatStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempNote, setTempNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [isFunnelManagerOpen, setIsFunnelManagerOpen] = useState(false);

  if (!activeConversation) {
    return (
      <div className="w-80 border-l bg-white h-full flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
        <div className="h-24 w-24 rounded-[2.5rem] bg-slate-50 flex items-center justify-center text-slate-200 mb-6 shadow-inner">
           <User size={48} strokeWidth={1.5} />
        </div>
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2">Perfil do Aluno</h3>
        <p className="text-xs font-medium text-slate-400 max-w-[200px] leading-relaxed">Selecione uma conversa para gerenciar o CRM e dados deste contato.</p>
      </div>
    );
  }

  const contact = activeConversation.contact;

  if (!contact) {
    return (
      <div className="w-80 border-l bg-white h-full flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-500">
        <div className="relative h-24 w-24 rounded-[2.5rem] bg-indigo-50 flex items-center justify-center text-indigo-400 mb-6 shadow-inner">
           <Loader2 size={32} className="animate-spin" />
        </div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Sincronizando Dados...</p>
      </div>
    );
  }

  const handleEditName = () => {
    setTempName(contact.name);
    setIsEditingName(true);
  };

  const handleEditNote = () => {
    setTempNote(activeConversation.pinnedNote || '');
    setIsEditingNote(true);
  };

  const saveName = async () => {
    if (!tempName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tempName })
      });
      if (res.ok) {
        updateConversationLocally(activeConversation.id, { 
          contact: { ...contact, name: tempName } 
        });
        setIsEditingName(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const saveNote = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/conversations/${activeConversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinnedNote: tempNote })
      });
      if (res.ok) {
        updateConversationLocally(activeConversation.id, { pinnedNote: tempNote });
        setIsEditingNote(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-80 border-l bg-white h-full overflow-y-auto flex flex-col animate-in slide-in-from-right-4 duration-500 scrollbar-hide select-none">
      
      {/* Visual Cover Area */}
      <div className="h-24 bg-gradient-to-br from-indigo-600 to-blue-700 relative shrink-0">
        <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
           <div className="relative group">
              <div className="h-24 w-24 rounded-[2.5rem] bg-white p-1.5 shadow-2xl transition-transform duration-500 group-hover:scale-105">
                 <div className="h-full w-full rounded-[2rem] bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-3xl font-black text-slate-400 overflow-hidden relative border border-slate-100 shadow-sm">
                    {contact.profilePictureUrl ? (
                       <img src={contact.profilePictureUrl} className="h-full w-full object-cover" alt={contact.name} />
                    ) : (
                       contact.name?.[0] || '?'
                    )}
                    <div className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-emerald-500 border-4 border-white shadow-sm" />
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Main Profile Info */}
      <div className="mt-16 px-6 pb-6 text-center border-b border-slate-50">
        <div className="flex items-center justify-center gap-2 mb-1">
          {isEditingName ? (
            <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-200 w-full px-4">
               <input 
                 autoFocus
                 value={tempName}
                 onChange={(e) => setTempName(e.target.value)}
                 className="w-full text-center text-lg font-black text-slate-900 border-b-2 border-indigo-500 outline-none pb-1 bg-transparent"
               />
               <div className="flex gap-2">
                  <button onClick={saveName} disabled={saving} className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:opacity-50">
                     {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  </button>
                  <button onClick={() => setIsEditingName(false)} className="h-8 w-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center hover:bg-slate-200">
                     <X size={14} />
                  </button>
               </div>
            </div>
          ) : (
            <>
              <h2 onClick={handleEditName} className="text-xl font-black text-slate-900 tracking-tight hover:text-indigo-600 transition-colors cursor-pointer uppercase">
                {contact.name || 'Sem Nome'}
              </h2>
              <button onClick={() => setIsStarred(!isStarred)} className={cn(
                "p-1 rounded-lg transition-colors",
                isStarred ? "text-amber-500 fill-amber-500" : "text-slate-200 hover:text-amber-400"
              )}>
                <Star size={20} />
              </button>
            </>
          )}
        </div>
        
        <p className="text-[11px] font-bold text-slate-400 font-mono tracking-tighter mb-4 opacity-70">
          {formatPhone(contact.phone)}
        </p>

        {/* Observation / Pinned Note Field (System Logic Integrated) */}
        <div className="mt-2 px-1">
           {isEditingNote ? (
              <div className="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-300">
                 <textarea 
                   autoFocus
                   value={tempNote}
                   onChange={(e) => setTempNote(e.target.value)}
                   placeholder="Adicionar observação crítica sobre o aluno..."
                   className="w-full min-h-[100px] p-4 text-xs font-bold text-amber-900 bg-amber-50/50 border border-amber-200 rounded-[1.5rem] shadow-inner outline-none focus:ring-2 focus:ring-amber-500/20 transition-all resize-none placeholder:text-amber-300"
                 />
                 <div className="flex justify-end gap-2 pr-1">
                    <button onClick={saveNote} disabled={saving} className="px-4 py-2 rounded-xl bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-amber-100 hover:bg-amber-700 active:scale-95 transition-all">
                       {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Salvar
                    </button>
                    <button onClick={() => setIsEditingNote(false)} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
                       Cancelar
                    </button>
                 </div>
              </div>
           ) : (
              <div className={cn(
                  "w-full group relative p-5 rounded-[1.75rem] border transition-all text-left overflow-hidden",
                  activeConversation.pinnedNote 
                    ? "bg-amber-50/80 border-amber-200/60 shadow-md shadow-amber-900/5" 
                    : "bg-slate-50 border-slate-100 border-dashed hover:bg-white hover:border-slate-300"
                )}>
                 
                 {activeConversation.pinnedNote && (
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                       <Zap size={40} className="text-amber-600 fill-amber-600" />
                    </div>
                 )}

                 <div className="flex items-start gap-4">
                    <div className={cn(
                       "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                       activeConversation.pinnedNote ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"
                    )}>
                       <Pin size={14} className={activeConversation.pinnedNote ? "fill-amber-600" : ""} />
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600/60 mb-1">Observação Fixada</p>
                       <p className={cn(
                          "text-[13px] font-medium leading-relaxed italic",
                          activeConversation.pinnedNote ? "text-amber-900" : "text-slate-300"
                       )}>
                          {activeConversation.pinnedNote || 'Sem observações críticas no momento...'}
                       </p>
                    </div>
                 </div>

                 <div className="flex items-center gap-3 mt-4 pt-3 border-t border-amber-200/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                       onClick={handleEditNote}
                       className="text-[10px] font-black uppercase tracking-widest text-amber-600 hover:text-amber-800 flex items-center gap-1.5"
                    >
                       <Edit3 size={11} /> Editar
                    </button>
                    {activeConversation.pinnedNote && (
                       <button 
                          disabled={saving}
                          onClick={async () => {
                             if(!confirm('Remover observação?')) return;
                             setSaving(true);
                             try {
                                await fetch(`/api/conversations/${activeConversation.id}`, {
                                   method: 'PATCH',
                                   headers: { 'Content-Type': 'application/json' },
                                   body: JSON.stringify({ pinnedNote: null })
                                });
                                updateConversationLocally(activeConversation.id, { pinnedNote: undefined });
                             } catch(e){} finally { setSaving(false); }
                          }}
                          className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-600 flex items-center gap-1.5"
                       >
                          <Trash2 size={11} /> Remover
                       </button>
                    )}
                 </div>
              </div>
           )}
        </div>
      </div>

      {/* Action Grid */}
      <div className="grid grid-cols-4 border-b border-slate-50">
         {[
           { icon: <MessageSquare size={18} />, label: 'Histórico', color: 'text-blue-500' },
           { icon: <Share2 size={18} />, label: 'Indicar', color: 'text-indigo-500' },
           { icon: <Download size={18} />, label: 'Ficha', color: 'text-emerald-500' },
           { icon: <MoreHorizontal size={18} />, label: 'Mais', color: 'text-slate-400' },
         ].map((act, i) => (
           <button key={i} className="flex flex-col items-center justify-center py-4 border-r border-slate-50 last:border-0 hover:bg-slate-50 transition-colors group">
              <div className={cn("mb-1 transition-transform group-hover:-translate-y-0.5", act.color)}>{act.icon}</div>
              <span className="text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">{act.label}</span>
           </button>
         ))}
      </div>

      {/* Main Data Content */}
      <div className="p-6 space-y-8 flex-1">
         {/* Core Info */}
         <section className="space-y-4">
            <header className="flex items-center justify-between pb-1">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Dados cadastrais</h3>
               <Edit3 size={12} className="text-slate-300 hover:text-indigo-600 cursor-pointer transition-colors" />
            </header>
            
            <div className="space-y-4">
               <div className="flex items-start gap-3">
                  <div className="h-9 w-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                     <TimeIcon size={18} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Última Interação</p>
                     <p className="text-xs font-bold text-slate-700">Hoje às 14:45</p>
                  </div>
               </div>

               <div className="flex items-start gap-3">
                  <div className="h-9 w-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                     <Calendar size={18} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Início da Jornada</p>
                     <p className="text-xs font-bold text-slate-700">
                        {new Date(contact.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                     </p>
                  </div>
               </div>

               <div className="flex items-start gap-3">
                  <div className="h-9 w-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 shrink-0">
                     <MapPin size={18} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Localização</p>
                     <p className="text-xs font-bold text-slate-700">São Paulo, SP</p>
                  </div>
               </div>
            </div>
         </section>

         {/* Segmentation & Tags */}
         <section className="space-y-4">
            <header className="flex items-center justify-between pb-1">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Segmentação</h3>
               <TagIcon size={12} className="text-slate-300" />
            </header>
            <div className="p-1 rounded-[1.25rem] bg-indigo-50/30 border border-indigo-100/50 shadow-inner">
               <TagSelector 
                 conversationId={activeConversation.id} 
                 currentTags={activeConversation.tags || []} 
                 onUpdate={() => {}}
               />
            </div>
         </section>

         {/* Fluxo Kanban (Dynamic) */}
         <section className="space-y-4">
            <header className="flex items-center justify-between pb-1">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Fluxo Kanban</h3>
               <div className="flex items-center gap-2">
                  <TrendingUp size={12} className="text-slate-300" />
                  <button 
                    onClick={() => setIsFunnelManagerOpen(true)}
                    className="text-slate-300 hover:text-indigo-600 transition-colors"
                  >
                     <Settings2 size={12} />
                  </button>
               </div>
            </header>
            
            <SalesFunnel />
         </section>
      </div>

      {/* Footer Support Actions */}
      <div className="p-6 border-t border-slate-50 bg-slate-50/20">
         <button className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-indigo-600 hover:border-indigo-600 shadow-sm transition-all hover:-translate-y-1 active:translate-y-0 group">
            <History size={16} className="group-hover:rotate-[-45deg] transition-transform" />
            Ver Jornada Completa
         </button>
      </div>

      {isFunnelManagerOpen && <FunnelManagerModal onClose={() => setIsFunnelManagerOpen(false)} />}
    </div>
  );
};
