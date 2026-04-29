import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth-server';
import { LimitsService } from '@/services/limits.service';
import { handleApiError, AppError } from '@/lib/api-errors';
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/organizations/usage';

export async function GET(req: Request) {
  try {
    const userSession = await getServerSession();
    if (!userSession) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');

    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) throw organizationNotFoundError();

    const usage = await LimitsService.getOrganizationUsage(organizationId);

    return NextResponse.json({ success: true, data: usage });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
