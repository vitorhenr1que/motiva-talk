import { NextResponse } from 'next/server';
import { ChannelConnectionService } from '@/services/channels/channel-connection.service';
import { handleApiError, validateBody } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/channels/[id]/webhook';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, message: 'ID obrigatório' }, { status: 400 });

    const config = await ChannelConnectionService.getWebhookConfig(id);
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ success: false, message: 'ID obrigatório' }, { status: 400 });

    const body = await req.json();
    console.log(`[API_WEBHOOK_DEBUG] POST Payload:`, body);

    // Permitimos atualizar apenas os campos de switch
    const payload = {
      url: body.url || process.env.EVOLUTION_WEBHOOK_URL!,
      enabled: body.enabled ?? true,
      webhookByEvents: body.webhookByEvents ?? true,
      webhookByStatus: body.webhookByStatus ?? false,
      webhookBase64: body.webhookBase64 ?? true,
      events: body.events || ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT']
    };
    
    console.log(`[API_WEBHOOK_DEBUG] Processed Payload:`, payload);

    const result = await ChannelConnectionService.setWebhookConfig(id, payload);
    console.log(`[API_WEBHOOK_DEBUG] API Response:`, result);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
