import { NextResponse } from 'next/server';
import { ChannelConnectionService } from '@/services/channels/channel-connection.service';
import { handleApiError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/channels/[id]/status';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[API] ${req.method} ${ROUTE}:`, { id });

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID do canal é obrigatório' }, { status: 400 });
    }

    const sessionStatus = await ChannelConnectionService.getChannelStatus(id);

    return NextResponse.json({
      success: true,
      data: { status: sessionStatus.status }
    });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
