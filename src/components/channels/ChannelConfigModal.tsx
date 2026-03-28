'use client';

import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  Unlink, 
  RefreshCw, 
  Trash2, 
  ShieldCheck, 
  Zap, 
  Activity, 
  AlertTriangle, 
  Loader2 
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChannelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: {
    id: string;
    name: string;
    phoneNumber: string;
    connectionStatus: string;
  } | null;
  onActionSuccess: () => void;
  onOpenConnect: (id: string, name: string) => void;
}

export const ChannelConfigModal: React.FC<ChannelConfigModalProps> = ({ 
  isOpen, 
  onClose, 
  channel,
  onActionSuccess,
  onOpenConnect
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (!isOpen || !channel) return null;

  const handleAction = async (action: string, endpoint: string, method: 'POST' | 'DELETE' | 'GET' = 'POST') => {
    // Confirmation logic
    if (action === 'delete') {
       if (!window.confirm(`⚠️ EXCLUIR PERMANENTEMENTE: Deseja realmente remover o canal "${channel.name}"? Esta ação não pode ser desfeita.`)) return;
    }
    if (action === 'disconnect' && channel.connectionStatus === 'CONNECTED') {
       if (!window.confirm(`Deseja desconectar sua conta do WhatsApp do canal "${channel.name}"?`)) return;
    }
    if (action === 'reset') {
       if (!window.confirm(`⚠️ RESETAR CANAL: Esta ação removerá a instância externa e criará uma nova. Você precisará escanear o QR Code novamente. Continuar?`)) return;
    }

    setLoadingAction(action);
    try {
      const res = await fetch(`/api/channels/${channel.id}${endpoint}`, { method });
      const data = await res.json();
      
      if (data.success) {
        onActionSuccess();
        if (action === 'delete') onClose();
        if (action === 'reset') handleReconnect();
      } else {
        alert('Falha na ação: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (err) {
      alert('Falha crítica na comunicação com o servidor. Tente novamente.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReconnect = () => {
    if (channel.connectionStatus === 'CONNECTED') {
      if (!window.confirm(`O canal "${channel.name}" já está conectado. Reconectar irá encerrar a sessão atual para gerar um novo QR Code. Continuar?`)) {
        return;
      }
    }
    onClose();
    onOpenConnect(channel.id, channel.name);
  };

  const statusLabel = () => {
    switch (channel.connectionStatus) {
      case 'CONNECTED': return { label: 'ONLINE', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
      case 'QR_CODE': return { label: 'AGUARDANDO QR', color: 'text-amber-500', bg: 'bg-amber-500/10' };
      case 'CONNECTING': return { label: 'CONECTANDO', color: 'text-blue-500', bg: 'bg-blue-500/10' };
      default: return { label: 'OFFLINE', color: 'text-slate-400', bg: 'bg-slate-500/10' };
    }
  };

  const status = statusLabel();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-lg p-8 shadow-2xl ring-1 ring-slate-900/10 scale-in-center">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b border-slate-50 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-400">
              <Settings size={28} />
            </div>
            <div className="text-left">
              <h2 className="text-xl font-black dark:text-white tracking-tight leading-none mb-1">Configurar Canal</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{channel.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        {/* Status Card */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 mb-8 flex items-center justify-between border border-slate-100 dark:border-slate-800/50 shadow-sm">
           <div className="flex items-center gap-4">
             <div className={cn("p-2 rounded-xl animate-pulse", status.bg)}>
                <Activity size={20} className={status.color} />
             </div>
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status Atual</p>
                <h4 className={cn("font-black tracking-tight", status.color)}>{status.label}</h4>
             </div>
           </div>
           <button 
             onClick={() => handleAction('sync', '/status', 'GET')}
             disabled={!!loadingAction}
             className="p-2.5 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-slate-600 dark:text-slate-300"
           >
             <RefreshCw size={18} className={loadingAction === 'sync' ? 'animate-spin' : ''} />
           </button>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 gap-4">
           {/* Reconnect / QR Code */}
           <button 
             onClick={handleReconnect}
             className="flex flex-col items-center justify-center p-6 gap-3 rounded-[28px] bg-blue-500/5 border border-blue-100 dark:border-blue-900/30 hover:bg-blue-500 hover:text-white group transition-all duration-300 text-blue-600 dark:text-blue-400"
           >
              <Zap size={24} className="group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-widest">Reconectar</span>
           </button>

           {/* Disconnect */}
           <button 
             onClick={() => handleAction('disconnect', '/disconnect', 'POST')}
             disabled={!!loadingAction}
             className="flex flex-col items-center justify-center p-6 gap-3 rounded-[28px] bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 hover:bg-slate-900 dark:hover:bg-white dark:hover:text-slate-900 hover:text-white group transition-all duration-300 text-slate-600 dark:text-slate-400"
           >
              {loadingAction === 'disconnect' ? <Loader2 size={24} className="animate-spin" /> : <Unlink size={24} className="group-hover:scale-110 transition-transform" />}
              <span className="text-xs font-bold uppercase tracking-widest">Desconectar</span>
           </button>

           {/* Reset */}
           <button 
             onClick={() => handleAction('reset', '/reset', 'POST')}
             disabled={!!loadingAction}
             className="flex flex-col items-center justify-center p-6 gap-3 rounded-[28px] bg-amber-500/5 border border-amber-100 dark:border-amber-900/30 hover:bg-amber-500 hover:text-white group transition-all duration-300 text-amber-600 dark:text-amber-400"
           >
              {loadingAction === 'reset' ? <Loader2 size={24} className="animate-spin" /> : <RefreshCw size={24} className="group-hover:rotate-180 transition-transform duration-500" />}
              <span className="text-xs font-bold uppercase tracking-widest">Resetar Inst</span>
           </button>

           {/* Delete */}
           <button 
             onClick={() => handleAction('delete', '', 'DELETE')}
             disabled={!!loadingAction}
             className="flex flex-col items-center justify-center p-6 gap-3 rounded-[28px] bg-rose-500/5 border border-rose-100 dark:border-rose-900/30 hover:bg-rose-500 hover:text-white group transition-all duration-300 text-rose-600 dark:text-rose-400"
           >
              <Trash2 size={24} className="group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-widest text-rose-600 group-hover:text-white">Excluir Permanente</span>
           </button>
        </div>

        {/* Action Description */}
        <div className="mt-8 flex items-start gap-4 p-4 bg-blue-50/30 dark:bg-blue-900/10 rounded-2xl border border-blue-100/50 dark:border-blue-900/30">
           <AlertTriangle size={18} className="text-blue-600 shrink-0 mt-0.5" />
           <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 text-left leading-relaxed italic">
             O reset do canal removerá a sessão atual e criará uma nova instância do zero. Use esta opção se o seu QR Code estiver travado ou a conexão inconsistente.
           </p>
        </div>

        <p className="mt-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
          <ShieldCheck size={14} className="text-slate-300" />
          Configurações seguras pela Evolution API
        </p>
      </div>
    </div>
  );
};
