import { NextResponse } from 'next/server';
import { ChannelConnectionService } from '@/services/channels/channel-connection.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[API] GET /status para ID: ${id}`);

    if (!id) {
      return NextResponse.json({ error: 'ID do canal é obrigatório' }, { status: 400 });
    }

    const sessionStatus = await ChannelConnectionService.getChannelStatus(id);

    return NextResponse.json({
      success: true,
      status: sessionStatus.status
    });
  } catch (error: any) {
    console.error('API Error (Get Channel Status):', error);
    return NextResponse.json({ 
      error: error.message || 'Erro ao obter status do canal' 
    }, { status: 500 });
  }
}
