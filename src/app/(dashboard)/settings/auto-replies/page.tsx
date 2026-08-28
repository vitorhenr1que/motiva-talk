'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell, Bot, CalendarDays, CheckCircle2, Clock3, Globe, Key,
  Loader2, MessageSquareText, Save, Shield, User as UserIcon,
} from 'lucide-react';
import {
  AutoReplySettings, BUSINESS_DAY_KEYS, BusinessDayKey,
  DEFAULT_AUTO_REPLY_SETTINGS, normalizeAutoReplySettings,
} from '@/types/auto-reply';

interface ChannelWithAutoReply {
  id: string;
  name: string;
  phoneNumber?: string | null;
  autoReply: AutoReplySettings;
}

const DAY_LABELS: Record<BusinessDayKey, string> = {
  monday: 'Segunda-feira', tuesday: 'Terça-feira', wednesday: 'Quarta-feira',
  thursday: 'Quinta-feira', friday: 'Sexta-feira', saturday: 'Sábado', sunday: 'Domingo',
};

function Toggle({ checked, onChange, label }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="relative inline-flex min-h-11 items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked}
        onChange={(event) => onChange(event.target.checked)} aria-label={label} />
      <span className="relative h-6 w-11 rounded-full bg-slate-200 shadow-inner transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-transform peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 peer-checked:bg-blue-600 peer-checked:after:translate-x-full dark:bg-slate-700" />
    </label>
  );
}

