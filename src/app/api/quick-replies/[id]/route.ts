import { NextRequest, NextResponse } from 'next/server'
import { QuickReplyService } from '@/services/quick-replies'
import { handleApiError, AppError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/quick-replies/[id]';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, { id, body });
    
    if (!id) throw new AppError('ID obrigatório', 400, 'VALIDATION_ERROR');
    
    const updated = await QuickReplyService.updateReply(id, body)
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
    console.log(`[API] ${req.method} ${ROUTE}:`, { id });

    if (!id) throw new AppError('ID obrigatório', 400, 'VALIDATION_ERROR');

    await QuickReplyService.deleteReply(id)
    return NextResponse.json({ success: true, message: 'Resposta rápida excluída com sucesso' })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
