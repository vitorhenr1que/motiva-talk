import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-errors'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'
import { WhatsAppTemplateService } from '@/services/whatsapp-templates'

export const dynamic = 'force-dynamic'

const ROUTE = '/api/whatsapp/templates'

export async function GET(req: Request) {
  try {
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()

    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId') || undefined
    const status = searchParams.get('status') || undefined

    const templates = await WhatsAppTemplateService.list(organizationId, { channelId, status })
    return NextResponse.json({
      success: true,
      data: templates,
      examples: WhatsAppTemplateService.getUsageExamples(),
    })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function POST(req: Request) {
  try {
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()

    const body = await req.json()
    const template = await WhatsAppTemplateService.create(organizationId, body)
    return NextResponse.json({ success: true, data: template }, { status: 201 })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
