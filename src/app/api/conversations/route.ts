import { NextResponse } from 'next/server'
import { ConversationService } from '@/services/conversations'
import { ConversationStatus } from '@prisma/client'

export const dynamic = 'force-dynamic';

import { getServerSession, getUserRole } from '@/lib/auth-server'

export async function GET(req: Request) {
  try {
    const user = await getServerSession()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    
    const role = await getUserRole(user.email!)
    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId') || undefined
    const status = searchParams.get('status') as ConversationStatus || undefined
    const tagId = searchParams.get('tagId') || undefined

    const prisma = (await import('@/lib/prisma')).default
    const dbUser = await prisma.user.findUnique({ where: { email: user.email! } })

    let where: any = {
      channelId: channelId || undefined,
      status: status || undefined,
    }

    // Aplicar Filtro de Tag se presente
    if (tagId) {
      where.tags = { some: { tagId } }
    }

    // Lógica de Filtro por Role (Segurança)
    if (role !== 'ADMIN' && role !== 'SUPERVISOR') {
      // AGENT: Restrição de Canais e Atribuição
      const userChannels = await prisma.userChannel.findMany({
        where: { userId: dbUser?.id }
      })
      const allowedChannelIds = userChannels.map(uc => uc.channelId)

      where.OR = [
        { assignedTo: dbUser?.id },
        { 
          assignedTo: null, 
          channelId: channelId ? (allowedChannelIds.includes(channelId) ? channelId : 'INVALID') : { in: allowedChannelIds } 
        }
      ]
    }

    const conversations = await ConversationService.listByFilter(where)
    return NextResponse.json(conversations)
  } catch (error) {
    console.error('API Error (Conversations GET):', error)
    return NextResponse.json({ error: 'Erro ao listar conversas' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { contactId, channelId } = body

    if (!contactId || !channelId) {
      return NextResponse.json({ error: 'contactId e channelId são obrigatórios' }, { status: 400 })
    }

    const conversation = await ConversationService.startConversation(contactId, channelId)
    return NextResponse.json(conversation, { status: 201 })
  } catch (error) {
    console.error('API Error (Conversations POST):', error)
    return NextResponse.json({ error: 'Erro ao iniciar conversa' }, { status: 500 })
  }
}
