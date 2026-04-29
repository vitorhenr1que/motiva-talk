import { NextResponse } from 'next/server';

import { AppError, handleApiError } from '@/lib/api-errors';
import { getStripeClient } from '@/lib/stripe';
import { requireAdminOrOwner } from '@/lib/tenant';
import { BillingRepository } from '@/repositories/billingRepository';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/billing/portal';

export async function POST(req: Request) {
  try {
    const user = await requireAdminOrOwner();
    const subscription = await BillingRepository.findActiveSubscription(user.organizationId!);

    if (!subscription?.stripeCustomerId) {
      throw new AppError('Nenhum cliente Stripe vinculado a esta organização', 404, 'NOT_FOUND');
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${baseUrl}/settings/plan`,
    });

    return NextResponse.json({ success: true, data: { url: session.url } });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
