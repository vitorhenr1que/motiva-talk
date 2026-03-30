'use client';

import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Phone, User, Calendar, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: any[]) => twMerge(clsx(inputs));

interface FeedbackListProps {
  feedbacks: any[];
}

export function FeedbackList({ feedbacks }: FeedbackListProps) {
  if (feedbacks.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-20 text-center space-y-4">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
          <MessageSquare size={32} />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-800 tracking-tight">Nenhum feedback encontrado</h3>
          <p className="text-slate-500 font-medium">Não existem avaliações submetidas para o período ou filtros selecionados.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedbacks.map((f) => {
        const score = f.score || 0;
        const range = score <= 6 ? 'detractor' : score <= 8 ? 'neutral' : 'promoter';

        return (
          <div key={f.id} className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
            <div className="flex flex-col md:flex-row">
              {/* Score Column */}
              <div className={cn(
                "w-full md:w-24 flex items-center justify-center text-3xl font-black text-white py-6 md:py-0",
                range === 'detractor' ? "bg-red-500" : range === 'neutral' ? "bg-amber-500" : "bg-emerald-500"
              )}>
                {score}
              </div>

              {/* Content Area */}
              <div className="flex-1 p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-800">
                      <User size={16} className="text-indigo-600" />
                      <span className="font-black tracking-tight">{f.contact?.name || 'Cliente'}</span>
                      <span className="text-slate-300 mx-1">•</span>
                      <Phone size={16} className="text-slate-400" />
                      <span className="text-sm font-bold text-slate-500">{f.contactPhone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <Calendar size={12} />
                      {format(new Date(f.submittedAt), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                      <span className="text-slate-200 mx-1">•</span>
                      <span>Atendente: {f.agentName || f.conversation?.agent?.name || 'Sistema'}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {f.categoryOptions?.map((opt: string) => (
                      <span key={opt} className="px-2.5 py-1 bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-600 rounded-full border border-slate-200">
                        {opt}
                      </span>
                    ))}
                  </div>
                </div>

                {f.comment && (
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-dashed border-slate-200 text-slate-600 text-sm leading-relaxed relative">
                    <div className="absolute -top-3 left-3 bg-white px-2 text-[10px] font-black uppercase tracking-widest text-slate-400 border border-slate-100 rounded-full">
                       Comentário
                    </div>
                    "{f.comment}"
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  {f.conversationId && (
                    <a 
                      href={`/inbox?conversationId=${f.conversationId}`}
                      className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100 shadow-sm"
                    >
                      Ver Conversa
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
