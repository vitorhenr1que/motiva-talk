import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { metaCloudProvider } from "@/services/whatsapp/providers/meta-cloud-provider";
import { ChannelRepository } from "@/repositories/channelRepository";
import type { TenantChannel } from "@/services/whatsapp/tenant-resolver";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const verifyToken = searchParams.get('hub.verify_token');

  const channel = verifyToken
    ? await ChannelRepository.findByMetaWebhookVerifyToken(verifyToken)
    : null;
  const expectedToken = channel?.metaWebhookVerifyToken || process.env.META_WEBHOOK_VERIFY_TOKEN;
  const challenge = expectedToken
    ? metaCloudProvider.verifyWebhookChallenge(expectedToken, Object.fromEntries(searchParams))
    : null;

  if (challenge) {
    return new NextResponse(challenge);
  }

  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const appSecret = process.env.META_APP_SECRET;

    if (appSecret) {
      const receivedSignature = req.headers.get('x-hub-signature-256');
      const expectedSignature = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
      const receivedBuffer = Buffer.from(receivedSignature || '');
      const expectedBuffer = Buffer.from(expectedSignature);

      if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);
    
    const entries = Array.isArray(body.entry) ? body.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];

      for (const change of changes) {
        const value = change?.value;
        if (change?.field === 'account_update' && value?.event === 'PARTNER_REMOVED' && value?.phone_number) {
          const disconnectedChannel = await ChannelRepository.findByPhoneNumber(String(value.phone_number));
          if (disconnectedChannel?.organizationId) {
            await ChannelRepository.update(disconnectedChannel.id, disconnectedChannel.organizationId, {
              connectionStatus: 'DISCONNECTED',
              metaAccessToken: null,
            });
          }
          continue;
        }
        if (change?.field === 'history' || change?.field === 'smb_app_state_sync') {
          console.info(`[META_WEBHOOK] Coexistence sync received: ${change.field}`);
          continue;
        }
        if (change?.field === 'message_template_status_update' || value?.message_template_id || value?.message_template_name) {
          const { WhatsAppTemplateService } = await import("@/services/whatsapp-templates");
          await WhatsAppTemplateService.updateStatusFromWebhook(value);
          continue;
        }

        const phoneNumberId = value?.metadata?.phone_number_id;

        const messages = Array.isArray(value?.messages)
          ? value.messages
          : Array.isArray(value?.message_echoes)
            ? value.message_echoes
            : [];

        if (!phoneNumberId || !messages.length) continue;

        const channel = await ChannelRepository.findByMetaPhoneNumberId(phoneNumberId);
        if (!channel?.organizationId) {
          console.warn(`[META_WEBHOOK] Channel not found for phone_number_id: ${phoneNumberId}`);
          continue;
        }

        for (const message of messages) {
          const event = await metaCloudProvider.parseIncomingWebhook({
            ...body,
            entry: [{
              ...entry,
              changes: [{
                ...change,
                value: change?.field === 'smb_message_echoes'
                  ? { ...value, message_echoes: [message] }
                  : { ...value, messages: [message] }
              }]
            }]
          });

          event.channelId = channel.id;

          const { WebhookService } = await import("@/services/whatsapp/webhook.service");
          await WebhookService.processEvent(event, channel as TenantChannel);
        }
      }
    }
    
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('[META_WEBHOOK] Error processing webhook:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to Meta
  }
}
