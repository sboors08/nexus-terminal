import type { FastifyPluginAsync } from 'fastify';
import { apiContractRoutes } from './api-contract/api-contract.routes.js';
import { healthRoutes } from './health/health.routes.js';
import type { MarketDataProvider } from './market-data/market-data.provider.js';

interface ApiModulesOptions { marketDataProvider: MarketDataProvider; }

export const apiModules: FastifyPluginAsync<ApiModulesOptions> = async (app, options) => {
  await app.register(healthRoutes);
  await app.register(apiContractRoutes, { marketDataProvider: options.marketDataProvider });
};
