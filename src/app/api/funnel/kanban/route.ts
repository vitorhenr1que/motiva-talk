import { NextResponse } from 'next/server'
import { FunnelRepository } from '@/repositories/funnelRepository'
import { handleApiError } from '@/lib/api-errors'

const ROUTE = '/api/funnel/kanban';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Converte datas para ISO se necessário (garante formato correto)
    const start = startDate ? new Date(`${startDate}T00:00:00.000Z`).toISOString() : undefined;
    const end = endDate ? new Date(`${endDate}T23:59:59.999Z`).toISOString() : undefined;

    const kanbanData = await FunnelRepository.getKanbanData(start, end)
    
    return NextResponse.json({ 
      success: true, 
      data: kanbanData 
    })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
