import { NextResponse } from 'next/server'
import { FunnelRepository } from '@/repositories/funnelRepository'
import { handleApiError } from '@/lib/api-errors'

const ROUTE = '/api/funnel/stages/[id]';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    
    const stage = await FunnelRepository.updateStage(id, body)
    return NextResponse.json({ success: true, data: stage })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await FunnelRepository.deleteStage(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
