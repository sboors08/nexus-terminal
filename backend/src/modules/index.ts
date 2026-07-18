import type { FastifyPluginAsync } from 'fastify';
import { apiContractRoutes } from './api-contract/api-contract.routes.js';
import { healthRoutes } from './health/health.routes.js';
import type { MarketDataProvider } from './market-data/market-data.provider.js';
import { realtimeMarketDataRoutes } from './realtime-market-data/realtime-market-data.routes.js';
import type { RealtimeMarketDataService } from './realtime-market-data/realtime-market-data.types.js';

interface ApiModulesOptions {
  marketDataProvider: MarketDataProvider;
  realtimeMarketDataService?: RealtimeMarketDataService;
}

export const apiModules: FastifyPluginAsync<ApiModulesOptions> = async (app, options) => {
  await app.register(healthRoutes);
  await app.register(apiContractRoutes, { marketDataProvider: options.marketDataProvider });

  if (options.realtimeMarketDataService) {
    await app.register(realtimeMarketDataRoutes, {
      realtimeMarketDataService: options.realtimeMarketDataService,
    });
  }
};
