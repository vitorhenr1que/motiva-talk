'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, RefreshCw, AlertCircle } from 'lucide-react';
import { SuggestionTable } from '@/components/suggestions/SuggestionTable';
import { SuggestionForm } from '@/components/suggestions/SuggestionForm';

export default function SuggestionConfigPage() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  const [filters, setFilters] = useState({
    keyword: '',
    category: '',
    channelId: '',
    isActive: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch suggestions with filters
      const q = new URLSearchParams(filters as any).toString();
      const res = await fetch(`/api/suggestions-config?${q}`);
      const data = await res.json();
      setSuggestions(data.data || []);

      // Fetch channels for selector
      const chRes = await fetch('/api/channels');
      const chData = await chRes.json();
      setChannels(chData.data || []);
    } catch (error) {
      console.error('Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters]);

  const handleCreate = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta sugestão?')) return;
    try {
      const resp = await fetch(`/api/suggestions-config/${id}`, { method: 'DELETE' });
      if (resp.ok) fetchData();
    } catch (e) {
      alert('Erro ao excluir');
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      const resp = await fetch(`/api/suggestions-config/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !current })
      });
      if (resp.ok) fetchData();
    } catch (e) {
      alert('Erro ao atualizar status');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Sugestões de Resposta</h1>
            <p className="text-sm text-slate-500">Configurações de gatilhos e respostas automáticas baseadas em palavras-chave.</p>
          </div>
          <button 
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95"
          >
            <Plus size={18} />
            Nova Sugestão
          </button>
        </header>

        {/* Filters */}
        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Buscar palavra-chave..."
              value={filters.keyword}
              onChange={(e) => setFilters({...filters, keyword: e.target.value})}
              className="w-full rounded-xl border-slate-100 bg-slate-50 pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <select 
            value={filters.category}
            onChange={(e) => setFilters({...filters, category: e.target.value})}
            className="rounded-xl border-slate-100 bg-slate-50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Todas Categorias</option>
            <option value="Matrícula">Matrícula</option>
            <option value="Financeiro">Financeiro</option>
            <option value="Acadêmico">Acadêmico</option>
            <option value="Geral">Geral</option>
          </select>

          <select 
            value={filters.channelId}
            onChange={(e) => setFilters({...filters, channelId: e.target.value})}
            className="rounded-xl border-slate-100 bg-slate-50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Todos Canais</option>
            {channels.map((ch: any) => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>

          <select 
            value={filters.isActive}
            onChange={(e) => setFilters({...filters, isActive: e.target.value})}
            className="rounded-xl border-slate-100 bg-slate-50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Todos Status</option>
            <option value="true">Ativas</option>
            <option value="false">Inativas</option>
          </select>
        </section>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center p-20 flex-col gap-4 text-slate-400">
              <RefreshCw className="animate-spin" size={32} />
              <p className="text-sm font-medium">Carregando sugestões...</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 text-center">
              <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mb-4 text-slate-300">
                 <AlertCircle size={40} />
              </div>
              <h3 className="text-lg font-bold text-slate-700">Nenhuma sugestão encontrada</h3>
              <p className="text-sm text-slate-400 max-w-xs mt-2">Tente ajustar seus filtros ou crie uma nova sugestão administrativa.</p>
            </div>
          ) : (
            <SuggestionTable 
              items={suggestions} 
              onEdit={handleEdit} 
              onDelete={handleDelete}
              onToggle={handleToggleActive}
            />
          )}
        </div>
      </div>

      {isModalOpen && (
        <SuggestionForm 
          item={editingItem} 
          channels={channels}
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
