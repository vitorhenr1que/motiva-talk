import { NextResponse } from 'next/server'
import { FunnelRepository } from '@/repositories/funnelRepository'
import { handleApiError, validateBody } from '@/lib/api-errors'

const ROUTE = '/api/funnel/stages';

export async function GET(req: Request) {
  try {
    const stages = await FunnelRepository.listStages()
    return NextResponse.json({ success: true, data: stages })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    validateBody(body, ['name', 'type', 'order'])
    
    const stage = await FunnelRepository.createStage(body)
    return NextResponse.json({ success: true, data: stage }, { status: 201 })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
