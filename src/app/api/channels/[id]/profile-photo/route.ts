import { NextResponse } from 'next/server';
import { AppError, handleApiError } from '@/lib/api-errors';
import { requireAdminOrOwner } from '@/lib/tenant';
import { MAX_PROFILE_PHOTO_BYTES } from '@/lib/whatsapp-profile-photo';
import { ChannelRepository } from '@/repositories/channelRepository';
import { metaCloudProvider } from '@/services/whatsapp/providers/meta-cloud-provider';

export const dynamic = 'force-dynamic';
const ROUTE = '/api/channels/[id]/profile-photo';
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
    const profilePictureUrl = await metaCloudProvider.getProfilePhoto(channel);
    return NextResponse.json({ success: true, data: { profilePictureUrl } });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}

export async function POST(req: Request, context: Context) {
  try {
    const channel = await getChannel(context);
    const length = Number(req.headers.get('content-length'));
    if (length > MAX_PROFILE_PHOTO_BYTES + 64 * 1024) {
      throw new AppError('A imagem deve ter no máximo 4 MB.', 413, 'VALIDATION_ERROR');
    }
    if (!req.headers.get('content-type')?.startsWith('multipart/form-data')) {
      throw new AppError('Envie a imagem como multipart/form-data.', 400, 'VALIDATION_ERROR');
    }
    const form = await req.formData().catch(() => {
      throw new AppError('Não foi possível ler a imagem enviada.', 400, 'VALIDATION_ERROR');
    });
    const file = form.get('file');
    if (!(file instanceof File)) throw new AppError('Selecione uma imagem.', 400, 'VALIDATION_ERROR');
    await metaCloudProvider.updateProfilePhoto(channel, file);
    return NextResponse.json({ success: true, message: 'Foto de perfil atualizada no WhatsApp.' });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
