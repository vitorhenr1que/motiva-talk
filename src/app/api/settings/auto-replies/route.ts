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
      isActive
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

    const { data: channels, error: channelsError } = await channelQuery
    if (channelsError) throw channelsError

    // Fetch all auto-reply settings to map manually
    const { data: allSettings, error: settingsError } = await supabaseAdmin
      .from('auto_reply_settings')
      .select('*')
    
    if (settingsError) throw settingsError

    // Map settings to channels
    const formattedChannels = channels?.map(channel => {
      const channelSettings = allSettings?.find(s => s.channelId === channel.id)
      return {
        ...channel,
        autoReply: channelSettings || {
          enabled: false,
          message: '',
          cooldownHours: 24
        }
      }
    })

    return NextResponse.json({ 
      success: true, 
      data: formattedChannels 
    })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
