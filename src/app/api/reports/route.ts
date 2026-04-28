import { NextResponse } from 'next/server'
import { ReportsRepository, ReportsFilter } from '@/repositories/reportsRepository'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'
import { handleApiError } from '@/lib/api-errors'

const ROUTE = '/api/reports'

export async function POST(req: Request) {
  try {
    const filters: ReportsFilter = await req.json();
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) throw organizationNotFoundError();
    
    // Obter Métricas Realtime
    const data = await ReportsRepository.getMetrics(organizationId, filters);
    
    return NextResponse.json({ 
      success: true, 
      data 
    });
  } catch (error: any) {
    console.error('[REPORTS_API_ERROR] Falha ao processar relatórios:', error);
    return handleApiError(error, req, { route: ROUTE });
  }
}

export async function GET(req: Request) {
  try {
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) throw organizationNotFoundError();
    // Retornar métricas default se acessar via GET
    const data = await ReportsRepository.getMetrics(organizationId, {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
