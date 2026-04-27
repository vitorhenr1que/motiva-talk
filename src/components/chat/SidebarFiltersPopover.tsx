'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useChatStore } from '@/store/useChatStore';
import { X, Filter, ChevronDown, Calendar, User, Layers, Tag, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function SidebarFiltersPopover() {
  const { 
    channels, selectedChannelId, setSelectedChannelId,
    tags, selectedTagId, setSelectedTagId,
    selectedSectorId, setSelectedSectorId,
    selectedUserId, setSelectedUserId,
    startDate, setStartDate,
    endDate, setEndDate
  } = useChatStore();

  const [isOpen, setIsOpen] = useState(false);
  const [sectors, setSectors] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>('AGENT');

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          let currentRole = 'AGENT';
          if (session?.user) {
             const resUser = await fetch(`/api/users/${session.user.id}`);
             const userData = await resUser.json();
             if (userData.success) {
               setUserRole(userData.data.role);
               currentRole = userData.data.role;
             }
          }

          const [secRes, userRes] = await Promise.all([
            fetch('/api/sectors?mine=true'),
            fetch('/api/users')
          ]);
          const [secData, userData] = await Promise.all([
            secRes.json(),
            userRes.json()
          ]);
          
          const fetchedSectors = secData.data || [];
          setSectors(fetchedSectors);
          setUsers(userData.data || []);

          // Se for AGENTE e não tiver setor selecionado, seleciona o primeiro disponível
          if (currentRole === 'AGENT' && !selectedSectorId && fetchedSectors.length > 0) {
            setSelectedSectorId(fetchedSectors[0].id);
          }
        } catch (e) {
          console.error('Failed to fetch filters data:', e);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen]);

  const activeFiltersCount = [
    selectedChannelId !== channels[0]?.id,
    !!selectedTagId,
    !!selectedSectorId,
    !!selectedUserId,
    !!startDate,
    !!endDate
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSelectedTagId(null);
    if (userRole === 'ADMIN' || userRole === 'SUPERVISOR') {
      setSelectedSectorId(null);
    } else if (sectors.length > 0) {
      setSelectedSectorId(sectors[0].id);
    }
    setSelectedUserId(null);
    setStartDate(null);
    setEndDate(null);
    if (channels.length > 0) setSelectedChannelId(channels[0].id);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest",
          activeFiltersCount > 0 
            ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
            : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
        )}
      >
        <Filter size={14} className={activeFiltersCount > 0 ? "animate-pulse" : ""} />
        <span>Filtros</span>
        {activeFiltersCount > 0 && (
          <span className="bg-white text-blue-600 rounded-full w-4 h-4 flex items-center justify-center text-[8px]">
            {activeFiltersCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[60] bg-slate-900/5 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute left-0 mt-2 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 z-[70] overflow-hidden p-5"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Filtros Avançados</h3>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Canal */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Phone size={12} />
                    <label className="text-[10px] font-black uppercase tracking-widest">Canal</label>
                  </div>
                  <select 
                    value={selectedChannelId || ''} 
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2 px-3 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                  >
                    {channels.map(ch => (
                      <option key={ch.id} value={ch.id}>{ch.name}</option>
                    ))}
                  </select>
                </div>

                {/* Setor */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Layers size={12} />
                    <label className="text-[10px] font-black uppercase tracking-widest">Setor / Departamento</label>
                  </div>
                  <select 
                    value={selectedSectorId || ''} 
                    onChange={(e) => setSelectedSectorId(e.target.value || null)}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2 px-3 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                  >
                    {(userRole === 'ADMIN' || userRole === 'SUPERVISOR') && (
                      <option value="">Todos os Setores</option>
                    )}
                    {sectors.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Atendente */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-400">
                    <User size={12} />
                    <label className="text-[10px] font-black uppercase tracking-widest">Atendente Responsável</label>
                  </div>
                  <select 
                    value={selectedUserId || ''} 
                    onChange={(e) => setSelectedUserId(e.target.value || null)}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2 px-3 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                  >
                    <option value="">Todos os Atendentes</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                {/* Etiqueta */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Tag size={12} />
                    <label className="text-[10px] font-black uppercase tracking-widest">Etiqueta (Tag)</label>
                  </div>
                  <select 
                    value={selectedTagId || ''} 
                    onChange={(e) => setSelectedTagId(e.target.value || null)}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2 px-3 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                  >
                    <option value="">Qualquer Etiqueta</option>
                    {tags.map(t => (
                      <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                    ))}
                  </select>
                </div>

                {/* Período */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar size={12} />
                    <label className="text-[10px] font-black uppercase tracking-widest">Período de Criação</label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="date"
                      value={startDate || ''}
                      onChange={(e) => setStartDate(e.target.value || null)}
                      className="rounded-xl border border-slate-100 bg-slate-50 py-2 px-2 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <input 
                      type="date"
                      value={endDate || ''}
                      onChange={(e) => setEndDate(e.target.value || null)}
                      className="rounded-xl border border-slate-100 bg-slate-50 py-2 px-2 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-50 flex items-center gap-3">
                <button 
                  onClick={clearFilters}
                  className="flex-1 py-2 text-[10px] font-black uppercase text-slate-400 hover:text-rose-500 transition-colors"
                >
                  Limpar
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-100 active:scale-95 transition-all"
                >
                  Aplicar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
