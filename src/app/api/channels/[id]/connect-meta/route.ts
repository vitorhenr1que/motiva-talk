import { NextRequest, NextResponse } from "next/server";
import { ChannelRepository } from "@/repositories/channelRepository";
import { getServerSession } from '@/lib/auth-server';
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant';
import { handleApiError, validateBody } from '@/lib/api-errors';
import { generateId } from '@/lib/utils';

const ROUTE = '/api/channels/[id]/connect-meta';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!session?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) throw organizationNotFoundError();

    const body = await req.json();
    validateBody(body, ['phoneNumberId', 'wabaId', 'accessToken']);
    
    const { id } = await params;
    const phoneNumberId = String(body.phoneNumberId || '').trim();
    const wabaId = String(body.wabaId || '').trim();
    const accessToken = String(body.accessToken || '').trim();
    const metaWebhookVerifyToken = body.metaWebhookVerifyToken || `motiva_${generateId()}`;

    // Validate if the channel belongs to the organization
    const channel = await ChannelRepository.findById(id, organizationId);
    if (!channel) {
      return NextResponse.json({ success: false, error: 'Channel not found' }, { status: 404 });
    }

    const updatedChannel = await ChannelRepository.update(id, organizationId, {
      metaPhoneNumberId: phoneNumberId,
      metaWabaId: wabaId,
      metaAccessToken: accessToken,
      metaWebhookVerifyToken,
      whatsappProvider: 'META_CLOUD',
      connectionStatus: 'CONNECTED'
    });

    const safeChannel = { ...updatedChannel };
    delete safeChannel.metaAccessToken;

    return NextResponse.json({ success: true, data: safeChannel });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
