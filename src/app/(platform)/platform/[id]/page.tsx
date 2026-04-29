'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Pause, Play, AlertTriangle, ShieldAlert } from 'lucide-react';

interface PlatformOrgDetail {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'CANCELED';
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

function intInputToValue(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
  return n;
}

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className={destructive ? 'text-red-400' : 'text-amber-400'} size={22} />
          <h2 className={`text-lg font-bold ${destructive ? 'text-red-300' : 'text-amber-300'}`}>
            {title}
          </h2>
        </div>
        <div className="mb-6 text-sm text-slate-300">{description}</div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${
              destructive
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-amber-500 text-slate-900 hover:bg-amber-400'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlatformOrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [org, setOrg] = useState<PlatformOrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Form fields
  const [plan, setPlan] = useState('FREE');
  const [maxChannels, setMaxChannels] = useState('');
  const [maxUsers, setMaxUsers] = useState('');
  const [maxMsgPerMonth, setMaxMsgPerMonth] = useState('');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [blockedReason, setBlockedReason] = useState('');

  // Modal state
  const [confirm, setConfirm] = useState<null | { kind: 'save' | 'suspend' | 'activate' }>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/platform/organizations/${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Erro ao carregar');
      const o: PlatformOrgDetail = json.data;
      setOrg(o);
      setPlan(o.plan || 'FREE');
      setMaxChannels(o.maxChannels === null || o.maxChannels === undefined ? '' : String(o.maxChannels));
      setMaxUsers(o.maxUsers === null || o.maxUsers === undefined ? '' : String(o.maxUsers));
      setMaxMsgPerMonth(
        o.maxMsgPerMonth === null || o.maxMsgPerMonth === undefined ? '' : String(o.maxMsgPerMonth)
      );
      setTrialEndsAt(o.trialEndsAt ? new Date(o.trialEndsAt).toISOString().slice(0, 16) : '');
      setBlockedReason(o.blockedReason || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const doSave = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        plan,
        maxChannels: maxChannels.trim() === '' ? null : intInputToValue(maxChannels),
        maxUsers: maxUsers.trim() === '' ? null : intInputToValue(maxUsers),
        maxMsgPerMonth: maxMsgPerMonth.trim() === '' ? null : intInputToValue(maxMsgPerMonth),
        trialEndsAt: trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
        blockedReason: blockedReason.trim() === '' ? null : blockedReason.trim(),
      };
      const res = await fetch(`/api/platform/organizations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Falha ao salvar');
      setNotice('Limites atualizados com sucesso.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  };

  const doStatusAction = async (action: 'suspend' | 'activate') => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/platform/organizations/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'suspend' ? JSON.stringify({ blockedReason: blockedReason.trim() || null }) : '{}',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Falha na operação');
      setNotice(action === 'suspend' ? 'Organização suspensa.' : 'Organização ativada.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  };

  if (loading && !org) {
    return <div className="text-slate-400">Carregando…</div>;
  }
  if (!org) {
    return (
      <div className="space-y-4">
        <Link href="/platform" className="inline-flex items-center gap-1 text-sm text-amber-400">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-300">
          {error || 'Organização não encontrada'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/platform" className="inline-flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300">
        <ArrowLeft size={16} /> Todas as organizações
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-400">
            <span className="font-mono">{org.slug}</span>
            <span>·</span>
            <span className="font-mono text-xs">{org.id}</span>
            <span
              className={`ml-2 rounded border px-2 py-0.5 text-xs font-bold uppercase ${
                STATUS_STYLES[org.status]
              }`}
            >
              {org.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {org.status === 'ACTIVE' ? (
            <button
              onClick={() => setConfirm({ kind: 'suspend' })}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500"
            >
              <Pause size={16} /> Suspender
            </button>
          ) : (
            <button
              onClick={() => setConfirm({ kind: 'activate' })}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"
            >
              <Play size={16} /> Ativar
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <ShieldAlert size={16} /> {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <UsageCard label="Usuários" used={org.usage.userCount} max={org.maxUsers} extra={org.usage.pendingInvitesCount > 0 ? `${org.usage.pendingInvitesCount} convites pendentes` : undefined} />
        <UsageCard label="Canais" used={org.usage.channelCount} max={org.maxChannels} />
        <UsageCard label="Mensagens (mês)" used={org.usage.monthlyMessageCount} max={org.maxMsgPerMonth} />
        <UsageCard label="Plano" customValue={org.plan} />
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
        <h2 className="mb-4 text-lg font-bold">Plano e limites</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plano (rótulo)">
            <input
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 font-mono uppercase"
            />
          </Field>
          <Field label="Trial termina em (opcional)">
            <input
              type="datetime-local"
              value={trialEndsAt}
              onChange={(e) => setTrialEndsAt(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
            />
          </Field>
          <Field label="Máx. canais (vazio = ilimitado)">
            <input
              type="number"
              min="0"
              value={maxChannels}
              onChange={(e) => setMaxChannels(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 font-mono"
            />
          </Field>
          <Field label="Máx. usuários (vazio = ilimitado)">
            <input
              type="number"
              min="0"
              value={maxUsers}
              onChange={(e) => setMaxUsers(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 font-mono"
            />
          </Field>
          <Field label="Máx. mensagens / mês (vazio = ilimitado)">
            <input
              type="number"
              min="0"
              value={maxMsgPerMonth}
              onChange={(e) => setMaxMsgPerMonth(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 font-mono"
            />
          </Field>
          <Field label="Motivo do bloqueio (opcional)">
            <input
              value={blockedReason}
              onChange={(e) => setBlockedReason(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2"
              placeholder="Ex.: pagamento atrasado"
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setConfirm({ kind: 'save' })}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
          >
            <Save size={16} /> Salvar limites
          </button>
        </div>
      </section>

      <ConfirmModal
        open={confirm?.kind === 'save'}
        title="Confirmar alteração de limites"
        destructive={false}
        confirmLabel={saving ? 'Salvando…' : 'Salvar'}
        description={
          <>
            Você está prestes a alterar os <strong>limites e plano</strong> da organização{' '}
            <span className="font-mono text-amber-300">{org.name} ({org.slug})</span>. Confirme antes de
            continuar.
          </>
        }
        onConfirm={doSave}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.kind === 'suspend'}
        title="Suspender organização"
        destructive
        confirmLabel={saving ? 'Suspendendo…' : 'Suspender'}
        description={
          <>
            Esta ação <strong>bloqueia o acesso de todos os usuários</strong> da organização{' '}
            <span className="font-mono text-red-300">{org.name} ({org.slug})</span> ao sistema. Apenas o
            Super Admin continuará podendo acessá-la pelo painel da plataforma.
          </>
        }
        onConfirm={() => doStatusAction('suspend')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.kind === 'activate'}
        title="Ativar organização"
        destructive={false}
        confirmLabel={saving ? 'Ativando…' : 'Ativar'}
        description={
          <>
            Reativar acesso da organização{' '}
            <span className="font-mono text-emerald-300">{org.name} ({org.slug})</span> ao sistema.
          </>
        }
        onConfirm={() => doStatusAction('activate')}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function UsageCard({
  label,
  used,
  max,
  extra,
  customValue,
}: {
  label: string;
  used?: number;
  max?: number | null;
  extra?: string;
  customValue?: string;
}) {
  const overflow = used !== undefined && max !== null && max !== undefined && used >= max;
  return (
    <div
      className={`rounded-xl border p-4 ${
        overflow ? 'border-red-500/50 bg-red-500/10' : 'border-slate-700 bg-slate-800/50'
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 font-mono text-xl ${overflow ? 'text-red-300' : 'text-slate-100'}`}>
        {customValue !== undefined ? (
          customValue
        ) : (
          <>
            {used} <span className="text-slate-500">/ {max === null || max === undefined ? '∞' : max}</span>
          </>
        )}
      </div>
      {extra && <div className="mt-1 text-xs text-slate-400">{extra}</div>}
    </div>
  );
}
