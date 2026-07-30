import type {
  FastifyPluginAsync,
} from 'fastify';
import {
  apiContractRoutes,
} from './api-contract/api-contract.routes.js';
import {
  healthRoutes,
} from './health/health.routes.js';
import type {
  MarketDataProvider,
} from './market-data/market-data.provider.js';
import {
  binanceSymbolUniverseRoutes,
} from './realtime-market-data/binance-symbol-universe.routes.js';
import type {
  BinanceSymbolUniverseService,
} from './realtime-market-data/binance-symbol-universe.service.js';
import type {
  MarketWideHistoryWarmupService,
} from './realtime-market-data/market-wide-history-warmup.service.js';
import {
  marketWideRealtimeRoutes,
} from './realtime-market-data/market-wide-realtime.routes.js';
import type {
  MarketWideRealtimeService,
} from './realtime-market-data/market-wide-realtime.service.js';
import {
  realtimeMarketDataRoutes,
} from './realtime-market-data/realtime-market-data.routes.js';
import type {
  RealtimeMarketDataService,
} from './realtime-market-data/realtime-market-data.types.js';
import {
  orderBookDepthRoutes,
} from './realtime-market-data/order-book-depth.routes.js';
import type {
  OrderBookDepthRuntimeService,
} from './realtime-market-data/order-book-depth-runtime.types.js';
import {
  setupReadRoutes,
} from './setup-engine/setup-read.routes.js';
import {
  setupEventHistoryRoutes,
} from './setup-engine/setup-event-history.routes.js';
import {
  setupLifecycleSseRoutes,
} from './setup-engine/setup-lifecycle-sse.routes.js';
import {
  levelV2ShadowReadRoutes,
} from './setup-engine/level-v2/level-v2-shadow-read.routes.js';
import type {
  LevelV2ShadowRuntimeReader,
} from './setup-engine/level-v2/level-v2-shadow-runtime.types.js';
import type {
  SetupDetectionRuntimeEventSource,
  SetupDetectionRuntimeReader,
} from './setup-engine/setup-detection-runtime.types.js';
import type {
  SetupEventHistoryReader,
} from './setup-engine/setup-event-history.types.js';

interface ApiModulesOptions {
  marketDataProvider:
    MarketDataProvider;

  realtimeMarketDataService?:
    RealtimeMarketDataService;

  orderBookDepthService?:
    OrderBookDepthRuntimeService;

  binanceSymbolUniverseService?:
    BinanceSymbolUniverseService;

  marketWideRealtimeService?:
    MarketWideRealtimeService;

  marketWideHistoryWarmupService?:
    MarketWideHistoryWarmupService;

  setupDetectionRuntimeReader?:
    SetupDetectionRuntimeReader;

  setupDetectionRuntimeEventSource?:
    SetupDetectionRuntimeEventSource;

  levelV2ShadowRuntimeReader?:
    LevelV2ShadowRuntimeReader;

  setupEventHistoryReader?:
    SetupEventHistoryReader;
}

export const apiModules:
FastifyPluginAsync<
  ApiModulesOptions
> = async (
  app,
  options,
) => {
  await app.register(
    healthRoutes,
  );

  await app.register(
    apiContractRoutes,
    {
      marketDataProvider:
        options.marketDataProvider,
    },
  );

  await app.register(
    setupReadRoutes,
    {
      marketDataProvider:
        options.marketDataProvider,

      ...(
        options
          .setupDetectionRuntimeReader
          ? {
              setupDetectionRuntimeReader:
                options
                  .setupDetectionRuntimeReader,
            }
          : {}
      ),
    },
  );

  await app.register(
    levelV2ShadowReadRoutes,
    {
      ...(
        options
          .levelV2ShadowRuntimeReader
          ? {
              levelV2ShadowRuntimeReader:
                options
                  .levelV2ShadowRuntimeReader,
            }
          : {}
      ),
    },
  );

  await app.register(
    setupEventHistoryRoutes,
    {
      ...(
        options
          .setupEventHistoryReader
          ? {
              setupEventHistoryReader:
                options
                  .setupEventHistoryReader,
            }
          : {}
      ),
    },
  );

  await app.register(
    setupLifecycleSseRoutes,
    {
      ...(
        options
          .setupEventHistoryReader
          ? {
              setupEventHistoryReader:
                options
                  .setupEventHistoryReader,
            }
          : {}
      ),

      ...(
        options
          .setupDetectionRuntimeEventSource
          ? {
              setupDetectionRuntimeEventSource:
                options
                  .setupDetectionRuntimeEventSource,
            }
          : {}
      ),
    },
  );

  if (
    options
      .realtimeMarketDataService
  ) {
    await app.register(
      realtimeMarketDataRoutes,
      {
        realtimeMarketDataService:
          options
            .realtimeMarketDataService,
        ...(
          options
            .marketWideRealtimeService
            ? {
                marketWideRealtimeService:
                  options
                    .marketWideRealtimeService,
              }
            : {}
        ),
      },
    );
  }

  if (
    options
      .orderBookDepthService
  ) {
    await app.register(
      orderBookDepthRoutes,
      {
        orderBookDepthService:
          options
            .orderBookDepthService,
      },
    );
  }

  if (
    options
      .binanceSymbolUniverseService
  ) {
    await app.register(
      binanceSymbolUniverseRoutes,
      {
        binanceSymbolUniverseService:
          options
            .binanceSymbolUniverseService,
      },
    );
  }

  if (
    options
      .marketWideRealtimeService
  ) {
    await app.register(
      marketWideRealtimeRoutes,
      {
        marketWideRealtimeService:
          options
            .marketWideRealtimeService,
        ...(
          options
            .marketWideHistoryWarmupService
            ? {
                marketWideHistoryWarmupService:
                  options
                    .marketWideHistoryWarmupService,
              }
            : {}
        ),
      },
    );
  }
};
