import { NextRequest, NextResponse } from 'next/server'
import { QuickReplyService } from '@/services/quick-replies'
import { handleApiError, AppError } from '@/lib/api-errors'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/quick-replies/[id]';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()
    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, { id, body });
    
    if (!id) throw new AppError('ID obrigatório', 400, 'VALIDATION_ERROR');
    
    const updated = await QuickReplyService.updateReply(id, organizationId, body)
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()
    console.log(`[API] ${req.method} ${ROUTE}:`, { id });

    if (!id) throw new AppError('ID obrigatório', 400, 'VALIDATION_ERROR');

    await QuickReplyService.deleteReply(id, organizationId)
    return NextResponse.json({ success: true, message: 'Resposta rápida excluída com sucesso' })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
