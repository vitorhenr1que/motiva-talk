import { NextRequest, NextResponse } from 'next/server'
import { ContactService } from '@/services/contacts'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { channelId } = await req.json()
    if (!channelId) {
      return NextResponse.json({ success: false, error: 'channelId is required' }, { status: 400 })
    }

    const { id } = await params
    console.log(`[API_PROFILE_PICTURE] Iniciando busca para contato ${id} e canal ${channelId}`)
    
    const profilePictureUrl = await ContactService.getAndUpdateProfilePicture(id, channelId)

    return NextResponse.json({ 
      success: true, 
      profilePictureUrl 
    })
  } catch (error: any) {
    console.error('[API_PROFILE_PICTURE] Erro:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
