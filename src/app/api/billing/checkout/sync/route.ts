import { NextResponse } from 'next/server';

import { AppError, handleApiError } from '@/lib/api-errors';
import { getStripeClient } from '@/lib/stripe';
import { requireAdminOrOwner } from '@/lib/tenant';
import { BillingService } from '@/services/billing.service';

export const dynamic = 'force-dynamic';

const ROUTE = '/api/billing/checkout/sync';

export async function POST(req: Request) {
  try {
    const user = await requireAdminOrOwner();
    const body = await req.json();
    const sessionId = String(body.sessionId || '');

    if (!sessionId.startsWith('cs_')) {
      throw new AppError('Sessão de checkout inválida', 400, 'VALIDATION_ERROR');
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (session.client_reference_id !== user.organizationId) {
      throw new AppError('Sessão de checkout não pertence a esta organização', 403, 'FORBIDDEN');
    }

    if (session.mode !== 'subscription' || !session.subscription) {
      throw new AppError('Sessão de checkout não possui assinatura', 400, 'VALIDATION_ERROR');
    }

    const subscription = typeof session.subscription === 'string'
      ? await stripe.subscriptions.retrieve(session.subscription)
      : session.subscription;

    const synced = await BillingService.syncStripeSubscription(subscription, {
      organizationId: session.client_reference_id,
      planCode: typeof session.metadata?.planCode === 'string' ? session.metadata.planCode : null,
    });

    return NextResponse.json({ success: true, data: synced });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
