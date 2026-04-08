import { NextResponse } from 'next/server'
import { ConversationRepository } from '@/repositories/conversationRepository'
import { UserRepository } from '@/repositories/userRepository'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { handleApiError, AppError } from '@/lib/api-errors'
import { getServerSession, getUserRole } from '@/lib/auth-server'

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await getServerSession()
    if (!user) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');
    
    const role = await getUserRole(user.email!)
    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId') || undefined
    const tagId = searchParams.get('tagId') || undefined
    const search = searchParams.get('search') || undefined

    const dbUser = await UserRepository.findMany({ email: user.email! }).then(users => users?.[0])

    let where: any = {
      channelId,
      tagId,
      search
    }

    if (role !== 'ADMIN' && role !== 'SUPERVISOR') {
      const { data: userChannels } = await supabaseAdmin
        .from('UserChannel')
        .select('channelId')
        .eq('userId', dbUser?.id)
      
      where.allowedChannelIds = userChannels?.map(uc => uc.channelId) || []
      where.currentUserId = dbUser?.id;
    }

    const counts = await ConversationRepository.countByStatus(where)
    return NextResponse.json({ success: true, data: counts })
  } catch (error) {
    return handleApiError(error, req, { route: '/api/conversations/counts' })
  }
}
