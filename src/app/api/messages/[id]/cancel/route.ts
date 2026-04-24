import { NextRequest, NextResponse } from 'next/server'
import { MessageService } from '@/services/messages'
import { handleApiError, AppError } from '@/lib/api-errors'

const ROUTE = 'PATCH /api/messages/[id]/cancel'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    if (!id) throw new AppError('ID da mensagem é obrigatório', 400);

    console.log(`[API] ${ROUTE}: Cancelando mensagem ${id}`);

    const message = await MessageService.cancelScheduledMessage(id);
    
    return NextResponse.json({ success: true, data: message })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
