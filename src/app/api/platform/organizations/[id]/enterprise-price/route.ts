import { NextResponse } from 'next/server';

import { AppError, handleApiError } from '@/lib/api-errors';
import { requirePlatformAdmin } from '@/lib/platform-admin';
import { getStripeClient } from '@/lib/stripe';
import { BillingRepository } from '@/repositories/billingRepository';
import { organizationRepository } from '@/repositories/organizationRepository';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/platform/organizations/[id]/enterprise-price';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePlatformAdmin();
    const { id } = await ctx.params;
    const body = await req.json();
    const priceCents = Number(body.priceCents);

    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      throw new AppError('priceCents deve ser inteiro maior que zero', 400, 'VALIDATION_ERROR');
    }

    const org = await organizationRepository.findById(id);
    if (!org) throw new AppError('Organização não encontrada', 404, 'NOT_FOUND');

    const enterprisePlan = await BillingRepository.findPlanByCode('ENTERPRISE');
    const stripe = getStripeClient();

    let productId = org.enterpriseStripeProductId || undefined;
    if (!productId) {
      const product = await stripe.products.create({
        name: `Motiva Talk Enterprise - ${org.name}`,
        description: `Preço Enterprise personalizado para ${org.name}`,
        metadata: { organizationId: org.id },
      });
      productId = product.id;
    }

    const price = await stripe.prices.create({
      product: productId,
      unit_amount: priceCents,
      currency: enterprisePlan.currency.toLowerCase(),
      recurring: { interval: 'month' },
      metadata: { organizationId: org.id, planCode: 'ENTERPRISE' },
    });

    const subscription = await BillingRepository.findActiveSubscription(org.id);
    if (subscription?.stripeSubscriptionId) {
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
      const item = stripeSubscription.items.data[0];
      if (item) {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          items: [{ id: item.id, price: price.id }],
          proration_behavior: 'none',
          metadata: {
            ...(stripeSubscription.metadata || {}),
            organizationId: org.id,
            planCode: 'ENTERPRISE',
          },
        });
      }

      await BillingRepository.updateSubscription(subscription.id, {
        planId: enterprisePlan.id,
        stripePriceId: price.id,
      });
    }

    const updated = await organizationRepository.update(org.id, {
      plan: 'ENTERPRISE',
      maxChannels: enterprisePlan.maxChannels ?? null,
      maxUsers: enterprisePlan.maxUsers ?? null,
      maxMsgPerMonth: enterprisePlan.maxMessagesPerMonth ?? null,
      enterprisePriceCents: priceCents,
      enterpriseStripePriceId: price.id,
      enterpriseStripeProductId: productId,
    });

    console.log(`[PLATFORM] ENTERPRISE_PRICE org=${org.id} by=${admin.email} price=${priceCents} stripePrice=${price.id}`);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
