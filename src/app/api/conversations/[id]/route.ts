import { NextRequest, NextResponse } from 'next/server'
import { ConversationService } from '@/services/conversations'
import { handleApiError, AppError } from '@/lib/api-errors'
import { getServerSession } from '@/lib/auth-server'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/conversations/[id]';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getServerSession();
    if (!user) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');

    if (!id) throw new AppError('ID obrigatório', 400, 'VALIDATION_ERROR');

    const body = await req.json();
    console.log('[API] PATCH ' + ROUTE + ':', { id, body });

    const { status, unreadCount, pinnedNote } = body;
    let { assignedTo } = body;

    // Se a conversa for finalizada, garante que o atendente atual seja registrado
    if (status === 'CLOSED' && !assignedTo) {
      assignedTo = user.id;
    }

    let updated;
    
    // Se for atribuição de agente específica (sem alteração de status)
    if (assignedTo && !status) {
      updated = await ConversationService.assignAgent(id, assignedTo)
    } 
    // Atualização genérica de campos (status, pinnedNote, unreadCount)
    else {
      const updateData: any = {};
      
      // Apenas adiciona ao objeto se estiver presente no body
      if (status) updateData.status = status;
      if (pinnedNote !== undefined) updateData.pinnedNote = pinnedNote;
      if (unreadCount !== undefined) updateData.unreadCount = Number(unreadCount);
      if (assignedTo) updateData.assignedTo = assignedTo;

      if (Object.keys(updateData).length === 0) {
        throw new AppError('Nenhum campo válido para atualização (status, pinnedNote, unreadCount)', 400, 'VALIDATION_ERROR');
      }

      updated = await ConversationService.updateConversation(id, updateData);
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userSession = await getServerSession();
    if (!userSession) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');

    if (!id) throw new AppError('ID obrigatório', 400, 'VALIDATION_ERROR');

    // 1. Verificar permissão global
    const { SettingRepository } = await import('@/repositories/settingRepository');
    const { getUserRole } = await import('@/lib/auth-server');
    
    const settings = await SettingRepository.getChatSettings();
    const userRole = await getUserRole(userSession.email!);

    // Se NÃO for admin ou supervisor, verifica a flag global
    if (userRole !== 'ADMIN' && userRole !== 'SUPERVISOR') {
       if (!settings?.allowAgentDeleteConversation) {
          throw new AppError('Você não tem permissão para apagar conversas. Contate o administrador.', 403, 'FORBIDDEN');
       }
    }

    console.log('[API] DELETE ' + ROUTE + ':', { id, user: userSession.email, role: userRole });

    await ConversationService.deleteConversation(id);

    return NextResponse.json({ success: true, message: 'Conversa excluída com sucesso' });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
