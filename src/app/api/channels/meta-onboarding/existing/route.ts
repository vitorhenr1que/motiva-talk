import { NextResponse } from 'next/server'

import { AppError, handleApiError } from '@/lib/api-errors'
import { generateId } from '@/lib/utils'
import { requireAdminOrOwner } from '@/lib/tenant'
import { ChannelRepository } from '@/repositories/channelRepository'
import { LimitsService } from '@/services/limits.service'
import { MetaChannelOnboardingService, type MetaPhoneNumber } from '@/services/meta/channel-onboarding.service'

export const dynamic = 'force-dynamic'

const ROUTE = '/api/channels/meta-onboarding/existing'

interface ImportBody {
  name?: unknown
  wabaId?: unknown
  phoneNumberId?: unknown
}

function configuredWabaIds() {
  return [...new Set([
    process.env.META_WABA_ID?.trim(),
    process.env.META_LEGACY_WABA_ID?.trim(),
  ].filter((value): value is string => Boolean(value)))]
}

function assertAllowedWaba(wabaId: string) {
  if (!configuredWabaIds().includes(wabaId)) {
    throw new AppError('Esta conta do WhatsApp não está autorizada para importação.', 403, 'FORBIDDEN')
  }
}

function isReady(phone: MetaPhoneNumber) {
  return phone.platform_type === 'CLOUD_API' && phone.status === 'CONNECTED'
}

function publicPhone(wabaId: string, phone: MetaPhoneNumber) {
  return {
    wabaId,
    phoneNumberId: phone.id,
    displayPhoneNumber: phone.display_phone_number || '',
    verifiedName: phone.verified_name || '',
    platformType: phone.platform_type || 'UNKNOWN',
    status: phone.status || 'UNKNOWN',
    ready: isReady(phone),
  }
}

function sanitizeChannel(channel: Record<string, unknown>) {
  const safeChannel = { ...channel }
  delete safeChannel.metaAccessToken
  return safeChannel
}

export async function GET(req: Request) {
  try {
    await requireAdminOrOwner()
    const wabaIds = configuredWabaIds()
    if (!wabaIds.length) {
      throw new AppError('Nenhuma conta do WhatsApp foi configurada no servidor.', 503, 'VALIDATION_ERROR')
    }

    const results = await Promise.allSettled(
      wabaIds.map(async (wabaId) => {
        const phones = await MetaChannelOnboardingService.listPhoneNumbersForWaba(wabaId)
        return phones.map((phone) => publicPhone(wabaId, phone))
      })
    )
    const phones = results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])

    return NextResponse.json({ success: true, data: phones })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAdminOrOwner()
    const body = (await req.json()) as ImportBody
    const name = String(body.name || '').trim()
    const wabaId = String(body.wabaId || '').trim()
    const phoneNumberId = String(body.phoneNumberId || '').trim()

    if (name.length < 2 || name.length > 80) {
      throw new AppError('O nome do canal deve ter entre 2 e 80 caracteres.', 400, 'VALIDATION_ERROR')
    }
    if (!/^\d+$/.test(phoneNumberId)) {
      throw new AppError('Selecione um número válido da Meta.', 400, 'VALIDATION_ERROR')
    }
    assertAllowedWaba(wabaId)

    const phones = await MetaChannelOnboardingService.listPhoneNumbersForWaba(wabaId)
    const phone = phones.find((item) => item.id === phoneNumberId)
    if (!phone) {
      throw new AppError('Este número não pertence à conta do WhatsApp selecionada.', 404, 'NOT_FOUND')
    }
    if (!isReady(phone)) {
      throw new AppError(
        'Este número ainda não está pronto para o Motiva Talk. Conclua a migração para a Meta Cloud API primeiro.',
        409,
        'CONFLICT'
      )
    }

    const organizationId = user.organizationId
    const normalizedPhone = String(phone.display_phone_number || '').replace(/\D/g, '')
    if (!normalizedPhone) {
      throw new AppError('A Meta não retornou um telefone válido para este número.', 409, 'CONFLICT')
    }

    const assignedChannel = await ChannelRepository.findByMetaPhoneNumberId(phoneNumberId)
    if (assignedChannel && assignedChannel.organizationId !== organizationId) {
      throw new AppError('Este número já pertence a outro canal ativo.', 409, 'CONFLICT')
    }

    const existingChannel = await ChannelRepository.findByPhoneNumberInOrganization(normalizedPhone, organizationId)
    if (existingChannel?.isActive && existingChannel.connectionStatus === 'CONNECTED') {
      throw new AppError('Este número já está conectado a um canal.', 409, 'CONFLICT')
    }
    if (!existingChannel) await LimitsService.checkCanCreateChannel(organizationId)

    await MetaChannelOnboardingService.subscribeWaba(wabaId)

    const channelData = {
      name,
      phoneNumber: normalizedPhone,
      isActive: true,
      connectionStatus: 'CONNECTED',
      provider: 'META_CLOUD',
      whatsappProvider: 'META_CLOUD',
      providerSessionId: null,
      metaPhoneNumberId: phoneNumberId,
      metaWabaId: wabaId,
      metaAccessToken: null,
      metaWebhookVerifyToken:
        process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ||
        existingChannel?.metaWebhookVerifyToken ||
        `motiva_${generateId()}`,
    }

    const channel = existingChannel
      ? await ChannelRepository.update(existingChannel.id, organizationId, channelData)
      : await ChannelRepository.create(organizationId, channelData)

    return NextResponse.json({ success: true, data: sanitizeChannel(channel) }, { status: 201 })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
