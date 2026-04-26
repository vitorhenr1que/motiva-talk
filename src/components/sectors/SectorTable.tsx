import React from 'react';
import { Edit2, Trash2, Users } from 'lucide-react';

interface SectorTableProps {
  items: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string, name: string) => void;
}

export function SectorTable({ items, onEdit, onDelete }: SectorTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-slate-500">
        <thead className="bg-slate-50 text-xs uppercase text-slate-700">
          <tr>
            <th className="px-6 py-4 font-bold text-slate-400">Setor</th>
            <th className="px-6 py-4 font-bold text-slate-400">Atendentes</th>
            <th className="px-6 py-4 font-bold text-slate-400">Criado em</th>
            <th className="px-6 py-4 font-bold text-slate-400 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-4">
                <div className="font-bold text-slate-800">{item.name}</div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                     {item.users?.slice(0, 3).map((u: any, idx: number) => (
                       <div key={idx} className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-xs font-bold text-blue-600" title={u.user?.name}>
                         {u.user?.name?.substring(0, 2).toUpperCase() || 'U'}
                       </div>
                     ))}
                     {item.users && item.users.length > 3 && (
                       <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs font-bold text-slate-600">
                         +{item.users.length - 3}
                       </div>
                     )}
                     {(!item.users || item.users.length === 0) && (
                       <span className="text-xs text-slate-400 font-medium">Nenhum</span>
                     )}
                  </div>
                  {item.users && item.users.length > 0 && (
                    <span className="text-xs text-slate-500 ml-2 font-medium">{item.users.length} usuário(s)</span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 text-xs font-medium text-slate-400">
                 {new Date(item.createdAt).toLocaleDateString('pt-BR')}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(item)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar Setor"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => onDelete(item.id, item.name)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remover Setor"
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
}
