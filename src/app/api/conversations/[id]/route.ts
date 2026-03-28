import { NextRequest, NextResponse } from 'next/server'
import { ConversationService } from '@/services/conversations'
import { handleApiError, AppError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/conversations/[id]';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, { id, body });

    const { status, assignedTo } = body

    if (!id) throw new AppError('ID obrigatório', 400, 'VALIDATION_ERROR');

    let updated;
    
    if (assignedTo) {
      updated = await ConversationService.assignAgent(id, assignedTo)
    } else if (status) {
      updated = await ConversationService.updateStatus(id, status)
    } else {
      throw new AppError('Status ou assignedTo é necessário', 400, 'VALIDATION_ERROR');
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
