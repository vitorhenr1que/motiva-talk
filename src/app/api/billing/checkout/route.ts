import { NextResponse } from 'next/server';

import { AppError, handleApiError } from '@/lib/api-errors';
import { assertStripePriceExists, getStripeClient, getStripePriceIdForPlan } from '@/lib/stripe';
import { requireAdminOrOwner } from '@/lib/tenant';
import { BillingRepository, type PlanCode } from '@/repositories/billingRepository';
import { organizationRepository } from '@/repositories/organizationRepository';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/billing/checkout';
const ALLOWED_PLAN_CODES = ['STARTER', 'PRO', 'ENTERPRISE'] as const;

export async function POST(req: Request) {
  try {
    const user = await requireAdminOrOwner();
    const body = await req.json();
    const planCode = String(body.planCode || '').toUpperCase() as PlanCode;

    if (!(ALLOWED_PLAN_CODES as readonly string[]).includes(planCode)) {
      throw new AppError('Plano inválido para checkout', 400, 'VALIDATION_ERROR');
    }

    const plan = await BillingRepository.findPlanByCode(planCode);
    const org = await organizationRepository.findById(user.organizationId!);
    const priceId = planCode === 'ENTERPRISE'
      ? org?.enterpriseStripePriceId || getStripePriceIdForPlan(plan.code, plan.stripePriceId)
      : getStripePriceIdForPlan(plan.code, plan.stripePriceId);
    if (!priceId) {
      throw new AppError(`Preço Stripe não configurado para o plano ${plan.code}`, 400, 'VALIDATION_ERROR');
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const stripe = getStripeClient();
    await assertStripePriceExists(stripe, priceId, plan.code);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/settings/plan?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/settings/plan?checkout=cancel`,
      client_reference_id: user.organizationId!,
      metadata: {
        organizationId: user.organizationId!,
        planCode: plan.code,
      },
      subscription_data: {
        metadata: {
          organizationId: user.organizationId!,
          planCode: plan.code,
        },
      },
    });

    return NextResponse.json({ success: true, data: { url: session.url } });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
