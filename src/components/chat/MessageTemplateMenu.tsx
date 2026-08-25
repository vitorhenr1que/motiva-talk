'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useReducer, useState } from 'react'
import {
  Check, ChevronLeft, Edit2, ExternalLink, Loader2, MessageSquareReply, Mic, MoreVertical,
  Megaphone, Paperclip, Phone, Plus, Search, Send, Smile, Trash2, Variable, Video, X
} from 'lucide-react'
import { useChatStore } from '@/store/useChatStore'
import { BulkTemplateCampaign } from '@/components/chat/BulkTemplateCampaign'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const WhatsAppBubbleTail = ({ color }: { color: string }) => (
  <svg
    viewBox="0 0 8 13"
    className="absolute -right-[7px] top-0 h-[13px] w-[8px]"
    style={{ fill: color }}
  >
    <path d="M5.188 0H0v11.193l6.467-8.273C7.363 1.733 6.541 0 5.188 0z" />
  </svg>
)

const WhatsAppPreviewBubble = ({ cabecalho, corpo, rodape, botoes }: { cabecalho?: string, corpo: string, rodape?: string, botoes: TemplateButton[] }) => {
  const visibleButtons = botoes.length > 3 ? botoes.slice(0, 2) : botoes
  const hiddenButtonsCount = Math.max(botoes.length - visibleButtons.length, 0)

  return (
    <div className="flex flex-col items-end gap-[3px]">
      <div className="relative ml-auto max-w-[88%] rounded-[7.5px] rounded-tr-none bg-[#d9fdd3] px-2 py-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.18)]">
        <WhatsAppBubbleTail color="#d9fdd3" />

        {cabecalho && (
          <div className="mb-1.5 text-[13px] font-semibold leading-tight text-[#111b21]">
            {cabecalho}
          </div>
        )}

        <div className="whitespace-pre-wrap break-words pr-1 text-[13.2px] font-normal leading-[19px] text-[#111b21]">
          {corpo}
        </div>

        {rodape && <div className="mt-1 text-[11px] leading-4 text-[#667781]">{rodape}</div>}

        <div className="mt-0.5 flex items-center justify-end gap-1 pl-10 text-[10px] font-medium text-[#667781]">
          <span>14:44</span>
          <div className="flex -space-x-1">
            <Check size={11} className="text-[#53bdeb]" />
            <Check size={11} className="text-[#53bdeb]" />
          </div>
        </div>
      </div>

      {botoes.length > 0 && (
        <div className="ml-auto flex w-full max-w-[88%] flex-col gap-[3px]">
          {visibleButtons.map((button, index) => (
            <div
              key={index}
              className="flex min-h-9 items-center justify-center gap-2 rounded-[7.5px] bg-white px-3 py-2 text-center text-[13px] font-medium text-[#008069] shadow-[0_1px_0.5px_rgba(11,20,26,0.16)]"
            >
              {button.type === 'url' ? <ExternalLink size={14} strokeWidth={2.3} /> : <MessageSquareReply size={14} strokeWidth={2.3} />}
              <span className="min-w-0 truncate">{button.text || 'Botao'}</span>
            </div>
          ))}
          {hiddenButtonsCount > 0 && (
            <div className="flex min-h-9 items-center justify-center gap-2 rounded-[7.5px] bg-white px-3 py-2 text-center text-[13px] font-medium text-[#008069] shadow-[0_1px_0.5px_rgba(11,20,26,0.16)]">
              <MoreVertical size={14} strokeWidth={2.3} />
              <span>Ver todas as opcoes</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const WhatsAppPhonePreview = ({ cabecalho, corpo, rodape, botoes, compact = false }: {
  cabecalho?: string
  corpo: string
  rodape?: string
  botoes: TemplateButton[]
  compact?: boolean
}) => (
  <div className={cn(
    'relative mx-auto flex flex-col overflow-hidden bg-[#111b21] shadow-2xl ring-1 ring-white/10',
    compact
      ? 'h-[520px] w-[252px] rounded-[34px] border-[8px] border-[#111b21]'
      : 'h-[590px] w-[286px] rounded-[42px] border-[10px] border-[#111b21]'
  )}>
    <div className="pointer-events-none absolute left-1/2 top-0 z-30 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-[#111b21]" />

    <div className="relative z-20 flex h-10 shrink-0 items-center justify-between bg-[#075e54] px-5 pt-2 text-[10px] font-bold text-white">
      <span>14:44</span>
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-3 rounded-[1px] bg-white/80" />
        <div className="relative h-2.5 w-4 rounded-[2px] border border-white/70">
          <div className="absolute inset-0.5 w-[70%] rounded-[1px] bg-white/80" />
        </div>
      </div>
    </div>

    <div className="flex h-14 shrink-0 items-center gap-2 bg-[#075e54] px-2 text-white">
      <ChevronLeft size={22} strokeWidth={2.5} />
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dfe5e7] text-[13px] font-black text-[#607d8b]">
        MT
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold leading-tight">Motiva Talk</div>
        <div className="truncate text-[11px] font-medium leading-tight text-white/70">online</div>
      </div>
      <Video size={18} />
      <Phone size={17} />
      <MoreVertical size={18} />
    </div>

    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#efeae2]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage: 'radial-gradient(#54656f 0.65px, transparent 0.65px), radial-gradient(#54656f 0.65px, transparent 0.65px)',
          backgroundPosition: '0 0, 8px 8px',
          backgroundSize: '16px 16px',
        }}
      />
      <div className="relative flex flex-1 flex-col justify-end overflow-y-auto px-2.5 pb-2.5 pt-3 custom-scrollbar">
        <div className="mx-auto mb-2 rounded-md bg-[#fff3bf] px-3 py-1.5 text-center text-[10px] font-medium leading-4 text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
          As mensagens e chamadas sao protegidas com criptografia de ponta a ponta.
        </div>
        <div className="mx-auto mb-2 rounded-md bg-white/80 px-3 py-1 text-[10px] font-medium text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">Hoje</div>
        <WhatsAppPreviewBubble cabecalho={cabecalho} corpo={corpo} rodape={rodape} botoes={botoes} />
      </div>

      <div className="relative flex h-14 shrink-0 items-center gap-1.5 bg-transparent px-1.5 pb-1.5">
        <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-3 text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
          <Smile size={20} />
          <span className="min-w-0 flex-1 truncate text-[14px] text-[#8696a0]">Mensagem</span>
          <Paperclip size={19} />
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white shadow-[0_1px_0.5px_rgba(11,20,26,0.22)]">
          <Mic size={19} />
        </div>
      </div>
    </div>
  </div>
)

type TemplateButton = {
  type: 'url' | 'quick_reply'
  text: string
  url?: string
}

type TemplateStatus = 'rascunho' | 'pendente' | 'aprovado' | 'rejeitado' | 'pausado' | 'desativado' | 'excluido'

type MessageTemplate = {
  id: string
  name: string
  category: 'utility' | 'marketing' | 'authentication'
  language: string
  bodyText: string
  header?: any
  footerText?: string | null
  buttons?: TemplateButton[]
  status: TemplateStatus
  errorMessage?: string | null
}

type TemplateVariable = {
  name: string
  example: string
}

type TemplateFormState = {
  channelId: string
  nome_do_template: string
  categoria: 'utility' | 'marketing' | 'authentication'
  idioma: string
  corpo: string
  cabecalho: string
  rodape: string
  variaveis: TemplateVariable[]
  botoes: TemplateButton[]
}

type Props = {
  onClose: () => void
  onError: (error: { message: string; code?: string }) => void
}

type FormAction =
  | { type: 'reset'; channelId: string; template?: MessageTemplate | null }
  | { type: 'field'; field: keyof Omit<TemplateFormState, 'variaveis' | 'botoes'>; value: string }
  | { type: 'addVariable'; variable: TemplateVariable }
  | { type: 'updateVariable'; index: number; patch: Partial<TemplateVariable> }
  | { type: 'removeVariable'; name: string }
  | { type: 'addButton' }
  | { type: 'updateButton'; index: number; patch: Partial<TemplateButton> }
  | { type: 'removeButton'; index: number }

const STATUS_LABEL: Record<TemplateStatus, string> = {
  rascunho: 'Rascunho',
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  pausado: 'Pausado',
  desativado: 'Desativado',
  excluido: 'Excluido',
}

const STATUS_STYLE: Record<TemplateStatus, string> = {
  rascunho: 'bg-slate-100 text-slate-600 border-slate-200',
  pendente: 'bg-amber-50 text-amber-700 border-amber-200',
  aprovado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejeitado: 'bg-red-50 text-red-700 border-red-200',
  pausado: 'bg-orange-50 text-orange-700 border-orange-200',
  desativado: 'bg-slate-100 text-slate-500 border-slate-200',
  excluido: 'bg-slate-100 text-slate-500 border-slate-200',
}

const STATUS_DOT: Record<TemplateStatus, string> = {
  rascunho: 'bg-slate-400',
  pendente: 'bg-amber-500',
  aprovado: 'bg-emerald-500',
  rejeitado: 'bg-red-500',
  pausado: 'bg-orange-500',
  desativado: 'bg-slate-400',
  excluido: 'bg-slate-400',
}

const CATEGORY_LABEL: Record<MessageTemplate['category'], string> = {
  utility: 'Utilidade',
  marketing: 'Marketing',
  authentication: 'Autenticacao',
}

function normalizeSearchValue(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getCategoryLabel(category: MessageTemplate['category']) {
  return CATEGORY_LABEL[category] || String(category || '')
}

function getTemplateSearchText(template: MessageTemplate) {
  return normalizeSearchValue([
    template.name,
    template.bodyText,
    template.category,
    getCategoryLabel(template.category),
    template.language,
    template.status,
    STATUS_LABEL[template.status],
    template.header?.type === 'text' ? template.header.text : '',
    template.footerText,
    ...(template.buttons || []).map(button => button.text),
  ].join(' '))
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
const labelClass = 'mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-400'

const VARIABLE_SUGGESTIONS: TemplateVariable[] = [
  { name: 'nome', example: 'João' },
  { name: 'telefone', example: '(75) 99999-0000' },
  { name: 'data', example: '02/05/2026' },
  { name: 'pedido', example: '#48291' },
  { name: 'protocolo', example: 'MT-2048' },
  { name: 'valor', example: 'R$ 149,90' },
]

function emptyForm(channelId: string): TemplateFormState {
  return {
    channelId,
    nome_do_template: '',
    categoria: 'utility',
    idioma: 'pt_BR',
    corpo: '',
    cabecalho: '',
    rodape: '',
    variaveis: [],
    botoes: [],
  }
}

function normalizeVariableName(value: string) {
  return value.replace(/[{}]/g, '').trim().toLowerCase().replace(/\s+/g, '_')
}

function variableToken(name: string) {
  return `{{${normalizeVariableName(name)}}}`
}

function extractVariableNames(text: string) {
  const matches = text.match(/\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/g) || []
  return matches.map(match => normalizeVariableName(match))
}

function uniqueVariablesFromText(text: string, current: TemplateVariable[]) {
  const byName = new Map(current.map(item => [item.name, item]))
  return Array.from(new Set(extractVariableNames(text))).map(name => (
    byName.get(name) || VARIABLE_SUGGESTIONS.find(item => item.name === name) || { name, example: '' }
  ))
}

function renderWithExamples(text: string, variables: TemplateVariable[]) {
  return text.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (_, name) => {
    const found = variables.find(item => item.name === normalizeVariableName(name))
    return found?.example || `{{${name}}}`
  })
}

function extractVariablesFromTemplate(template: MessageTemplate) {
  const metadata = (template as any).metadata
  if (Array.isArray(metadata?.variables)) return metadata.variables as TemplateVariable[]
  return uniqueVariablesFromText(template.bodyText, [])
}

function formReducer(state: TemplateFormState, action: FormAction): TemplateFormState {
  if (action.type === 'reset') {
    if (!action.template) return emptyForm(action.channelId)
    const variables = extractVariablesFromTemplate(action.template)
    return {
      channelId: action.channelId,
      nome_do_template: action.template.name,
      categoria: action.template.category,
      idioma: action.template.language,
      corpo: action.template.bodyText,
      cabecalho: action.template.header?.type === 'text' ? action.template.header.text : '',
      rodape: action.template.footerText || '',
      variaveis: variables,
      botoes: (action.template.buttons || []).filter(button => button.type === 'url' || button.type === 'quick_reply'),
    }
  }

  if (action.type === 'field') {
    const next = { ...state, [action.field]: action.value }
    if (action.field === 'corpo') {
      next.variaveis = uniqueVariablesFromText(action.value, state.variaveis)
    }
    return next
  }

  if (action.type === 'addVariable') {
    const name = normalizeVariableName(action.variable.name)
    if (!name || state.variaveis.some(item => item.name === name)) return state
    return {
      ...state,
      corpo: `${state.corpo}${state.corpo && !state.corpo.endsWith(' ') ? ' ' : ''}${variableToken(name)}`,
      variaveis: [...state.variaveis, { name, example: action.variable.example }],
    }
  }

  if (action.type === 'updateVariable') {
    return {
      ...state,
      variaveis: state.variaveis.map((item, index) => index === action.index ? { ...item, ...action.patch } : item),
    }
  }

  if (action.type === 'removeVariable') {
    const token = variableToken(action.name)
    return {
      ...state,
      corpo: state.corpo.replaceAll(token, '').replace(/\s{2,}/g, ' ').trim(),
      variaveis: state.variaveis.filter(item => item.name !== action.name),
    }
  }

  if (action.type === 'addButton') {
    return {
      ...state,
      botoes: [...state.botoes, { type: 'quick_reply', text: '' }],
    }
  }

  if (action.type === 'updateButton') {
    return {
      ...state,
      botoes: state.botoes.map((button, index) => index === action.index ? { ...button, ...action.patch } : button),
    }
  }

  if (action.type === 'removeButton') {
    return { ...state, botoes: state.botoes.filter((_, index) => index !== action.index) }
  }

  return state
}

function validateForm(form: TemplateFormState) {
  const errors: string[] = []
  if (!form.nome_do_template.trim()) errors.push('Informe o nome do template.')
  if (!/^[a-z0-9_]+$/.test(form.nome_do_template.trim())) errors.push('Use apenas letras minusculas, numeros e underscore no nome.')
  if (!form.corpo.trim()) errors.push('Informe o corpo da mensagem.')

  const names = extractVariableNames(form.corpo)
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index)
  if (duplicates.length) errors.push(`Variavel duplicada no corpo: {{${duplicates[0]}}}.`)

  for (const variable of form.variaveis) {
    if (!variable.example.trim()) errors.push(`Informe exemplo real para {{${variable.name}}}.`)
  }

  form.botoes.forEach((button, index) => {
    if (!button.text.trim()) errors.push(`Informe o texto do botao ${index + 1}.`)
    if (button.type === 'url' && !/^https?:\/\//i.test(button.url || '')) {
      errors.push(`Informe uma URL valida no botao ${index + 1}.`)
    }
  })

  return errors
}

function buildSendVariables(template: MessageTemplate, values: string[]) {
  return extractVariableNames(template.bodyText).map((_, index) => values[index] || '')
}

export const MessageTemplateMenu = ({ onClose, onError }: Props) => {
  const { activeConversation, addMessage } = useChatStore()
  const channelId = activeConversation?.channel?.id || ''
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<MessageTemplate | null>(null)
  const [sendExamples, setSendExamples] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MessageTemplate | null>(null)
  const [variableInputOpen, setVariableInputOpen] = useState(false)
  const [variableName, setVariableName] = useState('')
  const [campaignOpen, setCampaignOpen] = useState(false)
  const [form, dispatch] = useReducer(formReducer, channelId, emptyForm)

  const fetchTemplates = async (background = false) => {
    if (!channelId) return
    if (!background) setLoading(true)
    try {
      const resp = await fetch(`/api/whatsapp/templates?channelId=${channelId}`)
      const data = await resp.json()
      if (!resp.ok || !data.success) throw new Error(data.message || 'Falha ao carregar templates.')
      const nextTemplates = data.data || []
      setTemplates(nextTemplates)
      setSelected(current => current
        ? nextTemplates.find((template: MessageTemplate) => template.id === current.id) || current
        : null
      )
    } catch (error: any) {
      if (!background) onError({ message: error.message || 'Falha ao carregar templates.' })
    } finally {
      if (!background) setLoading(false)
    }
  }

  useEffect(() => {
    dispatch({ type: 'reset', channelId })
    fetchTemplates()
    const statusSyncTimer = window.setInterval(() => {
      void fetchTemplates(true)
    }, 60_000)

    return () => window.clearInterval(statusSyncTimer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

  const filtered = useMemo(() => {
    const s = normalizeSearchValue(search.trim())
    if (!s) return templates
    return templates.filter(template => getTemplateSearchText(template).includes(s))
  }, [templates, search])

  const formErrors = useMemo(() => validateForm(form), [form])
  const approvedCount = templates.filter(template => template.status === 'aprovado').length
  const pendingCount = templates.filter(template => template.status === 'pendente').length
  const selectedVariables = selected ? extractVariableNames(selected.bodyText) : []
  const selectedPreviewVariables = selectedVariables.map((name, index) => ({ name, example: sendExamples[index] || '' }))
  const formPreview = renderWithExamples(form.corpo || 'Ola, {{nome}}, sua entrega sera feita em {{data}}.', form.variaveis)

  const startCreate = () => {
    setFormOpen(true)
    setSelected(null)
    setEditing(null)
    setVariableInputOpen(false)
    dispatch({ type: 'reset', channelId })
  }

  const startEdit = (template: MessageTemplate) => {
    setEditing(template)
    setSelected(null)
    setFormOpen(true)
    dispatch({ type: 'reset', channelId, template })
  }

  const addVariable = (variable?: TemplateVariable) => {
    const item = variable || {
      name: variableName,
      example: VARIABLE_SUGGESTIONS.find(suggestion => suggestion.name === normalizeVariableName(variableName))?.example || '',
    }
    dispatch({ type: 'addVariable', variable: item })
    setVariableName('')
    setVariableInputOpen(false)
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (formErrors.length) {
      onError({ message: formErrors[0], code: 'VALIDATION_ERROR' })
      return
    }

    setSaving(true)
    try {
      const url = editing ? `/api/whatsapp/templates/${editing.id}` : '/api/whatsapp/templates'
      const method = editing ? 'PATCH' : 'POST'
      const payload = {
        ...form,
        cabecalho: form.cabecalho ? { type: 'text', text: form.cabecalho } : null,
        rodape: form.rodape || null,
        botoes: form.botoes.filter(button => button.text),
        variaveis: form.variaveis,
      }
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) throw new Error(data.message || 'Falha ao enviar para aprovacao.')
      setFormOpen(false)
      setEditing(null)
      dispatch({ type: 'reset', channelId })
      await fetchTemplates()
    } catch (error: any) {
      onError({ message: error.message || 'Falha ao enviar para aprovacao.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (template: MessageTemplate) => {
    if (!confirm('Excluir este template?')) return
    try {
      const resp = await fetch(`/api/whatsapp/templates/${template.id}`, { method: 'DELETE' })
      const data = await resp.json()
      if (!resp.ok || !data.success) throw new Error(data.message || 'Falha ao excluir template.')
      if (selected?.id === template.id) setSelected(null)
      await fetchTemplates()
    } catch (error: any) {
      onError({ message: error.message || 'Falha ao excluir template.' })
    }
  }

  const handleSelect = (template: MessageTemplate) => {
    setSelected(template)
    setCampaignOpen(false)
    setSendExamples(extractVariableNames(template.bodyText).map((name) => {
      const suggestion = VARIABLE_SUGGESTIONS.find(item => item.name === name)
      return suggestion?.example || ''
    }))
    setFormOpen(false)
  }

  const handleSend = async () => {
    if (!selected || !activeConversation) return
    setSaving(true)
    try {
      const resp = await fetch('/api/whatsapp/templates/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selected.id,
          conversationId: activeConversation.id,
          variables: buildSendVariables(selected, sendExamples),
        }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) throw new Error(data.message || 'Falha ao enviar template.')
      addMessage(data.data)
      onClose()
    } catch (error: any) {
      onError({ message: error.message || 'Falha ao enviar template.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="flex h-[min(900px,calc(100vh-24px))] w-[min(1320px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-900/10 animate-in zoom-in-95 duration-150 md:flex-row">
        <div className={cn(
          'flex w-full shrink-0 flex-col border-slate-200 bg-slate-50/80 md:w-[376px] md:border-r',
          formOpen ? 'max-md:hidden' : 'max-md:max-h-[46vh] max-md:border-b'
        )}>
          <div className="border-b border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Biblioteca Meta Cloud</p>
                <h2 className="mt-1 truncate text-xl font-black text-slate-950">Templates WhatsApp</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">{templates.length} modelos cadastrados</p>
              </div>
              <button type="button" onClick={startCreate} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-900/15 transition-all hover:bg-blue-600 active:scale-95" title="Criar template">
                <Plus size={18} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total</p>
                <p className="mt-1 text-lg font-black text-slate-900">{templates.length}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Prontos</p>
                <p className="mt-1 text-lg font-black text-emerald-700">{approvedCount}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Analise</p>
                <p className="mt-1 text-lg font-black text-amber-700">{pendingCount}</p>
              </div>
            </div>

            <div className="relative mt-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Buscar por nome, categoria ou texto"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2.5 custom-scrollbar">
            {loading ? (
              <div className="flex h-48 items-center justify-center text-slate-400"><Loader2 className="animate-spin" size={24} /></div>
            ) : filtered.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-center">
                <MessageSquareReply size={24} className="mb-2 text-slate-300" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Nenhum template</p>
                <p className="mt-1 max-w-48 text-xs font-medium text-slate-400">Ajuste a busca ou crie um novo modelo.</p>
              </div>
            ) : filtered.map(template => (
              <button
                key={template.id}
                type="button"
                onClick={() => handleSelect(template)}
                className={cn(
                  'group mb-2 w-full rounded-xl border p-3 text-left transition-all active:scale-[0.99]',
                  selected?.id === template.id
                    ? 'border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-900/15'
                    : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm'
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[template.status])} />
                      <span className="truncate text-xs font-black uppercase">{template.name}</span>
                    </div>
                    <p className={cn('mt-1 text-[10px] font-black uppercase tracking-widest', selected?.id === template.id ? 'text-slate-300' : 'text-slate-400')}>
                      {getCategoryLabel(template.category)} / {template.language}
                    </p>
                  </div>
                  <span className={cn('shrink-0 rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest', STATUS_STYLE[template.status])}>
                    {STATUS_LABEL[template.status]}
                  </span>
                </div>
                <p className={cn('line-clamp-2 text-[11px] font-medium leading-relaxed', selected?.id === template.id ? 'text-slate-300' : 'text-slate-500')}>
                  {template.bodyText}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {formOpen ? (editing ? 'Editando template' : 'Novo template') : selected ? 'Preparar envio' : 'Central de templates'}
              </p>
              <p className="mt-1 truncate text-sm font-black text-slate-900">
                {formOpen ? 'Componha, valide e envie para aprovacao' : selected ? selected.name : 'Selecione um modelo ou crie uma mensagem aprovada'}
              </p>
            </div>
            <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700" title="Fechar">
              <X size={18} />
            </button>
          </div>

          {formOpen ? (
            <form onSubmit={handleSave} className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_400px] overflow-hidden max-lg:grid-cols-1">
              <div className="min-h-0 overflow-y-auto bg-slate-50/60 p-5 custom-scrollbar">
                <div className="space-y-5">
                  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">Identificacao</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">Nome tecnico, categoria e idioma enviados para a Meta.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
                      <div>
                        <label className={labelClass}>Nome</label>
                        <input required value={form.nome_do_template} onChange={e => dispatch({ type: 'field', field: 'nome_do_template', value: e.target.value })} placeholder="confirmacao_pedido" className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Categoria</label>
                        <select value={form.categoria} onChange={e => dispatch({ type: 'field', field: 'categoria', value: e.target.value })} className={inputClass}>
                          <option value="utility">Utility</option>
                          <option value="marketing">Marketing</option>
                          <option value="authentication">Authentication</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Idioma</label>
                        <input required value={form.idioma} onChange={e => dispatch({ type: 'field', field: 'idioma', value: e.target.value })} placeholder="pt_BR" className={inputClass} />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">Mensagem</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">Use variaveis com exemplos reais para acelerar a aprovacao.</p>
                      </div>
                      <button type="button" onClick={() => setVariableInputOpen(!variableInputOpen)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-blue-600 active:scale-95">
                        <Variable size={13} />
                        Variavel
                      </button>
                    </div>
                    <textarea
                      required
                      rows={7}
                      value={form.corpo}
                      onChange={e => dispatch({ type: 'field', field: 'corpo', value: e.target.value })}
                      onFocus={() => setVariableInputOpen(true)}
                      placeholder="Ola, {{nome}}, sua entrega sera feita em {{data}}."
                      className={cn(
                        'w-full resize-none rounded-xl border bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-800 outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10',
                        formErrors.some(error => error.includes('corpo') || error.includes('Variavel')) ? 'border-red-300' : 'border-slate-200'
                      )}
                    />
                    {variableInputOpen && (
                      <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                        <div className="mb-3 flex gap-2">
                          <input value={variableName} onChange={e => setVariableName(e.target.value)} placeholder="nome_da_variavel" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-blue-500" />
                          <button type="button" onClick={() => addVariable()} className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-700">Adicionar</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {VARIABLE_SUGGESTIONS.map(suggestion => (
                            <button key={suggestion.name} type="button" onClick={() => addVariable(suggestion)} className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-blue-700 transition-all hover:border-blue-400 hover:bg-blue-600 hover:text-white">
                              {variableToken(suggestion.name)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-3 max-md:grid-cols-1">
                      <input value={form.cabecalho} onChange={e => dispatch({ type: 'field', field: 'cabecalho', value: e.target.value })} placeholder="Cabecalho opcional" className={inputClass} />
                      <input value={form.rodape} onChange={e => dispatch({ type: 'field', field: 'rodape', value: e.target.value })} placeholder="Rodape opcional" className={inputClass} />
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">Exemplos de variaveis</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">{form.variaveis.length} exemplos conectados ao corpo.</p>
                      </div>
                    </div>
                    {form.variaveis.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                        <Variable size={24} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-xs font-bold text-slate-400">Nenhuma variavel adicionada</p>
                        <p className="mt-1 text-[10px] text-slate-400/80">Inclua tokens como {"{{nome}}"} no corpo da mensagem.</p>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {form.variaveis.map((item, index) => (
                          <div key={item.name} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="rounded-md bg-white px-2 py-1 text-[10px] font-black text-slate-700 ring-1 ring-slate-200">{variableToken(item.name)}</span>
                              <button type="button" onClick={() => dispatch({ type: 'removeVariable', name: item.name })} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500" title="Remover variavel">
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <input
                              value={item.example}
                              onChange={e => dispatch({ type: 'updateVariable', index, patch: { example: e.target.value } })}
                              placeholder={`Ex: ${VARIABLE_SUGGESTIONS.find(s => s.name === item.name)?.example || 'Joao'}`}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none transition-all focus:border-blue-500"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">Botoes interativos</p>
                        <p className="mt-1 text-xs font-medium text-slate-500">Adicione respostas rapidas ou links externos.</p>
                      </div>
                      <button type="button" onClick={() => dispatch({ type: 'addButton' })} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-blue-700 hover:bg-blue-100">
                        <Plus size={13} />
                        Botao
                      </button>
                    </div>
                    {form.botoes.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                        <MessageSquareReply size={24} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-xs font-bold text-slate-400">Nenhum botao configurado</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {form.botoes.map((button, index) => (
                          <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="mb-3 flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Botao {index + 1}</span>
                              <button type="button" onClick={() => dispatch({ type: 'removeButton', index })} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-500" title="Remover botao">
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                              <div>
                                <label className={labelClass}>Texto do botao</label>
                                <input value={button.text} onChange={e => dispatch({ type: 'updateButton', index, patch: { text: e.target.value } })} placeholder="Ex: Falar com atendente" className={inputClass} />
                              </div>
                              <div>
                                <label className={labelClass}>Tipo de acao</label>
                                <select value={button.type} onChange={e => dispatch({ type: 'updateButton', index, patch: { type: e.target.value as TemplateButton['type'] } })} className={inputClass}>
                                  <option value="quick_reply">Resposta rapida</option>
                                  <option value="url">Link externo (URL)</option>
                                </select>
                              </div>
                            </div>
                            {button.type === 'url' && (
                              <div className="mt-3 animate-in fade-in slide-in-from-top-1">
                                <label className={labelClass}>URL de destino</label>
                                <div className="relative">
                                  <ExternalLink size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                                  <input value={button.url || ''} onChange={e => dispatch({ type: 'updateButton', index, patch: { url: e.target.value } })} placeholder="https://seu-site.com" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-500" />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {formErrors.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{formErrors[0]}</div>
                  )}
                </div>
              </div>

              <aside className="flex min-h-0 flex-col border-l border-slate-200 bg-slate-950 p-5 max-lg:hidden">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preview ao vivo</p>
                    <p className="mt-1 text-xs font-bold text-white">WhatsApp</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </div>
                </div>

                <div className="flex flex-1 items-center justify-center">
                  <WhatsAppPhonePreview
                    cabecalho={form.cabecalho}
                    corpo={formPreview}
                    rodape={form.rodape}
                    botoes={form.botoes}
                  />
                </div>

                <button disabled={saving || formErrors.length > 0} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-950 transition-all hover:bg-blue-50 active:scale-95 disabled:pointer-events-none disabled:opacity-40">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Enviar para aprovacao
                </button>
              </aside>
              <div className="col-span-full hidden justify-end gap-2 border-t border-slate-200 bg-white p-4 max-lg:flex">
                <button type="button" onClick={() => { setFormOpen(false); setEditing(null) }} className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100">Cancelar</button>
                <button disabled={saving || formErrors.length > 0} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-blue-600 disabled:opacity-40">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Enviar para aprovacao
                </button>
              </div>
            </form>
          ) : selected ? (
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_400px] overflow-hidden max-lg:grid-cols-1">
              <div className="min-h-0 overflow-y-auto bg-slate-50/60 p-5 custom-scrollbar">
                <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="min-w-0">
                    <h3 className="truncate text-xl font-black text-slate-950">{selected.name}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-widest', STATUS_STYLE[selected.status])}>{STATUS_LABEL[selected.status]}</span>
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">{getCategoryLabel(selected.category)}</span>
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">{selected.language}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => startEdit(selected)} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600" title="Editar template"><Edit2 size={16} /></button>
                    <button type="button" onClick={() => handleDelete(selected)} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-red-50 hover:text-red-600" title="Excluir template"><Trash2 size={16} /></button>
                  </div>
                </div>

                {selected.status !== 'aprovado' && (
                  <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900">
                    Este template ainda nao esta pronto para envio. Status: {STATUS_LABEL[selected.status]}.
                  </div>
                )}

                {selectedVariables.length > 0 && (
                  <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3">
                      <p className="text-sm font-black text-slate-900">Valores de envio</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">Preencha as variaveis antes de enviar para a conversa ativa.</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {selectedVariables.map((name, index) => (
                        <div key={name}>
                          <label className={labelClass}>{variableToken(name)}</label>
                          <input
                            value={sendExamples[index] || ''}
                            onChange={event => {
                              const next = [...sendExamples]
                              next[index] = event.target.value
                              setSendExamples(next)
                            }}
                            className={inputClass}
                            placeholder={`Valor para ${variableToken(name)}`}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="mb-3 text-sm font-black text-slate-900">Conteudo aprovado</p>
                  <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-6 text-slate-700">
                    {selected.bodyText}
                  </div>
                </section>
              </div>

              <aside className="flex min-h-0 flex-col border-l border-slate-200 bg-slate-950 p-5 max-lg:min-h-[560px] max-lg:border-l-0 max-lg:border-t">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visualizacao do envio</p>
                  <span className={cn('rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-widest', STATUS_STYLE[selected.status])}>{STATUS_LABEL[selected.status]}</span>
                </div>
                <div className="flex min-h-0 flex-1 items-center justify-center">
                  <WhatsAppPhonePreview
                    compact
                    cabecalho={selected.header?.type === 'text' ? selected.header.text : undefined}
                    corpo={renderWithExamples(selected.bodyText, selectedPreviewVariables)}
                    rodape={selected.footerText || undefined}
                    botoes={selected.buttons || []}
                  />
                </div>
                <div className="mt-4 grid gap-2">
                  <button type="button" onClick={handleSend} disabled={saving || selected.status !== 'aprovado'} className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-950 shadow-lg transition-all hover:bg-blue-50 active:scale-95 disabled:opacity-40">
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Enviar para esta conversa
                  </button>
                  <button type="button" onClick={() => setCampaignOpen(true)} disabled={saving || selected.status !== 'aprovado'} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-95 disabled:opacity-40">
                    <Megaphone size={16} />
                    Disparar por etiqueta
                  </button>
                </div>
              </aside>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center bg-slate-50 p-8 text-center">
              <div className="max-w-sm">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
                  <MessageSquareReply size={22} />
                </div>
                <p className="text-sm font-black text-slate-900">Nenhum template selecionado</p>
                <p className="mt-2 text-xs font-medium leading-5 text-slate-500">Escolha um modelo na biblioteca para enviar ou crie um novo template para aprovacao.</p>
                <button type="button" onClick={startCreate} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-blue-600 active:scale-95">
                  <Plus size={14} />
                  Criar template
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {campaignOpen && selected && (
        <BulkTemplateCampaign
          template={selected}
          onClose={() => setCampaignOpen(false)}
          onError={onError}
        />
      )}
    </div>
  )
}
