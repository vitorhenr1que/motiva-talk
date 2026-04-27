'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Layers, User, Loader2, Info, Send, Smartphone } from 'lucide-react';
import { Conversation, Sector, Channel } from '@/types/chat';

interface UnifiedTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  onTransferComplete: () => void;
}

type TransferTab = 'SECTOR' | 'CHANNEL';

export default function UnifiedTransferModal({ 
  isOpen, 
  onClose, 
  conversation,
  onTransferComplete 
}: UnifiedTransferModalProps) {
  const [activeTab, setActiveTab] = useState<TransferTab>('SECTOR');
  const [loading, setLoading] = useState(false);
  
  // Sector Tab State
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selectedSectorId, setSelectedSectorId] = useState('');
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  
  // Channel Tab State
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [transferNote, setTransferNote] = useState('');
  
  const [fetchingData, setFetchingData] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setFetchingData(true);
    try {
      const [secRes, userRes, chanRes] = await Promise.all([
        fetch('/api/sectors'),
        fetch('/api/users'),
        fetch('/api/channels')
      ]);
      
      const [secData, userData, chanData] = await Promise.all([
        secRes.json(),
        userRes.json(),
        chanRes.json()
      ]);
      
      setSectors(secData.data || []);
      setAgents(userData.data || []);
      
      const otherChannels = (chanData.data || []).filter((c: Channel) => c.id !== conversation.channelId);
      setChannels(otherChannels);

      if (secData.data?.length > 0) {
        const others = secData.data.filter((s: Sector) => s.id !== conversation.currentSectorId);
        setSelectedSectorId(others.length > 0 ? others[0].id : secData.data[0].id);
      }
      
      if (otherChannels.length > 0) {
        setSelectedChannelId(otherChannels[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingData(false);
    }
  };

  const handleSectorTransfer = async () => {
    if (!selectedSectorId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/conversations/transfer-sector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          targetSectorId: selectedSectorId,
          targetAgentId: selectedAgentId || undefined,
          note: transferNote.trim() || undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        onTransferComplete();
        onClose();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleChannelTransfer = async () => {
    if (!selectedChannelId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/conversations/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          targetChannelId: selectedChannelId,
          note: transferNote.trim() || undefined
        })
      });

      if ((await res.json()).success) {
        onTransferComplete();
        onClose();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-white/20">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Transferir Conversa</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contato: {conversation.contact.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="h-10 w-10 rounded-full hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-100">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 bg-slate-100/50 mx-8 mt-6 rounded-2xl">
          <button 
            onClick={() => setActiveTab('SECTOR')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'SECTOR' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Layers size={14} />
            Setor / Atendente
          </button>
          <button 
            onClick={() => setActiveTab('CHANNEL')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'CHANNEL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Smartphone size={14} />
            Canal (WhatsApp)
          </button>
        </div>

        {/* Content */}
        <div className="p-8 pt-6 space-y-6">
          {fetchingData ? (
            <div className="h-48 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 size={24} className="animate-spin text-indigo-500" />
              <span className="text-[10px] font-black uppercase tracking-widest">Carregando opções...</span>
            </div>
          ) : activeTab === 'SECTOR' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Setor de Destino</label>
                <div className="relative group">
                  <select 
                    value={selectedSectorId}
                    onChange={(e) => setSelectedSectorId(e.target.value)}
                    className="w-full h-14 px-6 pl-14 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                  >
                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <Layers className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" size={18} />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Atendente (Opcional)</label>
                <div className="relative group">
                  <select 
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full h-14 px-6 pl-14 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                  >
                    <option value="">Apenas Setor</option>
                    {agents.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <User className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500" size={18} />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Motivo da Transferência (Opcional)</label>
                <textarea 
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="Por que está transferindo esta conversa?"
                  className="w-full min-h-[100px] p-6 bg-slate-50 border-2 border-transparent focus:border-blue-400 focus:bg-white rounded-3xl outline-none transition-all font-medium text-slate-700 resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Canal de Destino</label>
                {channels.length === 0 ? (
                  <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl text-xs font-bold border border-orange-100 flex items-center gap-3">
                    <Info size={16} /> Sem outros canais disponíveis.
                  </div>
                ) : (
                  <div className="relative group">
                    <select 
                      value={selectedChannelId}
                      onChange={(e) => setSelectedChannelId(e.target.value)}
                      className="w-full h-14 px-6 pl-14 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer"
                    >
                      {channels.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phoneNumber})</option>)}
                    </select>
                    <Smartphone className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" size={18} />
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nota Interna (Opcional)</label>
                <textarea 
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="Motivo da transferência..."
                  className="w-full min-h-[100px] p-6 bg-slate-50 border-2 border-transparent focus:border-indigo-400 focus:bg-white rounded-3xl outline-none transition-all font-medium text-slate-700 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 bg-slate-50/50 flex gap-4">
          <button onClick={onClose} className="flex-1 h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:bg-white transition-all border border-transparent hover:border-slate-100">
            Cancelar
          </button>
          <button 
            onClick={activeTab === 'SECTOR' ? handleSectorTransfer : handleChannelTransfer}
            disabled={loading || (activeTab === 'SECTOR' && sectors.length === 0) || (activeTab === 'CHANNEL' && channels.length === 0)}
            className={`flex-[2] h-14 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 ${activeTab === 'SECTOR' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? 'Transferindo...' : 'Confirmar Transferência'}
          </button>
        </div>
      </div>
    </div>
  );
}
