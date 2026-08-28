import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-errors'
import { getServerSession, getUserRole } from '@/lib/auth-server'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'
import { AutoReplyService } from '@/services/auto-replies'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/settings/auto-replies';

export async function GET(req: Request) {
  try {
    const userSession = await getServerSession()
    if (!userSession) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()

    const role = await getUserRole(userSession.email!, organizationId)
    const userId = userSession.id

    const formattedChannels = await AutoReplyService.listChannelSettings(
      organizationId,
      userId,
      role === 'ADMIN'
    )

    return NextResponse.json({ 
      success: true, 
      data: formattedChannels
    })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
