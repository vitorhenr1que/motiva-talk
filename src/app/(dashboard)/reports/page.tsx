'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  GraduationCap,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  Settings2,
  Tag as TagIcon,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TagOption = { id: string; name: string; emoji?: string };
type FilterOption = string | TagOption;
type FunnelStage = { id: string; name: string; type: 'STEP' | 'SELECT' | string; options?: string[] };
type SummaryMetrics = {
  totalLeads: number;
  enrolledLeads: number;
  conversionRate: number;
  funnelRetention: number;
};
type StageMetric = { name: string; count: number };
type CourseMetric = { name: string; count: number };
type LeadTag = { id: string; name: string; emoji?: string };
type LeadMetric = {
  id: string;
  contactName: string;
  contactPhone: string;
  stage: string;
  value: string;
  completedAt: string;
  tags: LeadTag[];
};
type ReportsMetrics = {
  summary: SummaryMetrics;
  stages: StageMetric[];
  courses: CourseMetric[];
  leads: LeadMetric[];
};
type ApiResponse<T> = { success?: boolean; data?: T };

const currencyFormatter = new Intl.NumberFormat('pt-BR');

const CheckboxFilter = ({
  label,
  options,
  selectedValues,
  onToggle,
  onToggleAll,
  icon: Icon,
  renderOption
}: {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  icon: React.ElementType;
  renderOption?: (opt: FilterOption) => React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isAllSelected = selectedValues.length === options.length && options.length > 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex h-10 w-full min-w-44 items-center justify-between gap-3 rounded-lg border px-3 text-sm font-semibold transition-colors',
          selectedValues.length > 0 || isOpen
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon size={16} className="shrink-0" />
          <span className="truncate">
            {label}
            {selectedValues.length > 0 ? ` (${selectedValues.length})` : ''}
          </span>
        </span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Fechar filtro"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full z-50 mt-2 max-h-80 w-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={onToggleAll}
            >
              <span
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded border',
                  isAllSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                )}
              >
                {isAllSelected && <Check size={14} />}
              </span>
              Selecionar todos
            </button>

            <div className="mt-2 border-t border-slate-100 pt-2">
              {options.map((opt) => {
                const id = typeof opt === 'string' ? opt : opt.id;
                const isSelected = selectedValues.includes(id);

                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => onToggle(id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                      isSelected ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                        isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                      )}
                    >
                      {isSelected && <Check size={14} />}
                    </span>
                    <span className="min-w-0 truncate">
                      {renderOption ? renderOption(opt) : typeof opt === 'string' ? opt : opt.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const MetricCard = ({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'blue',
  progress
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ElementType;
  tone?: 'blue' | 'emerald' | 'amber' | 'slate';
  progress?: number;
}) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    slate: 'bg-slate-900 text-white border-slate-800'
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
        </div>
        <div className={cn('rounded-lg border p-2.5', tones[tone])}>
          <Icon size={20} />
        </div>
      </div>
      {typeof progress === 'number' && (
        <div className="mt-5 h-2 rounded-full bg-slate-100">
          <div
            className={cn(
              'h-full rounded-full',
              tone === 'emerald' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-blue-600'
            )}
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      )}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">{detail}</p>
    </section>
  );
};

const EmptyState = ({ label }: { label: string }) => (
  <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
    {label}
  </div>
);

export default function ReportsPage() {
  const { tags, setTags } = useChatStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<ReportsMetrics | null>(null);
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [fieldFilters, setFieldFilters] = useState<Record<string, string[]>>({});

  const stepStages = useMemo(() => stages.filter((s) => s.type === 'STEP'), [stages]);
  const selectStages = useMemo(() => stages.filter((s) => s.type === 'SELECT'), [stages]);

  const tagOptions = tags as TagOption[];
  const summary = metrics?.summary;
  const totalLeads = summary?.totalLeads || 0;
  const enrolledLeads = summary?.enrolledLeads || 0;
  const conversionRate = summary?.conversionRate || 0;
  const funnelRetention = summary?.funnelRetention || 0;
  const stageMetrics = metrics?.stages || [];
  const leadMetrics = metrics?.leads || [];
  const activeFilterCount =
    selectedStages.length +
    selectedTags.length +
    Object.values(fieldFilters).reduce((total, values) => total + values.length, 0);
  const sortedCourses = useMemo(
    () => [...(metrics?.courses || [])].sort((a, b) => b.count - a.count),
    [metrics?.courses]
  );

  const fetchInitialData = useCallback(async () => {
    try {
      const [tagsRes, stagesRes] = await Promise.all([fetch('/api/tags'), fetch('/api/funnel/stages')]);
      const tagsData = (await tagsRes.json()) as ApiResponse<TagOption[]>;
      const stagesData = (await stagesRes.json()) as ApiResponse<FunnelStage[]>;

      if (tagsData.success && tagsData.data) setTags(tagsData.data);
      if (stagesData.success && stagesData.data) setStages(stagesData.data);
    } catch {
      console.error('Falha ao carregar filtros iniciais');
    }
  }, [setTags]);

  const fetchMetrics = useCallback(async () => {
    setRefreshing(true);

    const formattedFieldFilters = Object.entries(fieldFilters)
      .filter(([, values]) => values.length > 0)
      .map(([stageId, values]) => ({ stageId, values }));

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          stageIds: selectedStages,
          tagIds: selectedTags,
          fieldFilters: formattedFieldFilters
        })
      });
      const data = (await res.json()) as ApiResponse<ReportsMetrics>;
      if (data.success && data.data) setMetrics(data.data);
    } catch {
      console.error('Erro ao buscar metricas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate, selectedStages, selectedTags, fieldFilters]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const toggleFieldOption = (stageId: string, value: string) => {
    setFieldFilters((prev) => {
      const current = prev[stageId] || [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [stageId]: next };
    });
  };

  const toggleAllStageOptions = (stageId: string, options: string[]) => {
    setFieldFilters((prev) => {
      const current = prev[stageId] || [];
      const next = current.length === options.length ? [] : options;
      return { ...prev, [stageId]: next };
    });
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]));
  };

  const toggleAllTags = () => {
    setSelectedTags((prev) => (prev.length === tagOptions.length ? [] : tagOptions.map((t) => t.id)));
  };

  const clearFilters = () => {
    setStartDate(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
    setSelectedStages([]);
    setSelectedTags([]);
    setFieldFilters({});
  };

  if (loading && !metrics) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 px-6">
        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <Loader2 size={22} className="animate-spin text-blue-600" />
          <div>
            <p className="font-semibold text-slate-900">Carregando relatorios</p>
            <p className="text-sm text-slate-500">Consolidando metricas do periodo.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-5 border-b border-slate-100 p-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-700">
                <BarChart3 size={18} />
                Relatorios
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Visao de desempenho comercial
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Acompanhe volume, conversao, retencao do funil e leads filtrados por etapa, curso e etiquetas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-medium text-slate-500">Filtros ativos</p>
                <p className="text-lg font-bold leading-tight text-slate-950">{activeFilterCount}</p>
              </div>
              <button
                type="button"
                onClick={() => fetchMetrics()}
                disabled={refreshing}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={16} className={cn(refreshing && 'animate-spin')} />
                {refreshing ? 'Atualizando' : 'Atualizar'}
              </button>
            </div>
          </div>

          <div className="grid gap-3 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
                <Calendar size={16} className="text-slate-400" />
                <span className="sr-only">Data inicial</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-32 bg-transparent text-sm font-semibold text-slate-700 outline-none"
                />
                <span className="text-xs font-semibold uppercase text-slate-400">ate</span>
                <span className="sr-only">Data final</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-32 bg-transparent text-sm font-semibold text-slate-700 outline-none"
                />
              </label>

              <label className="relative h-10 min-w-56">
                <span className="sr-only">Etapa</span>
                <TrendingUp size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm font-semibold text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-blue-500"
                  value={selectedStages[0] || ''}
                  onChange={(e) => setSelectedStages(e.target.value ? [e.target.value] : [])}
                >
                  <option value="">Todas as etapas</option>
                  {stepStages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </label>

              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn(
                  'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors',
                  showAdvanced
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                <Settings2 size={16} />
                Filtros avancados
                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <X size={16} />
              Limpar
            </button>
          </div>

          {showAdvanced && (
            <div className="border-t border-slate-100 bg-slate-50 p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {selectStages.map((stage) => (
                  <CheckboxFilter
                    key={stage.id}
                    label={stage.name}
                    options={stage.options || []}
                    selectedValues={fieldFilters[stage.id] || []}
                    onToggle={(val) => toggleFieldOption(stage.id, val)}
                    onToggleAll={() => toggleAllStageOptions(stage.id, stage.options || [])}
                    icon={stage.name === 'Curso' ? GraduationCap : Filter}
                  />
                ))}

                <CheckboxFilter
                  label="Etiquetas"
                  options={tagOptions}
                  selectedValues={selectedTags}
                  onToggle={toggleTag}
                  onToggleAll={toggleAllTags}
                  icon={TagIcon}
                  renderOption={(option) => {
                    const tag = typeof option === 'string' ? { name: option, emoji: '#' } : option;
                    return (
                      <span className="flex items-center gap-2">
                        <span className="shrink-0">{tag.emoji || '#'}</span>
                        <span className="truncate">{tag.name}</span>
                      </span>
                    );
                  }}
                />
              </div>
            </div>
          )}
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Leads qualificados"
            value={currencyFormatter.format(totalLeads)}
            detail="No periodo selecionado"
            icon={UserPlus}
            tone="blue"
          />
          <MetricCard
            label="Matriculas realizadas"
            value={currencyFormatter.format(enrolledLeads)}
            detail={`${conversionRate.toFixed(1)}% de conversao`}
            icon={CheckCircle2}
            tone="emerald"
            progress={conversionRate}
          />
          <MetricCard
            label="Taxa de conversao"
            value={`${conversionRate.toFixed(1)}%`}
            detail="Leads convertidos sobre total"
            icon={Target}
            tone="amber"
            progress={conversionRate}
          />
          <MetricCard
            label="Retencao do funil"
            value={`${funnelRetention.toFixed(0)}%`}
            detail="Avancaram alem da etapa inicial"
            icon={BarChart3}
            tone="slate"
            progress={funnelRetention}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Leitura do funil</h2>
                <p className="text-sm text-slate-500">Distribuicao dos leads por estagio atual.</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                <TrendingUp size={16} />
                {currencyFormatter.format(totalLeads)} leads
              </span>
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
              <div className="flex h-3 w-full bg-slate-100">
                {stageMetrics.map((stage, idx) => {
                  const width = totalLeads > 0 ? (stage.count / totalLeads) * 100 : 0;
                  return (
                    <div
                      key={stage.name}
                      className={cn(idx % 2 === 0 ? 'bg-blue-600' : 'bg-cyan-500')}
                      style={{ width: `${width}%` }}
                      title={`${stage.name}: ${stage.count}`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {stageMetrics.length === 0 ? (
                <EmptyState label="Nenhum estagio encontrado para os filtros atuais." />
              ) : (
                stageMetrics.map((stage, idx) => {
                  const percentage = totalLeads > 0 ? (stage.count / totalLeads) * 100 : 0;
                  return (
                    <div key={stage.name}>
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <p className="truncate text-sm font-semibold text-slate-800">{stage.name}</p>
                        <div className="flex shrink-0 items-center gap-3 text-sm">
                          <span className="font-bold text-slate-950">{currencyFormatter.format(stage.count)}</span>
                          <span className="w-12 text-right font-medium text-slate-500">{percentage.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div
                          className={cn('h-full rounded-full', idx % 2 === 0 ? 'bg-blue-600' : 'bg-cyan-500')}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Interesse por curso</h2>
                <p className="text-sm text-slate-500">Cursos mais frequentes no recorte aplicado.</p>
              </div>
              <GraduationCap size={22} className="text-slate-400" />
            </div>

            <div className="mt-6 space-y-3">
              {sortedCourses.length === 0 ? (
                <EmptyState label="Nenhum curso encontrado para os filtros atuais." />
              ) : (
                sortedCourses.map((course, idx) => {
                  const percentage = totalLeads > 0 ? (course.count / totalLeads) * 100 : 0;
                  return (
                    <div key={course.name} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-sm font-bold text-slate-700">
                            {idx + 1}
                          </span>
                          <p className="truncate text-sm font-semibold text-slate-800">{course.name}</p>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-slate-950">{course.count}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-2 flex-1 rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percentage}%` }} />
                        </div>
                        <span className="w-12 text-right text-xs font-semibold text-slate-500">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Leads filtrados</h2>
              <p className="text-sm text-slate-500">Amostra dos registros que atendem aos filtros atuais.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <div className="h-10 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold leading-10 text-slate-500">
                  {leadMetrics.length} registros
                </div>
              </div>
              <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white">
                <Users size={16} />
                {currencyFormatter.format(totalLeads)}
              </span>
            </div>
          </div>

          {leadMetrics.length === 0 ? (
            <div className="p-5">
              <EmptyState label="Nenhum lead encontrado para os filtros atuais." />
            </div>
          ) : (
            <div className="max-h-[640px] overflow-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-white shadow-[inset_0_-1px_0_#e2e8f0]">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">Contato</th>
                    <th className="px-5 py-3">Estagio atual</th>
                    <th className="px-5 py-3">Valor registrado</th>
                    <th className="px-5 py-3">Etiquetas</th>
                    <th className="px-5 py-3 text-right">Ultima atualizacao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leadMetrics.map((lead) => (
                    <tr key={lead.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
                            {(lead.contactName?.[0] || '?').toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">{lead.contactName}</p>
                            <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-medium text-slate-500">
                              <Phone size={12} />
                              {lead.contactPhone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            'inline-flex max-w-64 items-center rounded-md border px-2.5 py-1 text-xs font-semibold',
                            lead.stage.toLocaleLowerCase('pt-BR').includes('matric')
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-blue-200 bg-blue-50 text-blue-700'
                          )}
                        >
                          <span className="truncate">{lead.stage}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex max-w-56 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          <span className="truncate">{lead.value || '--'}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex max-w-48 flex-wrap gap-1.5">
                          {lead.tags.map((t) => (
                            <span
                              key={t.id}
                              className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-slate-200 bg-white px-1.5 text-sm"
                              title={t.name}
                            >
                              {t.emoji || '#'}
                            </span>
                          ))}
                          {lead.tags.length === 0 && (
                            <span className="text-xs font-medium text-slate-400">Sem etiquetas</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <p className="text-sm font-semibold text-slate-800">
                            {format(parseISO(lead.completedAt), "dd 'de' MMM", { locale: ptBR })}
                          </p>
                          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                            <Clock size={12} />
                            {format(parseISO(lead.completedAt), 'HH:mm')}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
