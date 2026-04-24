'use client';

import React, { useEffect, useState } from 'react';
import { X, Clock, Trash2, Calendar, MessageSquare, Loader2, AlertCircle, Send, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatWhatsappText } from '@/lib/formatWhatsappText';

interface ScheduledMessage {
  id: string;
  content: string;
  scheduledAt: string;
  sendStatus: string;
  type: string;
}

interface Props {
  conversationId: string;
  onClose: () => void;
  onScheduleSuccess?: () => void;
  onCancelSuccess?: () => void;
}

export const ScheduledMessagesModal = ({ conversationId, onClose, onScheduleSuccess, onCancelSuccess }: Props) => {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  
  // New Scheduling Form State
  const [showForm, setShowForm] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newDate, setNewDate] = useState('');
  const [cancelOnReply, setCancelOnReply] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const fetchScheduled = async () => {
    try {
      const resp = await fetch(`/api/messages/scheduled?conversationId=${conversationId}`);
      const data = await resp.json();
      if (data.success) {
        setMessages(data.data || []);
      }
    } catch (e) {
      console.error('Erro ao buscar agendados:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduled();
  }, [conversationId]);

  const handleCancel = async (id: string) => {
    if (!confirm('Deseja realmente cancelar este agendamento?')) return;
    
    setCancellingId(id);
    try {
      const resp = await fetch(`/api/messages/${id}/cancel`, {
        method: 'PATCH',
      });
      if (resp.ok) {
        setMessages(prev => prev.filter(m => m.id !== id));
        if (onCancelSuccess) onCancelSuccess();
      }
    } catch (e) {
      alert('Erro ao cancelar agendamento');
    } finally {
      setCancellingId(null);
    }
  };

  const handleSchedule = async () => {
    if (!newContent.trim() || !newDate) return;

    setScheduling(true);
    try {
      const resp = await fetch('/api/messages/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          content: newContent,
          scheduledAt: new Date(newDate).toISOString(),
          senderType: 'AGENT',
          cancelOnReply
        })
      });

      if (resp.ok) {
        setNewContent('');
        setNewDate('');
        setCancelOnReply(false);
        setShowForm(false);
        fetchScheduled();
        if (onScheduleSuccess) onScheduleSuccess();
      } else {
        const err = await resp.json();
        alert(err.message || 'Erro ao agendar mensagem');
      }
    } catch (e) {
      alert('Erro ao conectar com o servidor');
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Mensagens Agendadas</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{messages.length} envios pendentes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowForm(!showForm)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95",
                showForm ? "bg-slate-200 text-slate-600" : "bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700"
              )}
            >
              {showForm ? <X size={14} /> : <Plus size={14} />}
              {showForm ? 'Cancelar' : 'Novo Agendamento'}
            </button>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:bg-white hover:text-red-500 transition-all active:scale-90"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {showForm && (
          <div className="p-6 bg-blue-50/50 border-b border-blue-100 animate-in slide-in-from-top duration-300">
             <div className="flex flex-col gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2 block">Conteúdo da Mensagem</label>
                  <textarea 
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Digite a mensagem que será enviada automaticamente..."
                    className="w-full bg-white border border-blue-100 rounded-2xl p-4 text-sm font-medium text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all min-h-[100px] resize-none"
                  />
                </div>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2 block">Data e Hora do Envio</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" size={16} />
                      <input 
                        type="datetime-local" 
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                        className="w-full bg-white border border-blue-100 rounded-xl py-3 pl-12 pr-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer group/check">
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        checked={cancelOnReply}
                        onChange={(e) => setCancelOnReply(e.target.checked)}
                        className="peer h-5 w-5 appearance-none rounded-md border-2 border-blue-100 bg-white checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer"
                      />
                      <Check className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" size={14} strokeWidth={4} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 group-hover/check:text-blue-600 transition-colors">Cancelar se o cliente responder</span>
                      <span className="text-[9px] font-bold text-slate-400">O agendamento será removido automaticamente se houver resposta</span>
                    </div>
                  </label>

                  <button 
                    onClick={handleSchedule}
                    disabled={scheduling || !newContent.trim() || !newDate}
                    className="h-[46px] px-6 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-200"
                  >
                    {scheduling ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Agendar
                  </button>
                </div>
             </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-blue-500" size={32} />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Carregando...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center">
                <Calendar size={40} className="text-slate-200" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-400">Nenhum agendamento ativo</p>
                <p className="text-[10px] text-slate-300 font-medium mt-1">Clique em "Novo Agendamento" para começar.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map(msg => (
                <div key={msg.id} className="group relative bg-white border border-slate-100 p-4 rounded-2xl hover:border-amber-200 hover:shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-amber-500" />
                      <span className="text-[11px] font-black text-slate-800">
                        {new Date(msg.scheduledAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleCancel(msg.id)}
                      disabled={cancellingId === msg.id}
                      className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                      title="Cancelar agendamento"
                    >
                      {cancellingId === msg.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                  
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100/50">
                    <div className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {formatWhatsappText(msg.content)}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-600/70">Aguardando processamento</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center shrink-0">
           <p className="text-[10px] font-bold text-slate-400 text-center flex items-center gap-2">
             <AlertCircle size={12} />
             O cancelamento é imediato e impede o envio da mensagem.
           </p>
        </div>
      </div>
    </div>
  );
};
