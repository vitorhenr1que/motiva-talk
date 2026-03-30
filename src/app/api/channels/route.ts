import { NextResponse } from 'next/server'
import { ChannelService } from '@/services/channels'
import { handleApiError, validateBody } from '@/lib/api-errors'
import { getServerSession } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/channels';

export async function GET(req: Request) {
  try {
    const session = await getServerSession()
    if (!session?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: user } = await supabaseAdmin
      .from('User')
      .select('id, role')
      .eq('email', session.email)
      .single()

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    let channels;
    if (user.role === 'ADMIN' || user.role === 'SUPERVISOR') {
      channels = await ChannelService.listActive()
    } else {
      // Filtrar canais atribuídos ao AGENT
      channels = await ChannelService.listActive(user.id)
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
    
    validateBody(body, ['name', 'phoneNumber'])
    
    const channel = await ChannelService.registerChannel(body)
    return NextResponse.json({ success: true, data: channel }, { status: 201 })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