export default function AutoRepliesSettingsPage() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<ChannelWithAutoReply[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [settings, setSettings] = useState<AutoReplySettings>(() =>
    normalizeAutoReplySettings(DEFAULT_AUTO_REPLY_SETTINGS)
  );
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/settings/auto-replies');
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || payload.error || 'Não foi possível carregar as configurações.');
        }
        const loadedChannels = (payload.data || []).map((channel: ChannelWithAutoReply) => ({
          ...channel, autoReply: normalizeAutoReplySettings(channel.autoReply),
        }));
        setChannels(loadedChannels);
        if (loadedChannels.length > 0) {
          setSelectedChannelId(loadedChannels[0].id);
          setSettings(loadedChannels[0].autoReply);
        }
      } catch (error) {
        console.error('[AUTO-REPLY] Falha ao carregar dados:', error);
        setStatusMessage(error instanceof Error ? error.message : 'Erro ao carregar configurações.');
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  useEffect(() => {
    const channel = channels.find(({ id }) => id === selectedChannelId);
    if (channel) setSettings(normalizeAutoReplySettings(channel.autoReply));
  }, [selectedChannelId, channels]);

  const updateSettings = (patch: Partial<AutoReplySettings>) => {
    setSettings((current) => normalizeAutoReplySettings({ ...current, ...patch }));
    setStatusMessage('');
  };

  const updateDay = (day: BusinessDayKey, patch: Partial<AutoReplySettings['businessHours'][BusinessDayKey]>) => {
    setSettings((current) => ({
      ...current,
      businessHours: { ...current.businessHours, [day]: { ...current.businessHours[day], ...patch } },
    }));
    setStatusMessage('');
  };

  const handleSave = async () => {
    if (!selectedChannelId) return;
    setSaving(true);
    setStatusMessage('');
    try {
      const response = await fetch(`/api/settings/auto-replies/${selectedChannelId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || payload.message || 'Erro ao salvar configurações.');
      }
      const savedSettings = normalizeAutoReplySettings(payload.data);
      setSettings(savedSettings);
      setChannels((current) => current.map((channel) =>
        channel.id === selectedChannelId ? { ...channel, autoReply: savedSettings } : channel
      ));
      setStatusMessage('Configurações salvas com sucesso.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Erro na conexão ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const navItems = [
    { label: 'Perfil', icon: <UserIcon size={18} />, href: '/settings' },
    { label: 'Acessibilidade', icon: <Globe size={18} />, href: '/settings/accessibility' },
    { label: 'Mensagens Automáticas', icon: <Bot size={18} />, href: '/settings/auto-replies' },
    { label: 'Notificações', icon: <Bell size={18} />, href: '/settings/notifications' },
    { label: 'Segurança', icon: <Shield size={18} />, href: '/settings/security' },
    { label: 'API', icon: <Key size={18} />, href: '/settings/api' },
  ];

  if (loading) return (
    <div className="flex h-full items-center justify-center gap-3 text-slate-400">
      <Loader2 className="animate-spin" />
      <span className="text-sm font-medium tracking-tight">Carregando configurações...</span>
    </div>
  );

  const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
  const labelClass = 'ml-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400';

  return (
    <main className="mx-auto max-w-6xl space-y-10 p-5 pb-24 md:p-8">
      <header className="border-b border-slate-200 pb-6 dark:border-slate-800">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Configurações</h1>
        <p className="mt-2 font-medium text-slate-500 dark:text-slate-400">
          Defina qual resposta automática cada canal envia em dias, horários e recessos.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="space-y-1" aria-label="Configurações">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${pathname === item.href ? 'bg-blue-600 text-white shadow-lg shadow-blue-200/70 dark:shadow-none' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
              {item.icon}{item.label}
            </Link>
          ))}
        </nav>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40 ring-1 ring-slate-900/5 dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
          <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50 via-white to-indigo-50 p-6 dark:border-slate-800 dark:from-blue-950/30 dark:via-slate-950 dark:to-indigo-950/30 md:p-8">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-600 p-3 text-white shadow-lg shadow-blue-200 dark:shadow-none"><Bot size={24} /></div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-800 dark:text-white">Mensagens automáticas</h2>
                <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-slate-400">Recesso → fora do horário → mensagem padrão</p>
              </div>
            </div>
          </div>

          <div className="space-y-8 p-6 md:p-8">
            <div className="space-y-2">
              <label htmlFor="channel" className={labelClass}>Canal</label>
              <select id="channel" value={selectedChannelId} onChange={(event) => setSelectedChannelId(event.target.value)} className={inputClass}>
                {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name} ({channel.phoneNumber || 'Sem número'})</option>)}
                {channels.length === 0 && <option>Nenhum canal disponível</option>}
              </select>
            </div>

            {channels.length === 0 ? (
              <p className="py-10 text-center font-medium text-slate-500">Você não possui canais vinculados ou não tem permissão para configurá-los.</p>
            ) : <>
              <section className="space-y-5 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold text-slate-800 dark:text-white">Mensagem padrão</h3>
                    <p className="mt-1 text-xs text-slate-500">Continua sendo usada quando nenhuma regra especial se aplica.</p>
                  </div>
                  <Toggle checked={settings.enabled} onChange={(enabled) => updateSettings({ enabled })} label="Ativar mensagem automática" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="standard-message" className={labelClass}>Mensagem padrão</label>
                  <textarea id="standard-message" value={settings.message} onChange={(event) => updateSettings({ message: event.target.value })}
                    disabled={!settings.enabled} className={`${inputClass} min-h-32 resize-y font-medium`}
                    placeholder="Olá! Seja bem-vindo(a). Em instantes um atendente irá falar com você." />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="cooldown" className={labelClass}>Reenviar após (horas)</label>
                    <input id="cooldown" type="number" min="0" step="1" value={settings.cooldownHours}
                      onChange={(event) => updateSettings({ cooldownHours: Number(event.target.value) })} disabled={!settings.enabled} className={inputClass} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="timezone" className={labelClass}>Timezone do atendimento</label>
                    <input id="timezone" list="timezone-options" value={settings.timezone}
                      onChange={(event) => updateSettings({ timezone: event.target.value })} disabled={!settings.enabled}
                      className={inputClass} placeholder="America/Sao_Paulo" />
                    <datalist id="timezone-options">
                      {['America/Sao_Paulo', 'America/Bahia', 'America/Fortaleza', 'America/Manaus', 'America/Belem', 'America/Recife'].map((zone) => <option key={zone} value={zone} />)}
                    </datalist>
                  </div>
                </div>
              </section>

              <section className="space-y-5 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex gap-3"><Clock3 className="mt-0.5 text-blue-600" size={20} /><div>
                    <h3 className="font-extrabold text-slate-800 dark:text-white">Horários de atendimento</h3>
                    <p className="mt-1 text-xs text-slate-500">Configure cada dia de forma independente.</p>
                  </div></div>
                  <Toggle checked={settings.scheduleEnabled} onChange={(scheduleEnabled) => updateSettings({ scheduleEnabled })} label="Ativar controle de horários" />
                </div>
                <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                  <table className="w-full min-w-[620px] text-left">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:bg-slate-900"><tr>
                      <th className="px-4 py-3">Dia</th><th className="px-4 py-3">Atendimento</th><th className="px-4 py-3">Início</th><th className="px-4 py-3">Término</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {BUSINESS_DAY_KEYS.map((day) => {
                        const schedule = settings.businessHours[day];
                        return <tr key={day} className="text-sm">
                          <th className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">{DAY_LABELS[day]}</th>
                          <td className="px-4 py-2"><Toggle checked={schedule.enabled} onChange={(enabled) => updateDay(day, { enabled })} label={`Atendimento em ${DAY_LABELS[day]}`} /></td>
                          <td className="px-4 py-2"><input type="time" value={schedule.start} onChange={(event) => updateDay(day, { start: event.target.value })}
                            disabled={!settings.scheduleEnabled || !schedule.enabled} aria-label={`Início em ${DAY_LABELS[day]}`} className={`${inputClass} py-2`} /></td>
                          <td className="px-4 py-2"><input type="time" value={schedule.end} onChange={(event) => updateDay(day, { end: event.target.value })}
                            disabled={!settings.scheduleEnabled || !schedule.enabled} aria-label={`Término em ${DAY_LABELS[day]}`} className={`${inputClass} py-2`} /></td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="space-y-5 rounded-2xl border border-amber-200 bg-amber-50/40 p-5 dark:border-amber-900/60 dark:bg-amber-950/10">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex gap-3"><MessageSquareText className="mt-0.5 text-amber-600" size={20} /><div>
                    <h3 className="font-extrabold text-slate-800 dark:text-white">Fora do horário</h3>
                    <p className="mt-1 text-xs text-slate-500">Usada em dias desativados e antes ou depois do expediente.</p>
                  </div></div>
                  <Toggle checked={settings.outsideHoursEnabled} onChange={(outsideHoursEnabled) => updateSettings({ outsideHoursEnabled })} label="Ativar mensagem fora do horário" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="outside-message" className={labelClass}>Mensagem fora do horário</label>
                  <textarea id="outside-message" value={settings.outsideHoursMessage} onChange={(event) => updateSettings({ outsideHoursMessage: event.target.value })}
                    disabled={!settings.outsideHoursEnabled} className={`${inputClass} min-h-28 resize-y font-medium`}
                    placeholder="Recebemos sua mensagem. Nosso atendimento está fechado neste momento." />
                </div>
              </section>

              <section className="space-y-5 rounded-2xl border border-violet-200 bg-violet-50/40 p-5 dark:border-violet-900/60 dark:bg-violet-950/10">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex gap-3"><CalendarDays className="mt-0.5 text-violet-600" size={20} /><div>
                    <h3 className="font-extrabold text-slate-800 dark:text-white">Período de recesso</h3>
                    <p className="mt-1 text-xs text-slate-500">As duas datas são inclusivas e o recesso tem prioridade máxima.</p>
                  </div></div>
                  <Toggle checked={settings.recessEnabled} onChange={(recessEnabled) => updateSettings({ recessEnabled })} label="Ativar período de recesso" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><label htmlFor="recess-start" className={labelClass}>Data inicial</label>
                    <input id="recess-start" type="date" value={settings.recessStart || ''} onChange={(event) => updateSettings({ recessStart: event.target.value || null })}
                      disabled={!settings.recessEnabled} className={inputClass} /></div>
                  <div className="space-y-2"><label htmlFor="recess-end" className={labelClass}>Data final</label>
                    <input id="recess-end" type="date" min={settings.recessStart || undefined} value={settings.recessEnd || ''} onChange={(event) => updateSettings({ recessEnd: event.target.value || null })}
                      disabled={!settings.recessEnabled} className={inputClass} /></div>
                </div>
                <div className="space-y-2"><label htmlFor="recess-message" className={labelClass}>Mensagem durante o recesso</label>
                  <textarea id="recess-message" value={settings.recessMessage} onChange={(event) => updateSettings({ recessMessage: event.target.value })}
                    disabled={!settings.recessEnabled} className={`${inputClass} min-h-28 resize-y font-medium`} placeholder="Estamos em recesso e retornaremos em breve." /></div>
              </section>

              <div className="flex flex-col items-stretch justify-between gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center dark:border-slate-800">
                <p role="status" aria-live="polite" className={`flex min-h-6 items-center gap-2 text-sm font-semibold ${statusMessage.includes('sucesso') ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {statusMessage.includes('sucesso') && <CheckCircle2 size={17} />}{statusMessage}
                </p>
                <button type="button" onClick={handleSave} disabled={saving || !selectedChannelId}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-8 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}Salvar configurações
                </button>
              </div>
            </>}
          </div>
        </section>
      </div>
    </main>
  );
}
