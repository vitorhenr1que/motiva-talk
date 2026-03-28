import { NextResponse } from 'next/server'
import { TagService } from '@/services/tags'

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tags = await TagService.getAll()
    return NextResponse.json(tags)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar etiquetas' }, { status: 500 })
  }
}
