import Stripe from 'stripe';

import { AppError } from '@/lib/api-errors';

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error('STRIPE_SECRET_KEY não configurada');

  if (!stripeClient) {
    stripeClient = new Stripe(apiKey);
  }

  return stripeClient;
}

export function getStripePriceIdForPlan(planCode: string, storedPriceId?: string | null) {
  if (storedPriceId) return storedPriceId;

  const envName = `STRIPE_${planCode.toUpperCase()}_PRICE_ID`;
  return process.env[envName] || null;
}

export async function assertStripePriceExists(stripe: Stripe, priceId: string, planCode: string) {
  try {
    const price = await stripe.prices.retrieve(priceId);

    if (!price.active) {
      throw new AppError(
        `Preço Stripe inativo para o plano ${planCode}. Atualize o Price ID nas configurações de billing para um preço ativo.`,
        400,
        'VALIDATION_ERROR',
        { priceId, planCode }
      );
    }

    return price;
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === 'resource_missing') {
      throw new AppError(
        `Preço Stripe inválido para o plano ${planCode}. Atualize o Price ID nas configurações de billing ou use uma chave Stripe do mesmo ambiente.`,
        400,
        'VALIDATION_ERROR',
        { priceId, planCode }
      );
    }

    throw error;
  }
}
