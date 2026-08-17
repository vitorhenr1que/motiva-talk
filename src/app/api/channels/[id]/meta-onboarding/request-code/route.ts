import { NextResponse } from 'next/server'

import { AppError, handleApiError } from '@/lib/api-errors'
import { requireAdminOrOwner } from '@/lib/tenant'
import { ChannelRepository } from '@/repositories/channelRepository'
import { MetaChannelOnboardingService } from '@/services/meta/channel-onboarding.service'

export const dynamic = 'force-dynamic'

const ROUTE = '/api/channels/[id]/meta-onboarding/request-code'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdminOrOwner()
    const { id } = await params
    const body = (await req.json()) as { method?: unknown }
    const method = String(body.method || '').toUpperCase()

    if (method !== 'SMS' && method !== 'VOICE') {
      throw new AppError('Escolha SMS ou ligação para receber o código.', 400, 'VALIDATION_ERROR')
    }

    const channel = await ChannelRepository.findById(id, user.organizationId)
    if (!channel?.metaPhoneNumberId) {
      throw new AppError('Este canal ainda não possui um Phone Number ID da Meta.', 409, 'CONFLICT')
    }

    await MetaChannelOnboardingService.requestVerificationCode(channel.metaPhoneNumberId, method)
    await ChannelRepository.update(id, user.organizationId, { connectionStatus: 'CONNECTING' })

    return NextResponse.json({ success: true, data: { deliveryMethod: method } })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
