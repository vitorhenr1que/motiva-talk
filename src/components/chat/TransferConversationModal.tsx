'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, MessageSquare, Loader2, Info } from 'lucide-react';
import { Channel, Conversation } from '@/types/chat';

interface TransferConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  onTransferComplete: () => void;
}

export default function TransferConversationModal({ 
  isOpen, 
  onClose, 
  conversation,
  onTransferComplete 
}: TransferConversationModalProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingChannels, setFetchingChannels] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchChannels();
    }
  }, [isOpen]);

  const fetchChannels = async () => {
    try {
      const res = await fetch('/api/channels');
      const json = await res.json();
      if (json.success) {
        // Filtra o canal atual
        const others = json.data.filter((c: Channel) => c.id !== conversation.channelId);
        setChannels(others);
        if (others.length > 0) setSelectedChannelId(others[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingChannels(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedChannelId) return;

    setLoading(true);
    try {
      const res = await fetch('/api/conversations/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          targetChannelId: selectedChannelId,
          note: note.trim() || undefined
        })
      });

      const json = await res.json();
      if (json.success) {
        onTransferComplete();
        onClose();
      } else {
        alert('Erro ao transferir: ' + (json.error || 'Desconhecido'));
      }
    } catch (e) {
      console.error(e);
      alert('Erro crítico ao transferir.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-indigo-50/30">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Transferir</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Conversa com {conversation.contact.name}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="h-10 w-10 rounded-full hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm border border-transparent hover:border-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          
          {/* Channel Selection */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Canal de Destino</label>
            {fetchingChannels ? (
              <div className="h-14 flex items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Loader2 size={18} className="animate-spin text-indigo-400" />
              </div>
            ) : channels.length === 0 ? (
              <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl text-xs font-bold border border-orange-100 flex items-center gap-3">
                <Info size={16} />
                Nenhum outro canal ativo disponível.
              </div>
            ) : (
              <select 
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                className="w-full h-14 px-6 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
              >
                {channels.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phoneNumber})</option>
                ))}
              </select>
            )}
          </div>

          {/* Internal Note */}
          <div className="space-y-3">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nota Interna (Opcional)</label>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-tighter">Privado</span>
            </div>
            <textarea 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Cliente quer falar com o financeiro sobre a parcela atrasada..."
              className="w-full min-h-[120px] p-6 bg-slate-50 border-2 border-transparent focus:border-amber-400 focus:bg-white rounded-3xl outline-none transition-all font-medium text-slate-700 resize-none placeholder:text-slate-300"
            />
            <p className="text-[10px] text-slate-400 font-medium ml-1">Esta nota será visível apenas para os atendentes.</p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-8 bg-slate-50/50 flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:bg-white transition-all border border-transparent hover:border-slate-100"
          >
            Cancelar
          </button>
          <button 
            onClick={handleTransfer}
            disabled={loading || channels.length === 0}
            className="flex-[2] h-14 rounded-2xl bg-slate-900 hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200 transition-all flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
            {loading ? 'Processando...' : 'Confirmar Transferência'}
          </button>
        </div>

      </div>
    </div>
  );
}
