import { NextResponse } from 'next/server';
import { AppError, handleApiError } from '@/lib/api-errors';
import { requireAdminOrOwner } from '@/lib/tenant';
import { ChannelRepository } from '@/repositories/channelRepository';
import { metaCloudProvider } from '@/services/whatsapp/providers/meta-cloud-provider';

export const dynamic = 'force-dynamic';
const ROUTE = '/api/channels/[id]/display-name';
type Context = { params: Promise<{ id: string }> };

async function getChannel(context: Context) {
  const user = await requireAdminOrOwner();
  const { id } = await context.params;
  const channel = await ChannelRepository.findById(id, user.organizationId);
  if (!channel) throw new AppError('Canal não encontrado.', 404, 'NOT_FOUND');
  if (channel.whatsappProvider !== 'META_CLOUD' || !channel.metaPhoneNumberId) {
    throw new AppError('Configure a conexão Meta API deste canal primeiro.', 400, 'VALIDATION_ERROR');
  }
  return channel;
}

export async function GET(req: Request, context: Context) {
  try {
    const channel = await getChannel(context);
    return NextResponse.json({ success: true, data: await metaCloudProvider.getDisplayName(channel) });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}

export async function POST(req: Request, context: Context) {
  try {
    const channel = await getChannel(context);
    const body: unknown = await req.json().catch(() => {
      throw new AppError('Envie um JSON válido com o novo nome.', 400, 'VALIDATION_ERROR');
    });
    if (!body || typeof body !== 'object' || !('displayName' in body)) {
      throw new AppError('Informe o novo nome de exibição.', 400, 'VALIDATION_ERROR');
    }
    await metaCloudProvider.requestDisplayNameChange(channel, body.displayName);
    return NextResponse.json({ success: true, message: 'Solicitação enviada à Meta. A aprovação e a ativação do nome podem levar algum tempo.' });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
