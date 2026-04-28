import { NextResponse } from 'next/server'
import { FunnelRepository } from '@/repositories/funnelRepository'
import { handleApiError } from '@/lib/api-errors'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'

const ROUTE = '/api/funnel/stages/[id]';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()
    const body = await req.json()
    
    const stage = await FunnelRepository.updateStage(id, organizationId, body)
    return NextResponse.json({ success: true, data: stage })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()
    await FunnelRepository.deleteStage(id, organizationId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
