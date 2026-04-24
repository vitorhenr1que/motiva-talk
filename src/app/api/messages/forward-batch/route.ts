import { NextResponse } from 'next/server';
import { ForwardService } from '@/services/forward.service';
import { handleApiError, validateBody, AppError } from '@/lib/api-errors';
import { getServerSession } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/messages/forward-batch';

export async function POST(req: Request) {
  try {
    const user = await getServerSession();
    if (!user) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');

    const body = await req.json();
    console.log(`[API] ${req.method} ${ROUTE}:`, {
      messageIds: body?.messageIds?.length,
      targetContactIds: body?.targetContactIds?.length,
      channelId: body?.channelId || body?.instanceId,
    });

    validateBody(body, ['messageIds', 'targetContactIds']);

    const channelId = body.channelId || body.instanceId;
    if (!channelId) {
      throw new AppError('channelId é obrigatório', 400, 'VALIDATION_ERROR');
    }

    const result = await ForwardService.forwardBatch({
      messageIds: body.messageIds,
      targetContactIds: body.targetContactIds,
      channelId,
    });

    return NextResponse.json({ success: true, data: result }, { status: 202 });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
