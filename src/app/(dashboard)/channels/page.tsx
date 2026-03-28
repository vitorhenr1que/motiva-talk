'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Phone, Globe, Shield, Loader2, MessageCircle, AlertTriangle, CheckCircle2, MoreVertical, Settings, Unlink, QrCode, Trash2 } from 'lucide-react';
import { AddChannelModal } from '@/components/channels/AddChannelModal';
import { ConnectChannelModal } from '@/components/channels/ConnectChannelModal';
import { ChannelConfigModal } from '@/components/channels/ChannelConfigModal';

interface Channel {
  id: string;
  name: string;
  phoneNumber: string;
  connectionStatus: string;
  isActive: boolean;
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [connectModal, setConnectModal] = useState<{ isOpen: boolean; channelId: string | null; channelName: string }>({
    isOpen: false,
    channelId: null,
    channelName: ''
  });
  const [configModal, setConfigModal] = useState<{ isOpen: boolean; channel: Channel | null }>({
    isOpen: false,
    channel: null
  });

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/channels');
      const data = await res.json();
      setChannels(data);
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o canal "${name}"? Isso apagará a instância no WhatsApp também.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/channels/${id}`, { method: 'DELETE' });
      const data = await res.json();
      
      if (data.success) {
        fetchChannels();
      } else {
        alert('Erro ao remover canal: ' + data.error);
      }
    } catch (err) {
      alert('Falha na comunicação com o servidor');
    }
  };

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONNECTED': return 'text-green-600 bg-green-50 ring-green-600/10';
      case 'CONNECTING': 
      case 'QR_CODE': return 'text-amber-600 bg-amber-50 ring-amber-600/10';
      case 'ERROR': return 'text-rose-600 bg-rose-50 ring-rose-600/10';
      default: return 'text-slate-500 bg-slate-50 ring-slate-900/5';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'CONNECTED': return 'ONLINE';
      case 'CONNECTING': return 'CONECTANDO';
      case 'QR_CODE': return 'AGUARDANDO QR';
      case 'ERROR': return 'ERRO';
      case 'DISCONNECTED': return 'DESCONECTADO';
      default: return 'OFFLINE';
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-top-4 duration-700">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-3">Canais de Atendimento</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Gerencie suas conexões do WhatsApp e outros canais integrados.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-3 rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white shadow-xl shadow-blue-200 dark:shadow-none hover:bg-blue-700 hover:shadow-2xl transition-all hover:scale-105 active:scale-95 group"
        >
          <div className="bg-white/20 p-1.5 rounded-lg group-hover:rotate-90 transition-transform duration-500">
             <Plus size={18} strokeWidth={4} />
          </div>
          <span>Registrar Canal</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
           <Loader2 className="animate-spin text-blue-600" size={48} strokeWidth={2.5} />
           <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Carregando Informações...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {channels.map((channel) => (
            <div key={channel.id} className="group relative rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`rounded-2xl p-4 shadow-sm ring-1 transition-all group-hover:scale-110 ${getStatusColor(channel.connectionStatus)}`}>
                    <MessageCircle size={28} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white tracking-tight text-lg">{channel.name}</h3>
                    <p className="text-xs font-bold text-slate-400 tracking-wider">+{channel.phoneNumber}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(channel.id, channel.name)}
                  className="p-2 text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl transition-colors group/del"
                  title="Remover Canal"
                >
                  <Trash2 size={20} className="group-hover/del:scale-110 transition-transform" />
                </button>
              </div>

              <div className="mt-10 flex flex-col gap-4">
                 <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                    <span className="flex items-center gap-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">
                      <div className={`h-2.5 w-2.5 rounded-full animate-pulse ${channel.connectionStatus === 'CONNECTED' ? 'bg-green-500' : 'bg-slate-400'}`} />
                      {getStatusLabel(channel.connectionStatus)}
                    </span>
                    <button 
                      onClick={() => setConfigModal({ isOpen: true, channel })}
                      className="flex items-center gap-2 group/btn"
                    >
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest group-hover/btn:mr-1 transition-all">Configurar</span>
                      <Settings size={14} className="text-blue-600 group-hover/btn:rotate-90 transition-transform duration-500 shadow-sm" />
                    </button>
                 </div>

                 {channel.connectionStatus !== 'CONNECTED' && (
                    <button 
                      onClick={() => setConnectModal({ isOpen: true, channelId: channel.id, channelName: channel.name })}
                      className="flex items-center justify-center gap-3 w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3.5 rounded-2xl font-bold text-sm shadow-xl transition-all hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95"
                    >
                      <QrCode size={18} />
                      Conectar WhatsApp
                    </button>
                 )}
                 
                 {channel.connectionStatus === 'CONNECTED' && (
                    <button 
                      onClick={() => setConfigModal({ isOpen: true, channel })}
                      className="flex items-center justify-center gap-3 w-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 py-3.5 rounded-2xl font-bold text-sm transition-all hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95"
                    >
                      <Unlink size={18} />
                      Desconectar
                    </button>
                 )}
              </div>
            </div>
          ))}

          {/* New Channel Placeholder */}
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="group relative rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-8 flex flex-col items-center justify-center text-center transition-all hover:border-blue-400 dark:hover:border-blue-500 hover:bg-white dark:hover:bg-slate-900 group"
          >
            <div className="rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
               <Plus size={32} strokeWidth={2.5} className="text-slate-400 group-hover:text-white transition-colors" />
            </div>
            <p className="mt-4 text-sm font-black text-slate-400 group-hover:text-blue-600 uppercase tracking-widest">Adicionar novo canal</p>
          </button>
        </div>
      )}

      {/* Modals */}
      <AddChannelModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={fetchChannels} 
      />

      <ConnectChannelModal 
        isOpen={connectModal.isOpen} 
        onClose={() => {
           setConnectModal({ ...connectModal, isOpen: false });
           fetchChannels();
        }} 
        channelId={connectModal.channelId}
        channelName={connectModal.channelName}
      />

      <ChannelConfigModal
        isOpen={configModal.isOpen}
        onClose={() => setConfigModal({ ...configModal, isOpen: false })}
        channel={configModal.channel}
        onActionSuccess={fetchChannels}
        onOpenConnect={(id, name) => setConnectModal({ isOpen: true, channelId: id, channelName: name })}
      />

      {/* Info Banner */}
      <div className="mt-12 p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-[32px] border border-blue-100 dark:border-blue-900/30 flex items-center gap-6">
         <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm text-blue-600">
           <Shield size={24} strokeWidth={2.5} />
         </div>
         <div>
           <h4 className="font-bold text-slate-900 dark:text-white tracking-tight">Canais Criptografados</h4>
           <p className="text-sm text-slate-500 dark:text-slate-400">Todas as comunicações via Evolution API são seguras e seguem os protocolos de privacidade do WhatsApp.</p>
         </div>
      </div>
    </div>
  );
}
