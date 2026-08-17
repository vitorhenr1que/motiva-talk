import { NextResponse } from 'next/server'

import { AppError, handleApiError } from '@/lib/api-errors'
import { generateId } from '@/lib/utils'
import { requireAdminOrOwner } from '@/lib/tenant'
import { ChannelRepository } from '@/repositories/channelRepository'
import { LimitsService } from '@/services/limits.service'
import { MetaChannelOnboardingService } from '@/services/meta/channel-onboarding.service'

export const dynamic = 'force-dynamic'

const ROUTE = '/api/channels/meta-onboarding/start'

interface StartBody {
  name?: unknown
  displayName?: unknown
  countryCode?: unknown
  phoneNumber?: unknown
  method?: unknown
}

function publicMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível enviar o código agora.'
}

export async function POST(req: Request) {
  try {
    const user = await requireAdminOrOwner()
    const body = (await req.json()) as StartBody
    const name = String(body.name || '').trim()
    const displayName = String(body.displayName || '').trim()
    const method = String(body.method || '').toUpperCase()

    if (name.length < 2 || name.length > 80) {
      throw new AppError('O nome do canal deve ter entre 2 e 80 caracteres.', 400, 'VALIDATION_ERROR')
    }
    if (method !== 'SMS' && method !== 'VOICE') {
      throw new AppError('Escolha SMS ou ligação para receber o código.', 400, 'VALIDATION_ERROR')
    }

    const normalized = MetaChannelOnboardingService.normalizePhone(
      String(body.countryCode || ''),
      String(body.phoneNumber || '')
    )
    const organizationId = user.organizationId
    const existingChannel = await ChannelRepository.findByPhoneNumberInOrganization(
      normalized.e164Digits,
      organizationId
    )

    if (existingChannel?.isActive && existingChannel.connectionStatus === 'CONNECTED') {
      throw new AppError('Este número já está conectado a um canal.', 409, 'CONFLICT')
    }

    if (!existingChannel) {
      await LimitsService.checkCanCreateChannel(organizationId)
    }

    const metaPhone = existingChannel?.metaPhoneNumberId
      ? await MetaChannelOnboardingService.getPhoneNumber(existingChannel.metaPhoneNumberId)
      : await MetaChannelOnboardingService.ensurePhoneNumber({
          countryCode: normalized.countryCode,
          nationalNumber: normalized.nationalNumber,
          displayName,
        })

    const channelData = {
      name,
      phoneNumber: normalized.e164Digits,
      isActive: true,
      connectionStatus: 'CONNECTING',
      provider: 'META_CLOUD',
      whatsappProvider: 'META_CLOUD',
      providerSessionId: null,
      metaPhoneNumberId: metaPhone.id,
      metaWabaId: MetaChannelOnboardingService.getWabaId(),
      metaAccessToken: null,
      metaWebhookVerifyToken:
        process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ||
        existingChannel?.metaWebhookVerifyToken ||
        `motiva_${generateId()}`,
    }

    const channel = existingChannel
      ? await ChannelRepository.update(existingChannel.id, organizationId, channelData)
      : await ChannelRepository.create(organizationId, channelData)

    try {
      await MetaChannelOnboardingService.requestVerificationCode(metaPhone.id, method)
      return NextResponse.json({
        success: true,
        data: {
          channelId: channel.id,
          phoneNumber: normalized.e164Digits,
          deliveryMethod: method,
          codeSent: true,
        },
      })
    } catch (error) {
      await ChannelRepository.update(channel.id, organizationId, { connectionStatus: 'ERROR' })
      return NextResponse.json({
        success: true,
        data: {
          channelId: channel.id,
          phoneNumber: normalized.e164Digits,
          deliveryMethod: method,
          codeSent: false,
          warning: publicMessage(error),
        },
      })
    }
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
