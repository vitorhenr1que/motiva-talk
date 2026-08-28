import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-errors'
import { getServerSession, getUserRole } from '@/lib/auth-server'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'
import { AutoReplyService } from '@/services/auto-replies'

export const dynamic = 'force-dynamic';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const ROUTE = `/api/settings/auto-replies/${channelId}`;

  try {
    const userSession = await getServerSession()
    if (!userSession) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()

    const role = await getUserRole(userSession.email!, organizationId)
    const userId = userSession.id

    const body = await req.json()
    const result = await AutoReplyService.saveChannelSettings(
      organizationId,
      channelId,
      userId,
      role === 'ADMIN',
      body
    )

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: result.status }
      )
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
