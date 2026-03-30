'use client';

import React from 'react';
import { Star, TrendingUp, UserCheck, MessageSquare, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: any[]) => twMerge(clsx(inputs));

interface FeedbackStatsProps {
  summary: {
    total: number;
    average: number;
    counts: {
      detractor: number;
      neutral: number;
      promoter: number;
    }
  }
}

export function FeedbackStats({ summary }: FeedbackStatsProps) {
  const { total, average, counts } = summary;

  const stats = [
    {
      label: 'Nativa (Média)',
      value: average.toFixed(1),
      icon: Star,
      color: average >= 9 ? 'text-emerald-600 bg-emerald-50' : 
             average >= 7 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50',
    },
    {
      label: 'Total de Avaliações',
      value: total,
      icon: MessageSquare,
      color: 'text-indigo-600 bg-indigo-50',
    },
    {
      label: 'Promotores (9-10)',
      value: counts.promoter,
      subValue: total > 0 ? `${((counts.promoter / total) * 100).toFixed(0)}%` : '0%',
      icon: TrendingUp,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Detratores (0-6)',
      value: counts.detractor,
      subValue: total > 0 ? `${((counts.detractor / total) * 100).toFixed(0)}%` : '0%',
      icon: AlertCircle,
      color: 'text-red-600 bg-red-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, i) => (
        <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800 tracking-tight">{stat.value}</span>
              {stat.subValue && <span className="text-xs font-bold text-slate-400">{stat.subValue}</span>}
            </div>
          </div>
          <div className={cn("p-3 rounded-xl", stat.color)}>
            <stat.icon size={20} />
          </div>
        </div>
      ))}
    </div>
  );
}
