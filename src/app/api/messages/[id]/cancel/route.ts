import { NextRequest, NextResponse } from 'next/server'
import { MessageService } from '@/services/messages'
import { handleApiError, AppError } from '@/lib/api-errors'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'

const ROUTE = 'PATCH /api/messages/[id]/cancel'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()
    if (!id) throw new AppError('ID da mensagem é obrigatório', 400);

    console.log(`[API] ${ROUTE}: Cancelando mensagem ${id}`);

    const message = await MessageService.cancelScheduledMessage(id, organizationId);
    
    return NextResponse.json({ success: true, data: message })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
