'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  TrendingUp, Users, MessageSquare, 
  ArrowRight, Activity, Target, Flame,
  Loader2, ChevronRight, LayoutDashboard
} from 'lucide-react';
import { FunnelStage } from '@/types/chat';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function DashboardRootPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalContacts: 0,
    activeFunnel: 0,
    conversions: 0
  });

  const fetchStats = async () => {
    try {
      const [kanbanRes, contactsRes] = await Promise.all([
        fetch('/api/funnel/kanban'),
        fetch('/api/contacts')
      ]);
      const kanban = await kanbanRes.json();
      const contacts = await contactsRes.json();

      if (kanban.success && contacts.success) {
        setStats({
          totalContacts: contacts.data.length,
          activeFunnel: kanban.data.length,
          conversions: kanban.data.filter((f: any) => f.stage?.name.toLowerCase().includes('matrícula')).length
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center gap-4 bg-slate-50/20">
       <div className="h-20 w-20 rounded-[2.5rem] bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-inner">
          <Loader2 size={40} className="animate-spin" />
       </div>
       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preparando Dashboard...</p>
    </div>
  );

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
      
      {/* Intro Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-8">
         <div>
            <div className="flex items-center gap-3 mb-4">
               <div className="h-10 w-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                  <LayoutDashboard size={20} />
               </div>
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600">Analytics & Operação</span>
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-none uppercase">Visão do Gestor</h1>
            <p className="mt-4 text-slate-500 font-medium tracking-tight text-lg">Bem-vindo ao centro de comando do Motiva Talk.</p>
         </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         {[
           { icon: <Users />, label: 'Contatos Totais', value: stats.totalContacts, color: 'text-blue-600', bg: 'bg-blue-50' },
           { icon: <Flame />, label: 'Alunos no Funil', value: stats.activeFunnel, color: 'text-orange-600', bg: 'bg-orange-50' },
           { icon: <Target />, label: 'Matrículas Realizadas', value: stats.conversions, color: 'text-emerald-600', bg: 'bg-emerald-50' },
         ].map((stat, i) => (
           <div key={i} className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:shadow-slate-100 transition-all group">
              <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform", stat.bg, stat.color)}>
                 {stat.icon}
              </div>
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">{stat.label}</h3>
              <p className="text-4xl font-black text-slate-900 tracking-tighter">{stat.value}</p>
           </div>
         ))}
      </div>

      {/* Kanban Call to Action (ADDRESSING USER REQUEST) */}
      <section className="relative overflow-hidden bg-slate-900 rounded-[3.5rem] p-12 shadow-2xl shadow-indigo-200">
         {/* Background Visual Ornament */}
         <div className="absolute top-0 right-0 p-20 opacity-10">
            <TrendingUp size={300} strokeWidth={1} className="text-white" />
         </div>

         <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="max-w-md">
               <h2 className="text-3xl font-black text-white leading-tight uppercase tracking-tight">Fluxo Kanban<br/>(Visualização em Colunas)</h2>
               <p className="mt-4 text-slate-400 font-medium text-lg">Acompanhe visualmente cada etapa da jornada do aluno em tempo real. Identifique gargalos e acelere as matrículas.</p>
            </div>
            
            <Link 
              href="/funnel" 
              className="group flex gap-3 h-20 items-center px-10 rounded-[2rem] bg-indigo-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-900/50 hover:bg-white hover:text-indigo-600 transition-all"
            >
               Acessar Fluxo Kanban
               <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
            </Link>
         </div>
      </section>

      {/* Secondary Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <Link href="/inbox" className="group bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] flex items-center justify-between hover:bg-white hover:border-indigo-200 transition-all">
            <div className="flex items-center gap-6">
               <div className="h-14 w-14 rounded-2xl bg-white flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors shadow-sm">
                  <MessageSquare />
               </div>
               <div>
                  <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Atendimento</h4>
                  <p className="text-xs font-bold text-slate-400 tracking-tight">Acesse o inbox de conversas</p>
               </div>
            </div>
            <ChevronRight size={24} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
         </Link>

         <Link href="/contacts" className="group bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] flex items-center justify-between hover:bg-white hover:border-indigo-200 transition-all">
            <div className="flex items-center gap-6">
               <div className="h-14 w-14 rounded-2xl bg-white flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors shadow-sm">
                  <Users />
               </div>
               <div>
                  <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Contatos</h4>
                  <p className="text-xs font-bold text-slate-400 tracking-tight">Gerencie sua base de alunos</p>
               </div>
            </div>
            <ChevronRight size={24} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
         </Link>
      </div>

    </div>
  );
}
