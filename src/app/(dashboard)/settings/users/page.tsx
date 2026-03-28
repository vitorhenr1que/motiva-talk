'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, User as UserIcon, RefreshCw, AlertCircle } from 'lucide-react';
import { UserTable } from '@/components/users/UserTable';
import { UserForm } from '@/components/users/UserForm';

export default function UsersManagementPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  const [filters, setFilters] = useState({
    search: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Acesso negado');
      const data = await res.json();
      setUsers(data.data || []);

      const chRes = await fetch('/api/channels');
      const chData = await chRes.json();
      setChannels(chData.data || []);
    } catch (error) {
       console.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Deseja realmente excluir o usuário ${email}?`)) return;
    try {
      const resp = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (resp.ok) fetchData();
    } catch (e) {
      alert('Erro ao excluir');
    }
  };

  const filteredUsers = users.filter((u: any) => 
    u.name.toLowerCase().includes(filters.search.toLowerCase()) || 
    u.email.toLowerCase().includes(filters.search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <UserIcon className="text-blue-600" />
              Gestão de Usuários
            </h1>
            <p className="text-sm text-slate-500">Adicione atendentes e defina permissões de acesso por canal.</p>
          </div>
          <button 
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
          >
            <Plus size={18} />
            Novo Usuário
          </button>
        </header>

        {/* Filters */}
        <div className="mb-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={filters.search}
            onChange={(e) => setFilters({...filters, search: e.target.value})}
            className="w-full rounded-xl border border-slate-100 bg-white pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
          />
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center p-20 flex-col gap-4 text-slate-400">
              <RefreshCw className="animate-spin" size={32} />
              <p className="text-sm font-medium">Carregando usuários...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 text-center">
               <AlertCircle size={40} className="text-slate-200 mb-4" />
               <h3 className="text-lg font-bold text-slate-700">Nenhum usuário encontrado</h3>
               <p className="text-sm text-slate-400 mt-2">Os usuários cadastrados aparecerão aqui.</p>
            </div>
          ) : (
            <UserTable 
              items={filteredUsers} 
              onEdit={handleEdit} 
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {isModalOpen && (
        <UserForm 
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
