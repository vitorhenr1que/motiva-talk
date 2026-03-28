import { NextRequest, NextResponse } from 'next/server'
import { QuickReplyService } from '@/services/quick-replies'

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
    
    const updated = await QuickReplyService.updateReply(id, body)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('API Error (Quick Replies PATCH):', error)
    return NextResponse.json({ error: 'Erro ao atualizar resposta rápida' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    await QuickReplyService.deleteReply(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error (Quick Replies DELETE):', error)
    return NextResponse.json({ error: 'Erro ao excluir resposta rápida' }, { status: 500 })
  }
}
