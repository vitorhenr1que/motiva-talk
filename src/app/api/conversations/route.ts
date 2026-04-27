import { NextResponse } from 'next/server'
import { ConversationService } from '@/services/conversations'
import { UserRepository } from '@/repositories/userRepository'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { handleApiError, validateBody, AppError } from '@/lib/api-errors'
import { getServerSession, getUserRole } from '@/lib/auth-server'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/conversations';

export async function GET(req: Request) {
  try {
    const user = await getServerSession()
    if (!user) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');
    
    const role = await getUserRole(user.email!)
    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId') || undefined
    const status = (searchParams.get('status') as string) || undefined
    const tagId = searchParams.get('tagId') || undefined
    const search = searchParams.get('search') || undefined
    const cursorValue = searchParams.get('cursorValue') || undefined
    const cursorId = searchParams.get('cursorId') || undefined
    const cursorPinnedAt = searchParams.get('cursorPinnedAt') || undefined
    const limit = parseInt(searchParams.get('limit') || '15')

    const dbUser = await UserRepository.findMany({ email: user.email! }).then(users => users?.[0])

    let where: any = {
      channelId: channelId || undefined,
      status: status || undefined,
      tagId: tagId || undefined,
      sectorId: searchParams.get('sectorId') || undefined,
      assignedTo: searchParams.get('assignedTo') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      search: search || undefined,
      historical: searchParams.get('historical') === 'true',
      limit
    }

    // No modo histórico, status é ignorado (a aba lista todas as conversas com tenure passado)
    if (where.historical) where.status = undefined;

    if (cursorValue && cursorId) {
      where.cursor = {
        value: cursorValue,
        id: cursorId,
        pinnedAt: cursorPinnedAt
      }
    }

    // Buscar setores permitidos do usuário
    const { data: userSectors } = await supabaseAdmin
      .from('UserSector')
      .select('sectorId')
      .eq('userId', dbUser?.id)
    const allowedSectorIds = userSectors?.map((us: any) => us.sectorId) || []

    // Lógica de Filtro por Role (Segurança)
    if (role !== 'ADMIN' && role !== 'SUPERVISOR') {
      const { data: userChannels } = await supabaseAdmin
        .from('UserChannel')
        .select('channelId')
        .eq('userId', dbUser?.id)
      
      const allowedChannelIds = userChannels?.map((uc: any) => uc.channelId) || []
      
      // Filtro Especial: Ver conversas atribuídas a mim OU abertas nos meus canais
      where.allowedChannelIds = allowedChannelIds;
      where.allowedSectorIds = allowedSectorIds;
      where.currentUserId = dbUser?.id;
    }

    const conversations = await ConversationService.listByFilter(where)
    return NextResponse.json({ success: true, data: conversations })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, body);
    
    validateBody(body, ['contactId', 'channelId'])

    const conversation = await ConversationService.startConversation(body.contactId, body.channelId)
    return NextResponse.json({ success: true, data: conversation }, { status: 201 })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
