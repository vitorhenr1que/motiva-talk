import { NextResponse } from 'next/server'
import { QuickReplyService } from '@/services/quick-replies'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId') || undefined

    const replies = await QuickReplyService.listAvailable(channelId)
    return NextResponse.json(replies)
  } catch (error) {
    console.error('API Error (Quick Replies GET):', error)
    return NextResponse.json({ error: 'Erro ao buscar respostas rápidas' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { title, content, category, channelId } = body

    if (!title || !content || !category) {
      return NextResponse.json({ error: 'Título, conteúdo e categoria são obrigatórios' }, { status: 400 })
    }

    const reply = await QuickReplyService.addReply({ title, content, category, channelId })
    return NextResponse.json(reply, { status: 201 })
  } catch (error) {
    console.error('API Error (Quick Replies POST):', error)
    return NextResponse.json({ error: 'Erro ao criar resposta rápida' }, { status: 500 })
  }
}
