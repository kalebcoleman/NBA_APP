import Stripe from 'stripe';

import { env } from '../config/env.js';

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!env.stripe.secretKey) {
    throw new Error('Stripe is not configured: missing STRIPE_SECRET_KEY');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.stripe.secretKey);
  }

  return stripeClient;
}
