import { NextRequest, NextResponse } from "next/server";
import { ChannelRepository } from "@/repositories/channelRepository";
import { requireAdminOrOwner } from '@/lib/tenant';
import { AppError, handleApiError, validateBody } from '@/lib/api-errors';
import { generateId } from '@/lib/utils';

const ROUTE = '/api/channels/[id]/connect-meta';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdminOrOwner();
    const organizationId = user.organizationId;

    const body = await req.json();
    validateBody(body, ['phoneNumberId', 'wabaId']);
    
    const { id } = await params;
    const phoneNumberId = String(body.phoneNumberId || '').trim();
    const wabaId = String(body.wabaId || '').trim();
    const accessToken = process.env.META_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      throw new AppError('Configure META_ACCESS_TOKEN no servidor antes de conectar o canal.', 400, 'VALIDATION_ERROR');
    }

    // Validate if the channel belongs to the organization
    const channel = await ChannelRepository.findById(id, organizationId);
    if (!channel) {
      return NextResponse.json({ success: false, error: 'Channel not found' }, { status: 404 });
    }

    const graphVersion = process.env.META_GRAPH_API_VERSION || 'v26.0';
    const validationResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/${phoneNumberId}?fields=id,display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
    );
    const validationData = await validationResponse.json();
    if (!validationResponse.ok || validationData?.id !== phoneNumberId) {
      throw new AppError(
        validationData?.error?.message || 'Phone Number ID não pôde ser validado pela Meta.',
        400,
        'VALIDATION_ERROR'
      );
    }

    const validatedPhone = String(validationData.display_phone_number || '').replace(/\D/g, '');
    if (!validatedPhone || validatedPhone !== String(channel.phoneNumber).replace(/\D/g, '')) {
      throw new AppError(
        'O Phone Number ID informado pertence a um número diferente deste canal.',
        400,
        'VALIDATION_ERROR'
      );
    }

    const metaWebhookVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN
      || channel.metaWebhookVerifyToken
      || `motiva_${generateId()}`;

    const updatedChannel = await ChannelRepository.update(id, organizationId, {
      metaPhoneNumberId: phoneNumberId,
      metaWabaId: wabaId,
      metaAccessToken: null,
      metaWebhookVerifyToken,
      whatsappProvider: 'META_CLOUD',
      provider: 'META_CLOUD',
      providerSessionId: null,
      phoneNumber: validatedPhone,
      connectionStatus: 'CONNECTED'
    });

    const safeChannel = { ...updatedChannel };
    delete safeChannel.metaAccessToken;

    return NextResponse.json({ success: true, data: safeChannel });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
