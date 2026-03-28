'use client';

import React from 'react';
import { Edit2, Trash2, Shield, Phone, Mail } from 'lucide-react';

export const UserTable = ({ items, onEdit, onDelete }: any) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-50 bg-slate-50/50">
            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Usuário</th>
            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Perfil / Role</th>
            <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Canais Atribuídos</th>
            <th className="px-6 py-4 text-right px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {items.map((user: any) => (
            <tr key={user.id} className="group hover:bg-slate-50/50 transition-all">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-sm border border-slate-200">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800">{user.name}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Mail size={12} className="opacity-60" /> {user.email}
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className={(`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest ${
                  user.role === 'ADMIN' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                  user.role === 'SUPERVISOR' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                  'bg-slate-50 text-slate-500 border border-slate-200'
                }`)}>
                  <Shield size={12} />
                  {user.role}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {user.userChannels?.length > 0 ? (
                    user.userChannels.map((uc: any) => (
                      <span key={uc.channelId} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] font-bold uppercase flex items-center gap-1 border border-blue-100">
                        <Phone size={10} /> {uc.channel.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Nenhum canal vinculado</span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => onEdit(user)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => onDelete(user.id, user.email)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
