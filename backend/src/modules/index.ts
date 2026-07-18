import type { FastifyPluginAsync } from 'fastify';
import { healthRoutes } from './health/health.routes.js';

/**
 * Composition root for all HTTP modules.
 * Future modules are registered here without coupling them to server startup.
 */
export const apiModules: FastifyPluginAsync = async (app) => {
  await app.register(healthRoutes);
};
