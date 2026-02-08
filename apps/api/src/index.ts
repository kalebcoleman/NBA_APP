import { bootstrapSqlite } from './db/sqlite.js';
import { env } from './config/env.js';
import { buildServer } from './server.js';

async function main() {
  bootstrapSqlite();

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
