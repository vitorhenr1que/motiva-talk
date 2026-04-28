import { NextResponse } from 'next/server';
import { ConversationService } from '@/services/conversations';
import { handleApiError, validateBody, AppError } from '@/lib/api-errors';
import { getServerSession } from '@/lib/auth-server';
import { UserRepository } from '@/repositories/userRepository';
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) throw organizationNotFoundError();

    const body = await req.json();
    validateBody(body, ['conversationId', 'targetSectorId']);

    const { conversationId, targetSectorId, targetAgentId, note } = body;

    const dbUser = await UserRepository.findMany(organizationId, { email: session.email! }).then(users => users?.[0]);

    const result = await ConversationService.transferToSector({
      conversationId,
      targetSectorId,
      targetAgentId,
      note,
      transferredById: dbUser?.id || null,
      organizationId
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error, req, { route: '/api/conversations/transfer-sector' });
  }
}
