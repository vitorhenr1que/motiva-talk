import { NextResponse } from 'next/server'
import { handleApiError, AppError } from '@/lib/api-errors'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'
import { WhatsAppTemplateService } from '@/services/whatsapp-templates'

export const dynamic = 'force-dynamic'

const ROUTE = '/api/whatsapp/templates/bulk-send'

export async function POST(req: Request) {
  try {
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()

    const body = await req.json()
    if (body.action === 'preview') {
      const preview = await WhatsAppTemplateService.previewBulk(organizationId, body)
      return NextResponse.json({
        success: true,
        data: {
          segment: preview.segment,
          total: preview.total,
          sample: preview.sample,
          limit: 200,
        },
      })
    }
    if (body.action !== 'send') {
      throw new AppError('Ação inválida.', 400, 'VALIDATION_ERROR')
    }

    const result = await WhatsAppTemplateService.sendBulk(organizationId, body)
    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
