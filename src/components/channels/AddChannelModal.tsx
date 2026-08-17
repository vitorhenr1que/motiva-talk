'use client'

import React, { useState } from 'react'
import { ArrowLeft, Check, CheckCircle2, Cloud, KeyRound, Loader2, MessageSquarePlus, Phone, PhoneCall, RefreshCw, ShieldCheck, X } from 'lucide-react'

interface AddChannelModalProps { isOpen: boolean; onClose: () => void; onSuccess: () => void }
type Step = 'details' | 'verification' | 'success'
type DeliveryMethod = 'SMS' | 'VOICE'
type OnboardingMode = 'new' | 'existing'

interface ExistingMetaPhone {
  wabaId: string
  phoneNumberId: string
  displayPhoneNumber: string
  verifiedName: string
  platformType: string
  status: string
  ready: boolean
}

interface StartResponse {
  data?: { channelId: string; phoneNumber: string; deliveryMethod: DeliveryMethod; codeSent: boolean; warning?: string }
  message?: string
  error?: string
}

function responseMessage(data: { message?: string; error?: string }, fallback: string) {
  return data.message || data.error || fallback
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, -4)}-${digits.slice(-4)}`
}

export const AddChannelModal: React.FC<AddChannelModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<Step>('details')
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [countryCode, setCountryCode] = useState('55')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [method, setMethod] = useState<DeliveryMethod>('SMS')
  const [channelId, setChannelId] = useState('')
  const [registeredPhone, setRegisteredPhone] = useState('')
  const [code, setCode] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [mode, setMode] = useState<OnboardingMode>('new')
  const [existingPhones, setExistingPhones] = useState<ExistingMetaPhone[]>([])
  const [selectedExistingPhone, setSelectedExistingPhone] = useState<ExistingMetaPhone | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)

  if (!isOpen) return null

  const reset = () => {
    setStep('details'); setName(''); setDisplayName(''); setCountryCode('55'); setPhoneNumber('')
    setMethod('SMS'); setChannelId(''); setRegisteredPhone(''); setCode(''); setPin('')
    setLoading(false); setResending(false); setError(''); setNotice('')
    setMode('new'); setExistingPhones([]); setSelectedExistingPhone(null); setLoadingExisting(false)
  }

  const handleClose = () => { reset(); onClose() }

  const loadExistingPhones = async () => {
    setMode('existing'); setLoadingExisting(true); setError(''); setNotice(''); setSelectedExistingPhone(null)
    try {
      const response = await fetch('/api/channels/meta-onboarding/existing', { cache: 'no-store' })
      const data = (await response.json()) as { data?: ExistingMetaPhone[]; message?: string; error?: string }
      if (!response.ok || !data.data) throw new Error(responseMessage(data, 'Não foi possível consultar os números da Meta.'))
      setExistingPhones(data.data)
      const readyPhone = data.data.find((phone) => phone.ready)
      if (readyPhone) setSelectedExistingPhone(readyPhone)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao consultar os números da Meta.')
    } finally { setLoadingExisting(false) }
  }

  const handleImportExisting = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedExistingPhone) return
    setLoading(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/channels/meta-onboarding/existing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, wabaId: selectedExistingPhone.wabaId, phoneNumberId: selectedExistingPhone.phoneNumberId }),
      })
      const data = (await response.json()) as { message?: string; error?: string }
      if (!response.ok) throw new Error(responseMessage(data, 'Não foi possível importar este número.'))
      setRegisteredPhone(selectedExistingPhone.displayPhoneNumber.replace(/\D/g, ''))
      setStep('success'); onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao importar o canal da Meta.')
    } finally { setLoading(false) }
  }

  const handleStart = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/channels/meta-onboarding/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, displayName, countryCode, phoneNumber: phoneNumber.replace(/\D/g, ''), method }),
      })
      const data = (await response.json()) as StartResponse
      if (!response.ok || !data.data) throw new Error(responseMessage(data, 'Não foi possível iniciar o cadastro do número.'))
      setChannelId(data.data.channelId); setRegisteredPhone(data.data.phoneNumber); setMethod(data.data.deliveryMethod)
      setNotice(data.data.codeSent ? `Código enviado por ${data.data.deliveryMethod === 'SMS' ? 'SMS' : 'ligação'}.` : data.data.warning || 'O canal foi criado, mas o código ainda não foi enviado.')
      setStep('verification'); onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar o cadastro do canal.')
    } finally { setLoading(false) }
  }

  const handleResend = async (deliveryMethod: DeliveryMethod) => {
    if (!channelId) return
    setResending(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/channels/${channelId}/meta-onboarding/request-code`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: deliveryMethod }),
      })
      const data = (await response.json()) as { message?: string; error?: string }
      if (!response.ok) throw new Error(responseMessage(data, 'Não foi possível reenviar o código.'))
      setMethod(deliveryMethod); setNotice(`Novo código enviado por ${deliveryMethod === 'SMS' ? 'SMS' : 'ligação'}.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao reenviar o código.')
    } finally { setResending(false) }
  }

  const handleComplete = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/channels/${channelId}/meta-onboarding/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, pin }),
      })
      const data = (await response.json()) as { message?: string; error?: string }
      if (!response.ok) throw new Error(responseMessage(data, 'Não foi possível concluir o cadastro do canal.'))
      setStep('success'); onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao concluir o cadastro do canal.')
    } finally { setLoading(false) }
  }

  const steps = [{ id: 'details', label: 'Número' }, { id: 'verification', label: 'Verificação' }, { id: 'success', label: 'Ativo' }] as const
  const activeIndex = steps.findIndex((item) => item.id === step)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[32px] bg-white shadow-2xl ring-1 ring-slate-900/10 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-6 py-6 dark:border-slate-800 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-900/30"><MessageSquarePlus size={24} /></div>
              <div><h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Novo canal WhatsApp</h2><p className="mt-0.5 text-xs font-semibold text-slate-400">Cadastro oficial pela Meta Cloud API</p></div>
            </div>
            <button onClick={handleClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar"><X size={20} /></button>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {steps.map((item, index) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${index <= activeIndex ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>{index < activeIndex ? <Check size={14} strokeWidth={3} /> : index + 1}</span>
                <span className={`hidden text-[10px] font-black uppercase tracking-widest sm:block ${index <= activeIndex ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {step === 'details' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800" aria-label="Forma de cadastro">
                <button type="button" onClick={() => { setMode('new'); setError(''); setNotice('') }} className={`rounded-xl px-3 py-2.5 text-xs font-black transition ${mode === 'new' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>Novo número</button>
                <button type="button" onClick={loadExistingPhones} className={`rounded-xl px-3 py-2.5 text-xs font-black transition ${mode === 'existing' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>Já está na Meta</button>
              </div>

              {mode === 'existing' ? (
                <form onSubmit={handleImportExisting} className="space-y-5">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-blue-800 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-300">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest"><Cloud size={16} /> Canais vinculados à Meta</div>
                    <p className="mt-1 text-xs font-medium leading-relaxed">Números Cloud conectados podem ser importados sem novo SMS. Números do WhatsApp Business App ficam reservados até a migração.</p>
                  </div>

                  {loadingExisting ? (
                    <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 py-8 text-sm font-semibold text-slate-500 dark:border-slate-700"><Loader2 size={18} className="animate-spin" /> Consultando a Meta...</div>
                  ) : existingPhones.length ? (
                    <div className="space-y-3" role="radiogroup" aria-label="Números encontrados na Meta">
                      {existingPhones.map((phone) => (
                        <button
                          key={`${phone.wabaId}-${phone.phoneNumberId}`}
                          type="button"
                          role="radio"
                          aria-checked={selectedExistingPhone?.phoneNumberId === phone.phoneNumberId}
                          disabled={!phone.ready}
                          onClick={() => setSelectedExistingPhone(phone)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${selectedExistingPhone?.phoneNumberId === phone.phoneNumberId ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/10 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700'} ${phone.ready ? 'hover:border-blue-400' : 'cursor-not-allowed bg-slate-50 opacity-75 dark:bg-slate-800/60'}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div><p className="font-black text-slate-900 dark:text-white">{phone.displayPhoneNumber || 'Número sem identificação'}</p><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{phone.verifiedName || 'Nome ainda não informado'}</p></div>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${phone.ready ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>{phone.ready ? 'Pronto' : 'Aguardando migração'}</span>
                          </div>
                          <p className="mt-3 text-[11px] font-bold text-slate-400">{phone.platformType} · {phone.status}</p>
                        </button>
                      ))}
                    </div>
                  ) : !error && (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm font-semibold text-slate-500 dark:border-slate-700">Nenhum número foi encontrado nas contas Meta configuradas.</div>
                  )}

                  <label className="block space-y-2"><span className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-400">Nome do canal</span><input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Atendimento principal" className="w-full rounded-2xl border-none bg-slate-50 px-5 py-4 font-semibold text-slate-900 outline-none ring-blue-500/20 focus:ring-2 dark:bg-slate-800 dark:text-white" /></label>
                  {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
                  <button disabled={loading || !selectedExistingPhone} type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none">{loading ? <><Loader2 size={18} className="animate-spin" /> Importando...</> : <>Importar canal da Meta <Cloud size={18} /></>}</button>
                </form>
              ) : (
            <form onSubmit={handleStart} className="space-y-5">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest"><Cloud size={16} /> Processo automático</div>
                <p className="mt-1 text-xs font-medium leading-relaxed">O Motiva Talk adicionará o número à conta da faculdade, enviará o código e concluirá a conexão.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2"><span className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-400">Nome do canal</span><input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Matrículas" className="w-full rounded-2xl border-none bg-slate-50 px-5 py-4 font-semibold text-slate-900 outline-none ring-blue-500/20 focus:ring-2 dark:bg-slate-800 dark:text-white" /></label>
                <label className="space-y-2"><span className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-400">Nome exibido</span><input required minLength={3} maxLength={60} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Ex: Faculdade FAZAG" className="w-full rounded-2xl border-none bg-slate-50 px-5 py-4 font-semibold text-slate-900 outline-none ring-blue-500/20 focus:ring-2 dark:bg-slate-800 dark:text-white" /></label>
              </div>
              <label className="block space-y-2">
                <span className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-400">Número com DDD</span>
                <div className="flex gap-3">
                  <div className="relative w-24 shrink-0"><span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">+</span><input required inputMode="numeric" maxLength={3} value={countryCode} onChange={(event) => setCountryCode(event.target.value.replace(/\D/g, '').slice(0, 3))} aria-label="DDI" className="w-full rounded-2xl border-none bg-slate-50 py-4 pl-8 pr-3 font-bold text-slate-900 outline-none ring-blue-500/20 focus:ring-2 dark:bg-slate-800 dark:text-white" /></div>
                  <div className="relative flex-1"><Phone size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" /><input required inputMode="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(formatPhone(event.target.value))} placeholder="(75) 98178-6679" className="w-full rounded-2xl border-none bg-slate-50 py-4 pl-12 pr-5 font-semibold text-slate-900 outline-none ring-blue-500/20 focus:ring-2 dark:bg-slate-800 dark:text-white" /></div>
                </div>
                <p className="px-1 text-xs leading-relaxed text-slate-400">O número precisa receber SMS ou ligação e não pode estar preso a outra conta do WhatsApp.</p>
              </label>
              <div className="space-y-2">
                <span className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-400">Receber código por</span>
                <div className="grid grid-cols-2 gap-3">{(['SMS', 'VOICE'] as DeliveryMethod[]).map((item) => <button key={item} type="button" onClick={() => setMethod(item)} className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition ${method === item ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-600/10 dark:bg-blue-900/20 dark:text-blue-300' : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700'}`}>{item === 'SMS' ? <MessageSquarePlus size={17} /> : <PhoneCall size={17} />}{item === 'SMS' ? 'SMS' : 'Ligação'}</button>)}</div>
              </div>
              {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
              <button disabled={loading} type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 dark:shadow-none">{loading ? <><Loader2 size={18} className="animate-spin" /> Adicionando na Meta...</> : <>Enviar código de verificação <Phone size={18} /></>}</button>
            </form>
              )}
            </div>
          )}

          {step === 'verification' && (
            <form onSubmit={handleComplete} className="space-y-5">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-blue-800 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-300"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest"><ShieldCheck size={16} /> Confirme a posse do número</div><p className="mt-1 text-xs font-medium leading-relaxed">Canal <strong>+{registeredPhone}</strong>. Digite o código enviado pela Meta e crie o PIN de segurança.</p></div>
              {notice && <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">{notice}</div>}
              <label className="block space-y-2"><span className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-400">Código recebido</span><div className="relative"><MessageSquarePlus size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" /><input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="w-full rounded-2xl border-none bg-slate-50 py-4 pl-12 pr-5 font-mono text-lg font-black tracking-[0.35em] text-slate-900 outline-none ring-blue-500/20 focus:ring-2 dark:bg-slate-800 dark:text-white" /></div></label>
              <label className="block space-y-2"><span className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-400">Novo PIN de duas etapas</span><div className="relative"><KeyRound size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" /><input required type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 dígitos" className="w-full rounded-2xl border-none bg-slate-50 py-4 pl-12 pr-5 font-semibold text-slate-900 outline-none ring-blue-500/20 focus:ring-2 dark:bg-slate-800 dark:text-white" /></div><p className="px-1 text-xs leading-relaxed text-slate-400">Guarde esse PIN em local seguro. O Motiva Talk não armazena o código nem o PIN.</p></label>
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><p className="text-xs font-bold text-slate-500 dark:text-slate-300">Não recebeu o código?</p><div className="mt-3 flex flex-wrap gap-2"><button disabled={resending} type="button" onClick={() => handleResend('SMS')} className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300"><RefreshCw size={14} className={resending ? 'animate-spin' : ''} /> Reenviar SMS</button><button disabled={resending} type="button" onClick={() => handleResend('VOICE')} className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300"><PhoneCall size={14} /> Receber ligação</button></div></div>
              {error && <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
              <div className="flex gap-3"><button type="button" onClick={() => setStep('details')} className="flex items-center justify-center rounded-2xl border border-slate-200 px-4 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" aria-label="Voltar"><ArrowLeft size={19} /></button><button disabled={loading || code.length !== 6 || pin.length !== 6} type="submit" className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none">{loading ? <><Loader2 size={18} className="animate-spin" /> Conectando...</> : <>Verificar e ativar <ShieldCheck size={18} /></>}</button></div>
            </form>
          )}

          {step === 'success' && (
            <div className="py-4 text-center"><div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50 dark:bg-emerald-900/30 dark:ring-emerald-900/10"><CheckCircle2 size={42} strokeWidth={2.5} /></div><h3 className="mt-7 text-2xl font-black tracking-tight text-slate-900 dark:text-white">Canal conectado</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">O número <strong>+{registeredPhone}</strong> está registrado na Meta Cloud API e já pode receber mensagens no Motiva Talk.</p><button type="button" onClick={handleClose} className="mt-8 w-full rounded-2xl bg-slate-900 py-4 font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">Concluir</button></div>
          )}
        </div>
      </div>
    </div>
  )
}
