'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface PlatformOrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  createdAt: string;
  trialEndsAt: string | null;
  blockedReason: string | null;
  maxChannels: number | null;
  maxUsers: number | null;
  maxMsgPerMonth: number | null;
  usage: {
    channelCount: number;
    userCount: number;
    pendingInvitesCount: number;
    monthlyMessageCount: number;
  };
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  TRIAL: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  SUSPENDED: 'bg-red-500/20 text-red-300 border-red-500/40',
  CANCELED: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
};

function formatLimit(used: number, max: number | null) {
  if (max === null) return `${used} / ∞`;
  const overflow = used >= max;
  return (
    <span className={overflow ? 'text-red-400 font-bold' : ''}>
      {used} / {max}
    </span>
  );
}

export default function PlatformOrganizationsPage() {
  const [orgs, setOrgs] = useState<PlatformOrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/platform/organizations', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Erro ao carregar');
      setOrgs(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizações</h1>
          <p className="text-sm text-slate-400">
            Gestão centralizada de tenants, planos e limites do SaaS.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium hover:bg-slate-700"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <ShieldAlert size={16} />
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Nome / Slug</th>
              <th className="px-4 py-3 text-left">Plano</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Criada em</th>
              <th className="px-4 py-3 text-left">Usuários</th>
              <th className="px-4 py-3 text-left">Canais</th>
              <th className="px-4 py-3 text-left">Mensagens (mês)</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {loading && orgs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && orgs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma organização cadastrada.
                </td>
              </tr>
            )}
            {orgs.map((o) => {
              const usersTotal = o.usage.userCount + o.usage.pendingInvitesCount;
              return (
                <tr key={o.id} className="hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-100">{o.name}</div>
                    <div className="font-mono text-xs text-slate-400">{o.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-slate-700 px-2 py-0.5 text-xs font-mono uppercase">
                      {o.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded border px-2 py-0.5 text-xs font-bold uppercase ${
                        STATUS_STYLES[o.status] || STATUS_STYLES.CANCELED
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    {formatLimit(usersTotal, o.maxUsers)}
                    {o.usage.pendingInvitesCount > 0 && (
                      <span className="ml-1 text-xs text-slate-400">
                        ({o.usage.pendingInvitesCount} pend.)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{formatLimit(o.usage.channelCount, o.maxChannels)}</td>
                  <td className="px-4 py-3">
                    {formatLimit(o.usage.monthlyMessageCount, o.maxMsgPerMonth)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/platform/${o.id}`}
                      className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-amber-400"
                    >
                      Gerenciar
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
