import crypto from 'node:crypto';

import { Plan } from '@prisma/client';

import { prisma } from '../db/prisma.js';

export interface AuthProfile {
  email?: string;
  name?: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function upsertUserFromActor(actorKey: string, profile?: AuthProfile) {
  const user = await prisma.user.upsert({
    where: { externalKey: actorKey },
    create: {
      externalKey: actorKey,
      email: profile?.email,
      name: profile?.name,
      plan: Plan.FREE
    },
    update: {
      email: profile?.email,
      name: profile?.name
    }
  });

  return user;
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function getUserByExternalKey(externalKey: string) {
  return prisma.user.findUnique({ where: { externalKey } });
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
}

export async function createUserWithPassword(email: string, passwordHash: string) {
  const normalizedEmail = normalizeEmail(email);
  const temporaryActorKey = `signup:${crypto.randomUUID()}`;

  return prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        externalKey: temporaryActorKey,
        email: normalizedEmail,
        passwordHash,
        plan: Plan.FREE
      }
    });

    const actorKey = `user:${created.id}`;
    const user = await tx.user.update({
      where: { id: created.id },
      data: {
        externalKey: actorKey
      }
    });

    return user;
  });
}
