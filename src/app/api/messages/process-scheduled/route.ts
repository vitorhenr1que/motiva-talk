import { NextRequest, NextResponse } from 'next/server' 
import { MessageService } from '@/services/messages'
import { handleApiError, AppError } from '@/lib/api-errors'

const ROUTE = 'POST /api/messages/process-scheduled'
const CRON_SECRET = process.env.CRON_SECRET

export async function POST(req: NextRequest) {
  try {
    // 1. Validar Authorization Bearer
    const authHeader = req.headers.get('authorization')
    if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
      const ip = req.headers.get('x-forwarded-for') || 'unknown'
      console.warn(`[CRON] Chamada não autorizada de ${ip}`);
      throw new AppError('Não autorizado', 401);
    }

    console.log(`[CRON] Iniciando processamento de mensagens agendadas...`);

    // 2. Processar mensagens
    const result = await MessageService.processScheduledMessages();
    
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
