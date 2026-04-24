import { NextRequest, NextResponse } from 'next/server' 
import { MessageService } from '@/services/messages'
import { handleApiError, AppError } from '@/lib/api-errors'

const ROUTE = 'POST /api/messages/schedule'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log(`[API] ${ROUTE}:`, { 
      conversationId: body.conversationId, 
      scheduledAt: body.scheduledAt 
    });

    if (!body.conversationId) throw new AppError('conversationId é obrigatório', 400);
    if (!body.scheduledAt) throw new AppError('scheduledAt é obrigatório', 400);

    const message = await MessageService.scheduleMessage(body);
    
    return NextResponse.json({ success: true, data: message })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
