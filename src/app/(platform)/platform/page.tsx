'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  CheckCircle2,
  CreditCard,
  DollarSign,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Users,
  ChevronRight,
  TrendingUp,
  Activity,
  Zap,
  Plus,
  Trash2,
  Save as SaveIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface BillingPlan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  priceCents: number;
  currency: string;
  billingInterval: string;
  stripePriceId?: string | null;
  maxChannels?: number | null;
  maxUsers?: number | null;
  maxMessagesPerMonth?: number | null;
  serviceConversationQuotaEnabled?: boolean;
  maxServiceConversationsPerCycle?: number | null;
  serviceConversationWindowHours?: number;
  serviceConversationQuotaScope?: 'billing_cycle' | 'lifetime';
  serviceConversationOveragePriceCents?: number | null;
  stripeOveragePriceId?: string | null;
  stripeOverageMeterId?: string | null;
  features?: string[];
  isActive: boolean;
  sortOrder: number;
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

const PLAN_THEMES: Record<string, { gradient: string; border: string; accent: string; icon: any }> = {
  FREE: {
    gradient: 'from-slate-800/50 to-slate-900/50',
    border: 'border-slate-700/50',
    accent: 'text-slate-400',
    icon: Building2,
  },
  STARTER: {
    gradient: 'from-amber-500/10 to-slate-900/50',
    border: 'border-amber-500/20',
    accent: 'text-amber-400',
    icon: Zap,
  },
  PRO: {
    gradient: 'from-cyan-500/10 to-slate-900/50',
    border: 'border-cyan-500/20',
    accent: 'text-cyan-400',
    icon: Activity,
  },
  ENTERPRISE: {
    gradient: 'from-violet-500/10 to-slate-900/50',
    border: 'border-violet-500/20',
    accent: 'text-violet-400',
    icon: ShieldAlert,
  },
};

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
  if (!value) return 'Sob consulta';
  return (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(value?: number | null) {
  if (value === null || value === undefined) return '∞';
  return value.toLocaleString('pt-BR');
}

function formatLimit(used: number, max: number | null) {
  if (max === null) return `${used.toLocaleString('pt-BR')} / ∞`;
  const overflow = used >= max;
  return (
    <span className={cn('font-medium', overflow ? 'text-red-400 font-bold' : 'text-slate-300')}>
      {used.toLocaleString('pt-BR')} <span className="text-slate-600">/</span> {max === null ? '∞' : max.toLocaleString('pt-BR')}
    </span>
  );
}

function scopeLabel(scope?: string) {
  if (scope === 'lifetime') return 'vitalício';
  return 'ciclo';
}

export default function PlatformOrganizationsPage() {
  const [orgs, setOrgs] = useState<PlatformOrgRow[]>([]);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [starterPrice, setStarterPrice] = useState('');
  const [proPrice, setProPrice] = useState('');
  const [starterOveragePrice, setStarterOveragePrice] = useState('');
  const [proOveragePrice, setProOveragePrice] = useState('');
  const [planFeatures, setPlanFeatures] = useState<Record<string, string[]>>({});
  const [planLimits, setPlanLimits] = useState<Record<string, { 
    maxChannels: string; 
    maxUsers: string; 
    maxMessagesPerMonth: string;
    maxServiceConversationsPerCycle: string;
    serviceConversationWindowHours: string;
    serviceConversationQuotaScope: string;
  }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [orgsRes, plansRes] = await Promise.all([
        fetch('/api/platform/organizations', { cache: 'no-store' }),
        fetch('/api/platform/billing/plans', { cache: 'no-store' }),
      ]);
      const [orgsJson, plansJson] = await Promise.all([orgsRes.json(), plansRes.json()]);
      if (!orgsRes.ok || !orgsJson.success) throw new Error(orgsJson.message || 'Erro ao carregar organizações');
      if (!plansRes.ok || !plansJson.success) throw new Error(plansJson.message || 'Erro ao carregar planos');

      const loadedPlans: BillingPlan[] = plansJson.data;
      setOrgs(orgsJson.data);
      setPlans(loadedPlans);
      setStarterPrice(centsToCurrencyInput(loadedPlans.find((p) => p.code === 'STARTER')?.priceCents));
      setProPrice(centsToCurrencyInput(loadedPlans.find((p) => p.code === 'PRO')?.priceCents));
      setStarterOveragePrice(centsToCurrencyInput(loadedPlans.find((p) => p.code === 'STARTER')?.serviceConversationOveragePriceCents));
      setProOveragePrice(centsToCurrencyInput(loadedPlans.find((p) => p.code === 'PRO')?.serviceConversationOveragePriceCents));
      
      setPlanFeatures(Object.fromEntries(
        loadedPlans.map((plan) => [plan.code, plan.features || []])
      ));

      setPlanLimits(Object.fromEntries(
        loadedPlans.map((plan) => [
          plan.code, 
          { 
            maxChannels: plan.maxChannels === null ? '' : String(plan.maxChannels),
            maxUsers: plan.maxUsers === null ? '' : String(plan.maxUsers),
            maxMessagesPerMonth: plan.maxMessagesPerMonth === null ? '' : String(plan.maxMessagesPerMonth),
            maxServiceConversationsPerCycle: plan.maxServiceConversationsPerCycle === null ? '' : String(plan.maxServiceConversationsPerCycle),
            serviceConversationWindowHours: plan.serviceConversationWindowHours === null ? '' : String(plan.serviceConversationWindowHours),
            serviceConversationQuotaScope: plan.serviceConversationQuotaScope || 'billing_cycle'
          }
        ])
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updatePlanPrice = async (code: 'STARTER' | 'PRO', value: string) => {
    const priceCents = currencyInputToCents(value);
    if (!priceCents) {
      setError('Informe um valor válido maior que zero.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/platform/billing/plans/${code}/price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceCents }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Falha ao atualizar preço');
      setNotice(`Preço do plano ${code} atualizado.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const updatePlanOveragePrice = async (code: 'STARTER' | 'PRO', value: string) => {
    const overagePriceCents = currencyInputToCents(value);
    if (!overagePriceCents) {
      setError('Informe um valor de excedente válido maior que zero.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/platform/billing/plans/${code}/overage-price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overagePriceCents }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Falha ao atualizar excedente');
      setNotice(`Excedente do plano ${code} atualizado.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const updatePlanFeatures = async (code: string) => {
    const features = (planFeatures[code] || [])
      .map((feature) => feature.trim())
      .filter(Boolean);

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/platform/billing/plans/${code}/features`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Falha ao atualizar features');
      setNotice(`Features do plano ${code} atualizadas.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const updatePlanLimits = async (code: string) => {
    const limits = planLimits[code];
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/platform/billing/plans/${code}/limits`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxChannels: limits.maxChannels,
          maxUsers: limits.maxUsers,
          maxMessagesPerMonth: limits.maxMessagesPerMonth,
          maxServiceConversationsPerCycle: limits.maxServiceConversationsPerCycle,
          serviceConversationWindowHours: limits.serviceConversationWindowHours,
          serviceConversationQuotaScope: limits.serviceConversationQuotaScope,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Falha ao atualizar limites');
      setNotice(`Limites do plano ${code} atualizados.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const activeOrgs = orgs.filter((org) => org.status === 'ACTIVE' || org.status === 'TRIAL').length;
  const totalUsers = orgs.reduce((sum, org) => sum + org.usage.userCount + org.usage.pendingInvitesCount, 0);
  const monthlyMessages = orgs.reduce((sum, org) => sum + org.usage.monthlyMessageCount, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-12 py-8">
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl"
      >
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-400">
              <ShieldAlert size={14} className="text-amber-500" />
              Central de Comando
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                Plataforma <span className="text-amber-500">&</span> Planos
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-400">
                Gestão global de organizações, limites operacionais e configuração comercial do ecossistema Motiva Talk.
              </p>
            </div>
          </div>
          
          <button
            onClick={load}
            disabled={loading}
            className="group relative flex h-14 items-center justify-center gap-3 overflow-hidden rounded-2xl bg-white px-8 font-bold text-slate-950 transition-all hover:bg-amber-400 disabled:opacity-50"
          >
            <RefreshCw size={18} className={cn('transition-transform group-hover:rotate-180', loading && 'animate-spin')} />
            {loading ? 'Sincronizando...' : 'Atualizar Dados'}
          </button>
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
        <MetricCard 
          icon={Building2} 
          label="Organizações" 
          value={orgs.length.toLocaleString('pt-BR')} 
          hint={`${activeOrgs} ativas/trial`} 
          delay={0.1}
          trend="+4.2%"
        />
        <MetricCard 
          icon={CreditCard} 
          label="Planos Ativos" 
          value={plans.length.toLocaleString('pt-BR')} 
          hint="Configurados no sistema" 
          delay={0.2}
        />
        <MetricCard 
          icon={Users} 
          label="Base de Usuários" 
          value={totalUsers.toLocaleString('pt-BR')} 
          hint="Incluindo convites" 
          delay={0.3}
          trend="+12%"
        />
        <MetricCard 
          icon={MessageSquare} 
          label="Volume Mensal" 
          value={monthlyMessages.toLocaleString('pt-BR')} 
          hint="Mensagens trafegadas" 
          delay={0.4}
          trend="+18.5%"
        />
      </section>

      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <TrendingUp size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Catálogo de Planos</h2>
              <p className="text-sm text-slate-500">Configuração de limites globais, Stripe Price e features comerciais.</p>
            </div>
          </div>
          <div className="hidden rounded-full border border-slate-800 bg-slate-900/50 px-4 py-1.5 text-xs font-mono text-slate-400 sm:block">
            {loading ? 'Sincronizando...' : `${plans.length} planos ativos`}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {plans.map((plan, idx) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              featureDraft={planFeatures[plan.code] || []}
              limitsDraft={planLimits[plan.code] || { maxChannels: '', maxUsers: '', maxMessagesPerMonth: '' }}
              saving={saving}
              index={idx}
              priceValue={plan.code === 'STARTER' ? starterPrice : plan.code === 'PRO' ? proPrice : ''}
              overageValue={plan.code === 'STARTER' ? starterOveragePrice : plan.code === 'PRO' ? proOveragePrice : ''}
              onFeatureChange={(features) => setPlanFeatures((current) => ({ ...current, [plan.code]: features }))}
              onSaveFeatures={() => updatePlanFeatures(plan.code)}
              onLimitsChange={(limits) => setPlanLimits((current) => ({ ...current, [plan.code]: limits }))}
              onSaveLimits={() => updatePlanLimits(plan.code)}
              onPriceChange={plan.code === 'STARTER' ? setStarterPrice : plan.code === 'PRO' ? setProPrice : undefined}
              onSavePrice={plan.code === 'STARTER' ? () => updatePlanPrice('STARTER', starterPrice) : plan.code === 'PRO' ? () => updatePlanPrice('PRO', proPrice) : undefined}
              onOverageChange={plan.code === 'STARTER' ? setStarterOveragePrice : plan.code === 'PRO' ? setProOveragePrice : undefined}
              onSaveOverage={plan.code === 'STARTER' ? () => updatePlanOveragePrice('STARTER', starterOveragePrice) : plan.code === 'PRO' ? () => updatePlanOveragePrice('PRO', proOveragePrice) : undefined}
            />
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Organizações Registradas</h2>
              <p className="text-sm text-slate-500">Consumo em tempo real e gestão de infraestrutura por tenant.</p>
            </div>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/40 shadow-xl backdrop-blur-md"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="bg-slate-950/40 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-8 py-5 text-left">Organização</th>
                  <th className="px-6 py-5 text-left">Nível</th>
                  <th className="px-6 py-5 text-left">Status</th>
                  <th className="px-6 py-5 text-left">Usuários</th>
                  <th className="px-6 py-5 text-left">Canais</th>
                  <th className="px-6 py-5 text-left">Mensagens</th>
                  <th className="px-8 py-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading && orgs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 text-slate-500">
                        <RefreshCw className="animate-spin text-amber-500" size={32} />
                        <span className="font-medium">Carregando ecossistema...</span>
                      </div>
                    </td>
                  </tr>
                ) : orgs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-20 text-center text-slate-500">
                      Nenhuma organização detectada no sistema.
                    </td>
                  </tr>
                ) : (
                  orgs.map((org) => {
                    const usersTotal = org.usage.userCount + org.usage.pendingInvitesCount;
                    const status = STATUS_STYLES[org.status] || STATUS_STYLES.CANCELED;
                    
                    return (
                      <tr key={org.id} className="group transition-colors hover:bg-slate-800/40">
                        <td className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-100 group-hover:text-amber-400 transition-colors">{org.name}</span>
                            <span className="mt-1 font-mono text-[10px] text-slate-500 uppercase tracking-tighter">{org.slug}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="inline-flex rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-[10px] font-black text-slate-400 uppercase">
                            {org.plan}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider', status.bg, status.text)}>
                            <div className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                            {org.status}
                          </div>
                        </td>
                        <td className="px-6 py-5">{formatLimit(usersTotal, org.maxUsers)}</td>
                        <td className="px-6 py-5">{formatLimit(org.usage.channelCount, org.maxChannels)}</td>
                        <td className="px-6 py-5">{formatLimit(org.usage.monthlyMessageCount, org.maxMsgPerMonth)}</td>
                        <td className="px-8 py-5 text-right">
                          <Link 
                            href={`/platform/${org.id}`} 
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-amber-500 hover:text-slate-950"
                          >
                            Gerenciar
                            <ChevronRight size={14} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  delay = 0,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
  delay?: number;
  trend?: string;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl transition-all hover:border-amber-500/30 hover:bg-slate-900/80"
    >
      <div className="mb-6 flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 transition-colors group-hover:bg-amber-500 group-hover:text-slate-950">
          <Icon size={24} />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
            <TrendingUp size={12} />
            {trend}
          </div>
        )}
      </div>
      <div>
        <div className="text-3xl font-black tracking-tight text-white">{value}</div>
        <div className="mt-1 text-sm font-bold text-slate-400 group-hover:text-slate-200 transition-colors">{label}</div>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-600">
          <div className="h-1 w-1 rounded-full bg-slate-700" />
          {hint}
        </div>
      </div>
    </motion.div>
  );
}

function PlanCard({
  plan,
  featureDraft,
  limitsDraft,
  saving,
  index,
  priceValue,
  overageValue,
  onFeatureChange,
  onSaveFeatures,
  onLimitsChange,
  onSaveLimits,
  onPriceChange,
  onSavePrice,
  onOverageChange,
  onSaveOverage,
}: {
  plan: BillingPlan;
  featureDraft: string[];
  limitsDraft: { 
    maxChannels: string; 
    maxUsers: string; 
    maxMessagesPerMonth: string;
    maxServiceConversationsPerCycle: string;
    serviceConversationWindowHours: string;
    serviceConversationQuotaScope: string;
  };
  saving: boolean;
  index: number;
  priceValue: string;
  overageValue: string;
  onFeatureChange: (features: string[]) => void;
  onSaveFeatures: () => void;
  onLimitsChange: (limits: { 
    maxChannels: string; 
    maxUsers: string; 
    maxMessagesPerMonth: string;
    maxServiceConversationsPerCycle: string;
    serviceConversationWindowHours: string;
    serviceConversationQuotaScope: string;
  }) => void;
  onSaveLimits: () => void;
  onPriceChange?: (value: string) => void;
  onSavePrice?: () => void;
  onOverageChange?: (value: string) => void;
  onSaveOverage?: () => void;
}) {
  const theme = PLAN_THEMES[plan.code] || PLAN_THEMES.FREE;
  const editableBilling = plan.code === 'STARTER' || plan.code === 'PRO';

  const addFeature = () => {
    onFeatureChange([...featureDraft, '']);
  };

  const removeFeature = (idx: number) => {
    onFeatureChange(featureDraft.filter((_, i) => i !== idx));
  };

  const updateFeature = (idx: number, value: string) => {
    const next = [...featureDraft];
    next[idx] = value;
    onFeatureChange(next);
  };

  return (
    <motion.article 
      initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 * index }}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-[2.5rem] border bg-gradient-to-br p-8 shadow-2xl transition-all",
        theme.border,
        theme.gradient
      )}
    >
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-4">
          <div className={cn("inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5", theme.accent)}>
            <theme.icon size={24} />
          </div>
          <div>
            <div className={cn("mb-1 text-[11px] font-black uppercase tracking-[0.2em]", theme.accent)}>
              PLANO {plan.code}
            </div>
            <h3 className="text-3xl font-black text-white">{plan.name}</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{plan.description || 'Infraestrutura dedicada e suporte estratégico.'}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black text-white">{formatCurrency(plan.priceCents)}</div>
          <div className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">/{plan.billingInterval}</div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <EditablePlanLimit 
          icon={Smartphone} 
          label="Canais" 
          value={limitsDraft.maxChannels} 
          onChange={(v) => onLimitsChange({ ...limitsDraft, maxChannels: v })}
          theme={theme.accent} 
        />
        <EditablePlanLimit 
          icon={Users} 
          label="Usuários" 
          value={limitsDraft.maxUsers} 
          onChange={(v) => onLimitsChange({ ...limitsDraft, maxUsers: v })}
          theme={theme.accent} 
        />
        <EditablePlanLimit 
          icon={MessageSquare} 
          label="Msgs/Mês" 
          value={limitsDraft.maxMessagesPerMonth} 
          onChange={(v) => onLimitsChange({ ...limitsDraft, maxMessagesPerMonth: v })}
          theme={theme.accent} 
        />
      </div>

      <div className="mb-8 flex justify-end">
        <button
          onClick={onSaveLimits}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-[10px] font-black text-white transition-all hover:bg-white/20 disabled:opacity-50 border border-white/5"
        >
          <SaveIcon size={12} />
          SALVAR LIMITES
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/5 bg-slate-950/40 p-6">
            <div className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300">
              <Activity size={14} className="text-cyan-400" />
              Conversas de Serviço
            </div>
            <div className="grid grid-cols-2 gap-y-4 gap-x-4">
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Franquia</div>
                <input
                  type="number"
                  value={limitsDraft.maxServiceConversationsPerCycle}
                  onChange={(e) => onLimitsChange({ ...limitsDraft, maxServiceConversationsPerCycle: e.target.value })}
                  placeholder="∞"
                  className="w-full bg-transparent font-black text-white outline-none placeholder:text-slate-800"
                />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Janela (h)</div>
                <input
                  type="number"
                  value={limitsDraft.serviceConversationWindowHours}
                  onChange={(e) => onLimitsChange({ ...limitsDraft, serviceConversationWindowHours: e.target.value })}
                  placeholder="24"
                  className="w-full bg-transparent font-black text-white outline-none placeholder:text-slate-800"
                />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Escopo</div>
                <select
                  value={limitsDraft.serviceConversationQuotaScope}
                  onChange={(e) => onLimitsChange({ ...limitsDraft, serviceConversationQuotaScope: e.target.value })}
                  className="w-full bg-transparent font-black text-white outline-none appearance-none cursor-pointer"
                >
                  <option value="billing_cycle" className="bg-slate-900 text-white">Ciclo</option>
                  <option value="lifetime" className="bg-slate-900 text-white">Vitalício</option>
                </select>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Excedente</div>
                <div className="font-black text-amber-400">{formatCurrency(plan.serviceConversationOveragePriceCents)}</div>
              </div>
            </div>
          </div>

          {editableBilling ? (
            <div className="space-y-4">
              <PriceEditor
                label="Assinatura Stripe"
                value={priceValue}
                stripePriceId={plan.stripePriceId || null}
                onChange={onPriceChange || (() => undefined)}
                onSave={onSavePrice || (() => undefined)}
                saving={saving}
              />
              <PriceEditor
                label="Conversa Excedente"
                value={overageValue}
                stripePriceId={plan.stripeOveragePriceId || null}
                onChange={onOverageChange || (() => undefined)}
                onSave={onSaveOverage || (() => undefined)}
                saving={saving}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/20 p-8 text-center">
              <ShieldAlert size={24} className="mb-4 text-slate-700" />
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pricing Externo</div>
              <p className="mt-2 text-[11px] text-slate-600">
                {plan.code === 'ENTERPRISE' ? 'Contratos customizados via CRM.' : 'Plano gratuito sem recorrência Stripe.'}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col rounded-3xl border border-white/5 bg-slate-950/40 p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="text-xs font-black uppercase tracking-widest text-slate-300">Features Ativas</div>
            <div className="flex gap-2">
              <button
                onClick={addFeature}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white hover:bg-white/10"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={onSaveFeatures}
                disabled={saving}
                className="rounded-xl bg-white px-4 py-2 text-[10px] font-black text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                SALVAR
              </button>
            </div>
          </div>
          
          <div className="flex-1 space-y-2 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            <AnimatePresence initial={false}>
              {featureDraft.map((feature, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2"
                >
                  <input
                    value={feature}
                    onChange={(e) => updateFeature(idx, e.target.value)}
                    placeholder="Nome da feature..."
                    className="flex-1 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-2 text-sm text-slate-300 outline-none focus:border-amber-500/30"
                  />
                  <button
                    onClick={() => removeFeature(idx)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {featureDraft.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-600 border border-dashed border-slate-800 rounded-2xl">
                Nenhuma feature cadastrada.
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2 border-t border-slate-800 pt-4 font-mono text-[9px] text-slate-600">
            <div className="truncate">Price: {plan.stripePriceId || 'null'}</div>
            <div className="truncate">Overage: {plan.stripeOveragePriceId || 'null'}</div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function EditablePlanLimit({ 
  icon: Icon, 
  label, 
  value, 
  onChange,
  theme 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string; 
  onChange: (v: string) => void;
  theme: string 
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-white/5 p-4 text-center border border-white/5 focus-within:border-amber-500/30 transition-colors">
      <Icon size={16} className={cn("mb-3", theme)} />
      <div className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">{label}</div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="∞"
        className="w-full bg-transparent text-center font-black text-white outline-none placeholder:text-slate-700"
      />
    </div>
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
    <div className="rounded-3xl border border-white/5 bg-slate-950/40 p-5">
      <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className="flex gap-2">
        <div className="flex flex-1 items-center rounded-2xl border border-slate-800 bg-slate-900/50 px-4 focus-within:border-amber-500/50">
          <span className="mr-3 text-sm font-bold text-slate-500">R$</span>
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="0,00"
            className="w-full bg-transparent py-3 font-mono text-sm font-bold text-white outline-none"
          />
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center justify-center rounded-2xl bg-slate-800 px-5 text-[10px] font-black text-white hover:bg-amber-400 hover:text-slate-950 disabled:opacity-50"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : 'FIXAR'}
        </button>
      </div>
      <div className="mt-3 truncate font-mono text-[9px] text-slate-700">
        ID: {stripePriceId || 'não vinculado'}
      </div>
    </div>
  );
}
