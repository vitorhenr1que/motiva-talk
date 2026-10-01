'use client';

import Image from 'next/image';
import { Camera, Loader2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { validateProfilePhoto } from '@/lib/whatsapp-profile-photo';

type Props = { channelId: string; disabled: boolean; onBusyChange: (busy: boolean) => void };

export function ChannelProfilePhoto({ channelId, disabled, onBusyChange }: Props) {
  const inputId = useId();
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ file: File; url: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/channels/${channelId}/profile-photo`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Não foi possível carregar a foto atual.');
        setCurrentUrl(data.data.profilePictureUrl);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Não foi possível carregar a foto atual.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [channelId]);

  const previewUrl = selected?.url;
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function save() {
    if (!selected || saving) return;
    setSaving(true);
    onBusyChange(true);
    setError('');
    setSuccess(false);
    try {
      const form = new FormData();
      form.append('file', selected.file);
      const response = await fetch(`/api/channels/${channelId}/profile-photo`, { method: 'POST', body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || 'Não foi possível atualizar a foto. Tente novamente.');
      setSuccess(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível atualizar a foto.');
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  const imageUrl = previewUrl || currentUrl;
  return (
    <section aria-label="Foto de perfil do WhatsApp" className="mb-5 rounded-3xl border border-slate-100 p-5 dark:border-slate-800">
      <h3 className="text-sm font-bold text-slate-800 dark:text-white">Foto de perfil do WhatsApp</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Esta foto aparece para seus clientes no WhatsApp.</p>
      <div className="mt-4 flex items-center gap-4">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
          {imageUrl ? <Image src={imageUrl} alt={selected ? 'Prévia da foto selecionada' : 'Foto atual do WhatsApp'} fill sizes="80px" unoptimized className="object-cover" /> : loading ? <Loader2 size={24} className="animate-spin" /> : <Camera size={28} />}
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">Selecionar nova foto</label>
          <input id={inputId} type="file" accept="image/jpeg,image/png" disabled={disabled || saving || loading} className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700 disabled:opacity-50 dark:file:bg-blue-900/30 dark:file:text-blue-300" onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            const validationError = validateProfilePhoto(file);
            setError(validationError || '');
            if (validationError) return;
            setSelected({ file, url: URL.createObjectURL(file) });
            setSuccess(false);
          }} />
          <p className="mt-2 text-xs text-slate-400">JPG ou PNG, até 4 MB. Prefira uma imagem quadrada.</p>
        </div>
      </div>
      {selected && <p className="mt-3 truncate text-xs text-slate-500">{selected.file.name}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      {success && <p role="status" className="mt-3 text-xs text-emerald-700 dark:text-emerald-400">Foto atualizada! O WhatsApp pode levar alguns instantes para exibir a alteração.</p>}
      <button type="button" onClick={save} disabled={!selected || disabled || saving || success} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
        {saving ? 'Atualizando foto…' : 'Salvar foto no WhatsApp'}
      </button>
    </section>
  );
}
