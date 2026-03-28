'use client';

import React from 'react';
import Link from 'next/link';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Sun, Moon, Type, Check, ArrowLeft } from 'lucide-react';

export default function AccessibilitySettingsPage() {
  const { theme, toggleTheme, fontSize, setFontSize } = useSettingsStore();

  const fontOptions = [
    { id: 'normal', label: 'Normal', scale: '100%', description: 'Tamanho padrão do sistema' },
    { id: 'large', label: 'Grande', scale: '112.5%', description: 'Recomendado para melhor leitura' },
    { id: 'extra-large', label: 'Extra Grande', scale: '125%', description: 'Visualização ampliada' },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 p-8">
      <Link href="/settings" className="inline-flex items-center gap-2 text-slate-400 hover:text-blue-600 font-bold text-xs uppercase tracking-widest transition-colors mb-2">
         <ArrowLeft size={16} />
         Voltar para Perfil
      </Link>
      
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">Acessibilidade</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">Personalize sua experiência visual no Motiva Talk.</p>
      </div>

      {/* Seção de Tema */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          {theme === 'dark' ? <Moon size={20} className="text-blue-400" /> : <Sun size={20} className="text-amber-500" />}
          Aparência do CRM
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => theme === 'dark' && toggleTheme()}
            className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${
              theme === 'light' 
                ? 'border-blue-600 bg-blue-50/50' 
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-white shadow-sm text-amber-500">
                <Sun size={24} />
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-900">Modo Claro</p>
                <p className="text-xs text-slate-500">Ideal para ambientes iluminados</p>
              </div>
            </div>
            {theme === 'light' && <Check className="text-blue-600" size={20} />}
          </button>

          <button
            onClick={() => theme === 'light' && toggleTheme()}
            className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${
              theme === 'dark' 
                ? 'border-blue-600 bg-blue-900/20' 
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-slate-800 shadow-sm text-blue-400">
                <Moon size={24} />
              </div>
              <div className="text-left">
                <p className="font-bold dark:text-white">Modo Escuro</p>
                <p className="text-xs text-slate-400">Melhor para descanso visual</p>
              </div>
            </div>
            {theme === 'dark' && <Check className="text-blue-400" size={20} />}
          </button>
        </div>
      </div>

      {/* Seção de Tamanho de Fonte */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <Type size={20} className="text-blue-500" />
          Escala de Visualização
        </h2>

        <div className="space-y-3">
          {fontOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFontSize(opt.id as any)}
              className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${
                fontSize === opt.id 
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/20' 
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                  {opt.id === 'normal' ? 'Aa' : opt.id === 'large' ? 'AA' : 'AAA'}
                </div>
                <div className="text-left">
                  <p className="font-bold text-slate-900 dark:text-white">{opt.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{opt.description}</p>
                </div>
              </div>
              {fontSize === opt.id && <Check className="text-blue-600 dark:text-blue-400" size={20} />}
            </button>
          ))}
        </div>

        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Exemplo de Leitura</p>
          <p className="text-sm dark:text-slate-300">
            A rápida raposa marrom pula sobre o cão preguiçoso. Este texto ajuda você a visualizar como as fontes e cores se comportam na interface do Motiva Talk.
          </p>
        </div>
      </div>
    </div>
  );
}
