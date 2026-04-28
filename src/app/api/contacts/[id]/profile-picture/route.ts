import { NextRequest, NextResponse } from 'next/server'
import { ContactService } from '@/services/contacts'
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant'
import { handleApiError } from '@/lib/api-errors'

const ROUTE = '/api/contacts/[id]/profile-picture'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { channelId } = await req.json()
    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw organizationNotFoundError()
    if (!channelId) {
      return NextResponse.json({ success: false, error: 'channelId is required' }, { status: 400 })
    }

    const { id } = await params
    console.log(`[API_PROFILE_PICTURE] Iniciando busca para contato ${id} e canal ${channelId}`)
    
    const profilePictureUrl = await ContactService.getAndUpdateProfilePicture(id, channelId, organizationId)

    return NextResponse.json({ 
      success: true, 
      profilePictureUrl 
    })
  } catch (error: any) {
    console.error('[API_PROFILE_PICTURE] Erro:', error)
    return handleApiError(error, req, { route: ROUTE })
  }
}
