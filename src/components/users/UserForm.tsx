'use client';

import React, { useState } from 'react';
import { X, Save, Shield, Mail, User as UserIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const UserForm = ({ item, channels, onClose, onSuccess }: any) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: item?.name || '',
    email: item?.email || '',
    role: item?.role || 'AGENT',
    password: '',
    channelIds: item?.userChannels?.map((uc: any) => uc.channelId) || [] as string[],
  });

  const toggleChannel = (id: string) => {
    setFormData(prev => ({
      ...prev,
      channelIds: prev.channelIds.includes(id) 
        ? prev.channelIds.filter((cid: string) => cid !== id)
        : [...prev.channelIds, id]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item && !formData.password) {
      alert('Senha é obrigatória para novos usuários');
      return;
    }

    setLoading(true);
    try {
      const url = item ? `/api/users/${item.id}` : '/api/users';
      const method = item ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        onSuccess();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao salvar');
      }
    } catch (e) {
      alert('Erro na conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <header className="flex items-center justify-between border-b p-6 bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {item ? 'Editar Usuário' : 'Novo Usuário'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">Configure o perfil e credenciais do membro da equipe.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-white hover:shadow-sm transition-all">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto personalized-scrollbar">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome Completo</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="Ex: João da Silva"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-10 py-3 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {item ? 'Nova Senha (Opcional)' : 'Senha de Acesso'}
                </label>
                <div className="relative">
                  <Save className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="password"
                    required={!item}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-10 py-3 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder={item ? "Deixe em branco p/ manter" : "Mínimo 6 caracteres"}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Perfil de Acesso</label>
              <div className="relative">
                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select 
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                >
                  <option value="AGENT">AGENT (Atendente)</option>
                  <option value="SUPERVISOR">SUPERVISOR (Gerente)</option>
                  <option value="ADMIN">ADMIN (Diretor)</option>
                </select>
              </div>
              <p className="text-[10px] text-slate-500 bg-blue-50 p-2 rounded-lg border border-blue-100 flex gap-2">
                 {formData.role === 'AGENT' && "Vê apenas conversas atribuídas ou abertas em seus canais."}
                 {formData.role === 'SUPERVISOR' && "Pode gerenciar conversas e ver relatórios de todos os canais."}
                 {formData.role === 'ADMIN' && "Acesso total: gestão de canais, usuários e configurações globais."}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Canais de Atendimento</label>
              <div className="grid grid-cols-1 gap-2">
                {channels.map((ch: any) => (
                  <label 
                    key={ch.id} 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group",
                      formData.channelIds.includes(ch.id) 
                        ? "bg-blue-50 border-blue-200 ring-2 ring-blue-500/10" 
                        : "bg-white border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center transition-all",
                        formData.channelIds.includes(ch.id) ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300"
                      )}>
                        {formData.channelIds.includes(ch.id) && <Save size={10} className="text-white" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700">{ch.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{ch.phoneNumber}</p>
                      </div>
                    </div>
                    {ch.isActive ? (
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-slate-300" />
                    )}
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={formData.channelIds.includes(ch.id)}
                      onChange={() => toggleChannel(ch.id)}
                    />
                  </label>
                ))}
                {channels.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-dashed">Nenhum canal ativo encontrado.</p>
                )}
              </div>
            </div>
          </div>

          <footer className="flex gap-3 pt-6 justify-end border-t">
            <button 
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-200 hover:bg-black disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Salvar Usuário
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};
