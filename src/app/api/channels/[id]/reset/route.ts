import { NextResponse } from 'next/server';
import { ChannelConnectionService } from '@/services/channels/channel-connection.service';

/**
 * Handle manual channel reset
 * Removes the old instance and creates a fresh one.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[API] POST /reset para ID: ${id}`);
    
    if (!id) {
      return NextResponse.json({ error: 'ID do canal é obrigatório' }, { status: 400 });
    }

    const resetResult = await ChannelConnectionService.resetChannel(id);
    
    return NextResponse.json({
      success: true,
      message: 'Canal resetado com sucesso. Proceda com a geração do QR Code.',
      channel: resetResult
    });
  } catch (error: any) {
    console.error('API Error (Reset Channel):', error);
    return NextResponse.json({ 
      error: error.message || 'Erro ao resetar canal' 
    }, { status: 500 });
  }
}
