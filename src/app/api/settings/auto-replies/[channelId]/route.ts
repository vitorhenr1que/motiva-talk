import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { handleApiError } from '@/lib/api-errors'
import { getServerSession, getUserRole } from '@/lib/auth-server'

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

    const role = await getUserRole(userSession.email!)
    const userId = userSession.id

    // Validar se usuário tem permissão no canal
    if (role !== 'ADMIN') {
      const { data: permission } = await supabaseAdmin
        .from('UserChannel')
        .select('channelId')
        .eq('userId', userId)
        .eq('channelId', channelId)
        .maybeSingle()
      
      if (!permission) {
        return NextResponse.json({ error: 'Acesso negado ao canal' }, { status: 403 })
      }
    }

    const body = await req.json()
    console.log(`[AUTO-REPLY] Updating settings for channel ${channelId}:`, body)
    
    const { enabled, message, cooldownHours } = body

    const { data, error } = await supabaseAdmin
      .from('auto_reply_settings')
      .upsert({
        channelId,
        enabled,
        message,
        cooldownHours,
        updatedByUserId: userId,
        updatedAt: new Date().toISOString()
      }, { onConflict: 'channelId' })
      .select()
      .single()

    if (error) {
      console.error('[AUTO-REPLY] Upsert error:', error)
      throw error
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
