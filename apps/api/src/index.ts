// Fix for BigInt serialization in JSON responses
// eslint-disable-next-line
(BigInt.prototype as any).toJSON = function () {
  const int = Number.parseInt(this.toString());
  return Number.isNaN(int) ? this.toString() : int;
};

import { prisma } from './db/prisma.js';
import { env } from './config/env.js';
import { buildServer } from './server.js';

async function warmPostgresConnection(): Promise<void> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    throw error;

    // eslint-disable-next-line no-console
    console.error('PostgreSQL is unreachable on boot; continuing in degraded mode.', error);
  }
}

async function main() {
  await warmPostgresConnection();

  const app = await buildServer();

  await app.listen({
    host: '0.0.0.0',
    port: env.apiPort
  });

  app.log.info(`API listening on http://localhost:${env.apiPort}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
