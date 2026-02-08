import { Plan } from '@prisma/client';
import Stripe from 'stripe';

import { prisma } from '../db/prisma.js';
import { resolvePlanFromSubscriptionStatus, setUserPlan } from '../services/entitlement-service.js';

export function derivePlanFromSubscriptionInputs(status: string, _priceId: string | null | undefined): Plan {
  const derivedByStatus = resolvePlanFromSubscriptionStatus(status);
  return derivedByStatus === Plan.PREMIUM ? Plan.PREMIUM : Plan.FREE;
}

async function findUserIdByStripeCustomer(customerId: string): Promise<string | null> {
  const existing = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    orderBy: { updatedAt: 'desc' }
  });

  return existing?.userId ?? null;
}

async function resolveUserForSubscriptionPayload(
  subscription: Stripe.Subscription
): Promise<string | null> {
  const metadataUserId = subscription.metadata?.userId;
  if (metadataUserId) {
    return metadataUserId;
  }

  const metadataActorKey = subscription.metadata?.actorKey;
  if (metadataActorKey) {
    const user = await prisma.user.findUnique({ where: { externalKey: metadataActorKey } });
    if (user) {
      return user.id;
    }
  }

  if (typeof subscription.customer === 'string') {
    return findUserIdByStripeCustomer(subscription.customer);
  }

  return null;
}

function toDate(epochSeconds: number | null | undefined): Date | null {
  if (!epochSeconds) {
    return null;
  }
  return new Date(epochSeconds * 1000);
}

export async function handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserForSubscriptionPayload(subscription);
  if (!userId) {
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const status = subscription.status;
  const finalPlan = derivePlanFromSubscriptionInputs(status, priceId);

  await prisma.subscription.upsert({
    where: {
      stripeSubscriptionId: subscription.id
    },
    create: {
      userId,
      stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : null,
      stripeSubscriptionId: subscription.id,
      status,
      plan: finalPlan,
      currentPeriodEnd: toDate(subscription.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    },
    update: {
      stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : null,
      status,
      plan: finalPlan,
      currentPeriodEnd: toDate(subscription.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    }
  });

  await setUserPlan(userId, finalPlan);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId ?? session.client_reference_id;
  if (!userId) {
    return;
  }

  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
  const customerId = typeof session.customer === 'string' ? session.customer : null;

  if (subscriptionId) {
    await prisma.subscription.upsert({
      where: { stripeSubscriptionId: subscriptionId },
      create: {
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        status: 'checkout_completed',
        plan: Plan.FREE
      },
      update: {
        stripeCustomerId: customerId,
        status: 'checkout_completed',
        plan: Plan.FREE
      }
    });
  } else if (customerId) {
    await prisma.subscription.create({
      data: {
        userId,
        stripeCustomerId: customerId,
        status: 'checkout_completed',
        plan: Plan.FREE
      }
    });
  }
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      return;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
      return;
    default:
      return;
  }
}

export function isStripeSignatureError(error: unknown): boolean {
  return error instanceof Error && error.name === 'StripeSignatureVerificationError';
}
