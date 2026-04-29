'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CreditCard, Loader2, MessageSquare, Phone, Users, ArrowUpRight, ExternalLink } from 'lucide-react';

type BillingStatus = {
  plan: BillingPlan;
  limits: {
    maxChannels: number | null;
    maxUsers: number | null;
    maxMessagesPerMonth: number | null;
    serviceConversationQuotaEnabled: boolean;
    maxServiceConversationsPerCycle: number | null;
    serviceConversationQuotaScope: 'billing_cycle' | 'lifetime';
  };
  usage: {
    messages: number;
    serviceConversations: number;
    channels: number;
    users: number;
    pendingInvites: number;
    periodStart: string;
    periodEnd: string;
    serviceConversationPeriodStart: string | null;
    serviceConversationPeriodEnd: string | null;
  };
  subscription: BillingSubscription | null;
  plans: BillingPlan[];
};

type BillingPlan = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  priceCents: number;
  billingInterval: string;
  maxChannels: number | null;
  maxUsers: number | null;
  maxMessagesPerMonth: number | null;
  serviceConversationQuotaEnabled?: boolean;
  maxServiceConversationsPerCycle?: number | null;
  serviceConversationQuotaScope?: 'billing_cycle' | 'lifetime';
};

type BillingSubscription = {
  status: string;
  stripeCustomerId?: string | null;
};

function formatLimit(value: number | null) {
  return value === null ? 'Ilimitado' : value.toLocaleString('pt-BR');
}

function percent(current: number, max: number | null) {
  if (!max) return 0;
  return Math.min(100, Math.round((current / max) * 100));
}

