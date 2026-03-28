import { NextResponse } from 'next/server'
import { MessageService } from '@/services/messages'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversationId')
    
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId é obrigatório' }, { status: 400 })
    }

    const messages = await MessageService.listByConversation(conversationId)
    return NextResponse.json(messages)
  } catch (error) {
    console.error('API Error (Messages GET):', error)
    return NextResponse.json({ error: 'Erro ao buscar mensagens' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { conversationId, channelId, senderType, content, type } = body

    if (!conversationId || !channelId || !senderType || !content) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    const message = await MessageService.createMessage({
      conversationId,
      channelId,
      senderType,
      content,
      type
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('API Error (Messages POST):', error)
    return NextResponse.json({ error: 'Erro ao enviar mensagem' }, { status: 500 })
  }
}
