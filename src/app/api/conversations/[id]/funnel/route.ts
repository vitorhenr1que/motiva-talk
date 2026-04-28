import { NextResponse } from 'next/server'
import { FunnelRepository } from '@/repositories/funnelRepository'
import { handleApiError } from '@/lib/api-errors'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'

const ROUTE = '/api/conversations/[id]/funnel';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()
    const funnel = await FunnelRepository.getConversationFunnel(id, organizationId)
    return NextResponse.json({ success: true, data: funnel })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()
    // Body should have { stageId, value, rank }
    const res = await FunnelRepository.setConversationStage(organizationId, id, body.stageId, body.value, body.rank)
    return NextResponse.json({ success: true, data: res })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()
    const { searchParams } = new URL(req.url)
    const stageId = searchParams.get('stageId')
    
    if (!stageId) throw new Error('stageId é obrigatório')
    
    await FunnelRepository.removeConversationStage(id, stageId, organizationId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
