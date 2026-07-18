import type { FastifyPluginAsync } from 'fastify';

interface HealthResponse {
  status: 'ok';
  service: 'nexus-backend';
  version: string;
  timestamp: string;
  uptimeSec: number;
}

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: HealthResponse }>('/health', async () => ({
    status: 'ok',
    service: 'nexus-backend',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptimeSec: Math.floor(process.uptime()),
  }));

  app.get('/ready', async () => ({
    status: 'ready' as const,
    checks: {
      process: 'ok' as const,
    },
    timestamp: new Date().toISOString(),
  }));
};
