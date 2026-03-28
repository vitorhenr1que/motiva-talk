import { NextResponse } from 'next/server';
import { evolutionProvider } from '@/services/whatsapp/evolution-provider';
import { WebhookService } from '@/services/whatsapp/webhook.service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Log incoming payload (optional, good for debugging)
    // console.log('Evolution Webhook received:', JSON.stringify(body, null, 2));

    // 2. Parse using provider mapping
    const event = await evolutionProvider.parseIncomingWebhook(body);

    // 3. Delegate to business logic service
    await WebhookService.processEvent(event);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error (Evolution Webhook):', error);
    // Webhooks should ideally always return 200 or 201 to avoid API retries 
    // from the provider (Evolution) unless it's a critical error.
    return NextResponse.json({ success: false, error: 'Internal Error' }, { status: 200 });
  }
}
