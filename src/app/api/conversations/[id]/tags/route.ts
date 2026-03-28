import { NextRequest, NextResponse } from 'next/server'
import { TagService } from '@/services/tags'
import { handleApiError, AppError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/conversations/[id]/tags';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, { id, body });

    const { tags, newTagMeta } = body

    if (!Array.isArray(tags)) {
      throw new AppError('Tags deve ser um array', 400, 'VALIDATION_ERROR');
    }

    // Se houver metadados de uma nova tag, criamos ela primeiro no banco
    if (newTagMeta) {
      const { TagRepository } = await import('@/repositories/tagRepository')
      await TagRepository.findOrCreate(newTagMeta.name, newTagMeta.color, newTagMeta.emoji)
    }

    await TagService.syncConversationTags(id, tags)
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
