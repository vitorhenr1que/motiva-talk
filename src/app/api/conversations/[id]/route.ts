import { NextRequest, NextResponse } from 'next/server'
import { ConversationService } from '@/services/conversations'

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json()
    const { status, assignedTo } = body
    const { id } = await params

    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    let updated;
    
    if (assignedTo) {
      updated = await ConversationService.assignAgent(id, assignedTo)
    } else if (status) {
      updated = await ConversationService.updateStatus(id, status)
    } else {
      return NextResponse.json({ error: 'Status ou assignedTo é necessário' }, { status: 400 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('API Error (Conversations PATCH):', error)
    return NextResponse.json({ error: 'Erro ao atualizar conversa' }, { status: 500 })
  }
}
