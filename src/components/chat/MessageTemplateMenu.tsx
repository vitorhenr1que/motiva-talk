'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useReducer, useState } from 'react'
import {
  Check, Edit2, ExternalLink, Loader2, MessageSquareReply, MoreVertical, Plus, Search,
  Send, Trash2, Variable, X
} from 'lucide-react'
import { useChatStore } from '@/store/useChatStore'
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
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative ml-auto max-w-[90%] rounded-xl rounded-tr-none bg-[#dcf8c6] p-2.5 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] ring-1 ring-black/5">
        <WhatsAppBubbleTail color="#dcf8c6" />

        {cabecalho && (
          <div className="mb-1.5 text-[13px] font-black leading-tight text-[#111b21]">
            {cabecalho}
          </div>
        )}

        <div className="whitespace-pre-wrap text-[13px] leading-[19px] text-[#111b21]">
          {corpo}
        </div>

        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#667781] font-bold">
          {rodape && <span className="mr-auto text-[11px] font-medium italic opacity-70">{rodape}</span>}
          <span>14:44</span>
          <div className="flex -space-x-1.5">
            <Check size={11} className="text-[#53bdeb]" />
            <Check size={11} className="text-[#53bdeb]" />
          </div>
        </div>
      </div>

      {botoes.length > 0 && (
        <div className="flex flex-col gap-1 ml-auto w-full max-w-[90%]">
          {botoes.map((button, index) => (
            <div
              key={index}
              className="flex items-center justify-center gap-2 rounded-xl bg-white/90 backdrop-blur-sm py-2.5 text-[13px] font-bold text-[#008069] shadow-sm ring-1 ring-black/5 transition-all hover:bg-white active:scale-95"
            >
              {button.type === 'url' ? <ExternalLink size={14} /> : <MessageSquareReply size={14} />}
              {button.text || 'Botão'}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
  const [form, dispatch] = useReducer(formReducer, channelId, emptyForm)

  const fetchTemplates = async () => {
    if (!channelId) return
    setLoading(true)
    try {
      const resp = await fetch(`/api/whatsapp/templates?channelId=${channelId}`)
      const data = await resp.json()
      if (!resp.ok || !data.success) throw new Error(data.message || 'Falha ao carregar templates.')
      setTemplates(data.data || [])
    } catch (error: any) {
      onError({ message: error.message || 'Falha ao carregar templates.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    dispatch({ type: 'reset', channelId })
    fetchTemplates()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return templates.filter(template =>
      template.name.toLowerCase().includes(s) ||
      template.bodyText.toLowerCase().includes(s) ||
      template.category.toLowerCase().includes(s)
    )
  }, [templates, search])

  const formErrors = useMemo(() => validateForm(form), [form])
  const approvedCount = templates.filter(template => template.status === 'aprovado').length
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
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="flex h-[min(860px,calc(100vh-32px))] w-[min(1280px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-900/10 animate-in zoom-in-95 duration-150">
      <div className="flex w-[360px] shrink-0 flex-col border-r border-slate-100 bg-slate-50/60 max-md:hidden">
        <div className="border-b border-slate-100 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-800">Templates WhatsApp</p>
              <p className="mt-1 text-[11px] font-bold text-slate-400">{approvedCount} prontos para uso</p>
            </div>
            <button type="button" onClick={startCreate} className="rounded-xl bg-blue-600 p-2 text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95" title="Criar template">
              <Plus size={16} />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar template..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-bold text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-slate-400"><Loader2 className="animate-spin" size={24} /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-[11px] font-black uppercase tracking-widest text-slate-300">Nenhum template</div>
          ) : filtered.map(template => (
            <button
              key={template.id}
              type="button"
              onClick={() => handleSelect(template)}
              className={cn(
                'mb-2 flex w-full flex-col rounded-xl border p-3 text-left transition-all',
                selected?.id === template.id ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-white bg-white hover:border-slate-200 hover:shadow-sm'
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-black uppercase">{template.name}</span>
                <span className={cn('rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest', STATUS_STYLE[template.status])}>
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
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            {formOpen ? 'Criar e enviar para aprovacao' : 'Selecionar template'}
          </p>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        {formOpen ? (
          <form onSubmit={handleSave} className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_420px] overflow-hidden max-lg:grid-cols-1">
            <div className="min-h-0 space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
                <div className="col-span-1">
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Nome</label>
                  <input required value={form.nome_do_template} onChange={e => dispatch({ type: 'field', field: 'nome_do_template', value: e.target.value })} placeholder="confirmacao_pedido" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Categoria</label>
                  <select value={form.categoria} onChange={e => dispatch({ type: 'field', field: 'categoria', value: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-blue-500">
                    <option value="utility">Utility</option>
                    <option value="marketing">Marketing</option>
                    <option value="authentication">Authentication</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Idioma</label>
                  <input required value={form.idioma} onChange={e => dispatch({ type: 'field', field: 'idioma', value: e.target.value })} placeholder="pt_BR" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Corpo da mensagem</label>
                  <button type="button" onClick={() => setVariableInputOpen(!variableInputOpen)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-black">
                    <Variable size={13} />
                    Variavel
                  </button>
                </div>
                <textarea
                  required
                  rows={6}
                  value={form.corpo}
                  onChange={e => dispatch({ type: 'field', field: 'corpo', value: e.target.value })}
                  onFocus={() => setVariableInputOpen(true)}
                  placeholder="Ola, {{nome}}, sua entrega sera feita em {{data}}."
                  className={cn(
                    'w-full resize-none rounded-xl border bg-slate-50 p-3 text-sm font-bold outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10',
                    formErrors.some(error => error.includes('corpo') || error.includes('Variavel')) ? 'border-red-300' : 'border-slate-200'
                  )}
                />
                {variableInputOpen && (
                  <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="mb-3 flex gap-2">
                      <input value={variableName} onChange={e => setVariableName(e.target.value)} placeholder="nome_da_variavel" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:border-blue-500" />
                      <button type="button" onClick={() => addVariable()} className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-blue-700">Adicionar</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {VARIABLE_SUGGESTIONS.map(suggestion => (
                        <button key={suggestion.name} type="button" onClick={() => addVariable(suggestion)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-black text-slate-600 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                          {variableToken(suggestion.name)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                <input value={form.cabecalho} onChange={e => dispatch({ type: 'field', field: 'cabecalho', value: e.target.value })} placeholder="Cabecalho opcional" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-blue-500" />
                <input value={form.rodape} onChange={e => dispatch({ type: 'field', field: 'rodape', value: e.target.value })} placeholder="Rodape opcional" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-blue-500" />
              </div>

              <section className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Exemplos de variaveis</p>
                    <p className="mt-1 text-xs font-medium text-slate-400">Os valores abaixo alimentam a pre-visualizacao ao vivo.</p>
                  </div>
                </div>
                <div className="grid gap-2">
                  {form.variaveis.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50 p-6 text-center">
                      <Variable size={24} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-xs font-bold text-slate-400">Nenhuma variável adicionada</p>
                      <p className="mt-1 text-[10px] text-slate-400/80">Adicione variáveis no corpo da mensagem (ex: Ola, {"{{nome}}"}) para configurar exemplos reais.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {form.variaveis.map((item, index) => (
                        <div key={item.name} className="group relative flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-3 transition-all hover:border-blue-200 hover:shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600 ring-1 ring-slate-200/50">{variableToken(item.name)}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Exemplo real</span>
                            </div>
                            <button type="button" onClick={() => dispatch({ type: 'removeVariable', name: item.name })} className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <input
                            value={item.example}
                            onChange={e => dispatch({ type: 'updateVariable', index, patch: { example: e.target.value } })}
                            placeholder={`Ex: ${VARIABLE_SUGGESTIONS.find(s => s.name === item.name)?.example || 'João'}`}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Botoes interativos</p>
                  <button type="button" onClick={() => dispatch({ type: 'addButton' })} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-700 hover:bg-blue-100">
                    <Plus size={13} />
                    Botao
                  </button>
                </div>
                <div className="grid gap-3">
                  {form.botoes.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50 p-6 text-center">
                      <MessageSquareReply size={24} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-xs font-bold text-slate-400">Nenhum botão configurado</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {form.botoes.map((button, index) => (
                        <div key={index} className="relative rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:shadow-md">
                          <button
                            type="button"
                            onClick={() => dispatch({ type: 'removeButton', index })}
                            className="absolute -right-2 -top-2 h-7 w-7 items-center justify-center rounded-full bg-white text-slate-400 shadow-md ring-1 ring-slate-100 transition-all hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 size={14} className="mx-auto" />
                          </button>

                          <div className="grid gap-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">Texto do Botão</label>
                                <input
                                  value={button.text}
                                  onChange={e => dispatch({ type: 'updateButton', index, patch: { text: e.target.value } })}
                                  placeholder="Ex: Falar com atendente"
                                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">Tipo de Ação</label>
                                <select
                                  value={button.type}
                                  onChange={e => dispatch({ type: 'updateButton', index, patch: { type: e.target.value as TemplateButton['type'] } })}
                                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
                                >
                                  <option value="quick_reply">Resposta Rápida</option>
                                  <option value="url">Link Externo (URL)</option>
                                </select>
                              </div>
                            </div>

                            {button.type === 'url' && (
                              <div className="animate-in fade-in slide-in-from-top-1">
                                <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">URL de Destino</label>
                                <div className="relative">
                                  <ExternalLink size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                                  <input
                                    value={button.url || ''}
                                    onChange={e => dispatch({ type: 'updateButton', index, patch: { url: e.target.value } })}
                                    placeholder="https://seu-site.com"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {formErrors.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{formErrors[0]}</div>
              )}
            </div>

            <aside className="flex min-h-0 flex-col items-center justify-center border-l border-slate-100 bg-slate-50 p-6 max-lg:hidden">
              <div className="w-full max-w-[280px]">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pré-visualização</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">WhatsApp</span>
                  </div>
                </div>

                {/* Real Phone Mockup */}
                <div className="mx-auto flex h-[580px] w-[270px] flex-col rounded-[44px] border-[10px] border-[#1f2c33] bg-[#111b21] p-1 shadow-2xl ring-4 ring-slate-200/50 relative overflow-hidden">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-28 bg-[#1f2c33] rounded-b-2xl z-20 flex items-center justify-center gap-2">
                   <div className="h-1 w-8 rounded-full bg-[#2a3942]" />
                   <div className="h-1.5 w-1.5 rounded-full bg-[#2a3942]" />
                </div>

                {/* Status Bar */}
                <div className="h-10 flex items-center justify-between px-6 pt-2 z-10 text-[10px] font-bold text-white/80">
                   <span>14:44</span>
                   <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-4 rounded-[2px] border border-white/30 relative">
                         <div className="absolute inset-0.5 bg-white/60 rounded-[1px] w-[70%]" />
                      </div>
                   </div>
                </div>

                {/* Header Mockup */}
                <div className="h-14 bg-[#202c33] flex items-center px-3 gap-3 shrink-0">
                   <div className="h-8 w-8 rounded-full bg-slate-600" />
                   <div className="flex-1">
                      <div className="h-2 w-20 bg-white/20 rounded-full mb-1.5" />
                      <div className="h-1.5 w-12 bg-white/10 rounded-full" />
                   </div>
                   <MoreVertical size={14} className="text-white/40" />
                </div>

                {/* Chat Content Area */}
                <div className="flex-1 overflow-hidden relative bg-[#efeae2] flex flex-col">
                   {/* WhatsApp Background Pattern */}
                   <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0)', backgroundSize: '16px 16px' }} />

                   <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 justify-end pb-4 scrollbar-hide">
                      <div className="mx-auto mb-2 rounded-lg bg-white/60 px-3 py-1 text-[9px] font-black uppercase text-slate-500 shadow-sm">Hoje</div>

                      <WhatsAppPreviewBubble
                        cabecalho={form.cabecalho}
                        corpo={formPreview}
                        rodape={form.rodape}
                        botoes={form.botoes}
                      />
                   </div>

                   {/* Input Mockup */}
                   <div className="h-14 bg-[#f0f2f5] flex items-center px-2 gap-2 shrink-0 border-t border-slate-200/50">
                      <div className="h-9 flex-1 bg-white rounded-full border border-slate-200" />
                      <div className="h-9 w-9 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-sm">
                         <Send size={16} fill="currentColor" />
                      </div>
                   </div>
                  </div>
                </div>
              </div>

              <button disabled={saving || formErrors.length > 0} className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-black hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:pointer-events-none">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Enviar para aprovação
              </button>
            </aside>
            <div className="col-span-full hidden justify-end gap-2 border-t border-slate-100 bg-slate-50 p-4 max-lg:flex">
              <button type="button" onClick={() => { setFormOpen(false); setEditing(null) }} className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200">Cancelar</button>
              <button disabled={saving || formErrors.length > 0} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-black disabled:opacity-40">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Enviar para aprovacao
              </button>
            </div>
          </form>
        ) : selected ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{selected.name}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-widest', STATUS_STYLE[selected.status])}>{STATUS_LABEL[selected.status]}</span>
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">{selected.category} / {selected.language}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => startEdit(selected)} className="rounded-xl p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Edit2 size={16} /></button>
                  <button type="button" onClick={() => handleDelete(selected)} className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              </div>

              {selected.status !== 'aprovado' && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900">
                  Este template ainda nao esta pronto para envio. Status: {STATUS_LABEL[selected.status]}.
                </div>
              )}

              {extractVariableNames(selected.bodyText).map((name, index) => (
                <div key={name} className="mb-3">
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">{variableToken(name)}</label>
                  <input
                    value={sendExamples[index] || ''}
                    onChange={event => {
                      const next = [...sendExamples]
                      next[index] = event.target.value
                      setSendExamples(next)
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-blue-500"
                    placeholder={`Valor para ${variableToken(name)}`}
                  />
                </div>
              ))}

              <div className="mt-6 rounded-3xl border border-slate-100 bg-[#efeae2] p-6 relative overflow-hidden shadow-inner">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0)', backgroundSize: '16px 16px' }} />
                <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 relative z-10">Visualização do envio</p>
                
                <div className="relative z-10 max-w-[320px]">
                  <WhatsAppPreviewBubble
                    cabecalho={selected.header?.type === 'text' ? selected.header.text : undefined}
                    corpo={renderWithExamples(selected.bodyText, extractVariableNames(selected.bodyText).map((name, index) => ({ name, example: sendExamples[index] || '' })))}
                    rodape={selected.footerText || undefined}
                    botoes={selected.buttons || []}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 bg-slate-50 p-4">
              <button type="button" onClick={handleSend} disabled={saving || selected.status !== 'aprovado'} className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-black disabled:opacity-40">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Enviar template
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-[11px] font-black uppercase tracking-widest text-slate-300">
            Selecione um template ou crie um novo
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
