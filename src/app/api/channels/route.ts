import { NextResponse } from 'next/server'
import { ChannelService } from '@/services/channels'
import { handleApiError, validateBody } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/channels';

export async function GET(req: Request) {
  try {
    const channels = await ChannelService.listActive()
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
