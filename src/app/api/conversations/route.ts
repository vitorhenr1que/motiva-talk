import { NextResponse } from 'next/server'
import { ConversationService } from '@/services/conversations'
import { UserRepository } from '@/repositories/userRepository'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic';

import { getServerSession, getUserRole } from '@/lib/auth-server'

export async function GET(req: Request) {
  try {
    const user = await getServerSession()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    
    const role = await getUserRole(user.email!)
    const { searchParams } = new URL(req.url)
    const channelId = searchParams.get('channelId') || undefined
    const status = (searchParams.get('status') as string) || undefined
    const tagId = searchParams.get('tagId') || undefined

    const dbUser = await UserRepository.findMany({ email: user.email! }).then(users => users?.[0])

    let where: any = {
      channelId: channelId || undefined,
      status: status || undefined,
    }

    // Lógica de Filtro por Role (Segurança)
    if (role !== 'ADMIN' && role !== 'SUPERVISOR') {
      // AGENT: Restrição de Canais e Atribuição
      const { data: userChannels } = await supabaseAdmin
        .from('UserChannel')
        .select('channelId')
        .eq('userId', dbUser?.id)
      
      const allowedChannelIds = userChannels?.map(uc => uc.channelId) || []

      // In the new repository we might need to handle this more explicitly 
      // but for now we'll pass the constraints
      where.assignedTo = dbUser?.id
      // (Advanced filtering like OR would need custom implementation in repository)
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
