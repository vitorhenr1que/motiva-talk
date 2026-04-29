import { NextResponse } from 'next/server';

import { AppError, handleApiError } from '@/lib/api-errors';
import { getStripeClient } from '@/lib/stripe';
import { BillingService } from '@/services/billing.service';
import type Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/webhooks/stripe';

export async function POST(req: Request) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new AppError('STRIPE_WEBHOOK_SECRET não configurado', 500, 'INTERNAL_ERROR');

    const signature = req.headers.get('stripe-signature');
    if (!signature) throw new AppError('Assinatura Stripe ausente', 400, 'VALIDATION_ERROR');

    const rawBody = await req.text();
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await BillingService.syncStripeSubscription(subscription, {
          organizationId: session.client_reference_id,
          planCode: typeof session.metadata?.planCode === 'string' ? session.metadata.planCode : null,
        });
      }
    }

    if (
      event.type === 'customer.subscription.created'
      || event.type === 'customer.subscription.updated'
      || event.type === 'customer.subscription.deleted'
    ) {
      await BillingService.syncStripeSubscription(event.data.object);
    }

    return NextResponse.json({ success: true, received: true });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
