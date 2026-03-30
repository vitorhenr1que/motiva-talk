'use client';

import React, { useState, useEffect } from 'react';
import { 
  Filter, 
  Search, 
  Calendar as CalendarIcon, 
  RotateCw,
  MessageCircle,
  TrendingUp,
  History,
  Info
} from 'lucide-react';
import { FeedbackStats } from '@/components/feedback/FeedbackStats';
import { FeedbackList } from '@/components/feedback/FeedbackList';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: any[]) => twMerge(clsx(inputs));

export default function ReportsFeedbacksPage() {
  const [data, setData] = useState<{ list: any[], summary: any } | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    minScore: '',
    maxScore: '',
    agentId: ''
  });

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.minScore) params.append('minScore', filters.minScore);
      if (filters.maxScore) params.append('maxScore', filters.maxScore);
      if (filters.agentId) params.append('agentId', filters.agentId);

      const res = await fetch(`/api/admin/feedbacks?${params.toString()}`);
      const json = await res.json();
      
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar feedbacks');
      
      setData(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const json = await res.json();
      if (res.ok) setUsers(json.data || []);
    } catch (err) {
      console.warn('Erro ao carregar usuários:', err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchUsers();
  }, []);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleQuickRange = (range: string) => {
    const today = new Date();
    let start = new Date();
    
    if (range === 'today') start = new Date(today.setHours(0, 0, 0, 0));
    else if (range === 'week') start.setDate(today.getDate() - 7);
    else if (range === 'month') start.setMonth(today.getMonth() - 1);
    
    setFilters(prev => ({
      ...prev,
      startDate: start.toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }));
  };

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const clearFilters = () => {
    setFilters({ startDate: '', endDate: '', minScore: '', maxScore: '', agentId: '' });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-100">
               <TrendingUp size={18} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">
                Relatório de Feedbacks <span className="text-indigo-600">(NPS)</span>
            </h1>
          </div>
          <p className="text-slate-500 font-medium text-sm pl-10">Analise a satisfação dos seus clientes e desempenho do seu time.</p>
        </div>
        
        <button 
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
        >
          <RotateCw size={14} className={isLoading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </header>

      {/* Stats Summary */}
      {data && <FeedbackStats summary={data.summary} />}

      {/* Filters Area */}
      <section className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-50">
           <div className="flex items-center gap-2 font-black text-slate-800 uppercase tracking-widest text-xs">
              <Filter size={16} className="text-indigo-600" />
              Filtros Avançados
           </div>
           <div className="flex gap-2">
             <button onClick={() => handleQuickRange('today')} className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-all">Hoje</button>
             <button onClick={() => handleQuickRange('week')} className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-all">Últimos 7 dias</button>
             <button onClick={() => handleQuickRange('month')} className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-all">Último Mês</button>
           </div>
        </div>

        <form onSubmit={handleApplyFilters} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-end">
           <div className="space-y-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Data Início</label>
             <div className="relative">
                <input 
                  type="date" 
                  name="startDate" 
                  value={filters.startDate}
                  onChange={handleFilterChange}
                  className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-400 focus:ring-0 outline-none transition-all shadow-inner"
                />
                <CalendarIcon size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
             </div>
           </div>

           <div className="space-y-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Data Fim</label>
             <div className="relative">
                <input 
                  type="date" 
                  name="endDate" 
                  value={filters.endDate}
                  onChange={handleFilterChange}
                  className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-400 focus:ring-0 outline-none transition-all shadow-inner"
                />
                <CalendarIcon size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
             </div>
           </div>

           <div className="space-y-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Faixa de Nota</label>
             <select 
               name="minScore" 
               value={filters.minScore}
               onChange={handleFilterChange}
               className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-400 focus:ring-0 outline-none transition-all shadow-inner appearance-none pr-10"
             >
                <option value="">Todas as Notas</option>
                <option value="9">Promotores (9-10)</option>
                <option value="7">Neutros (7-8)</option>
                <option value="0">Detratores (0-6)</option>
             </select>
           </div>

           <div className="space-y-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Atendente</label>
             <select 
               name="agentId" 
               value={filters.agentId}
               onChange={handleFilterChange}
               className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-400 focus:ring-0 outline-none transition-all shadow-inner appearance-none pr-10"
             >
                <option value="">Todos os Atendentes</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
             </select>
           </div>

           <div className="flex gap-2">
              <button 
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-xs py-3 rounded-xl shadow-lg shadow-indigo-100 transition-all hover:-translate-y-0.5"
              >
                Aplicar
              </button>
              <button 
                type="button"
                onClick={clearFilters}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest text-xs p-3 rounded-xl transition-all"
              >
                <History size={18} />
              </button>
           </div>
        </form>
      </section>

      {/* Error State */}
      {error && (
        <div className="p-6 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 text-red-600 animate-shake">
           <Info size={24} />
           <div className="space-y-1">
              <p className="font-black uppercase tracking-widest text-xs">Erro ao filtrar dados</p>
              <p className="text-sm font-bold">{error}</p>
           </div>
        </div>
      )}

      {/* Feedback List Area */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-[0.2em] pl-2">
           <MessageCircle size={14} className="text-indigo-400" />
           Últimas Avaliações
        </h2>
        
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-white rounded-2xl border border-slate-100" />
            ))}
          </div>
        ) : (
          <FeedbackList feedbacks={data?.list || []} />
        )}
      </div>
    </div>
  );
}
