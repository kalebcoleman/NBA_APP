import { Prisma } from '@prisma/client';

import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { getUserEntitlement } from './entitlement-service.js';
import { getDailyUsage, incrementUsage } from './usage-service.js';
import { classifyQuestion } from '../qa/intents.js';
import { executeTemplate } from '../qa/templates.js';

export interface QaAskInput {
  question: string;
  userId: string;
  fallbackPlan: 'FREE' | 'PREMIUM';
}

export interface QaAskOutput {
  answer: string;
  table?: {
    columns: string[];
    rows: Array<Array<string | number | null>>;
  };
  chartSpec?: Record<string, unknown>;
  meta: {
    limited: boolean;
    usageRemaining: number;
    intent: string;
    queriesRemaining?: number;
  };
}

export async function askQuestion(input: QaAskInput): Promise<QaAskOutput> {
  const entitlement = await getUserEntitlement(input.userId, input.fallbackPlan);
  const usage = await getDailyUsage(input.userId);

  const used = usage?.qaQueries ?? 0;
  const remainingBefore = Math.max(entitlement.qaDailyLimit - used, 0);

  if (remainingBefore <= 0) {
    await prisma.queryHistory.create({
      data: {
        userId: input.userId,
        question: input.question,
        intent: 'LIMIT_REACHED',
        limited: true,
        responseSummary: 'Daily QA limit reached'
      }
    });

    return {
      answer: 'Daily Q&A limit reached for your plan. Upgrade to premium for higher limits.',
      meta: {
        limited: true,
        usageRemaining: 0,
        intent: 'LIMIT_REACHED',
        queriesRemaining: 0
      }
    };
  }

  const intent = classifyQuestion(input.question);
  const intentParams = intent.params as unknown as Prisma.InputJsonValue;

  const startedAt = Date.now();
  const result = executeTemplate(intent.type, intent.params, {
    rowLimit: entitlement.qaRowLimit
  });

  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs > env.qaQueryTimeoutMs) {
    await prisma.queryHistory.create({
      data: {
        userId: input.userId,
        question: input.question,
        intent: intent.type,
        parameters: intentParams,
        limited: false,
        responseSummary: `Timed out after ${elapsedMs}ms`
      }
    });

    return {
      answer: 'The query timed out. Please ask a narrower question.',
      meta: {
        limited: false,
        usageRemaining: remainingBefore - 1,
        intent: intent.type,
        queriesRemaining: Math.max(remainingBefore - 1, 0)
      }
    };
  }

  await incrementUsage(input.userId, { qaQueries: 1 });

  await prisma.queryHistory.create({
    data: {
      userId: input.userId,
      question: input.question,
      intent: intent.type,
      parameters: intentParams,
      limited: false,
      responseSummary: result.answer.slice(0, 240)
    }
  });

  return {
    answer: result.answer,
    table: result.table,
    chartSpec: result.chartSpec,
    meta: {
      limited: false,
      usageRemaining: Math.max(remainingBefore - 1, 0),
      intent: intent.type,
      queriesRemaining: Math.max(remainingBefore - 1, 0)
    }
  };
}
