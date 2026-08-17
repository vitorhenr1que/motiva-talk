import { NextResponse } from 'next/server'

import { AppError, handleApiError } from '@/lib/api-errors'
import { requireAdminOrOwner } from '@/lib/tenant'
import { ChannelRepository } from '@/repositories/channelRepository'
import { MetaChannelOnboardingService } from '@/services/meta/channel-onboarding.service'

export const dynamic = 'force-dynamic'

const ROUTE = '/api/channels/[id]/meta-onboarding/complete'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdminOrOwner()
    const { id } = await params
    const body = (await req.json()) as { code?: unknown; pin?: unknown }
    const code = String(body.code || '').replace(/\D/g, '')
    const pin = String(body.pin || '').replace(/\D/g, '')

    if (code.length !== 6) {
      throw new AppError('O código recebido deve ter 6 dígitos.', 400, 'VALIDATION_ERROR')
    }
    if (pin.length !== 6) {
      throw new AppError('Crie um PIN de segurança com exatamente 6 dígitos.', 400, 'VALIDATION_ERROR')
    }

    const channel = await ChannelRepository.findById(id, user.organizationId)
    if (!channel?.metaPhoneNumberId) {
      throw new AppError('Este canal ainda não possui um Phone Number ID da Meta.', 409, 'CONFLICT')
    }

    const metaPhone = await MetaChannelOnboardingService.completeRegistration(
      channel.metaPhoneNumberId,
      code,
      pin
    )
    const validatedPhone = String(metaPhone.display_phone_number || '').replace(/\D/g, '')
    if (
      validatedPhone &&
      !MetaChannelOnboardingService.phoneNumbersMatch(validatedPhone, String(channel.phoneNumber))
    ) {
      throw new AppError('A Meta retornou um número diferente do canal solicitado.', 409, 'CONFLICT')
    }

    const updatedChannel = await ChannelRepository.update(id, user.organizationId, {
      // Mantém o E.164 informado pelo usuário; a Meta pode exibir celulares brasileiros sem o nono dígito.
      phoneNumber: channel.phoneNumber,
      metaWabaId: MetaChannelOnboardingService.getWabaId(),
      metaAccessToken: null,
      whatsappProvider: 'META_CLOUD',
      provider: 'META_CLOUD',
      providerSessionId: null,
      connectionStatus: 'CONNECTED',
    })
    const safeChannel = { ...updatedChannel }
    delete safeChannel.metaAccessToken

    return NextResponse.json({ success: true, data: safeChannel })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
