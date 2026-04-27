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

    const { data: conversation } = await supabaseAdmin
      .from('Conversation')
      .select('channelId, currentSectorId, assignedTo')
      .eq('id', conversationId)
      .single();

    if (!conversation) throw new AppError('Conversa não encontrada', 404);

    // 1. Verificar acesso ao canal
    const { data: userChannel } = await supabaseAdmin
      .from('UserChannel')
      .select('channelId, Channel(allowAgentFilterAllSectors)')
      .eq('userId', dbUser?.id)
      .eq('channelId', conversation.channelId)
      .maybeSingle();

    if (role !== 'ADMIN' && role !== 'SUPERVISOR' && !userChannel) {
      throw new AppError('Você não tem acesso ao canal desta conversa', 403, 'FORBIDDEN');
    }

    const canViewAllSectorsInChannel = role === 'ADMIN' || role === 'SUPERVISOR' || (userChannel as any)?.Channel?.allowAgentFilterAllSectors === true;
    
    let allowedSectorIds: string[] | undefined = undefined;

    if (!canViewAllSectorsInChannel && dbUser) {
      const { data: userSectors } = await supabaseAdmin
        .from('UserSector')
        .select('sectorId')
        .eq('userId', dbUser.id);
      
      const mySectors = userSectors?.map(us => us.sectorId) || [];

      // Se o usuário está solicitando um setor específico (Histórico), permitimos se ele tiver 
      // acesso à conversa (pelo canal ou por ser o responsável), mas o MessageService já 
      // vai filtrar pelo sectorId solicitado.
      // Se não solicitou setor (Visão Geral), limitamos aos setores dele.
      if (!sectorId) {
        allowedSectorIds = mySectors;
      } else {
        // Se solicitou um setor que não é o dele, permitimos a visualização (Read Only)
        // já que ele tem acesso à conversa pelo canal.
        allowedSectorIds = [sectorId];
      }
    } else if (sectorId) {
       // Admin/Supervisor/AllSectors filtering by specific sector
       allowedSectorIds = [sectorId];
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
