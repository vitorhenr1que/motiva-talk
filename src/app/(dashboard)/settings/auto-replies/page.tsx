'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Shield, Bell, User as UserIcon, Key, Globe, 
  Loader2, Bot, Save, CheckCircle2 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AutoRepliesSettingsPage() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [settings, setSettings] = useState({
    enabled: false,
    message: '',
    cooldownHours: 24
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/settings/auto-replies');
      const data = await resp.json();
      if (data.success) {
        setChannels(data.data);
        if (data.data.length > 0) {
          setSelectedChannelId(data.data[0].id);
          setSettings(data.data[0].autoReply);
        }
      }
    } catch (e) {
      console.error('[AUTO-REPLY] Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedChannelId) {
      const channel = channels.find(c => c.id === selectedChannelId);
      if (channel) {
        setSettings(channel.autoReply);
      }
    }
  }, [selectedChannelId, channels]);


  const handleSave = async (overrides?: any) => {
    if (!selectedChannelId) return;
    const dataToSave = overrides || settings;
    setSaving(true);
    try {
      const resp = await fetch(`/api/settings/auto-replies/${selectedChannelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      });
      
      if (resp.ok) {
        // Update local state
        setChannels(prev => prev.map(c => 
          c.id === selectedChannelId ? { ...c, autoReply: dataToSave } : c
        ));
        // Optional: show a small toast or just let it be silent for auto-save
        if (!overrides) alert('Configurações de resposta automática salvas!');
      } else {
        const err = await resp.json();
        alert(err.error || 'Erro ao salvar configurações.');
      }
    } catch (e) {
      alert('Erro na conexão ao salvar.');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-slate-400">
        <Loader2 className="animate-spin" />
        <span className="text-sm font-medium tracking-tight">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-top-4 duration-500 pb-20">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          Configurações
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">Configure respostas automáticas para seus canais de atendimento.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                pathname === item.href
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="md:col-span-3 space-y-8">
          <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xl ring-1 ring-slate-900/5">
            <div className="flex items-center gap-3 mb-8">
               <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <Bot size={24} />
               </div>
               <div>
                  <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Mensagens Automáticas</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Resposta automática por canal</p>
               </div>
            </div>

            <div className="space-y-8">
               {/* Seleção de Canal */}
               <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Selecione o Canal</label>
                  <select 
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    className="w-full rounded-xl border-slate-200 bg-slate-50 py-3 px-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  >
                    {channels.map(channel => (
                      <option key={channel.id} value={channel.id}>
                        {channel.name} ({channel.phoneNumber || 'Sem número'})
                      </option>
                    ))}
                    {channels.length === 0 && <option disabled>Nenhum canal disponível</option>}
                  </select>
               </div>

               {channels.length > 0 ? (
                 <>
                  {/* Switch Ativar */}
                  <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition-all">
                      <div>
                        <h3 className="font-bold text-slate-800">Ativar mensagem automática</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Habilita a resposta instantânea quando o cliente enviar uma mensagem.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={settings.enabled}
                          onChange={(e) => {
                            const val = e.target.checked;
                            const newSettings = { ...settings, enabled: val };
                            setSettings(newSettings);
                            handleSave(newSettings);
                          }}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
                      </label>
                  </div>

                  {/* Mensagem */}
                  <div className="space-y-2">
                      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Mensagem Automática</label>
                      <textarea
                        value={settings.message}
                        onChange={(e) => setSettings({ ...settings, message: e.target.value })}
                        disabled={!settings.enabled}
                        className="w-full rounded-2xl border-slate-200 bg-slate-50 py-4 px-4 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[150px] disabled:opacity-50"
                        placeholder="Olá! Seja bem-vindo(a). Em instantes um atendente irá falar com você."
                      />
                      <div className="flex items-start gap-2 mt-2 px-1">
                        <Bot size={14} className="text-blue-500 mt-0.5" />
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">
                          Esta mensagem será enviada automaticamente apenas na primeira interação do cliente ou após o período de cooldown configurado.
                        </p>
                      </div>
                  </div>

                  {/* Cooldown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                    <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Reenviar após (Horas)</label>
                        <input 
                          type="number"
                          value={settings.cooldownHours}
                          onChange={(e) => setSettings({ ...settings, cooldownHours: parseInt(e.target.value) || 0 })}
                          disabled={!settings.enabled}
                          className="w-full rounded-xl border-slate-200 bg-slate-50 py-3 px-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-50"
                          min="0"
                        />
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mt-4 sm:mt-0">
                        <p className="text-[11px] text-amber-700 font-bold leading-relaxed">
                          ⚠️ O cooldown evita que o sistema envie a mesma mensagem repetidamente em cada interação. O padrão é 24 horas.
                        </p>
                    </div>
                  </div>

                  {/* Botão Salvar */}
                  <div className="pt-6 flex justify-end">
                    <button
                      onClick={() => handleSave()}
                      disabled={saving || !selectedChannelId}
                      className="flex items-center gap-2 rounded-xl bg-slate-900 px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-2xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      Salvar Configurações
                    </button>
                  </div>
                 </>
               ) : (
                 <div className="text-center py-10">
                   <p className="text-slate-500 font-medium">Você não possui canais vinculados ou não tem permissão para configurá-los.</p>
                 </div>
               )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
