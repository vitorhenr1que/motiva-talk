import { NextRequest, NextResponse } from 'next/server'
import { SuggestionService } from '@/services/suggestions'
import { handleApiError, AppError } from '@/lib/api-errors'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/suggestions-config/[id]';

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

    const updated = await SuggestionService.updateSuggestion(id, organizationId, body)
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

    await SuggestionService.remove(id, organizationId)
    return NextResponse.json({ success: true, message: 'Sugestão excluída com sucesso' })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
