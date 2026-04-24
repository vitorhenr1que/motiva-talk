import { NextRequest, NextResponse } from 'next/server'
import { MessageService } from '@/services/messages'
import { deleteFile } from '@/lib/supabase-utils'
import { handleApiError, AppError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/messages/[id]';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log(`[API] ${req.method} ${ROUTE}:`, { id });

    if (!id) throw new AppError('ID da mensagem obrigatório', 400, 'VALIDATION_ERROR');

    // 1. Buscar a mensagem antes de deletar para pegar a URL do arquivo no Storage
    const message = await MessageService.getMessageById(id)
    
    if (message && message.type !== 'TEXT') {
      try {
        // 2. Tentar deletar o arquivo do Storage se não for texto
        await deleteFile(message.content)
      } catch (storageError) {
        console.warn('[API] Falha ao deletar arquivo do storage:', storageError)
        // Continuamos para deletar o registro no banco mesmo se o storage falhar
      }
    }

    // 3. Deletar do banco de dados
    await MessageService.deleteMessage(id)
    
    return NextResponse.json({ success: true, message: 'Mensagem excluída com sucesso' })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { content } = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, { id, contentLength: content?.length });

    if (!id) throw new AppError('ID da mensagem obrigatório', 400, 'VALIDATION_ERROR');
    if (!content) throw new AppError('Conteúdo obrigatório', 400, 'VALIDATION_ERROR');

    const updated = await MessageService.updateMessage(id, content)
    
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
