'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp, Calendar, Filter, Search, 
  ChevronRight, ArrowRight, User as UserIcon,
  Phone, MessageSquare, Clock, GraduationCap,
  Award, Loader2, RefreshCw, Grab, X
} from 'lucide-react';
import { FunnelStage } from '@/types/chat';
import { useChatStore } from '@/store/useChatStore';
import { ContactProfileSidebar } from '@/components/chat/ContactProfileSidebar';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function FunnelKanbanPage() {
  const router = useRouter();
  const { 
    activeConversation, 
    setActiveConversation, 
    isProfileOpen, 
    setIsProfileOpen,
    kanbanData,
    setKanbanData 
  } = useChatStore();

  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  
  // DnD State
  const [draggingConversationId, setDraggingConversationId] = useState<string | null>(null);
  const [dropTargetStageId, setDropTargetStageId] = useState<string | null>(null);
  const [dropTargetConversationId, setDropTargetConversationId] = useState<string | null>(null);

  // Filtros
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [stagesRes, kanbanRes] = await Promise.all([
        fetch('/api/funnel/stages'),
        fetch(`/api/funnel/kanban?startDate=${startDate}&endDate=${endDate}`)
      ]);
      
      const stagesData = await stagesRes.json();
      const kanbanResData = await kanbanRes.json();
      
      if (stagesData.success) {
        setStages(stagesData.data.filter((s: any) => s.type === 'STEP'));
      }
      if (kanbanResData.success) {
        setKanbanData(kanbanResData.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const handleMoveStage = async (conversationId: string, stageId: string, rank?: number) => {
    setUpdatingId(conversationId);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/funnel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId, rank })
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const onDragStart = (conversationId: string) => {
    setDraggingConversationId(conversationId);
  };

  const onDragOverColumn = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDropTargetStageId(stageId);
  };

  const onDragOverCard = (e: React.DragEvent, conversationId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setDropTargetConversationId(conversationId);
  };

  const onDrop = (stageId: string) => {
    if (draggingConversationId) {
      // Cálculo do novo Rank para manter a ordem manual
      let newRank = 1000;
      const columnItems = kanbanData
        .filter(k => k.stageId === stageId && k.conversation.id !== draggingConversationId)
        .sort((a,b) => (a.rank || 0) - (b.rank || 0));

      if (dropTargetConversationId) {
         const overIndex = columnItems.findIndex(k => k.conversation.id === dropTargetConversationId);
         const overItem = overIndex !== -1 ? columnItems[overIndex] : null;
         if (overItem) {
            const aboveItem = overIndex > 0 ? columnItems[overIndex - 1] : null;
            newRank = aboveItem ? ((aboveItem.rank || 0) + (overItem.rank || 0)) / 2 : (overItem.rank || 0) - 500;
         } else {
            const lastItem = columnItems[columnItems.length - 1];
            newRank = lastItem ? (lastItem.rank || 0) + 1000 : 1000;
         }
      } else {
         const lastItem = columnItems[columnItems.length - 1];
         newRank = lastItem ? (lastItem.rank || 0) + 1000 : 1000;
      }
      handleMoveStage(draggingConversationId, stageId, newRank);
    }
    setDraggingConversationId(null);
    setDropTargetStageId(null);
    setDropTargetConversationId(null);
  };

  const handleOpenContactProfile = (item: any) => {
     setActiveConversation(item.conversation);
     setIsProfileOpen(true);
  };

  if (loading) return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-50/20">
       <div className="h-20 w-20 rounded-[2rem] bg-indigo-50 flex items-center justify-center text-indigo-500">
          <Loader2 size={32} className="animate-spin" />
       </div>
    </div>
  );

  return (
    <div className="h-full flex bg-slate-50/30 overflow-hidden">
      
      {/* Main Kanban Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
         {/* Header & Filters */}
         <header className="bg-white border-b px-8 py-5 flex items-center justify-between gap-4 shadow-sm z-10 shrink-0">
            <div className="flex items-center gap-4">
               <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                  <TrendingUp size={20} />
               </div>
               <div>
                  <div className="flex items-center gap-3">
                     <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase">Fluxo Kanban</h1>
                     {(refreshing || updatingId) && (
                        <div className="flex items-center gap-2 px-2 py-1 bg-indigo-50 rounded-lg animate-pulse">
                           <Loader2 size={10} className="animate-spin text-indigo-500" />
                           <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Sincronizando</span>
                        </div>
                     )}
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1.5">Clique no cartão para ver o perfil completo</p>
               </div>
            </div>

            <div className="flex items-center gap-3">
               <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl p-1 px-3">
                  <Calendar size={12} className="text-slate-400" />
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-0 text-[10px] font-bold text-slate-600 outline-none w-28 cursor-pointer" />
                  <span className="text-slate-300">-</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-0 text-[10px] font-bold text-slate-600 outline-none w-28 cursor-pointer" />
               </div>

               <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    placeholder="Buscar lead..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 focus:border-indigo-500 outline-none w-48 transition-all focus:w-64"
                  />
               </div>

               <button onClick={() => fetchData()} className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:scale-105 transition-all shadow-lg active:scale-95">
                  <RefreshCw size={18} className={cn(refreshing && "animate-spin")} />
               </button>
            </div>
         </header>

         {/* Kanban Canvas */}
         <div className="flex-1 overflow-x-auto p-6 scrollbar-hide">
            <div className="flex gap-4 h-full min-w-max pb-4">
               {stages.map((stage) => {
                  const columnItems = kanbanData
                    .filter(item => 
                      item.stageId === stage.id &&
                      (searchTerm ? item.conversation.contact.name.toLowerCase().includes(searchTerm.toLowerCase()) : true)
                    )
                    .sort((a,b) => (a.rank || 0) - (b.rank || 0));

                  const isDropTargetColumn = dropTargetStageId === stage.id;

                  return (
                    <div 
                      key={stage.id} 
                      onDragOver={(e) => onDragOverColumn(e, stage.id)}
                      onDrop={(e) => { e.preventDefault(); onDrop(stage.id); }}
                      className={cn(
                        "w-72 flex flex-col h-full transition-all duration-300",
                        isDropTargetColumn && "scale-[1.01]"
                      )}
                    >
                       <div className="flex items-center justify-between mb-3 px-3">
                          <h2 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 flex items-center gap-1.5">
                             <div className={cn(
                                "h-1.5 w-1.5 rounded-full shadow-sm",
                                isDropTargetColumn ? "bg-indigo-600 shadow-indigo-400 animate-pulse" : "bg-indigo-400 shadow-indigo-100"
                             )} />
                             {stage.name}
                          </h2>
                          <span className="text-[9px] font-black text-slate-400 bg-white border border-slate-100 px-2.5 py-1 rounded-full">{columnItems.length}</span>
                       </div>

                       <div className={cn(
                         "flex-1 overflow-y-auto space-y-2 p-2 rounded-[1.5rem] transition-all duration-300 border scrollbar-hide mb-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)]",
                         isDropTargetColumn ? "bg-indigo-50/80 border-indigo-400" : "bg-slate-50/50 border-slate-200"
                       )}>
                          {columnItems.map((item) => {
                            const isDraggingThis = draggingConversationId === item.conversation.id;
                            const isDropTargetThis = dropTargetConversationId === item.conversation.id;
                            
                            return (
                              <div 
                                key={item.id}
                                draggable={!updatingId}
                                onDragStart={() => onDragStart(item.conversation.id)}
                                onDragOver={(e) => onDragOverCard(e, item.conversation.id)}
                                onClick={() => !updatingId && handleOpenContactProfile(item)}
                                className={cn(
                                  "relative bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm transition-all cursor-pointer group hover:border-indigo-200 active:scale-[0.98]",
                                  activeConversation?.id === item.conversation.id ? "ring-2 ring-indigo-500 border-transparent shadow-indigo-100" : "hover:shadow-lg",
                                  isDraggingThis && "opacity-20 scale-95 border-dashed border-indigo-300",
                                  isDropTargetThis && "border-t-[3px] border-t-indigo-500 pt-2.5",
                                  updatingId === item.conversation.id && "cursor-wait"
                                )}
                              >
                                 {updatingId === item.conversation.id && (
                                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-2xl z-20 flex items-center justify-center">
                                       <Loader2 size={16} className="animate-spin text-indigo-600" />
                                    </div>
                                 )}

                                 <div className="flex items-center gap-3 mb-3">
                                    <div className={cn(
                                       "h-9 w-9 rounded-xl flex items-center justify-center text-sm font-black transition-all duration-300",
                                       activeConversation?.id === item.conversation.id ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white"
                                    )}>
                                       {item.conversation.contact.name?.[0] || '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                       <h3 className="text-xs font-black text-slate-800 tracking-tight truncate group-hover:text-indigo-600 transition-colors uppercase">
                                          {item.conversation.contact.name || 'Sem Nome'}
                                       </h3>
                                       <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                          <Phone size={8} className="opacity-50" /> {item.conversation.contact.phone}
                                       </p>
                                    </div>
                                 </div>

                                 <div className="flex items-center justify-between pt-2.5 border-t border-slate-50">
                                    <div className="flex -space-x-1.5 translate-y-0.5">
                                       {kanbanData
                                         .filter(f => f.conversation?.id === item.conversation.id && f.stage?.type === 'SELECT' && f.value)
                                         .slice(0, 2)
                                         .map(sel => (
                                            <div key={sel.id} title={`${sel.stage?.name}: ${sel.value}`} className="h-5 w-5 rounded-full bg-white border-2 border-indigo-50 flex items-center justify-center text-indigo-500 shadow-sm">
                                               {sel.stage?.name.toLowerCase().includes('curso') ? <GraduationCap size={10} /> : <Award size={10} />}
                                            </div>
                                         ))
                                       }
                                    </div>
                                    <div className="text-[8px] font-black text-slate-300 uppercase tracking-tighter flex items-center gap-1">
                                       <Clock size={8} />
                                       {format(parseISO(item.completedAt), 'HH:mm', { locale: ptBR })}
                                     </div>
                                 </div>
                              </div>
                            );
                          })}
                          
                          {columnItems.length === 0 && (
                            <div className="h-32 flex flex-col items-center justify-center opacity-20">
                               <Grab size={24} className="text-slate-400 mb-2" />
                               <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Arraste aqui</p>
                            </div>
                          )}
                       </div>
                    </div>
                  );
               })}
            </div>
         </div>
      </div>

      {/* Slide-over Profile Sidebar (ADDRESSING USER REQUEST) */}
      {isProfileOpen && (
         <div className="w-80 border-l border-slate-200 bg-white flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.05)] animate-in slide-in-from-right duration-500 relative">
            <button 
              onClick={() => setIsProfileOpen(false)}
              className="absolute top-4 left-4 z-[100] h-8 w-8 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/40 flex items-center justify-center transition-all"
            >
               <X size={16} />
            </button>
            <div className="flex-1 overflow-hidden">
               <ContactProfileSidebar />
            </div>
         </div>
      )}

    </div>
  );
}
