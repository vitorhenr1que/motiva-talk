import { NextResponse } from 'next/server'
import { FunnelRepository } from '@/repositories/funnelRepository'
import { handleApiError } from '@/lib/api-errors'

const ROUTE = '/api/conversations/[id]/funnel';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params
    const funnel = await FunnelRepository.getConversationFunnel(id)
    return NextResponse.json({ success: true, data: funnel })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params
    const body = await req.json()
    // Body should have { stageId, value, rank }
    const res = await FunnelRepository.setConversationStage(id, body.stageId, body.value, body.rank)
    return NextResponse.json({ success: true, data: res })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const stageId = searchParams.get('stageId')
    
    if (!stageId) throw new Error('stageId é obrigatório')
    
    await FunnelRepository.removeConversationStage(id, stageId)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
