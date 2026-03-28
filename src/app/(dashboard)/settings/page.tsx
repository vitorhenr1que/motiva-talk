'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, Bell, User as UserIcon, Key, Globe, Check, Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>('AGENT');
  const [profileName, setProfileName] = useState('');
  const [chatSettings, setChatSettings] = useState({
    autoIdentifyAgent: true,
    allowAgentNameEdit: false
  });

  const fetchData = async () => {
    setLoading(true);
    try {
       const { data: { session } } = await supabase.auth.getSession();
       if (!session?.user) return;
       
       setUser(session.user);
       setProfileName(session.user.user_metadata?.full_name || '');
         
       // 1. Fetch current user profile and role from dedicated API
       const profileRes = await fetch(`/api/users/${session.user.id}`);
       if (profileRes.ok) {
         const profileData = await profileRes.json();
         if (profileData.success) {
           setRole(profileData.data.role);
           console.log('[SETTINGS] Autenticado como:', profileData.data.role);
         }
       }

       // 2. Fetch global chat settings
       const settingsRes = await fetch('/api/settings/chat');
       const settingsData = await settingsRes.json();
       if (settingsData.success) {
         setChatSettings(settingsData.data);
       }
    } catch (e) {
      console.error('[SETTINGS] Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const resp = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileName })
      });
      if (resp.ok) {
        alert('Perfil atualizado!');
      } else {
        const error = await resp.json();
        alert(error.error || 'Erro ao atualizar. Verifique se a edição está permitida.');
      }
    } catch (e) {
      alert('Erro na conexão');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGlobalSettings = async () => {
    setSaving(true);
    try {
      const resp = await fetch('/api/settings/chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatSettings)
      });
      if (resp.ok) {
        alert('Configurações globais salvas!');
      } else {
        alert('Apenas administradores podem alterar configurações globais.');
      }
    } catch (e) {
      alert('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const navItems = [
    { label: 'Perfil', icon: <UserIcon size={18} />, href: '/settings' },
    { label: 'Acessibilidade', icon: <Globe size={18} />, href: '/settings/accessibility' },
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

  // Se for admin, mostra as seções globais
  const isAdmin = role === 'ADMIN';

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-top-4 duration-500 pb-20">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          Configurações
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">Personalize seu perfil e as regras do sistema.</p>
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
           {/* Seção de Perfil Pessoal */}
           <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xl ring-1 ring-slate-900/5">
              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight mb-6">Informações Pessoais</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nome Completo</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        disabled={!isAdmin && !chatSettings.allowAgentNameEdit}
                        className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 px-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="Nome como aparecerá no chat"
                      />
                      {!isAdmin && !chatSettings.allowAgentNameEdit && (
                        <div className="mt-1 text-[10px] text-amber-600 font-bold ml-1">
                          🔒 Edição bloqueada pelo administrador.
                        </div>
                      )}
                    </div>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">E-mail</label>
                    <input 
                       type="email" 
                       disabled
                       value={user?.email || ''} 
                       className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 px-4 text-sm font-bold text-slate-400 outline-none cursor-not-allowed font-mono opacity-60"
                    />
                 </div>
              </div>
              
              {(isAdmin || chatSettings.allowAgentNameEdit) && (
                <div className="mt-8 flex justify-end">
                   <button 
                     onClick={handleUpdateProfile}
                     disabled={saving}
                     className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-lg hover:shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                   >
                      {saving ? 'Salvando...' : 'Salvar Perfil'}
                   </button>
                </div>
              )}
           </section>

           {/* Seção Administrativa de Chat */}
           {isAdmin && (
             <section className="bg-white rounded-3xl border border-blue-100 p-8 shadow-xl ring-1 ring-blue-500/5 border-t-4 border-t-blue-600 animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center gap-3 mb-6">
                   <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                      <MessageSquare size={24} />
                   </div>
                   <div>
                      <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Regras de Atendimento</h2>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Visível apenas para Administradores</p>
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="flex items-center justify-between group p-4 rounded-2xl border border-slate-50 hover:border-slate-100 hover:bg-slate-50/50 transition-all">
                      <div className="flex-1 pr-10">
                         <h3 className="font-bold text-slate-800">Identificação Automática do Atendente</h3>
                         <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                            Obriga a inclusão do nome do atendente no padrão <b>*NOME:*</b> no topo de cada mensagem.
                         </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                         <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={chatSettings.autoIdentifyAgent}
                            onChange={(e) => setChatSettings({...chatSettings, autoIdentifyAgent: e.target.checked})}
                         />
                         <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
                      </label>
                   </div>

                   <div className="flex items-center justify-between group p-4 rounded-2xl border border-slate-50 hover:border-slate-100 hover:bg-slate-50/50 transition-all">
                      <div className="flex-1 pr-10">
                         <h3 className="font-bold text-slate-800">Permitir Edição do Nome</h3>
                         <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                            Permite que os atendentes (cargo AGENT) editem seu próprio nome de exibição.
                         </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                         <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={chatSettings.allowAgentNameEdit}
                            onChange={(e) => setChatSettings({...chatSettings, allowAgentNameEdit: e.target.checked})}
                         />
                         <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
                      </label>
                   </div>
                </div>

                <div className="mt-8 flex justify-end">
                   <button 
                     onClick={handleSaveGlobalSettings}
                     disabled={saving}
                     className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-200 hover:shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                   >
                      {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                      Salvar Regras de Chat
                   </button>
                </div>
             </section>
           )}
        </div>
      </div>
    </div>
  );
}
