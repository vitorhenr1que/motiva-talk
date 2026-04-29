'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Save, 
  Pause, 
  Play, 
  AlertTriangle, 
  ShieldAlert, 
  DollarSign,
  Building2,
  Users,
  Smartphone,
  MessageSquare,
  ChevronRight,
  Clock,
  Ban,
  Activity,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  enterprisePriceCents: number | null;
  enterpriseStripePriceId: string | null;
  usage: {
    channelCount: number;
    userCount: number;
    pendingInvitesCount: number;
    monthlyMessageCount: number;
  };
  plans: BillingPlan[];
  subscription: { stripeSubscriptionId?: string | null; stripePriceId?: string | null } | null;
}

interface BillingPlan {
  id: string;
  code: string;
  name: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE: {
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
  TRIAL: {
    bg: 'bg-sky-500/10 border-sky-500/20',
    text: 'text-sky-400',
    dot: 'bg-sky-400',
  },
  SUSPENDED: {
    bg: 'bg-red-500/10 border-red-500/20',
    text: 'text-red-400',
    dot: 'bg-red-400',
  },
  CANCELED: {
    bg: 'bg-slate-500/10 border-slate-500/20',
    text: 'text-slate-400',
    dot: 'bg-slate-400',
  },
};

function intInputToValue(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
  return n;
}

function centsToCurrencyInput(value?: number | null) {
  if (!value) return '';
  return (value / 100).toFixed(2).replace('.', ',');
}

function currencyInputToCents(value: string) {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return 'Não configurado';
  return (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900 shadow-2xl"
            >
              <div className="p-8">
                <div className="mb-6 flex items-center gap-4">
                  <div className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-2xl",
                    destructive ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                  )}>
                    <AlertTriangle size={24} />
                  </div>
                  <h2 className="text-xl font-black text-white">{title}</h2>
                </div>
                <div className="mb-8 text-sm leading-relaxed text-slate-400">{description}</div>
                <div className="flex gap-3">
                  <button
                    onClick={onCancel}
                    className="flex-1 rounded-2xl border border-slate-800 py-3 text-sm font-bold text-slate-400 transition-colors hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={onConfirm}
                    className={cn(
                      "flex-1 rounded-2xl py-3 text-sm font-bold transition-all",
                      destructive
                        ? "bg-red-600 text-white hover:bg-red-500"
                        : "bg-amber-500 text-slate-950 hover:bg-amber-400"
                    )}
                  >
                    {confirmLabel}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
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
  const [enterprisePrice, setEnterprisePrice] = useState('');

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
      setEnterprisePrice(centsToCurrencyInput(o.enterprisePriceCents));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  const updateEnterprisePrice = async () => {
    const priceCents = currencyInputToCents(enterprisePrice);
    if (!priceCents) {
      setError('Informe um valor Enterprise válido maior que zero.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/platform/organizations/${id}/enterprise-price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceCents }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Falha ao atualizar Enterprise');
      setNotice('Preço Enterprise personalizado atualizado.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSaving(false);
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
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-slate-500">
        <RefreshCw className="animate-spin text-amber-500" size={40} />
        <span className="text-lg font-medium">Carregando detalhes...</span>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 py-12 text-center">
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <Ban size={40} />
          </div>
        </div>
        <h1 className="text-3xl font-black text-white">Ops! Organização ausente</h1>
        <p className="text-slate-400">{error || 'O registro solicitado não foi localizado em nossa base de dados.'}</p>
        <Link href="/platform" className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3 font-bold text-slate-950 transition-colors hover:bg-amber-400">
          <ArrowLeft size={18} /> 
          Voltar para a Plataforma
        </Link>
      </div>
    );
  }

  const status = STATUS_STYLES[org.status] || STATUS_STYLES.CANCELED;

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-8">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <Link 
          href="/platform" 
          className="group inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-amber-400"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 transition-colors group-hover:bg-amber-500 group-hover:text-slate-950">
            <ArrowLeft size={14} />
          </div>
          VOLTAR PARA A PLATAFORMA
        </Link>
      </motion.div>

      <motion.header 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2.5rem] border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl"
      >
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-linear-to-br from-amber-500 to-amber-700 text-slate-950 shadow-xl shadow-amber-500/20">
              <Building2 size={32} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black text-white tracking-tight">{org.name}</h1>
                <div className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider', status.bg, status.text)}>
                  <div className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                  {org.status}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
                <span className="font-mono text-slate-400 uppercase">{org.slug}</span>
                <span className="text-slate-700">•</span>
                <span className="font-mono uppercase tracking-tighter">ID: {org.id}</span>
                <span className="text-slate-700">•</span>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  Desde {new Date(org.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {org.status === 'ACTIVE' || org.status === 'TRIAL' ? (
              <button
                onClick={() => setConfirm({ kind: 'suspend' })}
                className="group flex h-12 items-center gap-3 rounded-2xl bg-red-500/10 px-6 font-bold text-red-500 transition-all hover:bg-red-500 hover:text-white"
              >
                <Pause size={18} /> 
                Suspender Acesso
              </button>
            ) : (
              <button
                onClick={() => setConfirm({ kind: 'activate' })}
                className="group flex h-12 items-center gap-3 rounded-2xl bg-emerald-500/10 px-6 font-bold text-emerald-500 transition-all hover:bg-emerald-500 hover:text-white"
              >
                <Play size={18} /> 
                Reativar Tenant
              </button>
            )}
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {(error || notice) && (
          <motion.div 
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="space-y-3"
          >
            {error && (
              <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
                <ShieldAlert size={18} />
                <span className="font-medium">{error}</span>
              </div>
            )}
            {notice && (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-400">
                <CheckCircle2 size={18} />
                <span className="font-medium">{notice}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <UsageCard icon={Users} label="Usuários" used={org.usage.userCount} max={org.maxUsers} delay={0.1} />
        <UsageCard icon={Smartphone} label="Canais Ativos" used={org.usage.channelCount} max={org.maxChannels} delay={0.2} />
        <UsageCard icon={MessageSquare} label="Mensagens / Mês" used={org.usage.monthlyMessageCount} max={org.maxMsgPerMonth} delay={0.3} />
        <UsageCard icon={Activity} label="Plano Atual" customValue={org.plan} delay={0.4} />
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2 space-y-6 rounded-[2rem] border border-slate-800 bg-slate-900/40 p-8 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <ShieldAlert size={20} />
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Limites & Políticas</h2>
            </div>
            <button
              onClick={() => setConfirm({ kind: 'save' })}
              disabled={saving}
              className="group flex h-10 items-center gap-2 rounded-xl bg-white px-5 text-xs font-black text-slate-950 transition-all hover:bg-amber-400 disabled:opacity-50"
            >
              <Save size={14} /> 
              ATUALIZAR
            </button>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Plano (rótulo comercial)">
              <input
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm uppercase text-white outline-none focus:border-amber-500/50"
              />
            </Field>
            <Field label="Trial termina em">
              <input
                type="datetime-local"
                value={trialEndsAt}
                onChange={(e) => setTrialEndsAt(e.target.value)}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-500/50"
              />
            </Field>
            <Field label="Máx. Canais">
              <input
                type="number"
                min="0"
                value={maxChannels}
                onChange={(e) => setMaxChannels(e.target.value)}
                placeholder="Ilimitado"
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none focus:border-amber-500/50"
              />
            </Field>
            <Field label="Máx. Usuários">
              <input
                type="number"
                min="0"
                value={maxUsers}
                onChange={(e) => setMaxUsers(e.target.value)}
                placeholder="Ilimitado"
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none focus:border-amber-500/50"
              />
            </Field>
            <Field label="Msgs / Ciclo">
              <input
                type="number"
                min="0"
                value={maxMsgPerMonth}
                onChange={(e) => setMaxMsgPerMonth(e.target.value)}
                placeholder="Ilimitado"
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none focus:border-amber-500/50"
              />
            </Field>
            <Field label="Motivo da Suspensão">
              <input
                value={blockedReason}
                onChange={(e) => setBlockedReason(e.target.value)}
                placeholder="Nenhum bloqueio ativo"
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-500/50 placeholder:text-slate-700"
              />
            </Field>
          </div>
        </motion.section>

        <motion.section 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-6"
        >
          <div className="rounded-[2rem] border border-slate-800 bg-linear-to-br from-indigo-500/10 to-slate-900/50 p-8 shadow-xl">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
                <DollarSign size={20} />
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Enterprise</h2>
            </div>
            
            <p className="mb-8 text-sm leading-relaxed text-slate-400">
              Configure preços personalizados e IDs de checkout diretos para este tenant específico no Stripe.
            </p>

            <PriceEditor
              label="Assinatura Customizada"
              value={enterprisePrice}
              stripePriceId={org.enterpriseStripePriceId || null}
              onChange={setEnterprisePrice}
              onSave={updateEnterprisePrice}
              saving={saving}
            />
            
            <div className="mt-8 rounded-2xl bg-white/5 p-4 border border-white/5">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Stripe Subscription</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-mono text-xs text-slate-400 truncate max-w-[150px]">
                  {org.subscription?.stripeSubscriptionId || 'Nenhuma assinatura ativa'}
                </span>
                {org.subscription?.stripeSubscriptionId && (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                )}
              </div>
            </div>
          </div>
        </motion.section>
      </div>

      <ConfirmModal
        open={confirm?.kind === 'save'}
        title="Confirmar Alterações"
        destructive={false}
        confirmLabel={saving ? 'Salvando...' : 'Confirmar'}
        description={
          <>
            Você está atualizando os parâmetros operacionais de <strong>{org.name}</strong>. 
            Isso afetará imediatamente a capacidade do tenant de criar novos canais ou adicionar membros.
          </>
        }
        onConfirm={doSave}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.kind === 'suspend'}
        title="Suspender Acesso"
        destructive
        confirmLabel={saving ? 'Suspendendo...' : 'Bloquear Agora'}
        description={
          <>
            Esta é uma ação crítica. Ao suspender o acesso, todos os usuários (incluindo admins) 
            de <strong>{org.name}</strong> serão deslogados e impedidos de entrar.
          </>
        }
        onConfirm={() => doStatusAction('suspend')}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.kind === 'activate'}
        title="Reativar Organização"
        destructive={false}
        confirmLabel={saving ? 'Ativando...' : 'Reativar'}
        description={
          <>
            Você está removendo as restrições de acesso para <strong>{org.name}</strong>. 
            O status do tenant será restaurado para ACTIVE e os usuários poderão logar normalmente.
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
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 ml-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function UsageCard({
  icon: Icon,
  label,
  used,
  max,
  customValue,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  used?: number;
  max?: number | null;
  customValue?: string;
  delay?: number;
}) {
  const overflow = used !== undefined && max !== null && max !== undefined && used >= max;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        "rounded-[2rem] border p-6 shadow-lg transition-all",
        overflow 
          ? "border-red-500/30 bg-red-500/5 shadow-red-500/10" 
          : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          overflow ? "bg-red-500/10 text-red-500" : "bg-slate-800 text-slate-400"
        )}>
          <Icon size={20} />
        </div>
        {overflow && (
          <div className="flex items-center gap-1 text-[9px] font-black text-red-500 uppercase tracking-widest">
            <Ban size={12} />
            Limite Atingido
          </div>
        )}
      </div>
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600 mb-1">{label}</div>
        <div className={cn("text-2xl font-black tracking-tight", overflow ? "text-red-400" : "text-white")}>
          {customValue !== undefined ? (
            customValue
          ) : (
            <>
              {used?.toLocaleString('pt-BR')} 
              <span className="text-slate-600 ml-1.5 font-medium">/ {max === null || max === undefined ? '∞' : max.toLocaleString('pt-BR')}</span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function PriceEditor({
  label,
  value,
  stripePriceId,
  saving,
  onChange,
  onSave,
}: {
  label: string;
  value: string;
  stripePriceId?: string | null;
  saving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="rounded-3xl border border-white/5 bg-slate-950/60 p-6">
      <div className="mb-4 text-xs font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className="flex gap-2">
        <div className="flex flex-1 items-center rounded-2xl border border-slate-800 bg-slate-900 px-4 focus-within:border-amber-500/50">
          <span className="mr-3 text-sm font-bold text-slate-500">R$</span>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0,00"
            className="w-full bg-transparent py-4 font-mono text-sm font-bold text-white outline-none"
          />
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center justify-center rounded-2xl bg-white px-6 text-xs font-black text-slate-950 transition-all hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : 'FIXAR'}
        </button>
      </div>
      <div className="mt-4 truncate font-mono text-[9px] text-slate-700 uppercase tracking-tighter">
        STRIPE PRICE: {stripePriceId || 'PENDENTE DE SYNC'}
      </div>
    </div>
  );
}
