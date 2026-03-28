import { NextRequest, NextResponse } from 'next/server'
import { MessageService } from '@/services/messages'
import { deleteFile } from '@/lib/supabase-utils'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID da mensagem obrigatório' }, { status: 400 })

    // 1. Buscar a mensagem antes de deletar para pegar a URL do arquivo no Storage
    const message = await MessageService.getMessageById(id)
    
    if (message && message.type !== 'TEXT') {
      try {
        // 2. Tentar deletar o arquivo do Storage se não for texto
        await deleteFile(message.content)
      } catch (storageError) {
        console.warn('Falha ao deletar arquivo do storage:', storageError)
        // Continuamos para deletar o registro no banco mesmo se o storage falhar
      }
    }

    // 3. Deletar do banco de dados via Prisma
    await MessageService.deleteMessage(id)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error (Messages DELETE):', error)
    return NextResponse.json({ error: 'Erro ao excluir mensagem' }, { status: 500 })
  }
}
