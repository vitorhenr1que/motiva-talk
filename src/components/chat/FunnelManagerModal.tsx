'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Trash2, Save, GripVertical, 
  Settings2, ChevronDown, ListPlus, Loader2,
  Edit3, Check, CheckCircle2
} from 'lucide-react';
import { FunnelStage } from '@/types/chat';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FunnelManagerModalProps {
  onClose: () => void;
}

export const FunnelManagerModal = ({ onClose }: FunnelManagerModalProps) => {
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Form para nova etapa
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'STEP' | 'SELECT'>('STEP');

  const fetchStages = async () => {
    try {
      const res = await fetch('/api/funnel/stages');
      const data = await res.json();
      if (data.success) {
        // Ordena por 'order' localmente antes de setar
        setStages(data.data.sort((a: any, b: any) => a.order - b.order));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
  }, []);

  const handleAddStage = async () => {
    if (!newName.trim()) return;
    setSaving('add');
    try {
      const res = await fetch('/api/funnel/stages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          type: newType,
          order: stages.length + 1,
          options: newType === 'SELECT' ? [] : null
        })
      });
      if (res.ok) {
        setNewName('');
        await fetchStages();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateStage = async (id: string, data: Partial<FunnelStage>) => {
    setSaving(id);
    try {
       const res = await fetch(`/api/funnel/stages/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
       });
       if (res.ok) {
          if (editingId === id) setEditingId(null);
          await fetchStages();
       }
    } catch (e) {
       console.error(e);
    } finally {
       setSaving(null);
    }
  };

  const handleDeleteStage = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta etapa?')) return;
    try {
       await fetch(`/api/funnel/stages/${id}`, { method: 'DELETE' });
       await fetchStages();
    } catch (e) {
       console.error(e);
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggingId === id) return;
    
    setStages(prev => {
       const reordered = [...prev];
       const oldIndex = reordered.findIndex(s => s.id === draggingId);
       const newIndex = reordered.findIndex(s => s.id === id);
       const [dragged] = reordered.splice(oldIndex, 1);
       reordered.splice(newIndex, 0, dragged);
       return reordered;
    });
  };

  const handleDragEnd = async () => {
    setDraggingId(null);
    // Persiste a nova ordem de todos os itens alterados
    await Promise.all(stages.map((s, idx) => 
       fetch(`/api/funnel/stages/${s.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: idx + 1 })
       })
    ));
    await fetchStages();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white/95 w-full max-w-2xl rounded-[3rem] shadow-[-20px_20px_60px_rgba(0,0,0,0.1)] flex flex-col max-h-[90vh] overflow-hidden border border-white">
        
        {/* Header (Branding styled) */}
        <div className="p-8 pb-6 border-b border-slate-100 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100 rotate-3">
                 <Settings2 size={28} />
              </div>
              <div>
                 <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none">GESTOR DE FUNIL</h2>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Personalize a conversão de leads</p>
              </div>
           </div>
           <button onClick={onClose} className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center">
              <X size={20} />
           </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-hide">
           
           {/* Add New Section (Optimized layout to avoid overflow) */}
           <section className="bg-slate-50/80 rounded-[2.5rem] p-8 border border-slate-100/50">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
                 <Plus size={14} className="text-indigo-500" /> Nova Etapa da Jornada
              </h3>
              
              <div className="flex flex-col gap-4">
                 <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[240px]">
                       <input 
                         placeholder="Nome da etapa (ex: Visita Agendada)"
                         value={newName}
                         onChange={e => setNewName(e.target.value)}
                         className="w-full bg-white border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none shadow-sm transition-all"
                       />
                    </div>
                    
                    <div className="flex-1 min-w-[200px]">
                       <select 
                         value={newType}
                         onChange={e => setNewType(e.target.value as any)}
                         className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-700 focus:border-indigo-500 outline-none shadow-sm cursor-pointer"
                       >
                          <option value="STEP">Milenstone (Passo)</option>
                          <option value="SELECT">Seleção (Dropdown)</option>
                       </select>
                    </div>
                 </div>

                 <button 
                   onClick={handleAddStage}
                   disabled={saving === 'add' || !newName.trim()}
                   className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200 hover:scale-[1.01] active:scale-95 disabled:opacity-50 transition-all"
                 >
                    {saving === 'add' ? <Loader2 size={16} className="animate-spin m-auto" /> : 'Adicionar Nova Etapa ao Funil'}
                 </button>
              </div>
           </section>

           {/* List Section with Drag & Drop */}
           <section className="space-y-6">
              <div className="flex items-center justify-between">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <ListPlus size={14} className="text-indigo-500" /> Sequência de Atendimento
                 </h3>
                 <p className="text-[9px] font-bold text-slate-400 italic">Arraste para reordenar</p>
              </div>
              
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                   <Loader2 size={32} className="animate-spin text-slate-200" />
                   <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sincronizando...</span>
                </div>
              ) : (
                <div className="space-y-4">
                   {stages.map((stage) => {
                     const isEditing = editingId === stage.id;
                     const isBeingDragged = draggingId === stage.id;
                     
                     return (
                       <div 
                         key={stage.id} 
                         draggable={!editingId}
                         onDragStart={() => handleDragStart(stage.id)}
                         onDragOver={(e) => handleDragOver(e, stage.id)}
                         onDragEnd={handleDragEnd}
                         className={cn(
                           "group bg-white border border-slate-100 rounded-[2.25rem] p-6 transition-all duration-300",
                           isBeingDragged ? "opacity-20 scale-95 border-indigo-200" : "hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5",
                           !editingId && "cursor-grab active:cursor-grabbing"
                         )}
                       >
                          <div className="flex items-center gap-4">
                             <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 shrink-0 group-hover:text-indigo-500 transition-colors">
                                <GripVertical size={20} />
                             </div>
                             
                             <div className="flex-1">
                                {isEditing ? (
                                   <div className="flex items-center gap-2">
                                      <input 
                                         autoFocus
                                         defaultValue={stage.name}
                                         onBlur={(e) => handleUpdateStage(stage.id, { name: e.target.value })}
                                         className="bg-slate-50 border-0 rounded-lg px-3 py-1 text-sm font-black text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100"
                                      />
                                      <select
                                         defaultValue={stage.type}
                                         onChange={(e) => handleUpdateStage(stage.id, { type: e.target.value as any })}
                                         className="bg-slate-50 border-0 rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500 outline-none"
                                      >
                                         <option value="STEP">STEP</option>
                                         <option value="SELECT">SELECT</option>
                                      </select>
                                   </div>
                                ) : (
                                   <>
                                      <div className="flex items-center gap-2">
                                         <h4 className="text-sm font-black text-slate-800 tracking-tight uppercase">{stage.name}</h4>
                                         <span className={cn(
                                            "text-[8px] font-black px-1.5 py-0.5 rounded-md",
                                            stage.type === 'STEP' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                                         )}>
                                            {stage.type}
                                         </span>
                                      </div>
                                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">Posição #{stage.order}</p>
                                   </>
                                )}
                             </div>

                             <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => setEditingId(isEditing ? null : stage.id)}
                                  className={cn(
                                    "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                                    isEditing ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-300 hover:text-indigo-600"
                                  )}
                                >
                                   {isEditing ? <Check size={18} /> : <Edit3 size={18} />}
                                </button>
                                <button 
                                  onClick={() => handleDeleteStage(stage.id)}
                                  className="h-10 w-10 rounded-xl bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center"
                                >
                                   <Trash2 size={18} />
                                </button>
                             </div>
                          </div>

                          {/* Options Editor for SELECT type */}
                          {stage.type === 'SELECT' && !isBeingDragged && (
                             <div className="mt-6 pt-6 border-t border-slate-50 space-y-3">
                                <div className="flex items-center justify-between">
                                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">Opções disponíveis</label>
                                  {saving === stage.id && <Loader2 size={12} className="animate-spin text-indigo-500" />}
                                </div>
                                <textarea 
                                  defaultValue={Array.isArray(stage.options) ? stage.options.join(', ') : JSON.parse(stage.options as any || '[]').join(', ')}
                                  onBlur={(e) => {
                                     const newOptions = e.target.value.split(',').map(o => o.trim()).filter(Boolean);
                                     handleUpdateOptions(stage.id, newOptions);
                                  }}
                                  className="w-full bg-slate-50/50 border border-slate-50 rounded-[1.5rem] p-4 text-[11px] font-bold text-slate-600 outline-none focus:bg-white focus:border-indigo-100 min-h-[60px] resize-none"
                                  placeholder="Separar por vírgula. Ex: Opção 1, Opção 2"
                                />
                             </div>
                          )}
                       </div>
                     );
                   })}
                </div>
              )}
           </section>

        </div>

        {/* Improved Footer */}
        <div className="p-8 border-t border-slate-50 bg-slate-50/20 text-center">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-500" /> 
              Alterações salvas automaticamente no banco de dados.
           </p>
        </div>
      </div>
    </div>
  );
};

/* Helper para options (faltou no escopo local mas necessário para salvar SELECTs) */
const handleUpdateOptions = async (id: string, options: string[]) => {
   await fetch(`/api/funnel/stages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options })
   });
};
