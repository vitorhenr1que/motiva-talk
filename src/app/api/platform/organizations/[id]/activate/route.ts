import { NextResponse } from 'next/server';
import { handleApiError, AppError } from '@/lib/api-errors';
import { requirePlatformAdmin } from '@/lib/platform-admin';
import { organizationRepository } from '@/repositories/organizationRepository';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/platform/organizations/[id]/activate';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin();
    const { id } = await ctx.params;

    const org = await organizationRepository.findById(id);
    if (!org) throw new AppError('Organização não encontrada', 404, 'NOT_FOUND');

    const updated = await organizationRepository.update(id, {
      status: 'ACTIVE',
      blockedReason: null,
    });

    console.log(`[PLATFORM] ACTIVATE org=${id} by=${admin.email}`);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
