import cors from '@fastify/cors';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { readEnv, type AppEnv } from './config/env.js';
import { apiModules } from './modules/index.js';
import {
  InMemoryFeedbackStore,
  JsonlFeedbackStore,
  type FeedbackStore,
} from './modules/api-contract/feedback-store.js';
import { BinanceMarketDataClient } from './modules/market-data/binance-market-data.client.js';
import type { MarketDataProvider } from './modules/market-data/market-data.provider.js';
import { BinanceWebSocketMarketDataService } from './modules/realtime-market-data/binance-websocket.service.js';
import { BinanceOrderBookDepthService } from './modules/realtime-market-data/binance-order-book-depth.service.js';
import { BinanceMarketHistoryClient } from './modules/realtime-market-data/binance-market-history.client.js';
import { BinanceSymbolUniverseService } from './modules/realtime-market-data/binance-symbol-universe.service.js';
import { MarketWideHistoryWarmupService } from './modules/realtime-market-data/market-wide-history-warmup.service.js';
import { MarketWideRealtimeService } from './modules/realtime-market-data/market-wide-realtime.service.js';
import { MarketWideRuntimeCoordinator } from './modules/realtime-market-data/market-wide-runtime-coordinator.js';
import { SetupDetectionRuntimeService } from './modules/setup-engine/setup-detection-runtime.service.js';
import {
  LevelV2ShadowMarketEvidenceAdapter,
} from './modules/setup-engine/level-v2/level-v2-shadow-market-evidence.js';
import { LevelV2ShadowRuntimeService } from './modules/setup-engine/level-v2/level-v2-shadow-runtime.js';
import type {
  LevelV2ShadowRuntimeLifecycle,
  LevelV2ShadowRuntimeReader,
} from './modules/setup-engine/level-v2/level-v2-shadow-runtime.types.js';
import type {
  SetupDetectionRuntimeEventSource,
  SetupDetectionRuntimeLifecycle,
  SetupDetectionRuntimeReader,
} from './modules/setup-engine/setup-detection-runtime.types.js';
import {
  SetupEventHistoryService,
} from './modules/setup-engine/setup-event-history.service.js';
import type {
  SetupEventHistoryLifecycle,
  SetupEventHistoryReader,
} from './modules/setup-engine/setup-event-history.types.js';
import {
  AlertsRuntimeService,
} from './modules/alerts/alerts-runtime.service.js';
import {
  JsonFileAlertsPersistence,
  type AlertsPersistenceContract,
} from './modules/alerts/alerts-persistence.js';
import {
  SetupLifecycleAlertEventSource,
} from './modules/alerts/setup-lifecycle-alert-event-source.js';
import {
  BtcMarketModeAlertEventSource,
} from './modules/alerts/btc-market-mode-alert-event-source.js';
import {
  BtcMarketModeProducer,
  type BtcMarketModeMetricsSource,
} from './modules/alerts/btc-market-mode-producer.js';
import {
  MarketWideAlertEventSource,
} from './modules/alerts/market-wide-alert-event-source.js';
import {
  MarketImpulseAlertEventSource,
} from './modules/alerts/market-impulse-alert-event-source.js';
import {
  MarketImpulseProducer,
  type MarketImpulseMetricsSource,
} from './modules/alerts/market-impulse-producer.js';
import type {
  AlertEventSourceContract,
  AlertsRuntimeContract,
} from './modules/alerts/alerts.types.js';
import type {
  AlertDeliveryAdapter,
} from './modules/alerts/alerts-delivery.js';
import type { RealtimeMarketDataService } from './modules/realtime-market-data/realtime-market-data.types.js';
import type { OrderBookDepthRuntimeService } from './modules/realtime-market-data/order-book-depth-runtime.types.js';
import {
  JsonFileLevelEngineFrozenSampleReader,
} from './modules/level-engine/level-engine-frozen-sample-reader.js';
import type {
  LevelEngineFrozenSampleReader,
} from './modules/level-engine/level-engine-frozen-sample-reader.js';

