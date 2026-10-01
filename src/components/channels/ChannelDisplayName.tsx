'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { Loader2, RefreshCw, Send } from 'lucide-react';
import { displayNameStatusLabel, validateWhatsAppDisplayName, type WhatsAppDisplayName } from '@/lib/whatsapp-display-name';

type Props = { channelId: string; disabled: boolean; onBusyChange: (busy: boolean) => void };

export function ChannelDisplayName({ channelId, disabled, onBusyChange }: Props) {
  const inputId = useId();
  const [profile, setProfile] = useState<WhatsAppDisplayName | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submittedName, setSubmittedName] = useState('');

  const refresh = useCallback(async (signal?: AbortSignal, initialize = false) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/channels/${channelId}/display-name`, { signal });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Não foi possível consultar o nome na Meta.');
      if (signal?.aborted) return;
      setProfile(data.data);
      if (initialize) setName(data.data.requestedName || data.data.verifiedName || '');
    } catch (error) {
      if (!signal?.aborted) setError(error instanceof Error ? error.message : 'Falha ao consultar a Meta.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal, true);
    return () => controller.abort();
  }, [refresh]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || disabled || loading) return;
    let displayName: string;
    try { displayName = validateWhatsAppDisplayName(name); } catch (error) {
      setError(error instanceof Error ? error.message : 'Nome inválido.');
      return;
    }
    setSaving(true);
    onBusyChange(true);
    setError('');
    try {
      const response = await fetch(`/api/channels/${channelId}/display-name`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || 'Não foi possível enviar a solicitação.');
      setSubmittedName(displayName);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Falha ao solicitar alteração.');
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  const unchanged = name.trim() === profile?.verifiedName;
  const alreadySubmitted = name.trim() === submittedName || (name.trim() === profile?.requestedName && profile?.requestedNameStatus === 'PENDING_REVIEW');
  return (
    <section aria-label="Nome de exibição do WhatsApp" className="mb-5 rounded-3xl border border-slate-100 p-5 dark:border-slate-800">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Nome de exibição do WhatsApp</h3>
        <button type="button" onClick={() => void refresh()} disabled={loading || saving || disabled} aria-label="Consultar status do nome na Meta" className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:hover:bg-blue-900/30">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">A Meta analisa o novo nome antes de aprovar a alteração. Use o nome da sua empresa ou marca.</p>
      {profile && <dl className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
        <div><dt className="inline font-semibold">Nome em uso: </dt><dd className="inline break-words">{profile.verifiedName || 'Não informado'}</dd></div>
        <div><dt className="inline font-semibold">Status do nome em uso: </dt><dd className="inline">{displayNameStatusLabel(profile.nameStatus)}</dd></div>
        {profile.requestedName && <div><dt className="inline font-semibold">Nome solicitado: </dt><dd className="inline break-words">{profile.requestedName}</dd></div>}
        {profile.requestedName && <div><dt className="inline font-semibold">Status da solicitação: </dt><dd className="inline">{displayNameStatusLabel(profile.requestedNameStatus)}</dd></div>}
      </dl>}
      <form onSubmit={submit} className="mt-4">
        <label htmlFor={inputId} className="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">Novo nome de exibição</label>
        <input id={inputId} value={name} onChange={(event) => setName(event.target.value)} maxLength={512} required disabled={saving || disabled || loading} autoComplete="organization" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
        {error && <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        {submittedName && <p role="status" className="mt-3 text-xs text-emerald-700 dark:text-emerald-400">Solicitação enviada para “{submittedName}”. Isso ainda não confirma a aprovação ou ativação. Consulte o status pelo botão acima; os dados da Meta podem levar algum tempo para atualizar.</p>}
        <button type="submit" disabled={saving || disabled || loading || !name.trim() || unchanged || alreadySubmitted} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}{saving ? 'Enviando solicitação…' : 'Solicitar alteração do nome'}
        </button>
      </form>
    </section>
  );
}
