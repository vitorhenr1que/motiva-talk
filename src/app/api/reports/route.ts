import { NextResponse } from 'next/server'
import { ReportsRepository, ReportsFilter } from '@/repositories/reportsRepository'

export async function POST(req: Request) {
  try {
    const filters: ReportsFilter = await req.json();
    
    // Obter Métricas Realtime
    const data = await ReportsRepository.getMetrics(filters);
    
    return NextResponse.json({ 
      success: true, 
      data 
    });
  } catch (error: any) {
    console.error('[REPORTS_API_ERROR] Falha ao processar relatórios:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Erro interno do servidor' 
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // Retornar métricas default se acessar via GET
  const data = await ReportsRepository.getMetrics({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  return NextResponse.json({ success: true, data });
}
