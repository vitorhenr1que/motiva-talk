'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Columns3, Loader2, Megaphone,
  Phone, Tag, UserRound, UsersRound, XCircle,
} from 'lucide-react'

type CampaignTemplate = {
  id: string
  name: string
  bodyText: string
}

type CampaignTag = {
  id: string
  name: string
  color?: string
  emoji?: string
}

type CampaignStage = {
  id: string
  name: string
  type: 'STEP' | 'SELECT'
  order: number
}

type AudienceType = 'tag' | 'stage'

type CampaignSegment = {
  type: AudienceType
  id: string
  name: string
  color?: string
  emoji?: string
}

type VariableMode = 'fixed' | 'contact_name' | 'contact_phone'
type VariableRule = { mode: VariableMode; value: string }

type Preview = {
  segment: CampaignSegment
  total: number
  limit: number
  sample: Array<{ conversationId: string; contactName: string; phone: string }>
}

type CampaignResult = {
  total: number
  sent: number
  failed: number
  results: Array<{ conversationId: string; contactName: string; success: boolean; error?: string }>
}

type Props = {
  template: CampaignTemplate
  onClose: () => void
  onError: (error: { message: string; code?: string }) => void
}

function extractVariables(text: string) {
  const matches = text.match(/\{\{(?:\d+|[a-zA-Z_][a-zA-Z0-9_]*)\}\}/g) || []
  return Array.from(new Set(matches.map(match => match.replace(/[{}]/g, ''))))
}

