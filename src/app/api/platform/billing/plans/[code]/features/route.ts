import { NextResponse } from 'next/server';

import { AppError, handleApiError } from '@/lib/api-errors';
import { requirePlatformAdmin } from '@/lib/platform-admin';
import { BillingRepository, type PlanCode } from '@/repositories/billingRepository';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/platform/billing/plans/[code]/features';
const EDITABLE_PLAN_CODES: PlanCode[] = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];

export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const admin = await requirePlatformAdmin();
    const { code: rawCode } = await ctx.params;
    const code = rawCode.toUpperCase() as PlanCode;

    if (!EDITABLE_PLAN_CODES.includes(code)) {
      throw new AppError('Plano inválido', 400, 'VALIDATION_ERROR');
    }

    const body = await req.json();
    if (!Array.isArray(body.features)) {
      throw new AppError('features deve ser uma lista', 400, 'VALIDATION_ERROR');
    }

    const features = body.features
      .map((feature: unknown) => String(feature || '').trim())
      .filter(Boolean);

    const updated = await BillingRepository.updatePlanFeatures(code, features);

    console.log(`[PLATFORM] FEATURES plan=${code} by=${admin.email} count=${features.length}`);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
