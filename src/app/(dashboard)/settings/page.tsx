'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, Bell, User, Key, Globe } from 'lucide-react';

export default function SettingsPage() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Perfil', icon: <User size={18} />, href: '/settings' },
    { label: 'Acessibilidade', icon: <Globe size={18} />, href: '/settings/accessibility' },
    { label: 'Notificações', icon: <Bell size={18} />, href: '/settings/notifications' },
    { label: 'Segurança', icon: <Shield size={18} />, href: '/settings/security' },
    { label: 'API', icon: <Key size={18} />, href: '/settings/api' },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          Configurações
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">Personalize sua experiência no Motiva Talk.</p>
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
              <h2 className="text-xl font-extrabold text-slate-800 tracking-tight mb-6">Informações Pessoais</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nome Completo</label>
                    <input 
                       type="text" 
                       defaultValue="Atendente João" 
                       className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 px-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">E-mail</label>
                    <input 
                       type="email" 
                       defaultValue="joao@faculdade.edu.br" 
                       className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 px-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                    />
                 </div>
              </div>
              <div className="mt-8 flex justify-end">
                 <button className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-lg hover:shadow-2xl transition-all hover:scale-105 active:scale-95">
                    Salvar Alterações
                 </button>
              </div>
           </section>
        </div>
      </div>
    </div>
  );
}
