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
    const { enabled, message, cooldownHours } = body

    const payload = {
      channelId,
      enabled,
      message,
      cooldownHours,
      updatedByUserId: userId,
      updatedAt: new Date().toISOString()
    }

    const { data: existing } = await supabaseAdmin
      .from('auto_reply_settings')
      .select('id')
      .eq('channelId', channelId)
      .maybeSingle()

    let result;
    if (existing) {
      result = await supabaseAdmin
        .from('auto_reply_settings')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single()
    } else {
      result = await supabaseAdmin
        .from('auto_reply_settings')
        .insert([payload])
        .select()
        .single()
    }

    if (result.error) throw result.error

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
