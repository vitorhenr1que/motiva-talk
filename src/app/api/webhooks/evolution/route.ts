import { NextResponse } from 'next/server';
import { evolutionProvider } from '@/services/whatsapp/evolution-provider';
import { WebhookService } from '@/services/whatsapp/webhook.service';
import { handleApiError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/webhooks/evolution';

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  try {
    // 1. Get raw text to avoid any body parsing issues
    const rawBody = await req.text();
    console.log(`\n[${timestamp}] [WEBHOOK_TRACE] RAW BODY RECEIVED:`, rawBody.substring(0, 500) + (rawBody.length > 500 ? '...' : ''));
    
    // 2. Parse manually
    const body = JSON.parse(rawBody);
    console.log(`[WEBHOOK_TRACE] Event Type: ${body.event}`);
    console.log(`[WEBHOOK_TRACE] Instance: ${body.instance}`);
    console.log(`[WEBHOOK_TRACE] Full Payload:`, JSON.stringify(body, null, 2));

    // 3. Parse using provider mapping
    const event = await evolutionProvider.parseIncomingWebhook(body);
    
    if (!event) {
      console.warn(`[WEBHOOK_TRACE] Evento ignorado ou parser retornou nulo para: ${body.event}`);
      return NextResponse.json({ success: true, message: 'Evento ignorado' });
    }

    console.log(`[WEBHOOK_TRACE] Standardized Event:`, JSON.stringify(event, null, 2));

    // 4. Delegate to business logic service (with timing)
    console.log(`[WEBHOOK_TRACE] Starting WebhookService.processEvent...`);
    const start = Date.now();
    await WebhookService.processEvent(event);
    const duration = Date.now() - start;
    console.log(`[WEBHOOK_TRACE] Finished WebhookService.processEvent in ${duration}ms`);

    return NextResponse.json({ success: true, message: 'Webhook processado com sucesso' });
  } catch (error) {
    console.error(`[WEBHOOK_TRACE] CRITICAL ERROR IN ROUTE:`, error);
    return handleApiError(error, req, { route: ROUTE });
  }
}
