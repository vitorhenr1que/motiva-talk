import { NextResponse } from 'next/server';
import { ChannelConnectionService } from '@/services/channels/channel-connection.service';

export const dynamic = 'force-dynamic';

/**
 * Handle individual channel operations like DELETE
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'ID do canal é obrigatório' }, { status: 400 });
    }

    await ChannelConnectionService.deleteChannel(id);
    
    return NextResponse.json({
      success: true,
      message: 'Canal e instância removidos com sucesso'
    });
  } catch (error: any) {
    console.error('API Error (Delete Channel):', error);
    return NextResponse.json({ 
      error: error.message || 'Erro ao remover canal' 
    }, { status: 500 });
  }
}
