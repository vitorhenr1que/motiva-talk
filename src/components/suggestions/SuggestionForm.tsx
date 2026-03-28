'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2, Save, Info, RefreshCw } from 'lucide-react';

interface SuggestionFormProps {
  item?: any;
  channels: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export const SuggestionForm = ({ item, channels, onClose, onSuccess }: SuggestionFormProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    keyword: item?.keyword || '',
    category: item?.category || 'Geral',
    response: item?.response || '',
    channelId: item?.channelId || '',
    isActive: item ? item.isActive : true,
    triggers: item?.triggers || []
  });
  
  const [newTrigger, setNewTrigger] = useState('');

  const handleAddTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrigger.trim()) return;
    if (formData.triggers.includes(newTrigger.trim())) {
      setNewTrigger('');
      return;
    }
    setFormData({ ...formData, triggers: [...formData.triggers, newTrigger.trim()] });
    setNewTrigger('');
  };

  const removeTrigger = (trigger: string) => {
    setFormData({ ...formData, triggers: formData.triggers.filter((t: string) => t !== trigger) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = item ? `/api/suggestions-config/${item.id}` : '/api/suggestions-config';
      const method = item ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          channelId: formData.channelId === '' ? null : formData.channelId
        })
      });

      if (res.ok) {
        onSuccess();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao salvar');
      }
    } catch (error) {
      alert('Erro na conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <header className="flex items-center justify-between border-b p-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {item ? 'Editar Sugestão' : 'Nova Sugestão'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">Configure o gatilho e a resposta que o atendente verá.</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto overflow-x-hidden">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Palavra-chave Principal</label>
              <input 
                type="text"
                required
                value={formData.keyword}
                onChange={(e) => setFormData({...formData, keyword: e.target.value})}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                placeholder="Ex: Matrícula"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Categoria</label>
              <select 
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              >
                <option value="Geral">Geral</option>
                <option value="Matrícula">Matrícula</option>
                <option value="Financeiro">Financeiro</option>
                <option value="Acadêmico">Acadêmico</option>
                <option value="Suporte">Suporte</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Gatilhos (Triggers)</label>
              <span className="text-[10px] text-slate-400 italic">Palavras que ativam esta sugestão</span>
            </div>
            <div className="flex gap-2">
              <input 
                type="text"
                value={newTrigger}
                onChange={(e) => setNewTrigger(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTrigger(e as any)}
                placeholder="Adicionar gatilho e pressionar Enter..."
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
              />
              <button 
                type="button"
                onClick={handleAddTrigger}
                className="rounded-xl bg-slate-800 px-4 text-white hover:bg-black transition-colors"
                title="Adicionar gatilho"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3 p-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200 min-h-[60px]">
              {formData.triggers.map((t: string) => (
                <span key={t} className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
                  {t}
                  <button type="button" onClick={() => removeTrigger(t)} className="text-slate-300 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </span>
              ))}
              {formData.triggers.length === 0 && (
                <span className="text-xs text-slate-400 flex items-center gap-2 px-2 py-1">
                  <Info size={14} /> Nenhum gatilho adicionado
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Resposta Sugerida</label>
            <textarea 
              required
              rows={4}
              value={formData.response}
              onChange={(e) => setFormData({...formData, response: e.target.value})}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
              placeholder="Digite o texto da resposta que o atendente poderá enviar..."
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Canal Específico (Opcional)</label>
              <select 
                value={formData.channelId}
                onChange={(e) => setFormData({...formData, channelId: e.target.value})}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-blue-500 outline-none"
              >
                <option value="">Global (Todos os Canais)</option>
                {channels.map((ch: any) => (
                  <option key={ch.id} value={ch.id}>{ch.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end pb-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-bold text-slate-700">Sugestão Ativa</span>
              </label>
            </div>
          </div>

          <footer className="flex gap-3 pt-4 justify-end">
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
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
              Salvar Sugestão
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};
