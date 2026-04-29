import { NextResponse } from 'next/server';
import { handleApiError, AppError } from '@/lib/api-errors';
import { requirePlatformAdmin } from '@/lib/platform-admin';
import { organizationRepository } from '@/repositories/organizationRepository';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/platform/organizations/[id]/suspend';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin();
    const { id } = await ctx.params;

    const body = await req.json().catch(() => ({}));
    const blockedReason: string | null = typeof body?.blockedReason === 'string' ? body.blockedReason : null;

    const org = await organizationRepository.findById(id);
    if (!org) throw new AppError('Organização não encontrada', 404, 'NOT_FOUND');

    const updated = await organizationRepository.update(id, {
      status: 'SUSPENDED',
      blockedReason,
    });

    console.log(`[PLATFORM] SUSPEND org=${id} by=${admin.email} reason="${blockedReason || ''}"`);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