export interface BuildAppOptions {
  env?: AppEnv;
  marketDataProvider?: MarketDataProvider;
  feedbackStore?: FeedbackStore;
  realtimeMarketDataService?: RealtimeMarketDataService | null;
  orderBookDepthService?: OrderBookDepthRuntimeService | null;
  binanceSymbolUniverseService?: BinanceSymbolUniverseService | null;
  marketWideRealtimeService?: MarketWideRealtimeService | null;
  marketWideHistoryWarmupService?: MarketWideHistoryWarmupService | null;
  setupDetectionRuntimeService?: SetupDetectionRuntimeLifecycle | null;
  setupDetectionRuntimeReader?: SetupDetectionRuntimeReader | null;
  setupDetectionRuntimeEventSource?: SetupDetectionRuntimeEventSource | null;
  levelV2ShadowRuntimeService?: LevelV2ShadowRuntimeLifecycle | null;
  levelV2ShadowRuntimeReader?: LevelV2ShadowRuntimeReader | null;
  setupEventHistoryService?: SetupEventHistoryLifecycle | null;
  setupEventHistoryReader?: SetupEventHistoryReader | null;
  alertsRuntimeService?: AlertsRuntimeContract | null;
  alertsPersistence?: AlertsPersistenceContract | null;
  alertsDeliveryAdapters?:
    readonly AlertDeliveryAdapter[];
  levelEngineFrozenSampleReader?:
    LevelEngineFrozenSampleReader | null;
}

function isSetupDetectionRuntimeEventSource(
  value:
    SetupDetectionRuntimeLifecycle
    | null,
): value is
  SetupDetectionRuntimeLifecycle
  & SetupDetectionRuntimeEventSource {
  return Boolean(
    value
    && typeof (
      value as
        Partial<
          SetupDetectionRuntimeEventSource
        >
    ).subscribeLifecycleEvents
      === 'function',
  );
}

function createAlertEventSources(
  marketWideRealtimeService:
    MarketWideRealtimeService | null,
  setupDetectionRuntimeEventSource:
    SetupDetectionRuntimeEventSource | null,
): AlertEventSourceContract[] {
  const sources:
  AlertEventSourceContract[] = [];

  if (marketWideRealtimeService) {
    sources.push(
      new MarketWideAlertEventSource(
        marketWideRealtimeService,
      ),
    );

    if (
      isBtcMarketModeMetricsSource(
        marketWideRealtimeService,
      )
    ) {
      sources.push(
        new BtcMarketModeAlertEventSource(
          new BtcMarketModeProducer(
            marketWideRealtimeService,
          ),
        ),
      );
    }

    if (
      isMarketImpulseMetricsSource(
        marketWideRealtimeService,
      )
    ) {
      sources.push(
        new MarketImpulseAlertEventSource(
          new MarketImpulseProducer(
            marketWideRealtimeService,
          ),
        ),
      );
    }
  }

  if (
    setupDetectionRuntimeEventSource
  ) {
    sources.push(
      new SetupLifecycleAlertEventSource(
        setupDetectionRuntimeEventSource,
      ),
    );
  }

  return sources;
}

function isBtcMarketModeMetricsSource(
  value: MarketWideRealtimeService,
): value is
  MarketWideRealtimeService
  & BtcMarketModeMetricsSource {
  const candidate =
    value as Partial<
      BtcMarketModeMetricsSource
    >;

  return (
    typeof candidate.subscribeKlineChanges
      === 'function'
    && typeof candidate.getMetrics
      === 'function'
    && typeof candidate.getStatus
      === 'function'
  );
}

