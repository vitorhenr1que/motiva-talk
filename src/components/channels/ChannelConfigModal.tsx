'use client';

import React, { useEffect, useState } from 'react';
import { Cloud, Loader2, Settings, ShieldCheck, Unlink, X } from 'lucide-react';

interface ChannelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: {
    id: string;
    name: string;
    phoneNumber: string;
    connectionStatus: string;
    whatsappProvider?: 'META_CLOUD';
    allowAgentNameEdit?: boolean;
    defaultSectorId?: string | null;
    allowAgentFilterAllSectors?: boolean;
  } | null;
  onActionSuccess: () => void;
  onOpenConnect: (id: string, name: string) => void;
}

export const ChannelConfigModal: React.FC<ChannelConfigModalProps> = ({ isOpen, onClose, channel, onActionSuccess, onOpenConnect }) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [allowAgentNameEdit, setAllowAgentNameEdit] = useState(false);
  const [allowAgentFilterAllSectors, setAllowAgentFilterAllSectors] = useState(false);
  const [defaultSectorId, setDefaultSectorId] = useState<string | null>(null);
  const [sectors, setSectors] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!isOpen || !channel) return;
    setAllowAgentNameEdit(Boolean(channel.allowAgentNameEdit));
    setAllowAgentFilterAllSectors(Boolean(channel.allowAgentFilterAllSectors));
    setDefaultSectorId(channel.defaultSectorId || null);
    fetch('/api/sectors').then((response) => response.json()).then((data) => setSectors(data.data || [])).catch(() => setSectors([]));
  }, [isOpen, channel]);

  if (!isOpen || !channel) return null;

  const updateSetting = async (field: string, value: boolean | string | null) => {
    setLoading(field);
    try {
      const response = await fetch(`/api/channels/${channel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) throw new Error('Falha ao salvar configuração');
      if (field === 'allowAgentNameEdit') setAllowAgentNameEdit(Boolean(value));
      if (field === 'allowAgentFilterAllSectors') setAllowAgentFilterAllSectors(Boolean(value));
      if (field === 'defaultSectorId') setDefaultSectorId(value ? String(value) : null);
      onActionSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Falha ao salvar configuração');
    } finally {
      setLoading(null);
    }
  };

  const disconnect = async () => {
    setLoading('disconnect');
    try {
      const response = await fetch(`/api/channels/${channel.id}/disconnect`, { method: 'POST' });
      if (!response.ok) throw new Error('Falha ao desconectar canal');
      onActionSuccess();
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Falha ao desconectar canal');
    } finally {
      setLoading(null);
    }
  };

  const toggleClass = (active: boolean) => `relative h-6 w-11 rounded-full transition-colors ${active ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[32px] bg-white p-8 shadow-2xl dark:bg-slate-900">
        <div className="mb-7 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-900/30"><Settings size={22} /></div><div><h2 className="text-xl font-black text-slate-900 dark:text-white">{channel.name}</h2><p className="text-xs font-semibold text-slate-400">+{channel.phoneNumber}</p></div></div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar"><X size={20} /></button>
        </div>

        <div className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/30 dark:bg-emerald-900/20">
          <div className="flex items-center gap-3"><Cloud className="text-emerald-600" size={20} /><div><p className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Meta Cloud API</p><p className="text-[10px] font-semibold text-emerald-600/70">Integração oficial exclusiva</p></div></div>
          <span className={`rounded-full px-3 py-1 text-[10px] font-black ${channel.connectionStatus === 'CONNECTED' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{channel.connectionStatus === 'CONNECTED' ? 'ONLINE' : 'OFFLINE'}</span>
        </div>

        <div className="space-y-5 rounded-3xl border border-slate-100 p-5 dark:border-slate-800">
          <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-bold text-slate-800 dark:text-white">Identificar atendente</p><p className="text-xs text-slate-400">Permite personalizar o nome enviado nas mensagens.</p></div><button onClick={() => updateSetting('allowAgentNameEdit', !allowAgentNameEdit)} disabled={Boolean(loading)} className={toggleClass(allowAgentNameEdit)}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${allowAgentNameEdit ? 'left-6' : 'left-1'}`} /></button></div>
          <div className="h-px bg-slate-100 dark:bg-slate-800" />
          <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-bold text-slate-800 dark:text-white">Visualizar todos os setores</p><p className="text-xs text-slate-400">Libera o filtro global para agentes deste canal.</p></div><button onClick={() => updateSetting('allowAgentFilterAllSectors', !allowAgentFilterAllSectors)} disabled={Boolean(loading)} className={toggleClass(allowAgentFilterAllSectors)}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${allowAgentFilterAllSectors ? 'left-6' : 'left-1'}`} /></button></div>
          <div className="h-px bg-slate-100 dark:bg-slate-800" />
          <div><label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Setor padrão</label><select value={defaultSectorId || ''} onChange={(event) => updateSetting('defaultSectorId', event.target.value || null)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"><option value="">Fila geral</option>{sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select></div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={() => { onClose(); onOpenConnect(channel.id, channel.name); }} className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"><Cloud size={17} /> Credenciais</button>
          <button onClick={disconnect} disabled={Boolean(loading)} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{loading === 'disconnect' ? <Loader2 className="animate-spin" size={17} /> : <Unlink size={17} />} Desconectar</button>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400"><ShieldCheck size={14} /> Credenciais secretas somente no servidor</p>
      </div>
    </div>
  );
};
