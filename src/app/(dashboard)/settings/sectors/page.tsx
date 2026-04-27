'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, Layers, RefreshCw, AlertCircle, Shield, Check, Loader2 } from 'lucide-react';
import { SectorTable } from '@/components/sectors/SectorTable';
import { SectorForm } from '@/components/sectors/SectorForm';
import { supabase } from '@/lib/supabase';

export default function SectorsManagementPage() {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [role, setRole] = useState<string>('AGENT');
  
  const [chatSettings, setChatSettings] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sectors');
      if (!res.ok) throw new Error('Acesso negado');
      const data = await res.json();
      setSectors(data.data || []);

      const uRes = await fetch('/api/users');
      const uData = await uRes.json();
      setUsers(uData.data || []);

      // Fetch user role
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profileRes = await fetch(`/api/users/${session.user.id}`);
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData.success) {
            setRole(profileData.data.role);
          }
        }
      }

      // Fetch global chat settings
      const settingsRes = await fetch('/api/settings/chat');
      const settingsData = await settingsRes.json();
      if (settingsData.success) {
        setChatSettings(settingsData.data);
      }
    } catch (error) {
       console.error('Failed to load sectors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveDefaultSector = async (sectorId: string | null) => {
    if (savingSettings) return;
    setSavingSettings(true);
    try {
      const resp = await fetch('/api/settings/chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...chatSettings, defaultTriageSectorId: sectorId })
      });
      if (resp.ok) {
        setChatSettings({ ...chatSettings, defaultTriageSectorId: sectorId });
      } else {
        alert('Erro ao salvar: verifique suas permissões.');
      }
    } catch (e) {
      alert('Erro ao salvar setor de triagem');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreate = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente excluir o setor ${name}? As conversas desse setor ficarão sem setor.`)) return;
    try {
      const resp = await fetch(`/api/sectors/${id}`, { method: 'DELETE' });
      if (resp.ok) fetchData();
    } catch (e) {
      alert('Erro ao excluir');
    }
  };

  const filteredSectors = sectors.filter((s: any) => 
    s.name.toLowerCase().includes(filters.search.toLowerCase())
  );

  const isAdmin = role === 'ADMIN';

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
              <Layers className="text-blue-600" />
              Gestão de Setores
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Crie departamentos e distribua seus atendentes.</p>
          </div>
          <button 
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
          >
            <Plus size={18} />
            Novo Setor
          </button>
        </header>

        {isAdmin && chatSettings && (
          <section className="mb-10 bg-white rounded-3xl border border-blue-100 p-6 shadow-xl ring-1 ring-blue-500/5 border-t-4 border-t-blue-600 animate-in fade-in zoom-in-95 duration-300">
             <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Setor de Triagem Padrão</h2>
                    <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">Novas conversas sem setor definido cairão aqui automaticamente.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                   <select
                      value={chatSettings.defaultTriageSectorId || ''}
                      onChange={(e) => handleSaveDefaultSector(e.target.value || null)}
                      disabled={savingSettings}
                      className="rounded-xl border-slate-200 bg-slate-50 py-2.5 px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-w-[240px] disabled:opacity-50"
                    >
                      <option value="">Sem Setor (Fila Geral)</option>
                      {sectors.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <div className="h-10 w-10 flex items-center justify-center">
                      {savingSettings ? (
                        <Loader2 className="animate-spin text-blue-600" size={20} />
                      ) : (
                        <Check className="text-emerald-500" size={20} />
                      )}
                    </div>
                </div>
             </div>
          </section>
        )}

        <div className="flex items-center justify-between mb-6">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Buscar por nome do setor..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black uppercase text-slate-400">
             <Layers size={12} />
             {sectors.length} Setores
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center p-20 flex-col gap-4 text-slate-400">
              <RefreshCw className="animate-spin" size={32} />
              <p className="text-sm font-medium">Carregando setores...</p>
            </div>
          ) : filteredSectors.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 text-center">
               <AlertCircle size={40} className="text-slate-200 mb-4" />
               <h3 className="text-lg font-bold text-slate-700">Nenhum setor encontrado</h3>
               <p className="text-sm text-slate-400 mt-2">Os setores cadastrados aparecerão aqui.</p>
            </div>
          ) : (
            <SectorTable 
              items={filteredSectors} 
              onEdit={handleEdit} 
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {isModalOpen && (
        <SectorForm 
          item={editingItem} 
          users={users}
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => {
            setIsModalOpen(false);
            fetchData();
          }} 
        />
      )}
    </div>
  );
}
