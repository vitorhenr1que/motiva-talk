'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Layers, User, Loader2, Info, Send } from 'lucide-react';
import { Conversation, Sector } from '@/types/chat';

interface TransferToSectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  onTransferComplete: () => void;
}

export default function TransferToSectorModal({ 
  isOpen, 
  onClose, 
  conversation,
  onTransferComplete 
}: TransferToSectorModalProps) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selectedSectorId, setSelectedSectorId] = useState('');
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setFetchingData(true);
    try {
      const [secRes, userRes] = await Promise.all([
        fetch('/api/sectors'),
        fetch('/api/users')
      ]);
      const [secData, userData] = await Promise.all([
        secRes.json(),
        userRes.json()
      ]);
      
      setSectors(secData.data || []);
      setAgents(userData.data || []);
      
      if (secData.data?.length > 0) {
        // Find current sector and exclude it or just select another
        const others = secData.data.filter((s: Sector) => s.id !== conversation.currentSectorId);
        if (others.length > 0) {
          setSelectedSectorId(others[0].id);
        } else {
          setSelectedSectorId(secData.data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingData(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedSectorId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentSectorId: selectedSectorId,
          assignedTo: selectedAgentId || null // Transfer to agent too if selected
        })
      });

      const json = await res.json();
      if (json.success) {
        // Enviar uma mensagem de sistema informando a transferência
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: conversation.id,
            content: `🔄 Conversa transferida para o setor: ${sectors.find(s => s.id === selectedSectorId)?.name}`,
            type: 'SYSTEM',
            senderType: 'SYSTEM'
          })
        });

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
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-white/20">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-blue-50/30">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-100">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Transferir Setor</h2>
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
          
          {/* Sector Selection */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Setor de Destino</label>
            {fetchingData ? (
              <div className="h-14 flex items-center justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Loader2 size={18} className="animate-spin text-blue-400" />
              </div>
            ) : sectors.length === 0 ? (
              <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl text-xs font-bold border border-orange-100 flex items-center gap-3">
                <Info size={16} />
                Nenhum setor cadastrado.
              </div>
            ) : (
              <div className="relative group">
                <select 
                  value={selectedSectorId}
                  onChange={(e) => setSelectedSectorId(e.target.value)}
                  className="w-full h-14 px-6 pl-14 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                >
                  {sectors.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <Layers className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ArrowRightLeft size={14} className="rotate-90 text-slate-300" />
                </div>
              </div>
            )}
          </div>

          {/* Agent Selection (Optional) */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Atendente Específico (Opcional)</label>
            <div className="relative group">
              <select 
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full h-14 px-6 pl-14 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer"
              >
                <option value="">Apenas transferir para o Setor</option>
                {agents.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <User className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                <ArrowRightLeft size={14} className="rotate-90 text-slate-300" />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-medium ml-1">Se não selecionado, a conversa ficará disponível para todos do setor.</p>
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
            disabled={loading || sectors.length === 0}
            className="flex-[2] h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? 'Transferindo...' : 'Transferir Agora'}
          </button>
        </div>

      </div>
    </div>
  );
}
