import { NextRequest, NextResponse } from 'next/server'
import { AppError, handleApiError } from '@/lib/api-errors'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'
import { WhatsAppTemplateService } from '@/services/whatsapp-templates'

export const dynamic = 'force-dynamic'

const ROUTE = '/api/whatsapp/templates/[id]'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) throw new AppError('ID obrigatório', 400, 'VALIDATION_ERROR')
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()

    const body = await req.json()
    const template = await WhatsAppTemplateService.update(id, organizationId, body)
    return NextResponse.json({ success: true, data: template })
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
    if (!id) throw new AppError('ID obrigatório', 400, 'VALIDATION_ERROR')
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()

    await WhatsAppTemplateService.delete(id, organizationId)
    return NextResponse.json({ success: true, message: 'Template excluído com sucesso' })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
