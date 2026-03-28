import { NextResponse } from 'next/server';
import { evolutionProvider } from '@/services/whatsapp/evolution-provider';
import { WebhookService } from '@/services/whatsapp/webhook.service';
import { handleApiError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/webhooks/evolution';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log(`[API] ${req.method} ${ROUTE} payload:`, JSON.stringify(body, null, 2));

    // 2. Parse using provider mapping
    const event = await evolutionProvider.parseIncomingWebhook(body);

    // 3. Delegate to business logic service
    await WebhookService.processEvent(event);

    return NextResponse.json({ success: true, message: 'Webhook processado com sucesso' });
  } catch (error) {
    // Custom handling for webhooks: we might want to return 200 but keep the error body for logs
    return handleApiError(error, req, { route: ROUTE });
  }
}
