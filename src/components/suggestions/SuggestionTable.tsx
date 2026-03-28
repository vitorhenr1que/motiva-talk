'use client';

import React from 'react';
import { Edit2, Trash2, Power, Globe, MessageSquare, Tag } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SuggestionTableProps {
  items: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, current: boolean) => void;
}

export const SuggestionTable = ({ items, onEdit, onDelete, onToggle }: SuggestionTableProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-50 bg-slate-50/50">
            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Keyword / Resposta</th>
            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Gatilhos</th>
            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Categoria</th>
            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Status</th>
            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {Array.isArray(items) && items.map((item) => (
            <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-800">{item.keyword}</span>
                    {item.channel ? (
                      <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100 uppercase">
                        <MessageSquare size={10} /> {item.channel.name}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md border border-slate-200 uppercase">
                        <Globe size={10} /> Global
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1 italic">"{item.response}"</p>
                </div>
              </td>
              <td className="px-6 py-4 text-center">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 border border-slate-200 shadow-sm">
                  {item.triggers.length}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <Tag size={12} className="opacity-40" />
                  {item.category}
                </span>
              </td>
              <td className="px-6 py-4 text-center">
                <button 
                  onClick={() => onToggle(item.id, item.isActive)}
                  className={cn(
                    "relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none ring-2 ring-transparent ring-offset-2",
                    item.isActive ? "bg-green-500" : "bg-slate-200"
                  )}
                >
                  <span className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    item.isActive ? "translate-x-5" : "translate-x-1"
                  )} />
                </button>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => onEdit(item)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => onDelete(item.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
