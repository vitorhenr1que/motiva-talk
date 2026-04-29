import Stripe from 'stripe';

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
