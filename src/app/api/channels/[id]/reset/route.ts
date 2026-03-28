import { NextResponse } from 'next/server';
import { ChannelConnectionService } from '@/services/channels/channel-connection.service';
import { handleApiError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/channels/[id]/reset';

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
    console.log(`[API] ${req.method} ${ROUTE}:`, { id });
    
    if (!id) {
      return NextResponse.json({ success: false, message: 'ID do canal é obrigatório' }, { status: 400 });
    }

    const resetResult = await ChannelConnectionService.resetChannel(id);
    
    return NextResponse.json({
      success: true,
      message: 'Canal resetado com sucesso. Proceda com a geração do QR Code.',
      data: resetResult
    });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
