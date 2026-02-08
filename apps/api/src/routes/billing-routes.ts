import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { getStripeClient } from '../billing/stripe-client.js';
import { handleStripeEvent, isStripeSignatureError } from '../billing/webhook-service.js';
import { getPriceIdForInterval, type BillingInterval } from '../config/billing-plans.js';
import { env } from '../config/env.js';

function normalizeInterval(value: string | undefined): BillingInterval {
  if (!value) {
    return 'monthly';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'annual' || normalized === 'yearly') {
    return 'annual';
  }

  return 'monthly';
}

function getRequestedInterval(body: { interval?: string; plan?: string }): BillingInterval {
  if (body.interval) {
    return normalizeInterval(body.interval);
  }

  if (body.plan) {
    return normalizeInterval(body.plan);
  }

  return 'monthly';
}

export async function billingRoutes(app: FastifyInstance) {
  const checkoutHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth.userId || !request.auth.isAuthenticated) {
      reply.code(401);
      return {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication is required for checkout.'
        }
      };
    }

    const body = (request.body ?? {}) as { interval?: string; plan?: string };
    const interval = getRequestedInterval(body);
    const priceId = getPriceIdForInterval(interval);

    const stripeUnavailable = !env.stripe.secretKey || !priceId;
    if (stripeUnavailable) {
      reply.code(503);
      return {
        error: {
          code: 'STRIPE_NOT_CONFIGURED',
          message: `Missing Stripe configuration for ${interval} plan checkout.`
        }
      };
    }

    let stripe;
    try {
      stripe = getStripeClient();
    } catch (error) {
      reply.code(503);
      return {
        error: {
          code: 'STRIPE_NOT_CONFIGURED',
          message: error instanceof Error ? error.message : 'Stripe is not configured.'
        }
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: env.stripe.successUrl,
      cancel_url: env.stripe.cancelUrl,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      client_reference_id: request.auth.userId,
      metadata: {
        userId: request.auth.userId,
        actorKey: request.auth.actorKey,
        priceId
      },
      subscription_data: {
        metadata: {
          userId: request.auth.userId,
          actorKey: request.auth.actorKey,
          priceId
        }
      }
    });

    if (!session.url) {
      reply.code(502);
      return {
        error: {
          code: 'CHECKOUT_URL_UNAVAILABLE',
          message: 'Stripe checkout session was created without a redirect URL.'
        }
      };
    }

    return {
      url: session.url
    };
  };

  app.post('/billing/create-checkout-session', checkoutHandler);
  app.post('/billing/checkout', checkoutHandler);

  app.post(
    '/billing/webhook',
    {
      config: {
        rawBody: true
      }
    },
    async (request, reply) => {
      if (!env.stripe.webhookSecret) {
        reply.code(503);
        return {
          error: {
            code: 'STRIPE_NOT_CONFIGURED',
            message: 'Missing STRIPE_WEBHOOK_SECRET'
          }
        };
      }

      let stripe;
      try {
        stripe = getStripeClient();
      } catch (error) {
        reply.code(503);
        return {
          error: {
            code: 'STRIPE_NOT_CONFIGURED',
            message: error instanceof Error ? error.message : 'Stripe is not configured.'
          }
        };
      }

      const signature = request.headers['stripe-signature'];
      if (typeof signature !== 'string') {
        reply.code(400);
        return {
          error: {
            code: 'INVALID_STRIPE_SIGNATURE',
            message: 'Missing stripe-signature header.'
          }
        };
      }

      try {
        const payload = request.rawBody;
        if (!payload) {
          throw new Error('Missing raw request body for webhook verification.');
        }

        const event = stripe.webhooks.constructEvent(payload, signature, env.stripe.webhookSecret);
        await handleStripeEvent(event);

        return {
          received: true,
          type: event.type
        };
      } catch (error) {
        if (isStripeSignatureError(error)) {
          reply.code(400);
          return {
            error: {
              code: 'INVALID_STRIPE_SIGNATURE',
              message: error instanceof Error ? error.message : 'Webhook signature verification failed.'
            }
          };
        }

        request.log.error({ err: error }, 'stripe_webhook_failed');
        reply.code(500);
        return {
          error: {
            code: 'STRIPE_WEBHOOK_FAILED',
            message: error instanceof Error ? error.message : 'Stripe webhook processing failed.'
          }
        };
      }
    }
  );
}
