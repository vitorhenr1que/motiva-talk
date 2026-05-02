import { NextRequest, NextResponse } from "next/server";
import { metaCloudProvider } from "@/services/whatsapp/providers/meta-cloud-provider";
import { ChannelRepository } from "@/repositories/channelRepository";

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
    const body = await req.json();
    
    const entries = Array.isArray(body.entry) ? body.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];

      for (const change of changes) {
        const value = change?.value;
        if (change?.field === 'message_template_status_update' || value?.message_template_id || value?.message_template_name) {
          const { WhatsAppTemplateService } = await import("@/services/whatsapp-templates");
          await WhatsAppTemplateService.updateStatusFromWebhook(value);
          continue;
        }

        const phoneNumberId = value?.metadata?.phone_number_id;

        if (!phoneNumberId || !value?.messages?.length) continue;

        const channel = await ChannelRepository.findByMetaPhoneNumberId(phoneNumberId);
        if (!channel?.organizationId) {
          console.warn(`[META_WEBHOOK] Channel not found for phone_number_id: ${phoneNumberId}`);
          continue;
        }

        for (const message of value.messages) {
          const event = await metaCloudProvider.parseIncomingWebhook({
            ...body,
            entry: [{ ...entry, changes: [{ ...change, value: { ...value, messages: [message] } }] }]
          });

          event.channelId = channel.id;

          const { WebhookService } = await import("@/services/whatsapp/webhook.service");
          await WebhookService.processEvent(event, channel as any);
        }
      }
    }
    
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[META_WEBHOOK] Error processing webhook:', error);
    return NextResponse.json({ ok: true }); // Always return 200 to Meta
  }
}
