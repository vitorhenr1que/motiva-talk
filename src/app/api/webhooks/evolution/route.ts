import { NextResponse } from 'next/server';
import { evolutionProvider } from '@/services/whatsapp/evolution-provider';
import { WebhookService } from '@/services/whatsapp/webhook.service';
import { handleApiError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/webhooks/evolution';

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  try {
    const body = await req.json();
    console.log(`\n\n[${timestamp}] ================== WEBHOOK RECEIVED ==================`);
    console.log(`[WEBHOOK] Event: ${body.event}`);
    console.log(`[WEBHOOK] Instance: ${body.instance}`);
    console.log(`[WEBHOOK] Full Payload:`, JSON.stringify(body, null, 2));
    console.log(`==========================================================\n\n`);

    // 2. Parse using provider mapping
    const event = await evolutionProvider.parseIncomingWebhook(body);
    
    if (!event) {
      console.warn(`[WEBHOOK] Evento ignorado ou parser retornou nulo para: ${body.event}`);
      return NextResponse.json({ success: true, message: 'Evento ignorado' });
    }

    // 3. Delegate to business logic service
    await WebhookService.processEvent(event);

    return NextResponse.json({ success: true, message: 'Webhook processado com sucesso' });
  } catch (error) {
    // Custom handling for webhooks: we might want to return 200 but keep the error body for logs
    return handleApiError(error, req, { route: ROUTE });
  }
}
