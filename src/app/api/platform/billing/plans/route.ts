import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api-errors';
import { requirePlatformAdmin } from '@/lib/platform-admin';
import { BillingService } from '@/services/billing.service';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/platform/billing/plans';

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin();
    const plans = await BillingService.listPlans();
    return NextResponse.json({ success: true, data: plans });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
