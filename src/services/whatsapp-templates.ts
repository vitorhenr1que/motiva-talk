/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/lib/api-errors'
import { ChannelRepository } from '@/repositories/channelRepository'
import { ConversationRepository } from '@/repositories/conversationRepository'
import { MessageRepository } from '@/repositories/messageRepository'
import { WhatsAppTemplateRepository } from '@/repositories/whatsappTemplateRepository'
import { metaCloudProvider } from '@/services/whatsapp/providers/meta-cloud-provider'

type TemplateCategory = 'utility' | 'marketing' | 'authentication'
type HeaderInput = { type: 'text' | 'image' | 'video' | 'document'; text?: string; example?: string }
type ButtonInput = {
  type: 'url' | 'phone' | 'quick_reply'
  text: string
  url?: string
  phone_number?: string
}

type TemplateInput = {
  channelId: string
  nome_do_template: string
  categoria: TemplateCategory
  idioma: string
  corpo: string
  cabecalho?: HeaderInput | string | null
  rodape?: string | null
  botoes?: ButtonInput[] | null
  variaveis?: Array<{ name: string; example: string }> | null
}

const STATUS_MAP: Record<string, string> = {
  APPROVED: 'aprovado',
  PENDING: 'pendente',
  REJECTED: 'rejeitado',
  PAUSED: 'pausado',
  DISABLED: 'desativado',
  DELETED: 'excluido',
}

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, '_')
}

function getPlaceholders(text: string) {
  const matches = text.match(/\{\{(?:\d+|[a-zA-Z_][a-zA-Z0-9_]*)\}\}/g) || []
  return Array.from(new Set(matches.map(match => match.replace(/[{}]/g, ''))))
}

function sampleValuesFor(text: string) {
  return getPlaceholders(text).map((token, index) => {
    const fallback = Number.isFinite(Number(token)) ? `exemplo_${token}` : `exemplo_${index + 1}`
    return fallback
  })
}

function getVariableOrder(text: string) {
  return getPlaceholders(text).map(token => token.toLowerCase())
}

function hasDuplicateVariables(text: string) {
  const matches = text.match(/\{\{(?:\d+|[a-zA-Z_][a-zA-Z0-9_]*)\}\}/g) || []
  const tokens = matches.map(match => match.replace(/[{}]/g, '').toLowerCase())
  return tokens.some((token, index) => tokens.indexOf(token) !== index)
}

