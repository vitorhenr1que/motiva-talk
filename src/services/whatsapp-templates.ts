/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppError } from '@/lib/api-errors'
import { ChannelRepository } from '@/repositories/channelRepository'
import { ConversationRepository } from '@/repositories/conversationRepository'
import { MessageRepository } from '@/repositories/messageRepository'
import { WhatsAppTemplateRepository } from '@/repositories/whatsappTemplateRepository'
import { TagRepository } from '@/repositories/tagRepository'
import { FunnelRepository } from '@/repositories/funnelRepository'
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

type BulkVariableRule = {
  mode: 'fixed' | 'contact_name' | 'contact_phone'
  value?: string
}

type BulkAudienceInput = {
  templateId: string
  audienceType?: 'tag' | 'stage'
  tagId?: string
  stageId?: string
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
  const firstMissingVariableIndex = bodySlots.findIndex((_, index) => !variables[index]?.trim())
  if (firstMissingVariableIndex !== -1) {
    throw new AppError(
      `Informe um valor para {{${bodySlots[firstMissingVariableIndex]}}}.`,
      400,
      'VALIDATION_ERROR'
    )
  }
  if (bodySlots.length) {
    components.push({
      type: 'body',
      parameters: bodySlots.map((_, index) => ({ type: 'text', text: variables[index].trim() }))
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
    // O status local pode estar defasado; filtre somente depois de consultar a Meta.
    const templates = await WhatsAppTemplateRepository.findMany(organizationId, {
      channelId: filters.channelId,
    })
    if (!templates.length) return templates

    const syncedById = new Map<string, any>()
    const channelIds = Array.from(new Set(templates.map(template => template.channelId).filter(Boolean)))

    for (const channelId of channelIds) {
      try {
        const channel = await ChannelRepository.findById(channelId, organizationId)
        if (channel.whatsappProvider !== 'META_CLOUD') continue

        const metaTemplates = await metaCloudProvider.listMessageTemplates(channel as any)
        const metaById = new Map(
          metaTemplates
            .filter(template => template?.id)
            .map(template => [String(template.id), template])
        )

        const channelTemplates = templates.filter(template => template.channelId === channelId && template.metaTemplateId)
        const syncedAt = new Date().toISOString()

        await Promise.all(channelTemplates.map(async template => {
          const metaTemplate: any = metaById.get(String(template.metaTemplateId))
          if (!metaTemplate) return

          const status = mapMetaStatus(metaTemplate.status)
          const rejectionReason = status === 'rejeitado'
            ? metaTemplate.rejected_reason || null
            : null
          const patch: any = {
            status,
            lastSyncedAt: syncedAt,
            errorMessage: rejectionReason,
            rejectionReason,
            approvedAt: status === 'aprovado' ? (template.approvedAt || syncedAt) : null,
            rejectedAt: status === 'rejeitado' ? (template.rejectedAt || syncedAt) : null,
          }

          const updated = await WhatsAppTemplateRepository.update(
            template.id,
            organizationId,
            patch
          )
          syncedById.set(template.id, updated)
        }))
      } catch (error) {
        console.error(`[WHATSAPP_TEMPLATES] Falha ao sincronizar canal ${channelId} com a Meta:`, error)
        if (filters.channelId === channelId) {
          throw new AppError(
            'Não foi possível consultar o status dos templates na Meta. Tente novamente em instantes.',
            502,
            'INTERNAL_ERROR'
          )
        }
      }
    }

    const syncedTemplates = templates.map(template => syncedById.get(template.id) || template)
    return filters.status
      ? syncedTemplates.filter(template => template.status === filters.status)
      : syncedTemplates
  }

  static async create(organizationId: string, input: TemplateInput) {
    validateTemplateInput(input)

    const channel = await ChannelRepository.findById(input.channelId, organizationId)
    if (channel.whatsappProvider !== 'META_CLOUD') {
      throw new AppError('Templates só funcionam em canais com whatsappProvider META_CLOUD.', 400, 'VALIDATION_ERROR')
    }
    if ((!channel.metaWabaId && !process.env.META_WABA_ID) || (!channel.metaAccessToken && !process.env.META_ACCESS_TOKEN)) {
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

    if (current.metaTemplateId) {
      try {
        await metaCloudProvider.updateMessageTemplate(channel as any, current.metaTemplateId, payload)
      } catch (error: any) {
        throw new AppError(
          error.message || 'A Meta recusou a edição do template.',
          409,
          'CONFLICT'
        )
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
      status: 'pendente',
      submittedAt: new Date().toISOString(),
      errorMessage: null,
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
        templateButtons: Array.isArray(template.buttons) ? template.buttons : [],
        variables,
      },
      sectorId: conversation.currentSectorId || null,
      createdAt: new Date().toISOString(),
    })

    const { RealtimeService } = await import('@/services/realtime.service')
    await RealtimeService.notifyNewMessage(conversation.id, message)
    return message
  }

  static async previewBulk(
    organizationId: string,
    input: BulkAudienceInput
  ) {
    const audienceType = input.audienceType || (input.stageId ? 'stage' : 'tag')
    const audienceId = audienceType === 'stage' ? input.stageId : input.tagId
    if (!input.templateId || !audienceId || !['tag', 'stage'].includes(audienceType)) {
      throw new AppError('Template e segmento de público são obrigatórios.', 400, 'VALIDATION_ERROR')
    }

    const current = await WhatsAppTemplateRepository.findById(input.templateId, organizationId)
    const syncedTemplates = await this.list(organizationId, { channelId: current.channelId })
    const template = syncedTemplates.find(item => item.id === input.templateId)
    if (!template) throw new AppError('Template não encontrado.', 404, 'NOT_FOUND')
    if (template.status !== 'aprovado') {
      throw new AppError('Apenas templates aprovados podem ser usados em campanhas.', 400, 'VALIDATION_ERROR')
    }

    let segment: { type: 'tag' | 'stage'; id: string; name: string; color?: string; emoji?: string }
    let recipients
    if (audienceType === 'stage') {
      const stage = await FunnelRepository.findStageById(audienceId, organizationId)
      if (!stage || stage.type !== 'STEP') {
        throw new AppError('Fase do Kanban não encontrada.', 404, 'NOT_FOUND')
      }
      segment = { type: 'stage', id: stage.id, name: stage.name }
      recipients = await ConversationRepository.findManyByFunnelStageForMessaging(
        stage.id,
        template.channelId,
        organizationId
      )
    } else {
      const tag = await TagRepository.findById(audienceId, organizationId)
      if (!tag) throw new AppError('Etiqueta não encontrada.', 404, 'NOT_FOUND')
      segment = { type: 'tag', id: tag.id, name: tag.name, color: tag.color, emoji: tag.emoji }
      recipients = await ConversationRepository.findManyByTagForMessaging(
        tag.id,
        template.channelId,
        organizationId
      )
    }

    return {
      template,
      segment,
      total: recipients.length,
      sample: recipients.slice(0, 5).map(recipient => ({
        conversationId: recipient.id,
        contactName: recipient.contact?.name || recipient.contact?.phone || 'Contato',
        phone: recipient.contact?.phone || '',
      })),
      recipients,
    }
  }

  static async sendBulk(
    organizationId: string,
    input: BulkAudienceInput & { variables?: BulkVariableRule[] }
  ) {
    const preview = await this.previewBulk(organizationId, input)
    if (!preview.total) {
      throw new AppError('Nenhum contato elegível encontrado neste segmento e canal.', 400, 'VALIDATION_ERROR')
    }
    if (preview.total > 200) {
      throw new AppError(
        `Esta campanha possui ${preview.total} destinatários. O limite por disparo é 200.`,
        400,
        'VALIDATION_ERROR'
      )
    }

    const placeholders = getPlaceholders(preview.template.bodyText || '')
    const rules = input.variables || []
    if (rules.length !== placeholders.length) {
      throw new AppError('Configure todas as variáveis do template para o disparo.', 400, 'VALIDATION_ERROR')
    }
    for (const rule of rules) {
      if (!['fixed', 'contact_name', 'contact_phone'].includes(rule.mode)) {
        throw new AppError('Modo de variável inválido.', 400, 'VALIDATION_ERROR')
      }
      if (rule.mode === 'fixed' && !rule.value?.trim()) {
        throw new AppError('Preencha todos os valores fixos da campanha.', 400, 'VALIDATION_ERROR')
      }
    }

    const resolveVariables = (recipient: any) => rules.map(rule => {
      if (rule.mode === 'contact_name') return recipient.contact?.name || recipient.contact?.phone || ''
      if (rule.mode === 'contact_phone') return recipient.contact?.phone || ''
      return rule.value?.trim() || ''
    })

    const results: Array<{
      conversationId: string
      contactName: string
      success: boolean
      messageId?: string
      error?: string
    }> = []
    let nextIndex = 0
    const workerCount = Math.min(3, preview.recipients.length)

    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (nextIndex < preview.recipients.length) {
        const recipient = preview.recipients[nextIndex++]
        const contactName = recipient.contact?.name || recipient.contact?.phone || 'Contato'
        try {
          const message = await this.send(organizationId, {
            templateId: input.templateId,
            conversationId: recipient.id,
            variables: resolveVariables(recipient),
          })
          results.push({ conversationId: recipient.id, contactName, success: true, messageId: message.id })
        } catch (error: any) {
          results.push({
            conversationId: recipient.id,
            contactName,
            success: false,
            error: error?.message || 'Falha ao enviar template.',
          })
        }
      }
    }))

    const sent = results.filter(result => result.success).length
    return {
      segment: preview.segment,
      total: preview.total,
      sent,
      failed: preview.total - sent,
      results,
    }
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
