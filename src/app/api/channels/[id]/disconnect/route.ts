import { NextResponse } from 'next/server';
import { ChannelConnectionService } from '@/services/channels/channel-connection.service';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[API] POST /disconnect para ID: ${id}`);

    if (!id) {
      return NextResponse.json({ error: 'ID do canal é obrigatório' }, { status: 400 });
    }

    await ChannelConnectionService.disconnectChannel(id);

    return NextResponse.json({
      success: true,
      message: 'Canal desconectado com sucesso'
    });
  } catch (error: any) {
    console.error('API Error (Disconnect Channel):', error);
    return NextResponse.json({ 
      error: error.message || 'Erro ao desconectar canal' 
    }, { status: 500 });
  }
}
