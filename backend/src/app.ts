import cors from '@fastify/cors';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { readEnv, type AppEnv } from './config/env.js';
import { apiModules } from './modules/index.js';
import { BinanceMarketDataClient } from './modules/market-data/binance-market-data.client.js';
import type { MarketDataProvider } from './modules/market-data/market-data.provider.js';
import { BinanceWebSocketMarketDataService } from './modules/realtime-market-data/binance-websocket.service.js';
import { BinanceSymbolUniverseService } from './modules/realtime-market-data/binance-symbol-universe.service.js';
import { MarketWideRealtimeService } from './modules/realtime-market-data/market-wide-realtime.service.js';
import { MarketWideRuntimeCoordinator } from './modules/realtime-market-data/market-wide-runtime-coordinator.js';
import type { RealtimeMarketDataService } from './modules/realtime-market-data/realtime-market-data.types.js';

export interface BuildAppOptions {
  env?: AppEnv;
  marketDataProvider?: MarketDataProvider;
  realtimeMarketDataService?: RealtimeMarketDataService | null;
  binanceSymbolUniverseService?: BinanceSymbolUniverseService | null;
  marketWideRealtimeService?: MarketWideRealtimeService | null;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = options.env ?? readEnv();
  const marketDataProvider = options.marketDataProvider ?? new BinanceMarketDataClient({
    baseUrl: env.binanceBaseUrl ?? 'https://data-api.binance.vision',
    requestTimeoutMs: env.binanceRequestTimeoutMs ?? 5_000,
    symbolsLimit: env.binanceSymbolsLimit ?? 100,
    cacheTtlMs: env.binanceCacheTtlMs ?? 15_000,
  });
  const webSocketEnabled = env.binanceWebSocketEnabled ?? env.nodeEnv !== 'test';
  const realtimeMarketDataService = options.realtimeMarketDataService === undefined
    ? webSocketEnabled
      ? new BinanceWebSocketMarketDataService({
        baseUrl: env.binanceWebSocketBaseUrl ?? 'wss://data-stream.binance.vision',
        symbols: env.binanceWebSocketSymbols ?? ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
        reconnectBaseDelayMs: env.binanceWebSocketReconnectBaseDelayMs ?? 1_000,
        reconnectMaxDelayMs: env.binanceWebSocketReconnectMaxDelayMs ?? 30_000,
        tradesBufferSize: env.binanceWebSocketTradesBufferSize ?? 100,
      })
      : null
    : options.realtimeMarketDataService;

  const symbolUniverseEnabled =
    env.binanceSymbolUniverseEnabled
    ?? env.nodeEnv !== 'test';

  const binanceSymbolUniverseService =
    options.binanceSymbolUniverseService
    === undefined
      ? symbolUniverseEnabled
        ? new BinanceSymbolUniverseService({
            baseUrl:
              env.binanceBaseUrl
              ?? 'https://data-api.binance.vision',
            quoteAsset:
              env.binanceSymbolUniverseQuoteAsset
              ?? 'USDT',
            refreshIntervalMs:
              env.binanceSymbolUniverseRefreshIntervalMs
              ?? 60_000,
            requestTimeoutMs:
              env.binanceRequestTimeoutMs
              ?? 5_000,
            collectingDurationMs:
              env.binanceSymbolUniverseCollectingDurationMs
              ?? 15 * 60 * 1000,
          })
        : null
      : options.binanceSymbolUniverseService;

  const marketWideRealtimeEnabled =
    env.binanceMarketWideRealtimeEnabled
    ?? env.nodeEnv !== 'test';

  const marketWideRealtimeService =
    options.marketWideRealtimeService
    === undefined
      ? marketWideRealtimeEnabled
        ? new MarketWideRealtimeService({
            baseUrl:
              env.binanceMarketWideWebSocketBaseUrl
              ?? 'wss://stream.binance.com:9443',
            symbols: [],
            maxStreamsPerSocket:
              env.binanceMarketWideMaxStreamsPerSocket
              ?? 800,
            reconnectBaseDelayMs:
              env.binanceMarketWideReconnectBaseDelayMs
              ?? 1_000,
            reconnectMaxDelayMs:
              env.binanceMarketWideReconnectMaxDelayMs
              ?? 30_000,
          })
        : null
      : options.marketWideRealtimeService;

  const marketWideRuntimeCoordinator =
    binanceSymbolUniverseService
    && marketWideRealtimeService
      ? new MarketWideRuntimeCoordinator(
          binanceSymbolUniverseService,
          marketWideRealtimeService,
        )
      : null;

  const app = Fastify({
    logger: env.nodeEnv === 'test' ? false : { level: env.logLevel },
    trustProxy: true,
    requestIdHeader: 'x-request-id',
  });

  await app.register(cors, {
    credentials: true,
    origin(origin: string | undefined, callback: (error: Error | null, allow: boolean) => void) {
      const isAllowed = !origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin);
      callback(null, isAllowed);
    },
  });

  if (realtimeMarketDataService) {
    app.addHook('onReady', async () => realtimeMarketDataService.start());
    app.addHook('onClose', async () => realtimeMarketDataService.stop());
  }

  if (marketWideRuntimeCoordinator) {
    app.addHook(
      'onReady',
      async () => {
        await marketWideRuntimeCoordinator.start();
      },
    );

    app.addHook(
      'onClose',
      async () => {
        marketWideRuntimeCoordinator.stop();
      },
    );
  } else if (binanceSymbolUniverseService) {
    app.addHook(
      'onReady',
      async () => {
        await binanceSymbolUniverseService.start();
      },
    );

    app.addHook(
      'onClose',
      async () => {
        binanceSymbolUniverseService.stop();
      },
    );
  }

  app.get('/', async () => ({ service: 'nexus-backend', version: '0.1.0', apiPrefix: env.apiPrefix }));
  await app.register(apiModules, {
    prefix: env.apiPrefix,
    marketDataProvider,
    ...(realtimeMarketDataService ? { realtimeMarketDataService } : {}),
    ...(binanceSymbolUniverseService
      ? { binanceSymbolUniverseService }
      : {}),
    ...(marketWideRealtimeService
      ? { marketWideRealtimeService }
      : {}),
  });

  app.setNotFoundHandler((request, reply) => reply.status(404).send({ error: 'not_found', message: `Route ${request.method} ${request.url} was not found`, requestId: request.id }));
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ error }, 'Unhandled request error');
    return reply.status(error.statusCode ?? 500).send({ error: error.code ?? 'internal_error', message: error.statusCode && error.statusCode < 500 ? error.message : 'Internal server error', requestId: request.id });
  });
  return app;
}
