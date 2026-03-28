'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Trash2, Edit2, ChevronRight, Zap, Loader2 } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';

interface QuickReply {
  id: string;
  title: string;
  content: string;
  category: string;
  channelId?: string | null;
}

interface ManagerModalProps {
  onClose: () => void;
}

export const QuickReplyManagerModal = ({ onClose }: ManagerModalProps) => {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const { channels } = useChatStore();

  const fetchReplies = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/quick-replies');
      const data = await resp.json();
      setReplies(data);
    } catch (e) {
      console.error('Fetch error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReplies();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta resposta?')) return;
    try {
      await fetch(`/api/quick-replies/${id}`, { method: 'DELETE' });
      fetchReplies();
    } catch (e) {
      alert('Erro ao excluir');
    }
  };

  const handleSave = () => {
    setIsFormOpen(false);
    setEditingReply(null);
    fetchReplies();
  };

  const filtered = replies.filter(r => 
    r.title.toLowerCase().includes(search.toLowerCase()) || 
    r.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b p-6 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200">
              <Zap size={20} className="fill-current" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Gerenciar Respostas</h2>
              <p className="text-xs text-slate-500 font-medium">Crie atalhos para agilizar seu atendimento</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-200 text-slate-400 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* List & Search Area */}
        {!isFormOpen ? (
          <>
            <div className="p-6 border-b flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por título ou categoria..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
              </div>
              <button 
                onClick={() => setIsFormOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
              >
                <Plus size={18} /> Nova Resposta
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-thin">
              {loading ? (
                <div className="flex h-40 flex-col items-center justify-center text-slate-400">
                  <Loader2 className="animate-spin mb-2" size={32} />
                  <p className="text-sm font-medium">Carregando respostas...</p>
                </div>
              ) : (
                <>
                  {filtered.map(reply => (
                    <QuickReplyItem 
                      key={reply.id} 
                      reply={reply} 
                      onEdit={() => { setEditingReply(reply); setIsFormOpen(true); }}
                      onDelete={() => handleDelete(reply.id)}
                    />
                  ))}
                  {filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 opacity-50">
                      <Zap size={48} className="mb-2" />
                      <p className="text-sm italic">Nenhuma resposta encontrada</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <QuickReplyForm 
            initialData={editingReply} 
            channels={channels}
            onCancel={() => { setIsFormOpen(false); setEditingReply(null); }}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
};

const QuickReplyItem = ({ reply, onEdit, onDelete }: { reply: QuickReply, onEdit: () => void, onDelete: () => void }) => (
  <div className="group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-lg hover:shadow-blue-50/50">
    <div className="flex-1 overflow-hidden">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-bold text-slate-800 tracking-tight">{reply.title}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
          {reply.category}
        </span>
        {reply.channelId && (
          <span className="text-[10px] font-bold uppercase text-blue-500">Exclusivo</span>
        )}
      </div>
      <p className="truncate text-xs text-slate-500 leading-relaxed">{reply.content}</p>
    </div>
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
      <button onClick={onEdit} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit2 size={18} /></button>
      <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={18} /></button>
    </div>
    <ChevronRight size={18} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
  </div>
);

const QuickReplyForm = ({ initialData, channels, onCancel, onSave }: any) => {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    content: initialData?.content || '',
    category: initialData?.category || '',
    channelId: initialData?.channelId || ''
  });
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const url = initialData?.id ? `/api/quick-replies/${initialData.id}` : '/api/quick-replies';
      const method = initialData?.id ? 'PATCH' : 'POST';
      
      const payload = {
        ...formData,
        channelId: formData.channelId === '' ? null : formData.channelId
      };

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      onSave();
    } catch (e) {
      alert('Erro ao salvar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">Título</label>
            <input
              required
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="Ex: Saudação Inicial"
              className="w-full rounded-xl border-slate-200 bg-slate-50 p-3 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">Categoria</label>
            <input
              required
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
              placeholder="Ex: Geral, Vendas, Suporte"
              className="w-full rounded-xl border-slate-200 bg-slate-50 p-3 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">Canal Vinculado (Opcional)</label>
          <select
            value={formData.channelId || ''}
            onChange={e => setFormData({...formData, channelId: e.target.value})}
            className="w-full rounded-xl border-slate-200 bg-slate-50 p-3 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
          >
            <option value="">Global (Disponível em todos canais)</option>
            {channels.map((ch: any) => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 flex-1">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">Conteúdo da Mensagem</label>
          <textarea
            required
            rows={5}
            value={formData.content}
            onChange={e => setFormData({...formData, content: e.target.value})}
            placeholder="Olá! Como podemos ajudar hoje?"
            className="w-full rounded-xl border-slate-200 bg-slate-50 p-3 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium resize-none"
          />
        </div>
      </div>

      <div className="border-t bg-slate-50 p-6 flex justify-end gap-3">
        <button 
          type="button" 
          onClick={onCancel}
          className="rounded-xl px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-200 transition-all"
        >
          Cancelar
        </button>
        <button 
          disabled={busy}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-100"
        >
          {busy ? <Loader2 className="animate-spin" size={18} /> : 'Salvar Resposta'}
        </button>
      </div>
    </form>
  );
};