function toMetaBodyText(text: string, variableOrder: string[]) {
  return text.replace(/\{\{(\d+|[a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (_, token) => {
    if (/^\d+$/.test(token)) return `{{${token}}}`
    const index = variableOrder.indexOf(String(token).toLowerCase())
    return `{{${index + 1}}}`
  })
}

function normalizeHeader(header?: HeaderInput | string | null): HeaderInput | null {
  if (!header) return null
  if (typeof header === 'string') return { type: 'text', text: header }
  return { ...header, type: header.type?.toLowerCase() as HeaderInput['type'] }
}

function validateTemplateInput(input: TemplateInput) {
  if (!input.channelId) throw new AppError('channelId é obrigatório', 400, 'VALIDATION_ERROR')
  if (!input.nome_do_template) throw new AppError('nome_do_template é obrigatório', 400, 'VALIDATION_ERROR')
  if (!/^[a-z0-9_]{1,512}$/.test(normalizeName(input.nome_do_template))) {
    throw new AppError('nome_do_template deve usar apenas letras minúsculas, números e underscore.', 400, 'VALIDATION_ERROR')
  }
  if (!['utility', 'marketing', 'authentication'].includes(input.categoria)) {
    throw new AppError('categoria deve ser utility, marketing ou authentication.', 400, 'VALIDATION_ERROR')
  }
  if (!/^[a-z]{2}_[A-Z]{2}$/.test(input.idioma)) {
    throw new AppError('idioma deve seguir o formato pt_BR.', 400, 'VALIDATION_ERROR')
  }
  if (!input.corpo?.trim()) throw new AppError('corpo é obrigatório', 400, 'VALIDATION_ERROR')
  if (input.corpo.length > 1024) throw new AppError('corpo deve ter no máximo 1024 caracteres.', 400, 'VALIDATION_ERROR')

  if (hasDuplicateVariables(input.corpo)) {
    throw new AppError('Variáveis no corpo não podem se repetir.', 400, 'VALIDATION_ERROR')
  }

  const variableNames = getVariableOrder(input.corpo).filter(token => !/^\d+$/.test(token))
  const examplesByName = new Map((input.variaveis || []).map(item => [item.name.toLowerCase(), item.example]))
  for (const name of variableNames) {
    if (!examplesByName.get(name)?.trim()) {
      throw new AppError(`Informe um exemplo real para {{${name}}}.`, 400, 'VALIDATION_ERROR')
    }
  }

  const header = normalizeHeader(input.cabecalho)
  if (header) {
    if (!['text', 'image', 'video', 'document'].includes(header.type)) {
      throw new AppError('cabecalho.type deve ser text, image, video ou document.', 400, 'VALIDATION_ERROR')
    }
    if (header.type === 'text' && !header.text?.trim()) {
      throw new AppError('cabecalho.text é obrigatório para cabeçalho de texto.', 400, 'VALIDATION_ERROR')
    }
  }

  if (input.rodape && input.rodape.length > 60) {
    throw new AppError('rodape deve ter no máximo 60 caracteres.', 400, 'VALIDATION_ERROR')
  }

  if (input.botoes && input.botoes.length > 10) {
    throw new AppError('botoes deve ter no máximo 10 itens.', 400, 'VALIDATION_ERROR')
  }
}

function buildMetaComponents(input: TemplateInput) {
  const components: any[] = []
  const header = normalizeHeader(input.cabecalho)
  const variableOrder = getVariableOrder(input.corpo)
  const exampleByName = new Map((input.variaveis || []).map(item => [item.name.toLowerCase(), item.example]))

  if (header) {
    if (header.type === 'text') {
      const component: any = { type: 'HEADER', format: 'TEXT', text: header.text!.trim() }
      const examples = sampleValuesFor(header.text || '')
      if (examples.length) component.example = { header_text: examples }
      components.push(component)
    } else {
      components.push({
        type: 'HEADER',
        format: header.type.toUpperCase(),
        example: { header_handle: [header.example || 'media_handle_example'] }
      })
    }
  }

  const metaBodyText = toMetaBodyText(input.corpo.trim(), variableOrder)
  const body: any = { type: 'BODY', text: metaBodyText }
  const bodySamples = variableOrder.map((token, index) => (
    exampleByName.get(token) || (Number.isFinite(Number(token)) ? `exemplo_${token}` : `exemplo_${index + 1}`)
  ))
  if (bodySamples.length) body.example = { body_text: [bodySamples] }
  components.push(body)

  if (input.rodape?.trim()) {
    components.push({ type: 'FOOTER', text: input.rodape.trim() })
  }

  if (input.botoes?.length) {
    const buttons = input.botoes.map(button => {
      const type = button.type.toLowerCase()
      if (!button.text?.trim()) throw new AppError('Todo botão precisa de text.', 400, 'VALIDATION_ERROR')
      if (type === 'url') {
        if (!button.url) throw new AppError('Botão URL precisa de url.', 400, 'VALIDATION_ERROR')
        return { type: 'URL', text: button.text.trim(), url: button.url }
      }
      if (type === 'phone') {
        if (!button.phone_number) throw new AppError('Botão telefone precisa de phone_number.', 400, 'VALIDATION_ERROR')
        return { type: 'PHONE_NUMBER', text: button.text.trim(), phone_number: button.phone_number }
      }
      if (type === 'quick_reply') return { type: 'QUICK_REPLY', text: button.text.trim() }
      throw new AppError('Tipo de botão inválido.', 400, 'VALIDATION_ERROR')
    })
    components.push({ type: 'BUTTONS', buttons })
  }

  return components
}

function mapMetaStatus(status?: string) {
  return STATUS_MAP[String(status || 'PENDING').toUpperCase()] || 'pendente'
}

function buildSendComponents(template: any, variables: string[] = []) {
  const components: any[] = []
  const bodySlots = getPlaceholders(template.bodyText || '')
  if (bodySlots.length) {
    components.push({
      type: 'body',
      parameters: bodySlots.map((_, index) => ({ type: 'text', text: variables[index] || '' }))
    })
  }
  return components
}

function renderTemplateText(template: any, variables: string[] = []) {
  let index = 0
  return String(template.bodyText || '').replace(/\{\{(?:\d+|[a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, () => variables[index++] || '')
}

export class WhatsAppTemplateService {
  static async list(organizationId: string, filters: { channelId?: string; status?: string }) {
    return WhatsAppTemplateRepository.findMany(organizationId, filters)
  }

  static async create(organizationId: string, input: TemplateInput) {
    validateTemplateInput(input)

    const channel = await ChannelRepository.findById(input.channelId, organizationId)
    if (channel.whatsappProvider !== 'META_CLOUD') {
      throw new AppError('Templates só funcionam em canais com whatsappProvider META_CLOUD.', 400, 'VALIDATION_ERROR')
    }
    if (!channel.metaWabaId || !channel.metaAccessToken) {
      throw new AppError('Canal Meta Cloud sem WABA ID ou Access Token configurado.', 400, 'VALIDATION_ERROR')
    }

    const components = buildMetaComponents(input)
    const payload = {
      name: normalizeName(input.nome_do_template),
      category: input.categoria.toUpperCase(),
      language: input.idioma,
      components,
    }

    try {
      const metaResponse = await metaCloudProvider.createMessageTemplate(channel as any, payload)
      return await WhatsAppTemplateRepository.create(organizationId, {
        channelId: input.channelId,
        metaTemplateId: metaResponse.id || null,
        name: payload.name,
        category: input.categoria,
        language: input.idioma,
        bodyText: input.corpo.trim(),
        header: normalizeHeader(input.cabecalho),
        footerText: input.rodape?.trim() || null,
        buttons: input.botoes || [],
        components,
        metadata: { variables: input.variaveis || [] },
        status: mapMetaStatus(metaResponse.status),
        submittedAt: new Date().toISOString(),
        errorMessage: null,
      })
    } catch (error: any) {
      return await WhatsAppTemplateRepository.create(organizationId, {
        channelId: input.channelId,
        name: payload.name,
        category: input.categoria,
        language: input.idioma,
        bodyText: input.corpo.trim(),
        header: normalizeHeader(input.cabecalho),
        footerText: input.rodape?.trim() || null,
        buttons: input.botoes || [],
        components,
        metadata: { variables: input.variaveis || [] },
        status: 'rejeitado',
        submittedAt: new Date().toISOString(),
        errorMessage: error.message,
      })
    }
  }

  static async update(id: string, organizationId: string, input: Partial<TemplateInput>) {
    const current = await WhatsAppTemplateRepository.findById(id, organizationId)
    const merged = {
      channelId: input.channelId || current.channelId,
      nome_do_template: input.nome_do_template || current.name,
      categoria: input.categoria || current.category,
      idioma: input.idioma || current.language,
      corpo: input.corpo || current.bodyText,
      cabecalho: input.cabecalho !== undefined ? input.cabecalho : current.header,
      rodape: input.rodape !== undefined ? input.rodape : current.footerText,
      botoes: input.botoes !== undefined ? input.botoes : current.buttons,
      variaveis: input.variaveis !== undefined ? input.variaveis : current.metadata?.variables,
    } as TemplateInput
    validateTemplateInput(merged)

    const channel = await ChannelRepository.findById(merged.channelId, organizationId)
    if (channel.whatsappProvider !== 'META_CLOUD') {
      throw new AppError('Templates só funcionam em canais com whatsappProvider META_CLOUD.', 400, 'VALIDATION_ERROR')
    }

    const components = buildMetaComponents(merged)
    const payload = {
      name: normalizeName(merged.nome_do_template),
      category: merged.categoria.toUpperCase(),
      language: merged.idioma,
      components,
    }

    let status = 'pendente'
    let errorMessage = null
    if (current.metaTemplateId) {
      try {
        const metaResponse = await metaCloudProvider.updateMessageTemplate(channel as any, current.metaTemplateId, payload)
        status = mapMetaStatus(metaResponse.status)
      } catch (error: any) {
        status = 'rejeitado'
        errorMessage = error.message
      }
    }

    return WhatsAppTemplateRepository.update(id, organizationId, {
      channelId: merged.channelId,
      name: payload.name,
      category: merged.categoria,
      language: merged.idioma,
      bodyText: merged.corpo.trim(),
      header: normalizeHeader(merged.cabecalho),
      footerText: merged.rodape?.trim() || null,
      buttons: merged.botoes || [],
      components,
      metadata: { variables: merged.variaveis || [] },
      status,
      submittedAt: new Date().toISOString(),
      errorMessage,
    })
  }

  static async delete(id: string, organizationId: string) {
    const template = await WhatsAppTemplateRepository.findById(id, organizationId)
    if (template?.channel?.whatsappProvider === 'META_CLOUD') {
      try {
        await metaCloudProvider.deleteMessageTemplate(template.channel as any, template.name)
      } catch (error: any) {
        await WhatsAppTemplateRepository.update(id, organizationId, { status: 'excluido', errorMessage: error.message })
      }
    }
    return WhatsAppTemplateRepository.delete(id, organizationId)
  }

  static async updateStatusFromWebhook(payload: any) {
    const templateId = payload?.message_template_id || payload?.id || payload?.template_id
    const name = payload?.message_template_name || payload?.name
    const status = mapMetaStatus(payload?.event || payload?.status)
    let template = templateId ? await WhatsAppTemplateRepository.findByMetaTemplateId(String(templateId)) : null
    if (!template && name && payload?.organizationId) {
      template = await WhatsAppTemplateRepository.findByName(name, payload.organizationId)
    }
    if (!template) return null

    const patch: any = {
      status,
      lastSyncedAt: new Date().toISOString(),
      errorMessage: payload?.reason || payload?.rejection_reason || null,
      rejectionReason: payload?.reason || payload?.rejection_reason || null,
    }
    if (status === 'aprovado') patch.approvedAt = new Date().toISOString()
    if (status === 'rejeitado') patch.rejectedAt = new Date().toISOString()

    const updated = await WhatsAppTemplateRepository.update(template.id, template.organizationId, patch)
    const { RealtimeService } = await import('@/services/realtime.service')
    await RealtimeService.publish(`organization:${template.organizationId}`, 'whatsapp-template:status', { template: updated })
    return updated
  }

  static async send(organizationId: string, input: { templateId: string; conversationId: string; variables?: string[] }) {
    const template = await WhatsAppTemplateRepository.findById(input.templateId, organizationId)
    if (template.status !== 'aprovado') {
      throw new AppError('Apenas templates aprovados podem ser enviados.', 400, 'VALIDATION_ERROR')
    }

    const conversation = await ConversationRepository.findByIdForMessaging(input.conversationId, organizationId)
    if (!conversation || conversation.channelId !== template.channelId || !conversation.contact || !conversation.channel) {
      throw new AppError('Conversa não pertence ao canal do template.', 400, 'VALIDATION_ERROR')
    }
    if (conversation.channel.whatsappProvider !== 'META_CLOUD') {
      throw new AppError('Envio de templates exige canal META_CLOUD.', 400, 'VALIDATION_ERROR')
    }

    const { LimitsService } = await import('@/services/limits.service')
    await LimitsService.checkCanSendMessage(organizationId)

    const variables = input.variables || []
    const externalMessageId = await metaCloudProvider.sendTemplateMessage(conversation.channel as any, conversation.contact.phone, {
      name: template.name,
      language: template.language,
      components: buildSendComponents(template, variables),
    })

    const message = await MessageRepository.create(organizationId, {
      conversationId: conversation.id,
      channelId: conversation.channelId,
      senderType: 'AGENT',
      content: renderTemplateText(template, variables),
      type: 'TEXT',
      externalMessageId,
      metadata: {
        isTemplate: true,
        templateId: template.id,
        templateName: template.name,
        templateLanguage: template.language,
        variables,
      },
      sectorId: conversation.currentSectorId || null,
      createdAt: new Date().toISOString(),
    })

    const { BillingService } = await import('@/services/billing.service')
    await BillingService.incrementMessageUsage(organizationId)

    const { RealtimeService } = await import('@/services/realtime.service')
    await RealtimeService.notifyNewMessage(conversation.id, message)
    return message
  }

  static getUsageExamples() {
    return {
      create: {
        method: 'POST',
        url: '/whatsapp/templates',
        body: {
          channelId: 'canal_meta_cloud_id',
          nome_do_template: 'confirmacao_pedido',
          categoria: 'utility',
          idioma: 'pt_BR',
          corpo: 'Olá {{1}}, seu pedido {{2}} foi confirmado.',
          cabecalho: { type: 'text', text: 'Confirmação do pedido' },
          rodape: 'Obrigado pela preferência.',
          botoes: [{ type: 'quick_reply', text: 'Ver pedido' }],
        },
      },
      personalization: 'Use {{1}}, {{2}} etc. no corpo e informe os valores ao enviar pelo CRM.',
    }
  }
}
