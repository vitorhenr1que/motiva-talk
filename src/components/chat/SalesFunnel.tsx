'use client';

import React, { useEffect, useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { 
  Check, ChevronRight, Loader2, Target, 
  GraduationCap, Award, CreditCard, FileCheck, 
  CheckCircle2, Flame, Settings2, BookOpen
} from 'lucide-react';
import { FunnelStage, ConversationFunnel } from '@/types/chat';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SalesFunnel = () => {
  const { activeConversation } = useChatStore();
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [activeFunnels, setActiveFunnels] = useState<ConversationFunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchFunnelData = async () => {
    if (!activeConversation) return;
    try {
      const [stagesRes, funnelRes] = await Promise.all([
        fetch('/api/funnel/stages'),
        fetch(`/api/conversations/${activeConversation.id}/funnel`)
      ]);
      
      const stagesData = await stagesRes.json();
      const funnelData = await funnelRes.json();

      if (stagesData.success) setStages(stagesData.data);
      if (funnelData.success) setActiveFunnels(funnelData.data);
    } catch (e) {
      console.error('Erro ao carregar funil:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFunnelData();
  }, [activeConversation?.id]);

  const handleStageAction = async (stageId: string, value: string | null = null) => {
    if (!activeConversation) return;
    
    // Toggle: Se já estiver ativo e for STEP, remover
    const currentFunnel = activeFunnels.find(f => f.stageId === stageId);
    const stage = stages.find(s => s.id === stageId);
    const isRemoving = stage?.type === 'STEP' && currentFunnel;

    setUpdating(stageId);
    try {
      const method = isRemoving ? 'DELETE' : 'POST';
      const url = isRemoving 
        ? `/api/conversations/${activeConversation.id}/funnel?stageId=${stageId}` 
        : `/api/conversations/${activeConversation.id}/funnel`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: JSON.stringify({ stageId, value }) } : {})
      });
      
      if (res.ok) {
        await fetchFunnelData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(null);
    }
  };

  const getStageIcon = (name: string, isActive: boolean) => {
    const lower = name.toLowerCase();
    if (lower.includes('curso')) return <GraduationCap size={14} className={isActive ? "text-indigo-600" : "text-slate-400"} />;
    if (lower.includes('bolsa')) return <Award size={14} className={isActive ? "text-indigo-600" : "text-slate-400"} />;
    return <BookOpen size={14} className={isActive ? "text-indigo-600" : "text-slate-400"} />;
  };

  if (loading) return (
    <div className="py-8 flex flex-col items-center justify-center gap-2">
       <Loader2 size={18} className="animate-spin text-indigo-500" />
       <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sincronizando...</p>
    </div>
  );

  const lastStep = [...activeFunnels]
    .filter(f => f.stage?.type === 'STEP')
    .sort((a, b) => (b.stage?.order || 0) - (a.stage?.order || 0))[0];
  
  const totalStepStages = stages.filter(s => s.type === 'STEP').length;
  const currentStepIndex = lastStep?.stage ? stages.filter(s => s.type === 'STEP' && s.order <= lastStep.stage!.order).length : 0;
  
  const totalSelects = stages.filter(s => s.type === 'SELECT').length;
  const filledSelectsCount = activeFunnels.filter(f => f.stage?.type === 'SELECT' && f.value).length;
  
  const baseTemp = totalStepStages > 0 ? (currentStepIndex / totalStepStages) * 80 : 0;
  const selectTemp = totalSelects > 0 ? (filledSelectsCount / totalSelects) * 20 : 0;
  const temperature = Math.min(100, Math.max(5, baseTemp + selectTemp));

  return (
    <div className="space-y-4">
      {/* Temperature Section */}
      <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100/60 flex flex-col gap-2">
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
               <Flame size={12} className={cn(temperature > 50 ? "text-orange-500" : "text-blue-400")} />
               Temperatura
            </div>
            <span className={cn(
              "text-[9px] font-black px-1.5 py-0.5 rounded-md border",
              temperature >= 80 ? "text-red-600 bg-red-50 border-red-100" :
              temperature >= 50 ? "text-orange-600 bg-orange-50 border-orange-100" :
              "text-blue-600 bg-blue-50 border-blue-100"
            )}>
              {temperature >= 80 ? 'QUENTE' : temperature >= 50 ? 'MORNO' : 'FRIO'}
            </span>
         </div>
         <div className="h-1.5 w-full bg-slate-200/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-400 via-orange-400 to-red-500 rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${temperature}%` }}
            />
         </div>
      </div>

      {/* Funnel Section */}
      <div className="space-y-2">
         {stages.map((stage) => {
           const currentFunnel = activeFunnels.find(f => f.stageId === stage.id);
           const isActive = !!currentFunnel;
           const isUpdating = updating === stage.id;
           
           return (
             <div key={stage.id} className="relative group">
                {stage.type === 'STEP' ? (
                  <button
                    onClick={() => handleStageAction(stage.id)}
                    disabled={!!updating}
                    className={cn(
                      "w-full flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-300 text-left",
                      isActive 
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" 
                        : "bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <div className={cn(
                      "h-5 w-5 rounded-md flex items-center justify-center shrink-0 border",
                      isActive ? "bg-white/20 border-white/30" : "bg-slate-50 border-slate-100"
                    )}>
                      {isUpdating ? <Loader2 size={10} className="animate-spin" /> : isActive ? <Check size={10} strokeWidth={4} /> : <div className="h-1 w-1 rounded-full bg-slate-300" />}
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-tight flex-1">{stage.name}</span>
                  </button>
                ) : (
                  <div className={cn(
                    "w-full rounded-xl border transition-all duration-300 overflow-hidden",
                    isActive && currentFunnel?.value ? "bg-indigo-50/40 border-indigo-100" : "bg-white border-slate-100 hover:border-slate-200"
                  )}>
                    <div className="flex items-center gap-2 px-3 pt-3">
                       <div className="h-6 w-6 rounded-lg bg-slate-100/50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          {getStageIcon(stage.name, isActive && !!currentFunnel?.value)}
                       </div>
                       <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex-1">{stage.name}</h4>
                    </div>
                    
                    <div className="p-2 relative">
                      <select
                        value={currentFunnel?.value || ''}
                        onChange={(e) => handleStageAction(stage.id, e.target.value)}
                        disabled={!!updating}
                        className={cn(
                          "w-full bg-transparent border-0 rounded-lg px-2 py-2 text-[10px] font-black text-slate-700 outline-none disabled:opacity-50 appearance-none bg-no-repeat bg-[right_8px_center] cursor-pointer",
                          isUpdating && "opacity-0"
                        )}
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'%3E%3C/path%3E%3C/svg%3E")` }}
                      >
                        <option value="">Selecionar...</option>
                        {Array.isArray(stage.options) ? stage.options.map((opt, i) => (
                          <option key={i} value={opt}>{opt}</option>
                        )) : stage.options && JSON.parse(stage.options as any).map((opt: string, i: number) => (
                          <option key={i} value={opt}>{opt}</option>
                        ))}
                      </select>
                      {isUpdating && (
                        <div className="absolute inset-0 flex items-center justify-center">
                           <Loader2 size={12} className="animate-spin text-indigo-500" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
             </div>
           );
         })}
      </div>

    </div>
  );
};
