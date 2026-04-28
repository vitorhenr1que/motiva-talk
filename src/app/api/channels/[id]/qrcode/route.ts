import { NextResponse } from 'next/server';
import { ChannelConnectionService } from '@/services/channels/channel-connection.service';
import { handleApiError } from '@/lib/api-errors';
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/channels/[id]/qrcode';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) throw organizationNotFoundError();
    console.log(`[API] ${req.method} ${ROUTE}:`, { id });

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID do canal é obrigatório' }, { status: 400 });
    }

    const qrcode = await ChannelConnectionService.getChannelQrCode(id, organizationId);

    return NextResponse.json({
      success: true,
      data: {
        qrcode: qrcode.base64,
        code: qrcode.code
      }
    });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
