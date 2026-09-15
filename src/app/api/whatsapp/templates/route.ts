import { NextResponse } from 'next/server'
import { AppError, handleApiError } from '@/lib/api-errors'
import { getCurrentUserWithOrganization, organizationNotFoundError } from '@/lib/tenant'
import { SettingRepository } from '@/repositories/settingRepository'
import { WhatsAppTemplateService } from '@/services/whatsapp-templates'

export const dynamic = 'force-dynamic'

const ROUTE = '/api/whatsapp/templates'

async function getTemplateCreationContext() {
  const user = await getCurrentUserWithOrganization()
  if (!user?.organizationId || !user.organization) throw organizationNotFoundError()

  if (user.role === 'ADMIN' || user.role === 'OWNER' || user.role === 'SUPERVISOR') {
    return { organizationId: user.organizationId, canCreateTemplates: true }
  }

  const settings = await SettingRepository.findByOrganization(user.organizationId)
  return {
    organizationId: user.organizationId,
    canCreateTemplates: settings.allowAgentCreateTemplate === true,
  }
}

export async function GET(req: Request) {
  try {
    const { organizationId, canCreateTemplates } = await getTemplateCreationContext()

    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId') || undefined
    const status = searchParams.get('status') || undefined

    const templates = await WhatsAppTemplateService.list(organizationId, { channelId, status })
    return NextResponse.json({
      success: true,
      data: templates,
      permissions: { canCreateTemplates },
      examples: WhatsAppTemplateService.getUsageExamples(),
    })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function POST(req: Request) {
  try {
    const { organizationId, canCreateTemplates } = await getTemplateCreationContext()
    if (!canCreateTemplates) {
      throw new AppError(
        'Você não tem permissão para criar templates. Solicite a liberação ao administrador.',
        403,
        'FORBIDDEN'
      )
    }

    const body = await req.json()
    const template = await WhatsAppTemplateService.create(organizationId, body)
    return NextResponse.json({ success: true, data: template }, { status: 201 })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
