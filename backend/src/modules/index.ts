import type { FastifyPluginAsync } from 'fastify';
import { apiContractRoutes } from './api-contract/api-contract.routes.js';
import { healthRoutes } from './health/health.routes.js';
import type { MarketDataProvider } from './market-data/market-data.provider.js';
import { binanceSymbolUniverseRoutes } from './realtime-market-data/binance-symbol-universe.routes.js';
import type { BinanceSymbolUniverseService } from './realtime-market-data/binance-symbol-universe.service.js';
import { marketWideRealtimeRoutes } from './realtime-market-data/market-wide-realtime.routes.js';
import type { MarketWideRealtimeService } from './realtime-market-data/market-wide-realtime.service.js';
import { realtimeMarketDataRoutes } from './realtime-market-data/realtime-market-data.routes.js';
import type { RealtimeMarketDataService } from './realtime-market-data/realtime-market-data.types.js';

interface ApiModulesOptions {
  marketDataProvider: MarketDataProvider;
  realtimeMarketDataService?: RealtimeMarketDataService;
  binanceSymbolUniverseService?: BinanceSymbolUniverseService;
  marketWideRealtimeService?: MarketWideRealtimeService;
}

export const apiModules: FastifyPluginAsync<ApiModulesOptions> = async (app, options) => {
  await app.register(healthRoutes);
  await app.register(apiContractRoutes, { marketDataProvider: options.marketDataProvider });

  if (options.realtimeMarketDataService) {
    await app.register(realtimeMarketDataRoutes, {
      realtimeMarketDataService: options.realtimeMarketDataService,
    });
  }

  if (options.binanceSymbolUniverseService) {
    await app.register(
      binanceSymbolUniverseRoutes,
      {
        binanceSymbolUniverseService:
          options.binanceSymbolUniverseService,
      },
    );
  }

  if (options.marketWideRealtimeService) {
    await app.register(
      marketWideRealtimeRoutes,
      {
        marketWideRealtimeService:
          options.marketWideRealtimeService,
      },
    );
  }
};