function initialRule(name: string): VariableRule {
  const normalized = name.toLowerCase()
  if (['nome', 'name', 'cliente', 'contato', 'nome_cliente'].includes(normalized)) {
    return { mode: 'contact_name', value: '' }
  }
  if (['telefone', 'phone', 'celular', 'whatsapp'].includes(normalized)) {
    return { mode: 'contact_phone', value: '' }
  }
  return { mode: 'fixed', value: '' }
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'

export function BulkTemplateCampaign({ template, onClose, onError }: Props) {
  const variables = useMemo(() => extractVariables(template.bodyText), [template.bodyText])
  const [tags, setTags] = useState<CampaignTag[]>([])
  const [stages, setStages] = useState<CampaignStage[]>([])
  const [audienceType, setAudienceType] = useState<AudienceType>('tag')
  const [tagId, setTagId] = useState('')
  const [stageId, setStageId] = useState('')
  const [rules, setRules] = useState<VariableRule[]>(() => variables.map(initialRule))
  const [loadingAudience, setLoadingAudience] = useState(true)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<CampaignResult | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([fetch('/api/tags'), fetch('/api/funnel/stages')])
      .then(async ([tagsResponse, stagesResponse]) => {
        const [tagsData, stagesData] = await Promise.all([tagsResponse.json(), stagesResponse.json()])
        if (!tagsResponse.ok || !tagsData.success) throw new Error(tagsData.message || 'Falha ao carregar etiquetas.')
        if (!stagesResponse.ok || !stagesData.success) throw new Error(stagesData.message || 'Falha ao carregar fases do Kanban.')
        if (active) {
          setTags(tagsData.data || [])
          setStages((stagesData.data || []).filter((stage: CampaignStage) => stage.type === 'STEP'))
        }
      })
      .catch(error => onError({ message: error.message || 'Falha ao carregar os segmentos.' }))
      .finally(() => { if (active) setLoadingAudience(false) })
    return () => { active = false }
  }, [onError])

  useEffect(() => {
    const audienceId = audienceType === 'tag' ? tagId : stageId
    if (!audienceId) {
      setPreview(null)
      return
    }

    const controller = new AbortController()
    setLoadingPreview(true)
    setPreview(null)
    fetch('/api/whatsapp/templates/bulk-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        action: 'preview',
        templateId: template.id,
        audienceType,
        ...(audienceType === 'tag' ? { tagId } : { stageId }),
      }),
    })
      .then(async response => {
        const data = await response.json()
        if (!response.ok || !data.success) throw new Error(data.message || 'Falha ao calcular o público.')
        setPreview(data.data)
      })
      .catch(error => {
        if (error.name !== 'AbortError') onError({ message: error.message || 'Falha ao calcular o público.' })
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPreview(false)
      })

    return () => controller.abort()
  }, [audienceType, tagId, stageId, template.id, onError])

  const invalidFixedRule = rules.some(rule => rule.mode === 'fixed' && !rule.value.trim())
  const selectedAudienceId = audienceType === 'tag' ? tagId : stageId
  const previewMatchesAudience = preview?.segment.type === audienceType && preview.segment.id === selectedAudienceId
  const canReview = !!preview && previewMatchesAudience && preview.total > 0 && preview.total <= preview.limit && !invalidFixedRule

  const updateRule = (index: number, patch: Partial<VariableRule>) => {
    setRules(current => current.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule))
  }

  const handleSend = async () => {
    if (!preview || !canReview) return
    setSending(true)
    try {
      const response = await fetch('/api/whatsapp/templates/bulk-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          templateId: template.id,
          audienceType,
          ...(audienceType === 'tag' ? { tagId } : { stageId }),
          variables: rules.map(rule => ({ mode: rule.mode, value: rule.value })),
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'Falha ao executar campanha.')
      setResult(data.data)
      setConfirming(false)
    } catch (error: unknown) {
      onError({ message: error instanceof Error ? error.message : 'Falha ao executar campanha.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-md animate-in fade-in duration-150" role="dialog" aria-modal="true" aria-labelledby="campaign-title">
      <div className="flex max-h-[min(860px,calc(100vh-24px))] w-[min(900px,calc(100vw-24px))] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl animate-in zoom-in-95 duration-150">
        <header className="relative overflow-hidden border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
          <div className="pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full bg-blue-500/25 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/20">
                <Megaphone size={21} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Campanha segmentada</p>
                <h2 id="campaign-title" className="mt-1 truncate text-xl font-black">{template.name}</h2>
                <p className="mt-1 text-xs font-medium text-slate-400">Dispare o template por etiqueta ou fase do Kanban.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} disabled={sending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40" aria-label="Fechar campanha">
              <XCircle size={20} />
            </button>
          </div>
        </header>

        {result ? (
          <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-6 custom-scrollbar">
            <div className="mx-auto max-w-2xl">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-emerald-600" size={28} />
                  <div>
                    <h3 className="text-lg font-black text-emerald-950">Campanha concluída</h3>
                    <p className="text-sm font-medium text-emerald-800">{result.sent} de {result.total} mensagens foram enviadas.</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  ['Público', result.total, 'text-slate-900'],
                  ['Enviadas', result.sent, 'text-emerald-700'],
                  ['Falhas', result.failed, 'text-red-700'],
                ].map(([label, value, color]) => (
                  <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                    <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              {result.failed > 0 && (
                <section className="mt-4 rounded-2xl border border-red-200 bg-white p-4">
                  <h3 className="text-sm font-black text-slate-900">Envios que precisam de atenção</h3>
                  <div className="mt-3 space-y-2">
                    {result.results.filter(item => !item.success).map(item => (
                      <div key={item.conversationId} className="rounded-xl bg-red-50 px-3 py-2 text-xs">
                        <p className="font-black text-red-900">{item.contactName}</p>
                        <p className="mt-0.5 font-medium text-red-700">{item.error}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </main>
        ) : confirming && preview ? (
          <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-6 custom-scrollbar">
            <div className="mx-auto max-w-2xl">
              <button type="button" onClick={() => setConfirming(false)} disabled={sending} className="mb-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900">
                <ArrowLeft size={14} /> Voltar e revisar
              </button>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={22} />
                  <div>
                    <h3 className="text-lg font-black text-amber-950">Confirmar disparo para {preview.total} contatos?</h3>
                    <p className="mt-1 text-sm font-medium leading-6 text-amber-900">A campanha começará imediatamente e não poderá ser cancelada depois que as mensagens forem aceitas pela Meta.</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Segmento</p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-black text-slate-900">
                      {preview.segment.type === 'tag' ? <span>{preview.segment.emoji || '🏷️'}</span> : <Columns3 size={16} className="text-indigo-600" />}
                      {preview.segment.name}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-950 px-5 py-3 text-center text-white">
                    <p className="text-2xl font-black">{preview.total}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">destinatários</p>
                  </div>
                </div>
              </div>
            </div>
          </main>
        ) : (
          <main className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-6 custom-scrollbar">
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-5">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                      {audienceType === 'tag' ? <Tag size={17} /> : <Columns3 size={17} />}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Escolha o público</h3>
                      <p className="text-xs font-medium text-slate-500">Somente contatos deste canal serão incluídos.</p>
                    </div>
                  </div>
                  <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1" role="group" aria-label="Tipo de público">
                    <button
                      type="button"
                      onClick={() => setAudienceType('tag')}
                      aria-pressed={audienceType === 'tag'}
                      className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition ${audienceType === 'tag' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      <Tag size={14} /> Etiqueta
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudienceType('stage')}
                      aria-pressed={audienceType === 'stage'}
                      className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black transition ${audienceType === 'stage' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      <Columns3 size={14} /> Fase do Kanban
                    </button>
                  </div>
                  {audienceType === 'tag' ? (
                    <>
                      <label htmlFor="campaign-tag" className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">Etiqueta</label>
                      <select id="campaign-tag" value={tagId} onChange={event => setTagId(event.target.value)} disabled={loadingAudience} className={inputClass}>
                        <option value="">Selecione uma etiqueta</option>
                        {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.emoji || '🏷️'} {tag.name}</option>)}
                      </select>
                    </>
                  ) : (
                    <>
                      <label htmlFor="campaign-stage" className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">Fase do fluxo</label>
                      <select id="campaign-stage" value={stageId} onChange={event => setStageId(event.target.value)} disabled={loadingAudience} className={inputClass}>
                        <option value="">Selecione uma fase</option>
                        {stages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                      </select>
                    </>
                  )}
                </section>

                {variables.length > 0 && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><UserRound size={17} /></div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900">Personalização</h3>
                        <p className="text-xs font-medium text-slate-500">Defina a origem de cada variável.</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {variables.map((name, index) => (
                        <div key={`${name}-${index}`} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[120px_190px_minmax(0,1fr)] sm:items-end">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Variável</p>
                            <p className="mt-2 rounded-lg bg-white px-2 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200">{'{{'}{name}{'}}'}</p>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">Usar</label>
                            <select value={rules[index]?.mode} onChange={event => updateRule(index, { mode: event.target.value as VariableMode, value: '' })} className={inputClass}>
                              <option value="contact_name">Nome do contato</option>
                              <option value="contact_phone">Telefone do contato</option>
                              <option value="fixed">Valor fixo</option>
                            </select>
                          </div>
                          <div>
                            {rules[index]?.mode === 'fixed' ? (
                              <>
                                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">Valor</label>
                                <input value={rules[index]?.value || ''} onChange={event => updateRule(index, { value: event.target.value })} placeholder="Valor para todos" className={inputClass} />
                              </>
                            ) : (
                              <div className="flex h-[42px] items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 text-xs font-bold text-slate-500">
                                {rules[index]?.mode === 'contact_phone' ? <Phone size={14} /> : <UserRound size={14} />}
                                Preenchimento automático
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <aside className="h-fit rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-xl">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Alcance estimado</p>
                {loadingPreview ? (
                  <div className="flex h-28 items-center justify-center"><Loader2 className="animate-spin text-blue-400" size={24} /></div>
                ) : preview ? (
                  <>
                    <div className="mt-4 flex items-end gap-2">
                      <span className="text-5xl font-black tracking-tight">{preview.total}</span>
                      <span className="pb-1 text-xs font-bold text-slate-400">contatos</span>
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-400">
                      na {preview.segment.type === 'tag' ? 'etiqueta' : 'fase'} <span className="font-black text-white">{preview.segment.name}</span> deste canal
                    </p>
                    {preview.total > preview.limit && (
                      <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs font-bold leading-5 text-amber-200">Reduza o segmento para até {preview.limit} contatos.</div>
                    )}
                    {preview.sample.length > 0 && (
                      <div className="mt-5 border-t border-white/10 pt-4">
                        <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-500">Amostra do público</p>
                        <div className="space-y-2">
                          {preview.sample.map(contact => (
                            <div key={contact.conversationId} className="flex items-center gap-2 text-xs font-bold text-slate-300">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10"><UserRound size={13} /></div>
                              <span className="truncate">{contact.contactName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex h-28 flex-col items-center justify-center text-center text-slate-500">
                    <UsersRound size={24} />
                    <p className="mt-2 text-xs font-bold">Selecione {audienceType === 'tag' ? 'uma etiqueta' : 'uma fase'} para calcular o público.</p>
                  </div>
                )}
              </aside>
            </div>
          </main>
        )}

        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <p className="hidden text-xs font-medium text-slate-500 sm:block">Limite de segurança: 200 destinatários por disparo.</p>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} disabled={sending} className="rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-100 disabled:opacity-40">
              {result ? 'Fechar' : 'Cancelar'}
            </button>
            {!result && (confirming ? (
              <button type="button" onClick={handleSend} disabled={sending} className="inline-flex min-w-56 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 active:scale-95 disabled:opacity-50">
                {sending ? <Loader2 className="animate-spin" size={16} /> : <Megaphone size={16} />}
                {sending ? 'Enviando campanha' : `Confirmar ${preview?.total || 0} envios`}
              </button>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} disabled={!canReview} className="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-blue-600 active:scale-95 disabled:pointer-events-none disabled:opacity-35">
                Revisar disparo <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </footer>
      </div>
    </div>
  )
}
