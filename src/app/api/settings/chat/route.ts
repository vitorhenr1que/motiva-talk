import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-errors'
import { getServerSession, getUserRole } from '@/lib/auth-server'
import { SettingRepository } from '@/repositories/settingRepository'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/settings/chat';

export async function GET(req: Request) {
  try {
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()
    const settings = await SettingRepository.findByOrganization(organizationId)
    
    return NextResponse.json({ 
      success: true, 
        data: {
          autoIdentifyAgent: settings.autoIdentifyAgent,
          allowAgentNameEdit: settings.allowAgentNameEdit ?? (settings as any).allowAgentEditName ?? false,
          allowAgentDeleteConversation: settings.allowAgentDeleteConversation ?? false,
          finishMessage: settings.finishMessage || 'Seu atendimento foi finalizado. Gostaríamos de saber sua opinião sobre o nosso atendimento:',
          agentMenuVisibility: settings.agentMenuVisibility || {
            conversations: true,
            funnel: true,
            reports: false,
            channels: false,
            contacts: false,
            suggestions: true,
            settings: true
          },
          defaultTriageSectorId: settings.defaultTriageSectorId || null
        }
      })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function PATCH(req: Request) {
  try {
    const userSession = await getServerSession()
    if (!userSession) throw new Error('Não autorizado')
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()

    const role = await getUserRole(userSession.email!, organizationId)
    if (role !== 'ADMIN') throw new Error('Acesso negado')

    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, body);

    const { autoIdentifyAgent, allowAgentNameEdit, allowAgentDeleteConversation, agentMenuVisibility, finishMessage, defaultTriageSectorId } = body

    if (defaultTriageSectorId) {
      const { data: sector } = await supabaseAdmin
        .from('Sector')
        .select('id')
        .eq('id', defaultTriageSectorId)
        .eq('organizationId', organizationId)
        .maybeSingle()

      if (!sector) throw new Error('Setor de triagem padrão não encontrado')
    }

    const existing = await SettingRepository.findByOrganization(organizationId)
    const payload = { 
      autoIdentifyAgent, 
      allowAgentNameEdit,
      allowAgentDeleteConversation,
      agentMenuVisibility,
      finishMessage,
      defaultTriageSectorId
    };

    const result = await SettingRepository.updateChatSettings(existing.id, organizationId, payload)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
