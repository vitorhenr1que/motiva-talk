import { NextResponse } from 'next/server'
import { ChannelService } from '@/services/channels'
import { LimitsService } from '@/services/limits.service'
import { handleApiError, validateBody } from '@/lib/api-errors'
import { getServerSession } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentOrganizationId, organizationNotFoundError, requireAdminOrOwner } from '@/lib/tenant'
import { ChannelRepository } from '@/repositories/channelRepository'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/channels';

function sanitizeChannel(channel: Record<string, unknown> | null) {
  if (!channel) return channel;
  const safeChannel = { ...channel };
  delete safeChannel.metaAccessToken;
  return safeChannel;
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession()
    if (!session?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()

    const { data: user } = await supabaseAdmin
      .from('User')
      .select('id, role')
      .eq('email', session.email)
      .eq('organizationId', organizationId)
      .single()

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    let channels;
    if (user.role === 'ADMIN' || user.role === 'SUPERVISOR') {
      channels = await ChannelService.listActive(organizationId)
    } else {
      // Filtrar canais atribuídos ao AGENT
      channels = await ChannelService.listActive(organizationId, user.id)
    }

    return NextResponse.json({ success: true, data: (channels || []).map(sanitizeChannel) })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const user = await requireAdminOrOwner()
    const organizationId = user.organizationId
    
    validateBody(body, ['name', 'phoneNumber'])

    const requestedPhone = String(body.phoneNumber).replace(/\D/g, '')

    const existingChannel = await ChannelRepository.findByPhoneNumberInOrganization(requestedPhone, organizationId)
    if (existingChannel?.isActive) {
      return NextResponse.json({ success: false, error: 'Este número já está cadastrado como canal.' }, { status: 409 })
    }

    if (existingChannel) {
      const reactivatedChannel = await ChannelRepository.update(existingChannel.id, organizationId, {
        name: String(body.name).trim(),
        isActive: true,
        connectionStatus: 'DISCONNECTED',
        provider: 'META_CLOUD',
        whatsappProvider: 'META_CLOUD',
        providerSessionId: null,
      })
      return NextResponse.json({ success: true, data: sanitizeChannel(reactivatedChannel), reactivated: true })
    }

    await LimitsService.checkCanCreateChannel(organizationId)

    const channel = await ChannelService.registerChannel(organizationId, {
      name: String(body.name).trim(),
      phoneNumber: requestedPhone,
      provider: 'META_CLOUD',
      whatsappProvider: 'META_CLOUD',
      connectionStatus: 'DISCONNECTED',
      providerSessionId: null,
    })
    return NextResponse.json({ success: true, data: channel }, { status: 201 })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
