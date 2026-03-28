'use client';

import React from 'react';
import { Users, Search, Download, UserPlus, MoreHorizontal } from 'lucide-react';

export default function ContactsPage() {
  const contacts = [
    { id: 1, name: 'João Silva', phone: '+55 11 99999-9999', tags: ['Inscrito', 'Medicina'] },
    { id: 2, name: 'Maria Souza', phone: '+55 11 88888-8888', tags: ['Interessado', 'Direito'] },
    { id: 3, name: 'Pedro Santos', phone: '+55 11 77777-7777', tags: ['Aluno', 'Engenharia'] },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
             Contatos
             <span className="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-xs align-middle">842</span>
          </h1>
          <p className="mt-2 text-slate-500 font-medium italic">Base de leads e alunos engajados no atendimento.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
            <Download size={18} />
            Exportar
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 font-bold text-white shadow-lg hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95">
            <UserPlus size={18} />
            Novo Contato
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm ring-1 ring-slate-900/5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            className="w-full rounded-xl border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 select-none">
              <th className="px-6 py-4">Nome</th>
              <th className="px-6 py-4">Telefone</th>
              <th className="px-6 py-4">Etiquetas</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contacts.map((contact) => (
              <tr key={contact.id} className="group hover:bg-slate-50/80 transition-colors cursor-pointer">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 uppercase group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                      {contact.name[0]}
                    </div>
                    <span className="text-sm font-bold text-slate-800">{contact.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-mono text-xs text-slate-600">{contact.phone}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-1.5 flex-wrap">
                    {contact.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                   <button className="text-slate-300 hover:text-slate-600 transition-colors">
                     <MoreHorizontal size={20} />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