function isMarketImpulseMetricsSource(
  value: MarketWideRealtimeService,
): value is
  MarketWideRealtimeService
  & MarketImpulseMetricsSource {
  const candidate =
    value as Partial<
      MarketImpulseMetricsSource
    >;

  return (
    typeof candidate.subscribeKlineChanges
      === 'function'
    && typeof candidate.getMetrics
      === 'function'
    && typeof candidate.getStatus
      === 'function'
  );
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = options.env ?? readEnv();
  const marketDataProvider = options.marketDataProvider ?? new BinanceMarketDataClient({
    baseUrl: env.binanceBaseUrl ?? 'https://fapi.binance.com',
    requestTimeoutMs: env.binanceRequestTimeoutMs ?? 5_000,
    symbolsLimit: env.binanceSymbolsLimit ?? 1_000,
    cacheTtlMs: env.binanceCacheTtlMs ?? 15_000,
  });

  const feedbackStore =
    options.feedbackStore
    ?? (
      env.nodeEnv === 'test'
        ? new InMemoryFeedbackStore()
        : new JsonlFeedbackStore({
            filePath: env.feedbackStorePath ?? './data/feedback.jsonl',
          })
    );
  const webSocketEnabled = env.binanceWebSocketEnabled ?? env.nodeEnv !== 'test';
  const realtimeMarketDataService = options.realtimeMarketDataService === undefined
    ? webSocketEnabled
      ? new BinanceWebSocketMarketDataService({
        baseUrl: env.binanceWebSocketBaseUrl ?? 'wss://fstream.binance.com',
        symbols: env.binanceWebSocketSymbols ?? ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
        reconnectBaseDelayMs: env.binanceWebSocketReconnectBaseDelayMs ?? 1_000,
        reconnectMaxDelayMs: env.binanceWebSocketReconnectMaxDelayMs ?? 30_000,
        tradesBufferSize: env.binanceWebSocketTradesBufferSize ?? 100,
      })
      : null
    : options.realtimeMarketDataService;

  const orderBookDepthEnabled =
    env.binanceOrderBookDepthEnabled
    ?? env.nodeEnv !== 'test';

  const orderBookDepthService =
    options.orderBookDepthService
    === undefined
      ? orderBookDepthEnabled
        ? new BinanceOrderBookDepthService({
            restBaseUrl:
              env.binanceBaseUrl
              ?? 'https://fapi.binance.com',
            websocketBaseUrl:
              env.binanceWebSocketBaseUrl
              ?? 'wss://fstream.binance.com',
            symbols:
              env.binanceWebSocketSymbols
              ?? [
                'BTCUSDT',
                'ETHUSDT',
                'SOLUSDT',
              ],
            requestTimeoutMs:
              env.binanceRequestTimeoutMs
              ?? 5_000,
            staleAfterMs:
              env.binanceOrderBookDepthStaleAfterMs
              ?? 5_000,
            reconnectBaseDelayMs:
              env.binanceWebSocketReconnectBaseDelayMs
              ?? 1_000,
            reconnectMaxDelayMs:
              env.binanceWebSocketReconnectMaxDelayMs
              ?? 30_000,
          })
        : null
      : options.orderBookDepthService;

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
              ?? 'https://fapi.binance.com',
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
              ?? 'wss://fstream.binance.com',
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

  const marketWideHistoryWarmupEnabled =
    env.binanceMarketWideHistoryWarmupEnabled
    ?? env.nodeEnv !== 'test';

  const marketWideHistoryWarmupService =
    options.marketWideHistoryWarmupService
    === undefined
      ? marketWideHistoryWarmupEnabled
        && marketWideRealtimeService
          ? new MarketWideHistoryWarmupService({
              historySource:
                new BinanceMarketHistoryClient({
                  baseUrl:
                    env.binanceBaseUrl
                    ?? 'https://fapi.binance.com',
                  requestTimeoutMs:
                    env.binanceMarketWideHistoryWarmupRequestTimeoutMs
                    ?? 15_000,
                }),
              target:
                marketWideRealtimeService,
              minutesPerSymbol:
                env.binanceMarketWideHistoryWarmupMinutesPerSymbol
                ?? 4_320,
              requestDelayMs:
                env.binanceMarketWideHistoryWarmupRequestDelayMs
                ?? 250,
              maxRequestAttempts:
                env.binanceMarketWideHistoryWarmupMaxRequestAttempts
                ?? 3,
              retryBaseDelayMs:
                env.binanceMarketWideHistoryWarmupRetryBaseDelayMs
                ?? 1_000,
            })
          : null
      : options.marketWideHistoryWarmupService;

  const setupDetectionRuntimeService =
    options.setupDetectionRuntimeService
    === undefined
      ? marketWideRealtimeService
        ? new SetupDetectionRuntimeService(
            marketWideRealtimeService,
            undefined,
            {
              tapeReader:
                realtimeMarketDataService,
              orderBookReader:
                orderBookDepthService,
            },
          )
        : null
      : options.setupDetectionRuntimeService;

  const levelV2ShadowMarketEvidenceSource =
    realtimeMarketDataService
    || orderBookDepthService
      ? new LevelV2ShadowMarketEvidenceAdapter({
          tapeReader:
            realtimeMarketDataService,
          orderBookReader:
            orderBookDepthService,
        })
      : null;

  const levelV2ShadowRuntimeService =
    options.levelV2ShadowRuntimeService
    === undefined
      ? env.nodeEnv !== 'test'
        && marketWideRealtimeService
          ? new LevelV2ShadowRuntimeService(
              marketWideRealtimeService,
              undefined,
              levelV2ShadowMarketEvidenceSource,
            )
          : null
      : options.levelV2ShadowRuntimeService;

  const levelV2ShadowRuntimeReader =
    options.levelV2ShadowRuntimeReader
    === undefined
      ? levelV2ShadowRuntimeService
        instanceof LevelV2ShadowRuntimeService
          ? levelV2ShadowRuntimeService
          : null
      : options.levelV2ShadowRuntimeReader;

  const setupDetectionRuntimeReader =
    options.setupDetectionRuntimeReader
    === undefined
      ? setupDetectionRuntimeService
        instanceof SetupDetectionRuntimeService
          ? setupDetectionRuntimeService
          : null
      : options.setupDetectionRuntimeReader;

  const setupDetectionRuntimeEventSource =
    options.setupDetectionRuntimeEventSource
    === undefined
      ? isSetupDetectionRuntimeEventSource(
          setupDetectionRuntimeService,
        )
        ? setupDetectionRuntimeService
        : null
      : options.setupDetectionRuntimeEventSource;

  const setupEventHistoryService =
    options.setupEventHistoryService
    === undefined
      ? setupDetectionRuntimeEventSource
        ? new SetupEventHistoryService(
            setupDetectionRuntimeEventSource,
          )
        : null
      : options.setupEventHistoryService;

  const setupEventHistoryReader =
    options.setupEventHistoryReader
    === undefined
      ? setupEventHistoryService
        instanceof SetupEventHistoryService
          ? setupEventHistoryService
          : null
      : options.setupEventHistoryReader;

  const alertsPersistenceEnabled =
    env.alertsPersistenceEnabled
    ?? env.nodeEnv !== 'test';

  const alertsPersistence =
    options.alertsPersistence
    === undefined
      ? alertsPersistenceEnabled
        ? new JsonFileAlertsPersistence({
            filePath:
              env.alertsPersistencePath
              ?? './data/alerts-runtime-v1.json',
          })
        : null
      : options.alertsPersistence;

  const alertsRuntimeService =
    options.alertsRuntimeService
    === undefined
      ? new AlertsRuntimeService(
          createAlertEventSources(
            marketWideRealtimeService,
            setupDetectionRuntimeEventSource,
          ),
          {},
          alertsPersistence,
          options.alertsDeliveryAdapters
          ?? [],
        )
      : options.alertsRuntimeService;

  const levelEngineFrozenSampleReader =
    options.levelEngineFrozenSampleReader
    === undefined
      ? new JsonFileLevelEngineFrozenSampleReader({
          filePath:
            env.levelEngineFrozenSamplePath
            ?? './.tmp/level-engine-validation/latest-frozen-sample.json',
        })
      : options.levelEngineFrozenSampleReader;

  const marketWideRuntimeCoordinator =
    binanceSymbolUniverseService
    && marketWideRealtimeService
      ? new MarketWideRuntimeCoordinator(
          binanceSymbolUniverseService,
          marketWideRealtimeService,
          marketWideHistoryWarmupService
          ?? undefined,
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

  if (setupEventHistoryService) {
    app.addHook(
      'onReady',
      async () => {
        setupEventHistoryService.start();
      },
    );

    app.addHook(
      'onClose',
      async () => {
        setupEventHistoryService.stop();
      },
    );
  }

  if (alertsRuntimeService) {
    app.addHook(
      'onReady',
      async () => {
        await alertsRuntimeService.start();
      },
    );

    app.addHook(
      'onClose',
      async () => {
        await alertsRuntimeService.stop();
      },
    );
  }

  if (realtimeMarketDataService) {
    app.addHook('onReady', async () => realtimeMarketDataService.start());
    app.addHook('onClose', async () => realtimeMarketDataService.stop());
  }

  if (orderBookDepthService) {
    app.addHook(
      'onReady',
      async () => {
        orderBookDepthService.start();
      },
    );

    app.addHook(
      'onClose',
      async () => {
        orderBookDepthService.stop();
      },
    );
  }

  if (setupDetectionRuntimeService) {
    app.addHook(
      'onReady',
      async () => {
        setupDetectionRuntimeService.start();
      },
    );

    app.addHook(
      'onClose',
      async () => {
        setupDetectionRuntimeService.stop();
      },
    );
  }

  if (levelV2ShadowRuntimeService) {
    app.addHook(
      'onReady',
      async () => {
        levelV2ShadowRuntimeService.start();
      },
    );

    app.addHook(
      'onClose',
      async () => {
        levelV2ShadowRuntimeService.stop();
      },
    );
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
    feedbackStore,
    ...(realtimeMarketDataService ? { realtimeMarketDataService } : {}),
    ...(orderBookDepthService
      ? { orderBookDepthService }
      : {}),
    ...(binanceSymbolUniverseService
      ? { binanceSymbolUniverseService }
      : {}),
    ...(marketWideRealtimeService
      ? { marketWideRealtimeService }
      : {}),
    ...(marketWideHistoryWarmupService
      ? { marketWideHistoryWarmupService }
      : {}),
    ...(setupDetectionRuntimeReader
      ? { setupDetectionRuntimeReader }
      : {}),
    ...(setupDetectionRuntimeEventSource
      ? { setupDetectionRuntimeEventSource }
      : {}),
    ...(levelV2ShadowRuntimeReader
      ? { levelV2ShadowRuntimeReader }
      : {}),
    ...(levelEngineFrozenSampleReader
      ? { levelEngineFrozenSampleReader }
      : {}),
    ...(setupEventHistoryReader
      ? { setupEventHistoryReader }
      : {}),
    ...(alertsRuntimeService
      ? { alertsRuntime: alertsRuntimeService }
      : {}),
  });

  app.setNotFoundHandler((request, reply) => reply.status(404).send({ error: 'not_found', message: `Route ${request.method} ${request.url} was not found`, requestId: request.id }));
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ error }, 'Unhandled request error');
    return reply.status(error.statusCode ?? 500).send({ error: error.code ?? 'internal_error', message: error.statusCode && error.statusCode < 500 ? error.message : 'Internal server error', requestId: request.id });
  });
  return app;
}
