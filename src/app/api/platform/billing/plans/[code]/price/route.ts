import { NextResponse } from 'next/server';

import { AppError, handleApiError } from '@/lib/api-errors';
import { requirePlatformAdmin } from '@/lib/platform-admin';
import { getStripeClient } from '@/lib/stripe';
import { BillingRepository, type PlanCode } from '@/repositories/billingRepository';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/platform/billing/plans/[code]/price';
const EDITABLE_PLAN_CODES: PlanCode[] = ['STARTER', 'PRO'];

export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const admin = await requirePlatformAdmin();
    const { code: rawCode } = await ctx.params;
    const code = rawCode.toUpperCase() as PlanCode;

    if (!EDITABLE_PLAN_CODES.includes(code)) {
      throw new AppError('Preço global editável apenas para STARTER e PRO', 400, 'VALIDATION_ERROR');
    }

    const body = await req.json();
    const priceCents = Number(body.priceCents);
    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      throw new AppError('priceCents deve ser inteiro maior que zero', 400, 'VALIDATION_ERROR');
    }

    const plan = await BillingRepository.findPlanByCode(code);
    const stripe = getStripeClient();

    let productId: string | undefined;
    if (plan.stripePriceId) {
      const currentPrice = await stripe.prices.retrieve(plan.stripePriceId);
      productId = typeof currentPrice.product === 'string' ? currentPrice.product : currentPrice.product.id;
    }

    if (!productId) {
      const product = await stripe.products.create({
        name: `Motiva Talk ${plan.name}`,
        description: `Plano ${plan.name} do Motiva Talk`,
      });
      productId = product.id;
    }

    const price = await stripe.prices.create({
      product: productId,
      unit_amount: priceCents,
      currency: plan.currency.toLowerCase(),
      recurring: { interval: 'month' },
    });

    const updated = await BillingRepository.updatePlanPrice(code, priceCents, price.id);

    console.log(`[PLATFORM] PRICE plan=${code} by=${admin.email} price=${priceCents} stripePrice=${price.id}`);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
