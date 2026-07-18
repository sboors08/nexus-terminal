import { buildApp } from './app.js';
import { readEnv } from './config/env.js';

const env = readEnv();
const app = await buildApp({ env });

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, 'Graceful shutdown started');

  try {
    await app.close();
    process.exitCode = 0;
  } catch (error) {
    app.log.error({ error }, 'Graceful shutdown failed');
    process.exitCode = 1;
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: env.host, port: env.port });
  app.log.info({ host: env.host, port: env.port }, 'NEXUS backend started');
} catch (error) {
  app.log.fatal({ error }, 'NEXUS backend failed to start');
  process.exitCode = 1;
}
