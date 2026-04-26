import React, { useState, useEffect } from 'react';
import { X, Save, Layers, Search, Check } from 'lucide-react';

interface SectorFormProps {
  item?: any;
  users: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export function SectorForm({ item, users, onClose, onSuccess }: SectorFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: item?.name || '',
    userIds: item?.users?.map((u: any) => u.userId) || [],
  });
  const [searchUser, setSearchUser] = useState('');

  const filteredUsers = users.filter((u: any) => 
    u.name.toLowerCase().includes(searchUser.toLowerCase()) || 
    u.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  const toggleUser = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      userIds: prev.userIds.includes(userId)
        ? prev.userIds.filter((id: string) => id !== userId)
        : [...prev.userIds, userId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return alert('O nome do setor é obrigatório');
    
    setLoading(true);
    try {
      const url = item ? `/api/sectors/${item.id}` : '/api/sectors';
      const method = item ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        alert(error.error || 'Erro ao salvar setor');
      }
    } catch (error) {
      console.error(error);
      alert('Erro de rede');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {item ? 'Editar Setor' : 'Novo Setor'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">Configuração de departamento</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                Nome do Setor <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Suporte Financeiro"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                Atendentes Atribuídos
              </label>
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                <div className="p-3 border-b border-slate-200 bg-white relative">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Buscar atendente..."
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                  {filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-400">Nenhum usuário encontrado.</div>
                  ) : (
                    filteredUsers.map((user: any) => {
                      const isSelected = formData.userIds.includes(user.id);
                      return (
                        <div 
                          key={user.id} 
                          onClick={() => toggleUser(user.id)}
                          className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                            isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-100 border border-transparent'
                          }`}
                        >
                          <div>
                            <p className={`text-sm font-bold ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>{user.name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                          <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                            isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white text-transparent'
                          }`}>
                            <Check size={14} strokeWidth={3} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 ml-1 font-medium">
                Selecione os atendentes que poderão visualizar e responder as conversas deste setor.
              </p>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
            >
              <Save size={18} />
              {loading ? 'Salvando...' : 'Salvar Setor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
