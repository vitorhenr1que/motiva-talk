import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { handleApiError } from '@/lib/api-errors'
import { getServerSession, getUserRole } from '@/lib/auth-server'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/settings/auto-replies';

export async function GET(req: Request) {
  try {
    const userSession = await getServerSession()
    if (!userSession) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const role = await getUserRole(userSession.email!)
    const userId = userSession.id

    let channelQuery = supabaseAdmin.from('Channel').select(`
      id,
      name,
      phoneNumber,
      isActive,
      auto_reply_settings (
        enabled,
        message,
        cooldownHours
      )
    `)

    if (role !== 'ADMIN') {
      // Filtrar canais que o usuário tem acesso
      const { data: userChannels } = await supabaseAdmin
        .from('UserChannel')
        .select('channelId')
        .eq('userId', userId)
      
      const allowedChannelIds = userChannels?.map(uc => uc.channelId) || []
      channelQuery = channelQuery.in('id', allowedChannelIds)
    }

    const { data: channels, error } = await channelQuery

    if (error) throw error

    // Transform data to simplify frontend usage
    const formattedChannels = channels?.map(channel => ({
      ...channel,
      autoReply: (channel.auto_reply_settings as any)?.[0] || {
        enabled: false,
        message: '',
        cooldownHours: 24
      }
    }))

    return NextResponse.json({ 
      success: true, 
      data: formattedChannels 
    })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
