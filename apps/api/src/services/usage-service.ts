import { prisma } from '../db/prisma.js';

function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function getDailyUsage(userId: string, dateKey = todayKey()) {
  return prisma.usageDaily.findUnique({
    where: {
      userId_usageDate: {
        userId,
        usageDate: dateKey
      }
    }
  });
}

export async function incrementUsage(
  userId: string,
  delta: { qaQueries?: number; apiRequests?: number },
  dateKey = todayKey()
) {
  return prisma.usageDaily.upsert({
    where: {
      userId_usageDate: {
        userId,
        usageDate: dateKey
      }
    },
    create: {
      userId,
      usageDate: dateKey,
      qaQueries: delta.qaQueries ?? 0,
      apiRequests: delta.apiRequests ?? 0
    },
    update: {
      qaQueries: {
        increment: delta.qaQueries ?? 0
      },
      apiRequests: {
        increment: delta.apiRequests ?? 0
      }
    }
  });
}

export function getTodayKey() {
  return todayKey();
}
