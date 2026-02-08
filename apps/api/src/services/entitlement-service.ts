import { Plan } from '@prisma/client';

import { getPlanLimits } from '../config/plans.js';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';

export function resolvePlanFromSubscriptionStatus(status: string): Plan {
  const premiumStatuses = new Set(['active']);
  return premiumStatuses.has(status) ? Plan.PREMIUM : Plan.FREE;
}

export async function ensureEntitlement(userId: string, plan: Plan | 'FREE' | 'PREMIUM') {
  const limits = getPlanLimits(plan);

  return prisma.entitlement.upsert({
    where: { userId },
    create: {
      userId,
      plan,
      qaDailyLimit: limits.qaDailyLimit,
      qaRowLimit: limits.qaRowLimit
    },
    update: {
      plan,
      qaDailyLimit: limits.qaDailyLimit,
      qaRowLimit: limits.qaRowLimit
    }
  });
}

export async function setUserPlan(userId: string, plan: Plan | 'FREE' | 'PREMIUM') {
  await prisma.user.update({
    where: { id: userId },
    data: { plan }
  });

  return ensureEntitlement(userId, plan);
}

export async function getUserEntitlement(userId: string, fallbackPlan: Plan | 'FREE' | 'PREMIUM') {
  const existing = await prisma.entitlement.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }
  return ensureEntitlement(userId, fallbackPlan);
}

function planFromStatus(status: string): Plan {
  return resolvePlanFromSubscriptionStatus(status);
}

async function resolvePlanFromSubscriptions(userId: string): Promise<Plan> {
  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: {
        in: ['active']
      }
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });

  return activeSubscription ? planFromStatus(activeSubscription.status) : Plan.FREE;
}

export async function syncAuthenticatedUserPlan(userId: string) {
  const desiredPlan = env.devPremiumBypass ? Plan.PREMIUM : await resolvePlanFromSubscriptions(userId);
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return null;
  }

  if (user.plan !== desiredPlan) {
    await setUserPlan(userId, desiredPlan);
  }

  const entitlement = await getUserEntitlement(userId, desiredPlan);
  if (entitlement.plan !== desiredPlan) {
    return ensureEntitlement(userId, desiredPlan);
  }

  return entitlement;
}
