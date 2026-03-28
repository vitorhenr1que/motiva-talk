import { NextRequest, NextResponse } from 'next/server'
import { ConversationService } from '@/services/conversations'
import { handleApiError, AppError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/conversations/[id]';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    console.log('[API] PATCH ' + ROUTE + ':', { id, body });

    if (!id) throw new AppError('ID obrigatório', 400, 'VALIDATION_ERROR');

    const { status, assignedTo, unreadCount, pinnedNote } = body;

    let updated;
    
    // Se for atribuição de agente específica
    if (assignedTo) {
      updated = await ConversationService.assignAgent(id, assignedTo)
    } 
    // Atualização genérica de campos (status, pinnedNote, unreadCount)
    else {
      const updateData: any = {};
      
      // Apenas adiciona ao objeto se estiver presente no body
      if (status) updateData.status = status;
      if (pinnedNote !== undefined) updateData.pinnedNote = pinnedNote;
      if (unreadCount !== undefined) updateData.unreadCount = Number(unreadCount);

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
