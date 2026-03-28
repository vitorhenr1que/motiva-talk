import { NextRequest, NextResponse } from 'next/server'
import { TagService } from '@/services/tags'

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { tags, newTagMeta } = await req.json() 

    if (!Array.isArray(tags)) {
      return NextResponse.json({ error: 'Formato inválido' }, { status: 400 })
    }

    // Se houver metadados de uma nova tag, criamos ela primeiro no banco
    if (newTagMeta) {
      const { TagRepository } = await import('@/repositories/tagRepository')
      await TagRepository.findOrCreate(newTagMeta.name, newTagMeta.color, newTagMeta.emoji)
    }

    await TagService.syncConversationTags(id, tags)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error (Conversation Tags):', error)
    return NextResponse.json({ error: 'Erro ao atualizar etiquetas' }, { status: 500 })
  }
}
