import { NextResponse } from 'next/server';
import { evolutionProvider } from '@/services/whatsapp/evolution-provider';
import { WebhookService } from '@/services/whatsapp/webhook.service';
import { resolveTenantChannel } from '@/services/whatsapp/tenant-resolver';
import { handleApiError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/webhooks/evolution';

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  try {
    const rawBody = await req.text();
    console.log(`\n[${timestamp}] [WEBHOOK_TRACE] RAW BODY RECEIVED:`, rawBody.substring(0, 500) + (rawBody.length > 500 ? '...' : ''));

    const body = JSON.parse(rawBody);
    console.log(`[WEBHOOK_TRACE] Event Type: ${body.event}`);
    console.log(`[WEBHOOK_TRACE] Instance: ${body.instance}`);

    const event = await evolutionProvider.parseIncomingWebhook(body);
    if (!event) {
      console.warn(`[WEBHOOK_TRACE] Evento ignorado ou parser retornou nulo para: ${body.event}`);
      return NextResponse.json({ success: true, message: 'Evento ignorado' });
    }

    // Tenant binding: a fonte de verdade do tenant é SEMPRE o Channel resolvido
    // a partir do instanceName/providerSessionId. Nunca confiar em organizationId vindo do payload.
    const instanceIdentifier = event.channelId;
    if (!instanceIdentifier) {
      console.warn(`[WEBHOOK_TRACE] Payload sem instance/channelId. Ignorando.`);
      return NextResponse.json({ success: true, message: 'Evento sem instance' });
    }

    const tenantChannel = await resolveTenantChannel(instanceIdentifier);
    if (!tenantChannel) {
      console.warn(`[WEBHOOK_TRACE] Canal não encontrado para instance="${instanceIdentifier}". Evento descartado.`);
      return NextResponse.json(
        { success: false, message: 'Canal não encontrado para a instância informada' },
        { status: 404 }
      );
    }

    console.log(
      `[WEBHOOK_TRACE] Tenant resolvido: org=${tenantChannel.organizationId} channel=${tenantChannel.id} provider=${tenantChannel.provider || 'evolution'}`
    );

    const start = Date.now();
    await WebhookService.processEvent(event, tenantChannel);
    const duration = Date.now() - start;
    console.log(`[WEBHOOK_TRACE] Finished WebhookService.processEvent in ${duration}ms (org=${tenantChannel.organizationId})`);

    return NextResponse.json({ success: true, message: 'Webhook processado com sucesso' });
  } catch (error) {
    console.error(`[WEBHOOK_TRACE] CRITICAL ERROR IN ROUTE:`, error);
    return handleApiError(error, req, { route: ROUTE });
  }
}
