import { NextResponse } from 'next/server'
import { ChannelService } from '@/services/channels'
import { handleApiError, validateBody } from '@/lib/api-errors'
import { getServerSession } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/channels';

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

    return NextResponse.json({ success: true, data: channels })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, body); // Simple trace
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()
    
    validateBody(body, ['name', 'phoneNumber'])
    
    const channel = await ChannelService.registerChannel(organizationId, body)
    return NextResponse.json({ success: true, data: channel }, { status: 201 })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
