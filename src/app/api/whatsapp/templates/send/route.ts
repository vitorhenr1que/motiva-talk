import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-errors'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'
import { WhatsAppTemplateService } from '@/services/whatsapp-templates'

export const dynamic = 'force-dynamic'

const ROUTE = '/api/whatsapp/templates/send'

export async function POST(req: Request) {
  try {
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()

    const body = await req.json()
    const message = await WhatsAppTemplateService.send(organizationId, body)
    return NextResponse.json({ success: true, data: message }, { status: 201 })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