function UsageCard({ icon, label, current, max }: { icon: React.ReactNode; label: string; current: number; max: number | null }) {
  const value = percent(current, max);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">{icon}</div>
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <div className="mt-6">
        <p className="text-3xl font-black text-slate-900">
          {current.toLocaleString('pt-BR')}
          <span className="ml-2 text-sm font-bold text-slate-400">/ {formatLimit(max)}</span>
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: max === null ? '100%' : `${value}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function BillingPlanPage() {
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchBilling = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/status');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Erro ao carregar billing');
      setBilling(data.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar billing');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  const startCheckout = async (planCode: string) => {
    setActionLoading(planCode);
    setError('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Erro ao iniciar checkout');
      window.location.href = data.data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar checkout');
      setActionLoading(null);
    }
  };

  const openPortal = async () => {
    if (!billing?.subscription?.stripeCustomerId) {
      const fallbackPlan = currentPlan?.code && currentPlan.code !== 'FREE' ? currentPlan.code : 'STARTER';
      await startCheckout(fallbackPlan);
      return;
    }

    setActionLoading('portal');
    setError('');
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Erro ao abrir portal');
      window.location.href = data.data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Portal disponível apenas para organizações com assinatura Stripe ativa.');
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-3 text-slate-400">
        <Loader2 className="animate-spin" />
        <span className="text-sm font-medium">Carregando plano...</span>
      </div>
    );
  }

  const currentPlan = billing?.plan;
  const paidPlans = (billing?.plans || []).filter((plan) => plan.code !== 'FREE');
  const serviceConversationMax = billing?.limits.serviceConversationQuotaEnabled
    ? billing.limits.maxServiceConversationsPerCycle
    : null;
  const serviceConversationLimitReached = serviceConversationMax !== null
    && (billing?.usage.serviceConversations || 0) >= serviceConversationMax;
  const freeReplyBlocked = currentPlan?.code === 'FREE' && serviceConversationLimitReached;
  const paidOverage = currentPlan?.code !== 'FREE' && serviceConversationLimitReached;
  const hasStripeCustomer = !!billing?.subscription?.stripeCustomerId;
  const billingActionLoading = actionLoading === 'portal' || actionLoading === currentPlan?.code || actionLoading === 'STARTER';

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8 pb-20">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-blue-600">
            <CreditCard size={14} /> Billing
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Plano e uso</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">Acompanhe limites mensais e gerencie a cobrança da organização.</p>
        </div>

        <button
          onClick={openPortal}
          disabled={billingActionLoading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-blue-200 hover:text-blue-600 disabled:opacity-50"
        >
          {billingActionLoading ? <Loader2 className="animate-spin" size={18} /> : <ExternalLink size={18} />}
          {hasStripeCustomer ? 'Portal de cobrança' : 'Ativar cobrança'}
        </button>
      </header>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
          {error}
        </div>
      )}

      {freeReplyBlocked && (
        <div className="flex flex-col gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 shrink-0" size={22} />
            <div>
              <p className="text-sm font-black uppercase tracking-widest">Franquia de conversas atingida</p>
              <p className="mt-1 text-sm font-semibold text-amber-800">
                As mensagens continuam chegando, mas respostas de agentes ficam bloqueadas no FREE até fazer upgrade.
              </p>
            </div>
          </div>
          <button
            onClick={() => startCheckout(currentPlan?.code === 'FREE' ? 'STARTER' : 'PRO')}
            disabled={!!actionLoading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-black text-white shadow-sm transition-all hover:bg-amber-700 disabled:opacity-50"
          >
            Fazer upgrade
          </button>
        </div>
      )}

      {paidOverage && (
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-sm font-semibold text-blue-800">
          A franquia de conversas foi ultrapassada. O atendimento continua ativo e o excedente fica registrado para cobrança adicional.
        </div>
      )}

      <section className="overflow-hidden rounded-[32px] bg-slate-950 text-white shadow-2xl">
        <div className="grid gap-8 p-8 md:grid-cols-[1.2fr_0.8fr] md:p-10">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-300">Plano atual</p>
            <h2 className="mt-3 text-5xl font-black tracking-tight">{currentPlan?.name || 'Free'}</h2>
            <p className="mt-4 max-w-xl text-sm font-medium leading-6 text-slate-300">{currentPlan?.description || 'Organizações sem assinatura ativa usam automaticamente o plano FREE.'}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Assinatura</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-200">Status</span>
              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-300">
                {billing?.subscription?.status || 'FREE'}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-200">Ciclo</span>
              <span className="text-sm font-black text-white">{currentPlan?.billingInterval === 'custom' ? 'Customizado' : 'Mensal'}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <UsageCard icon={<MessageSquare size={22} />} label="Conversas" current={billing?.usage.serviceConversations || 0} max={serviceConversationMax ?? null} />
        <UsageCard icon={<MessageSquare size={22} />} label="Mensagens" current={billing?.usage.messages || 0} max={billing?.limits.maxMessagesPerMonth ?? null} />
        <UsageCard icon={<Phone size={22} />} label="Canais" current={billing?.usage.channels || 0} max={billing?.limits.maxChannels ?? null} />
        <UsageCard icon={<Users size={22} />} label="Usuários" current={(billing?.usage.users || 0) + (billing?.usage.pendingInvites || 0)} max={billing?.limits.maxUsers ?? null} />
      </div>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">Alterar plano</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">O checkout é criado no servidor com os preços configurados no Stripe.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {paidPlans.map((plan) => (
            <div key={plan.id} className="rounded-3xl border border-slate-200 p-6 transition-all hover:border-blue-200 hover:shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{plan.name}</h3>
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                    {formatLimit(plan.maxServiceConversationsPerCycle ?? null)} conversas/ciclo
                  </p>
                </div>
                {currentPlan?.code === plan.code && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-blue-600">Atual</span>
                )}
              </div>
              <p className="mt-5 text-3xl font-black text-slate-900">
                {plan.priceCents > 0 ? `R$ ${(plan.priceCents / 100).toLocaleString('pt-BR')}` : 'Sob consulta'}
              </p>
              <button
                onClick={() => startCheckout(plan.code)}
                disabled={actionLoading === plan.code || currentPlan?.code === plan.code}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-100 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {actionLoading === plan.code ? <Loader2 className="animate-spin" size={18} /> : <ArrowUpRight size={18} />}
                {currentPlan?.code === plan.code ? 'Plano atual' : 'Alterar plano'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
