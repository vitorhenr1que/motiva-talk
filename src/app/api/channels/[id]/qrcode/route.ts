import { NextResponse } from 'next/server';
import { ChannelConnectionService } from '@/services/channels/channel-connection.service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[API] GET /qrcode para ID: ${id}`);

    if (!id) {
      return NextResponse.json({ error: 'ID do canal é obrigatório' }, { status: 400 });
    }

    const qrcode = await ChannelConnectionService.getChannelQrCode(id);

    return NextResponse.json({
      success: true,
      qrcode: qrcode.base64,
      code: qrcode.code
    });
  } catch (error: any) {
    console.error('API Error (Get QR Code):', error);
    return NextResponse.json({ 
      error: error.message || 'Erro ao obter QR Code' 
    }, { status: 500 });
  }
}
