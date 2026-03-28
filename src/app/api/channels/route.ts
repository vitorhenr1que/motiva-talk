import { NextResponse } from 'next/server'
import { ChannelService } from '@/services/channels'

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const channels = await ChannelService.listActive()
    return NextResponse.json(channels)
  } catch (error) {
    console.error('API Error (Channels GET):', error)
    return NextResponse.json({ error: 'Erro ao buscar canais' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.name || !body.phoneNumber) {
      return NextResponse.json({ error: 'Nome e telefone são obrigatórios' }, { status: 400 })
    }

    const channel = await ChannelService.registerChannel(body)
    return NextResponse.json(channel, { status: 201 })
  } catch (error) {
    console.error('API Error (Channels POST):', error)
    return NextResponse.json({ error: 'Erro ao criar canal' }, { status: 500 })
  }
}
