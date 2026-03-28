import { NextRequest, NextResponse } from 'next/server'
import { SuggestionService } from '@/services/suggestions'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const updated = await SuggestionService.updateSuggestion(id, body)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('API Error (Suggestions Config PATCH):', error)
    return NextResponse.json({ error: 'Erro ao atualizar sugestão' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    await SuggestionService.remove(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error (Suggestions Config DELETE):', error)
    return NextResponse.json({ error: 'Erro ao excluir sugestão' }, { status: 500 })
  }
}
