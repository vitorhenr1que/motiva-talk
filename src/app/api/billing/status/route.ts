import { NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api-errors';
import { requireOrganization } from '@/lib/tenant';
import { BillingRepository } from '@/repositories/billingRepository';
import { BillingService } from '@/services/billing.service';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/billing/status';

export async function GET(req: Request) {
  try {
    const organizationId = await requireOrganization();
    const [plan, limits, usage, subscription, plans] = await Promise.all([
      BillingService.getCurrentPlan(organizationId),
      BillingService.getPlanLimits(organizationId),
      BillingService.getMonthlyUsage(organizationId),
      BillingRepository.findActiveSubscription(organizationId),
      BillingService.listPlans(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        plan,
        limits,
        usage,
        subscription,
        plans,
      },
    });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
