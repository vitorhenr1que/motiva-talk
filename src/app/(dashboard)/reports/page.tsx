'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  BarChart3, Calendar, Filter, Search, 
  ChevronRight, ArrowRight, User as UserIcon,
  Phone, MessageSquare, Clock, GraduationCap,
  Award, Loader2, RefreshCw, Grab, X, 
  Users, CheckCircle2, TrendingUp, Tag as TagIcon, PieChart,
  ChevronDown, ChevronUp, Check, Info, Settings2, Sparkles,
  ArrowUpRight, Target, UserPlus, Zap
} from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Subcomponente genérico para os filtros de Checkbox
const CheckboxFilter = ({ 
  label, 
  options, 
  selectedValues, 
  onToggle, 
  onToggleAll, 
  icon: Icon,
  renderOption
}: { 
  label: string, 
  options: any[], 
  selectedValues: string[], 
  onToggle: (id: string) => void, 
  onToggleAll: () => void,
  icon: any,
  renderOption?: (opt: any) => React.ReactNode
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isAllSelected = selectedValues.length === options.length && options.length > 0;

  return (
    <div className="relative group/filter">
       <button 
         onClick={() => setIsOpen(!isOpen)}
         className={cn(
           "flex items-center justify-between min-w-[12rem] rounded-2xl py-2 px-4 text-[11px] font-black uppercase tracking-widest transition-all h-11 border-2",
           isOpen || selectedValues.length > 0
            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
            : "bg-white border-slate-100 text-slate-500 hover:border-indigo-200"
         )}
       >
         <div className="flex items-center gap-2 truncate">
           <Icon size={14} className={cn("shrink-0", (isOpen || selectedValues.length > 0) ? "text-white" : "text-slate-400")} />
           <span className="truncate">{label} {selectedValues.length > 0 && `(${selectedValues.length})`}</span>
         </div>
         {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
       </button>

       {isOpen && (
         <>
           <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
           <div className="absolute top-full left-0 mt-3 w-80 bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 p-4 z-[70] animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300 max-h-[24rem] overflow-y-auto personalized-scrollbar">
              <div 
                className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-2xl cursor-pointer transition-all border-b border-slate-100 mb-3 group/all"
                onClick={onToggleAll}
              >
                 <div className={cn(
                   "h-5 w-5 rounded-lg border-2 flex items-center justify-center transition-all",
                   isAllSelected ? "bg-indigo-600 border-indigo-600 shadow-md" : "bg-white border-slate-200 group-hover/all:border-indigo-400"
                 )}>
                    {isAllSelected && <Check size={14} className="text-white" />}
                 </div>
                 <span className="text-[11px] font-black uppercase tracking-widest text-slate-800">Selecionar Todos</span>
              </div>

              <div className="space-y-1">
                 {options.map(opt => {
                   const id = typeof opt === 'string' ? opt : opt.id;
                   const isSelected = selectedValues.includes(id);
                   return (
                     <div 
                       key={id}
                       onClick={() => onToggle(id)}
                       className={cn(
                         "flex items-center gap-3 p-3 rounded-2xl cursor-pointer group/opt transition-all",
                         isSelected ? "bg-indigo-50" : "hover:bg-slate-50"
                       )}
                     >
                        <div className={cn(
                          "h-5 w-5 rounded-lg border-2 flex items-center justify-center transition-all",
                          isSelected ? "bg-indigo-500 border-indigo-500" : "bg-white border-slate-200 group-hover/opt:border-indigo-400"
                        )}>
                           {isSelected && <Check size={14} className="text-white" />}
                        </div>
                        <div className={cn(
                          "text-[11px] font-bold truncate transition-colors",
                          isSelected ? "text-indigo-900" : "text-slate-600"
                        )}>
                          {renderOption ? renderOption(opt) : (typeof opt === 'string' ? opt : opt.name)}
                        </div>
                     </div>
                   );
                 })}
              </div>
           </div>
         </>
       )}
    </div>
  );
};

export default function ReportsPage() {
  const { tags, setTags } = useChatStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Filters State
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const [fieldFilters, setFieldFilters] = useState<Record<string, string[]>>({});

  const stepStages = useMemo(() => stages.filter(s => s.type === 'STEP'), [stages]);
  const selectStages = useMemo(() => stages.filter(s => s.type === 'SELECT'), [stages]);

  const fetchInitialData = async () => {
    try {
      const [tagsRes, stagesRes] = await Promise.all([
        fetch('/api/tags'),
        fetch('/api/funnel/stages')
      ]);
      const tagsData = await tagsRes.json();
      const stagesData = await stagesRes.json();
      
      if (tagsData.success) setTags(tagsData.data);
      if (stagesData.success) {
        setStages(stagesData.data);
      }
    } catch (e) {
      console.error('Falha ao carregar filtros iniciais');
    }
  };

  const fetchMetrics = useCallback(async () => {
    setRefreshing(true);
    
    const formattedFieldFilters = Object.entries(fieldFilters)
      .filter(([_, values]) => values.length > 0)
      .map(([stageId, values]) => ({ stageId, values }));

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          stageIds: selectedStages,
          tagIds: selectedTags,
          fieldFilters: formattedFieldFilters
        })
      });
      const data = await res.json();
      if (data.success) {
        setMetrics(data.data);
      }
    } catch (e) {
      console.error('Erro ao buscar métricas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate, selectedStages, selectedTags, fieldFilters]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const toggleFieldOption = (stageId: string, value: string) => {
    setFieldFilters(prev => {
      const current = prev[stageId] || [];
      const next = current.includes(value) 
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [stageId]: next };
    });
  };

  const toggleAllStageOptions = (stageId: string, options: string[]) => {
    setFieldFilters(prev => {
      const current = prev[stageId] || [];
      const next = current.length === options.length ? [] : options;
      return { ...prev, [stageId]: next };
    });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const toggleAllTags = () => {
    setSelectedTags(prev => 
      prev.length === tags.length ? [] : tags.map(t => t.id)
    );
  };

  if (loading && !metrics) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 bg-white">
         <div className="relative">
            <div className="h-24 w-24 rounded-[2.5rem] bg-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-indigo-200 animate-bounce">
               <Zap size={40} fill="currentColor" />
            </div>
            <div className="absolute -inset-4 border-2 border-indigo-100 rounded-[3rem] animate-ping" />
         </div>
         <div className="text-center space-y-2">
            <p className="text-lg font-black text-slate-800 uppercase tracking-tighter">Sincronizando Relatórios</p>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Compilando métricas em tempo real...</p>
         </div>
      </div>
    );
  }

  const sortedCourses = (metrics?.courses || []).sort((a: any, b: any) => b.count - a.count);

  return (
    <div className="flex flex-col h-full bg-[#f8faff] overflow-hidden font-sans">
      {/* Dynamic Background Decorations */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-indigo-100/30 rounded-full blur-[120px] -z-10 animate-pulse" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-emerald-100/20 rounded-full blur-[100px] -z-10" />

      {/* Hero Header */}
      <header className="px-10 py-8 flex flex-col gap-8 shrink-0">
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
               <div className="h-16 w-16 rounded-[2rem] bg-slate-900 flex items-center justify-center text-white shadow-2xl shadow-slate-200 group">
                  <BarChart3 size={32} className="group-hover:scale-110 transition-transform" />
               </div>
               <div>
                  <div className="flex items-center gap-3">
                     <h1 className="text-4xl font-black text-slate-900 tracking-[-0.04em]">Dashboard de Insights</h1>
                     <div className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Sparkles size={12} fill="currentColor" />
                        Beta Pro
                     </div>
                  </div>
                  <p className="text-xs font-bold text-slate-400 mt-1.5 flex items-center gap-2">
                     <Target size={14} className="text-indigo-500" />
                     Monitoramento estratégico do funil de vendas e educação
                  </p>
               </div>
            </div>
            
            <div className="flex items-center gap-3">
               <button 
                 onClick={() => fetchMetrics()} 
                 disabled={refreshing}
                 className="h-14 px-8 bg-indigo-600 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-widest hover:bg-indigo-700 hover:shadow-2xl hover:shadow-indigo-200 transition-all flex items-center gap-3 group disabled:opacity-50"
               >
                 <RefreshCw size={18} className={cn("transition-all duration-700", refreshing ? "animate-spin" : "group-hover:rotate-180")} />
                 {refreshing ? 'Atualizando...' : 'Recarregar Dados'}
               </button>
            </div>
         </div>

         {/* Ultra Modern Filter Bar */}
         <div className="bg-white/70 backdrop-blur-md border border-white p-2 rounded-[2.5rem] shadow-[0_15px_40px_rgba(0,0,0,0.03)] flex items-center justify-between">
            <div className="flex items-center gap-3 flex-nowrap overflow-x-auto no-scrollbar py-1 px-1">
               {/* Period Group */}
               <div className="flex items-center bg-white border border-slate-100 rounded-2xl h-11 px-4 shadow-sm hover:border-indigo-200 transition-all group">
                  <Calendar size={14} className="text-slate-400 group-hover:text-indigo-500 transition-colors mr-3" />
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-0 text-[10px] font-black text-slate-700 outline-none w-26 cursor-pointer" />
                  <span className="text-slate-300 mx-2 font-bold select-none text-[10px]">ATÉ</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-0 text-[10px] font-black text-slate-700 outline-none w-26 cursor-pointer" />
               </div>

               <div className="h-6 w-[2px] bg-slate-100 mx-1" />

               {/* Primary Stage */}
               <div className="relative">
                  <select 
                    className="bg-white border border-slate-100 rounded-2xl h-11 pl-10 pr-6 text-[11px] font-black uppercase tracking-widest text-slate-700 outline-none w-56 shadow-sm hover:border-indigo-200 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                    value={selectedStages[0] || ''}
                    onChange={(e) => setSelectedStages(e.target.value ? [e.target.value] : [])}
                  >
                    <option value="">Todas as Etapas</option>
                    {stepStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <TrendingUp size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
               </div>

               {/* Advanced Toggle */}
               <button 
                 onClick={() => setShowAdvanced(!showAdvanced)}
                 className={cn(
                   "h-11 px-6 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3",
                   showAdvanced ? "bg-slate-900 text-white shadow-xl" : "bg-white border border-slate-100 text-slate-500 hover:border-indigo-200 active:scale-95"
                 )}
               >
                 <Settings2 size={16} />
                 Configurações
                 <div className={cn("transition-transform duration-300", showAdvanced && "rotate-180")}>
                    <ChevronDown size={14}/>
                 </div>
               </button>
            </div>

            <div className="flex items-center gap-2 pr-4">
               <button 
                 onClick={() => {
                    setStartDate(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
                    setEndDate(format(new Date(), 'yyyy-MM-dd'));
                    setSelectedStages([]);
                    setSelectedTags([]);
                    setFieldFilters({});
                 }}
                 className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                 title="Limpar todos os filtros"
               >
                 <X size={18} />
               </button>
            </div>
         </div>

         {/* Hidden Advanced Filters Pane */}
         {showAdvanced && (
           <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 p-8 bg-white/40 backdrop-blur-xl border border-white rounded-[3rem] animate-in slide-in-from-top-10 fade-in duration-500 shadow-2xl shadow-indigo-100/20">
              {selectStages.map(stage => (
                 <div key={stage.id} className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                       <span className="h-1 w-1 bg-indigo-500 rounded-full" />
                       {stage.name}
                    </label>
                    <CheckboxFilter 
                      label={stage.name}
                      options={stage.options || []}
                      selectedValues={fieldFilters[stage.id] || []}
                      onToggle={(val) => toggleFieldOption(stage.id, val)}
                      onToggleAll={() => toggleAllStageOptions(stage.id, stage.options || [])}
                      icon={stage.name === 'Curso' ? GraduationCap : Award}
                    />
                 </div>
              ))}

              <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                    <span className="h-1 w-1 bg-indigo-500 rounded-full" />
                    Segmentação
                 </label>
                 <CheckboxFilter 
                   label="Etiquetas"
                   options={tags}
                   selectedValues={selectedTags}
                   onToggle={toggleTag}
                   onToggleAll={toggleAllTags}
                   icon={TagIcon}
                   renderOption={(t) => (
                     <span className="flex items-center gap-2">
                        <span className="shrink-0 text-lg">{t.emoji || '🏷️'}</span>
                        <span className="truncate">{t.name}</span>
                     </span>
                   )}
                 />
              </div>
           </div>
         )}
      </header>

      {/* Main Content Scroll Area */}
      <div className="flex-1 overflow-y-auto personalized-scrollbar px-10 pb-10 space-y-10">
         
         {/* Top Stats - Interactive Cards */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Total Leads */}
            <div className="bg-white p-8 rounded-[3rem] shadow-[0_20px_60px_rgba(0,0,0,0.02)] border border-slate-50 flex flex-col gap-6 relative overflow-hidden group hover:scale-[1.02] hover:shadow-2xl transition-all duration-500">
               <div className="flex items-center justify-between">
                  <div className="h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                    <UserPlus size={24} />
                  </div>
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest px-3 py-1 bg-slate-50 rounded-lg">ATIVO</div>
               </div>
               <div className="space-y-1">
                  <h3 className="text-5xl font-black text-slate-900 tracking-tighter">{metrics?.summary.totalLeads || 0}</h3>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Leads Qualificados</p>
               </div>
               <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500">
                  <ArrowUpRight size={14} />
                  NO PERÍODO SELECIONADO
               </div>
               <div className="absolute top-0 right-0 h-40 w-40 bg-indigo-50/30 rounded-full -mr-20 -mt-20 blur-3xl" />
            </div>

            {/* Matrículas */}
            <div className="bg-white p-8 rounded-[3rem] shadow-[0_20px_60px_rgba(0,0,0,0.02)] border border-slate-50 flex flex-col gap-6 relative overflow-hidden group hover:scale-[1.02] hover:shadow-2xl transition-all duration-500">
               <div className="flex items-center justify-between">
                  <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500">
                    <CheckCircle2 size={24} />
                  </div>
                  <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest">SUCESSO</div>
               </div>
               <div className="space-y-1">
                  <h3 className="text-5xl font-black text-slate-900 tracking-tighter">{metrics?.summary.enrolledLeads || 0}</h3>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Matrículas Realizadas</p>
               </div>
               <div className="flex items-center gap-4">
                  <div className="h-1.5 flex-1 bg-slate-50 rounded-full overflow-hidden">
                     <div style={{ width: `${metrics?.summary.conversionRate}%` }} className="h-full bg-emerald-500 rounded-full" />
                  </div>
                  <span className="text-[11px] font-black text-slate-900">{metrics?.summary.conversionRate.toFixed(1)}%</span>
               </div>
            </div>

            {/* Taxa de Conversão */}
            <div className="bg-white p-8 rounded-[3rem] shadow-[0_20px_60px_rgba(0,0,0,0.02)] border border-slate-50 flex flex-col gap-6 relative overflow-hidden group hover:scale-[1.02] hover:shadow-2xl transition-all duration-500">
               <div className="flex items-center justify-between">
                  <div className="h-14 w-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all duration-500">
                    <Target size={24} />
                  </div>
               </div>
               <div className="space-y-1">
                  <h3 className="text-5xl font-black text-slate-900 tracking-tighter">{metrics?.summary.conversionRate.toFixed(1)}<span className="text-2xl text-slate-300 ml-1">%</span></h3>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Taxa de Eficiência</p>
               </div>
               <p className="text-[10px] font-bold text-slate-400 leading-relaxed italic">Baseado em leads únicos por conversão final</p>
            </div>

            {/* Outra Métrica Exemplo */}
            <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl border border-slate-800 flex flex-col gap-6 relative overflow-hidden group hover:scale-[1.02] transition-all duration-500 text-white">
               <div className="flex items-center justify-between">
                  <div className="h-14 w-14 rounded-2xl bg-white/10 text-white flex items-center justify-center group-hover:bg-white group-hover:text-slate-900 transition-all duration-500">
                    <PieChart size={24} />
                  </div>
                  <Sparkles size={18} className="text-amber-400 animate-pulse" />
               </div>
               <div className="space-y-1">
                  <h3 className="text-5xl font-black text-white tracking-tighter">{metrics?.summary.funnelRetention?.toFixed(0) || 0}<span className="text-2xl opacity-30 ml-1">%</span></h3>
                  <p className="text-[11px] font-black opacity-50 uppercase tracking-widest">Retenção de Funil</p>
               </div>
               <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Otimização recomendada</div>
            </div>
         </div>

         {/* Visual Data Section */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Steps Flow Chart */}
            <div className="bg-white p-12 rounded-[4rem] shadow-[0_30px_80px_rgba(0,0,0,0.03)] border border-slate-50 relative overflow-hidden">
               <div className="flex items-center justify-between mb-12">
                  <div className="space-y-2">
                     <h4 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        Fluxo Educacional
                        <ArrowRight size={20} className="text-slate-200" />
                     </h4>
                     <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Volume por estágio de atendimento</p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                     <TrendingUp size={20} />
                  </div>
               </div>
               
               <div className="space-y-8">
                  {(metrics?.stages || []).map((stage: any, idx: number) => {
                     const percentage = (stage.count / (metrics.summary.totalLeads || 1)) * 100;
                     return (
                       <div key={stage.name} className="group cursor-default">
                          <div className="flex items-center justify-between mb-3">
                             <span className="text-xs font-black text-slate-800 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">{stage.name}</span>
                             <div className="flex items-center gap-3">
                                <span className={cn(
                                   "px-3 py-1 rounded-full text-[10px] font-black",
                                   idx === (metrics.stages.length - 1) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                                )}>
                                   {stage.count} LEADS
                                </span>
                                <span className="text-xs font-black text-slate-300">{percentage.toFixed(0)}%</span>
                             </div>
                          </div>
                          <div className="h-4 w-full bg-slate-50/50 rounded-full overflow-hidden p-0.5 border border-slate-100 shadow-inner">
                             <div 
                               style={{ width: `${percentage}%` }}
                               className={cn(
                                 "h-full rounded-full transition-all duration-1000 ease-out shadow-sm",
                                 idx === 0 ? "bg-gradient-to-r from-indigo-500 to-indigo-400" :
                                 idx === metrics.stages.length - 1 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                                 "bg-indigo-300"
                               )}
                             />
                          </div>
                       </div>
                     );
                  })}
               </div>
            </div>

            {/* Courses Distribution */}
            <div className="bg-white p-12 rounded-[4rem] shadow-[0_30px_80px_rgba(0,0,0,0.03)] border border-slate-50 flex flex-col relative overflow-hidden">
               <div className="flex items-center justify-between mb-12">
                  <div className="space-y-2">
                     <h4 className="text-2xl font-black text-slate-900 tracking-tight">Distribuição por Curso</h4>
                     <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Interesse acadêmico filtrado</p>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-200">
                     <GraduationCap size={20} />
                  </div>
               </div>
               
               <div className="flex-1 space-y-6 overflow-y-auto personalized-scrollbar pr-4">
                  {sortedCourses.map((course: any) => {
                     const percentage = (course.count / (metrics.summary.totalLeads || 1)) * 100;
                     return (
                       <div key={course.name} className="p-5 bg-slate-50/30 rounded-3xl border border-slate-50 hover:border-indigo-100 hover:bg-white transition-all group">
                          <div className="flex items-center justify-between mb-4">
                             <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-xl bg-white text-indigo-500 flex items-center justify-center font-black shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                   {course.name[0]}
                                </div>
                                <span className="text-xs font-black text-slate-700 uppercase tracking-tight group-hover:text-indigo-900 transition-colors truncate max-w-[200px]">{course.name}</span>
                             </div>
                             <span className="text-[11px] font-black text-indigo-600">{course.count}</span>
                          </div>
                          <div className="flex items-center gap-4">
                             <div className="h-2 flex-1 bg-slate-100/50 rounded-full overflow-hidden">
                                <div 
                                  style={{ width: `${percentage}%` }}
                                  className="h-full bg-indigo-500 group-hover:bg-indigo-600 transition-all duration-700"
                                />
                             </div>
                             <span className="text-[10px] font-bold text-slate-400">{percentage.toFixed(1)}%</span>
                          </div>
                       </div>
                     );
                  })}
               </div>
            </div>
         </div>

         {/* Detailed Leads Grid/Table */}
         <div className="bg-white rounded-[4rem] shadow-[0_30px_100px_rgba(0,0,0,0.03)] border border-slate-50 overflow-hidden mb-10">
            <div className="p-12 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/30">
               <div className="space-y-2">
                  <h4 className="text-2xl font-black text-slate-900 tracking-tight">Leads Filtrados</h4>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Listagem completa dos registros ativos</p>
               </div>
               
               {/* TOTAL RECORDS BADGE */}
               <div className="bg-white border-2 border-indigo-100 px-8 py-5 rounded-[2rem] flex items-center gap-8 shadow-xl shadow-indigo-100/10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Localizado</span>
                    <span className="text-3xl font-black text-indigo-600 leading-none mt-1 transition-all">{(metrics?.leads || []).length}</span>
                  </div>
                  <div className="h-10 w-[2px] bg-indigo-50" />
                  <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                    <Users size={20} />
                  </div>
               </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[800px] personalized-scrollbar">
               <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white z-10">
                     <tr className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100">
                        <th className="py-8 px-10 whitespace-nowrap">Identificação do Contato</th>
                        <th className="py-8 px-8 whitespace-nowrap">Estágio Atual</th>
                        <th className="py-8 px-8 whitespace-nowrap">Detalhes do Valor</th>
                        <th className="py-8 px-8 whitespace-nowrap">Tags</th>
                        <th className="py-8 px-10 text-right whitespace-nowrap">Data de Atualização</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {(metrics?.leads || []).map((lead: any) => (
                        <tr key={lead.id} className="group hover:bg-slate-50/50 transition-all font-sans">
                           <td className="py-8 px-10">
                              <div className="flex items-center gap-5">
                                 <div className="relative">
                                    <div className="h-14 w-14 rounded-[1.5rem] bg-slate-900 text-white flex items-center justify-center font-black text-lg group-hover:scale-110 transition-transform">
                                       {lead.contactName[0].toUpperCase()}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-lg bg-indigo-500 border-4 border-white flex items-center justify-center">
                                       <MessageSquare size={10} className="text-white" fill="currentColor" />
                                    </div>
                                 </div>
                                 <div className="leading-tight space-y-1">
                                    <p className="text-[15px] font-black text-slate-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{lead.contactName}</p>
                                    <p className="text-[11px] font-bold text-slate-400 font-mono flex items-center gap-2">
                                       <Phone size={12} />
                                       {lead.contactPhone}
                                    </p>
                                 </div>
                              </div>
                           </td>
                           <td className="py-8 px-8">
                              <span className={cn(
                                "px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
                                lead.stage === 'Matrícula realizada' 
                                 ? "bg-emerald-100 text-emerald-700 border border-emerald-200" 
                                 : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                              )}>
                                 {lead.stage}
                              </span>
                           </td>
                           <td className="py-8 px-8">
                              <div className="max-w-[180px]">
                                 <p className="text-[12px] font-bold text-slate-600 truncate bg-slate-50 px-3 py-1.5 rounded-xl border border-dotted border-slate-200">
                                    {lead.value || '--'}
                                 </p>
                              </div>
                           </td>
                           <td className="py-8 px-8">
                              <div className="flex gap-2">
                                 {lead.tags.map((t: any) => (
                                    <span 
                                      key={t.id} 
                                      className="h-8 w-8 rounded-xl flex items-center justify-center text-lg shadow-sm border border-slate-100 bg-white hover:scale-125 transition-transform" 
                                      title={t.name}
                                    >
                                       {t.emoji}
                                    </span>
                                 ))}
                                 {lead.tags.length === 0 && <span className="text-[10px] font-bold text-slate-300">Sem Tags</span>}
                              </div>
                           </td>
                           <td className="py-8 px-10 text-right">
                              <div className="flex flex-col items-end gap-1">
                                 <p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-800">
                                    {format(parseISO(lead.completedAt), "dd 'de' MMMM", { locale: ptBR })}
                                 </p>
                                 <p className="text-[10px] font-bold text-slate-400">
                                    {format(parseISO(lead.completedAt), "'às' HH:mm")}
                                 </p>
                              </div>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    </div>
  );
}
