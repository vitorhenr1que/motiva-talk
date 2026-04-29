import { NextResponse } from 'next/server';

import { AppError, handleApiError } from '@/lib/api-errors';
import { requirePlatformAdmin } from '@/lib/platform-admin';
import { getStripeClient } from '@/lib/stripe';
import { BillingRepository, type PlanCode } from '@/repositories/billingRepository';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/platform/billing/plans/[code]/overage-price';
const EDITABLE_PLAN_CODES: PlanCode[] = ['STARTER', 'PRO'];

export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const admin = await requirePlatformAdmin();
    const { code: rawCode } = await ctx.params;
    const code = rawCode.toUpperCase() as PlanCode;

    if (!EDITABLE_PLAN_CODES.includes(code)) {
      throw new AppError('Excedente editável apenas para STARTER e PRO', 400, 'VALIDATION_ERROR');
    }

    const body = await req.json();
    const overagePriceCents = Number(body.overagePriceCents);
    if (!Number.isInteger(overagePriceCents) || overagePriceCents <= 0) {
      throw new AppError('overagePriceCents deve ser inteiro maior que zero', 400, 'VALIDATION_ERROR');
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

    let meterId = plan.stripeOverageMeterId || undefined;
    if (meterId) {
      try {
        await stripe.billing.meters.retrieve(meterId);
      } catch (error) {
        const errorCode = error && typeof error === 'object' && 'code' in error
          ? (error as { code?: string }).code
          : null;
        if (errorCode !== 'resource_missing') throw error;
        meterId = undefined;
      }
    }

    if (!meterId) {
      const meter = await stripe.billing.meters.create({
        display_name: `Motiva Talk ${plan.name} - conversas excedentes`,
        event_name: `motiva_talk_service_conversation_overage_${code.toLowerCase()}`,
        default_aggregation: { formula: 'sum' },
        customer_mapping: { type: 'by_id', event_payload_key: 'stripe_customer_id' },
        value_settings: { event_payload_key: 'value' },
      });
      meterId = meter.id;
    }

    const price = await stripe.prices.create({
      product: productId,
      unit_amount: overagePriceCents,
      currency: plan.currency.toLowerCase(),
      recurring: { interval: 'month', usage_type: 'metered', meter: meterId },
      nickname: `${plan.name} - conversa excedente`,
    });

    const updated = await BillingRepository.updatePlanOveragePrice(code, overagePriceCents, price.id, meterId);

    console.log(`[PLATFORM] OVERAGE_PRICE plan=${code} by=${admin.email} price=${overagePriceCents} stripePrice=${price.id} meter=${meterId}`);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
