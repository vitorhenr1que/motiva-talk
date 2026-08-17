'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Cloud, KeyRound, Loader2, ShieldCheck, X } from 'lucide-react';

interface ConnectChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string | null;
  channelName: string;
}

type ConnectStatus = 'READY' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export const ConnectChannelModal: React.FC<ConnectChannelModalProps> = ({ isOpen, onClose, channelId, channelName }) => {
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [status, setStatus] = useState<ConnectStatus>('READY');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setPhoneNumberId('');
    setWabaId('');
    setStatus('READY');
    setError('');
  }, [channelId, isOpen]);

  if (!isOpen) return null;

  const connectChannel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!channelId) return;
    setStatus('CONNECTING');
    setError('');

    try {
      const response = await fetch(`/api/channels/${channelId}/connect-meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumberId: phoneNumberId.trim(), wabaId: wabaId.trim() }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || payload.message || 'Não foi possível validar o número na Meta.');
      setStatus('CONNECTED');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível validar o número na Meta.');
      setStatus('ERROR');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-xl overflow-hidden rounded-[34px] bg-white shadow-2xl ring-1 ring-white/20 dark:bg-slate-900">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-blue-500 to-indigo-500" />
        <div className="p-8">
          <div className="mb-7 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-900/30"><Cloud size={25} /></div>
              <div><h2 className="text-xl font-black text-slate-900 dark:text-white">Conectar Meta Cloud API</h2><p className="text-xs font-semibold text-slate-400">{channelName}</p></div>
            </div>
            <button onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-slate-800" aria-label="Fechar"><X size={20} /></button>
          </div>

          {(status === 'READY' || status === 'ERROR') && (
            <form onSubmit={connectChannel} className="space-y-5">
              <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 text-amber-950 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-100">
                <div className="flex gap-4">
                  <div className="rounded-2xl bg-white p-3 text-amber-600 shadow-sm dark:bg-slate-800"><AlertCircle size={24} /></div>
                  <div><p className="font-black">Uso exclusivo pela Cloud API</p><p className="mt-1 text-sm font-medium leading-relaxed opacity-80">O número precisa estar removido do WhatsApp Business no celular antes do cadastro no WhatsApp Manager.</p></div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number ID</span>
                  <input required inputMode="numeric" autoComplete="off" value={phoneNumberId} onChange={(event) => setPhoneNumberId(event.target.value.replace(/\D/g, ''))} placeholder="ID fornecido pela Meta" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </label>
                <label className="space-y-2">
                  <span className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-400">WABA ID</span>
                  <input required inputMode="numeric" autoComplete="off" value={wabaId} onChange={(event) => setWabaId(event.target.value.replace(/\D/g, ''))} placeholder="ID da conta WhatsApp" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </label>
              </div>

              {status === 'ERROR' && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600 dark:bg-rose-950/30 dark:text-rose-300" role="alert">{error}</p>}

              <button type="submit" className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#1877F2] py-4 font-black text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-[#166FE5] focus:outline-none focus:ring-4 focus:ring-blue-200 dark:shadow-none"><KeyRound size={19} /> Validar e conectar</button>
              <p className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400"><ShieldCheck size={14} /> Token permanente somente no servidor</p>
            </form>
          )}

          {status === 'CONNECTING' && (
            <div className="flex min-h-72 flex-col items-center justify-center gap-5 text-center" aria-live="polite">
              <div className="rounded-full bg-blue-50 p-6 text-blue-600 dark:bg-blue-950/40"><Loader2 className="animate-spin" size={42} /></div>
              <div><h3 className="font-black text-slate-900 dark:text-white">Validando o número oficial</h3><p className="mt-1 text-sm font-medium text-slate-500">Consultando os identificadores diretamente na Meta.</p></div>
            </div>
          )}

          {status === 'CONNECTED' && (
            <div className="flex min-h-72 flex-col items-center justify-center gap-5 text-center" aria-live="polite">
              <div className="rounded-full bg-emerald-500 p-5 text-white shadow-xl shadow-emerald-200 dark:shadow-none"><CheckCircle2 size={52} /></div>
              <div><h3 className="text-2xl font-black text-slate-900 dark:text-white">Canal conectado</h3><p className="mt-2 max-w-sm text-sm font-medium text-slate-500">O número foi validado e está pronto para operar pela Meta Cloud API.</p></div>
              <button onClick={onClose} className="rounded-2xl bg-emerald-600 px-10 py-3 font-black text-white">Concluir</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
