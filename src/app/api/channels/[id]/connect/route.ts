import { NextResponse } from 'next/server';
import { ChannelConnectionService } from '@/services/channels/channel-connection.service';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[API] POST /connect para ID: ${id}`);
    
    if (!id) {
      return NextResponse.json({ error: 'ID do canal é obrigatório' }, { status: 400 });
    }

    const updatedChannel = await ChannelConnectionService.connectChannel(id);
    
    return NextResponse.json({
      success: true,
      channel: updatedChannel
    });
  } catch (error: any) {
    console.error('API Error (Connect Channel):', error);
    return NextResponse.json({ 
      error: error.message || 'Erro ao conectar canal' 
    }, { status: 500 });
  }
}
