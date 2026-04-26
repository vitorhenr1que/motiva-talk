import { NextResponse } from 'next/server'
import { MessageService } from '@/services/messages'
import { handleApiError, validateBody, AppError } from '@/lib/api-errors'
import { getServerSession, getUserRole } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { UserRepository } from '@/repositories/userRepository'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/messages';

export async function GET(req: Request) {
  try {
    const user = await getServerSession()
    if (!user) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');
    
    const role = await getUserRole(user.email!)
    const dbUser = await UserRepository.findMany({ email: user.email! }).then(users => users?.[0])

    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')
    const sectorId = searchParams.get('sectorId') || undefined
    const limit = parseInt(searchParams.get('limit') || '20')
    const before = searchParams.get('before') || undefined

    if (!conversationId) {
      throw new AppError('conversationId é obrigatório', 400, 'VALIDATION_ERROR');
    }

    let allowedSectorIds: string[] | undefined = undefined;

    if (role !== 'ADMIN' && role !== 'SUPERVISOR' && dbUser) {
      const { data: userSectors } = await supabaseAdmin
        .from('UserSector')
        .select('sectorId')
        .eq('userId', dbUser.id)
      
      allowedSectorIds = userSectors?.map(us => us.sectorId) || [];
    }

    const result = await MessageService.listByConversation(conversationId, limit, before, allowedSectorIds, sectorId)
    
    // Logs temporários para validação de paginação
    console.log(`[PAGINATION_DEBUG] Conv: ${conversationId} | Limit: ${limit} | Cursor: ${before || 'NONE'}`);
    console.log(`[PAGINATION_DEBUG] Retornou: ${result.messages.length} | HasMore: ${result.hasMore} | Next: ${result.nextCursor}`);

    return NextResponse.json({ 
      success: true, 
      data: result.messages,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore
    })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, body);

    validateBody(body, ['conversationId', 'channelId', 'senderType', 'content'])
    const { 
      conversationId, 
      channelId, 
      senderType, 
      content, 
      type, 
      replyToMessageId, 
      metadata,
      mediaUrl,
      fileName,
      mimeType,
      fileSize,
      thumbnailUrl,
      duration,
      sectorId
    } = body

    const message = await MessageService.createMessage({
      conversationId,
      channelId,
      senderType,
      content,
      type,
      replyToMessageId,
      metadata,
      mediaUrl,
      fileName,
      mimeType,
      fileSize,
      thumbnailUrl,
      duration,
      sectorId
    })

    return NextResponse.json({ success: true, data: message }, { status: 201 })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
