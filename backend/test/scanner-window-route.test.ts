import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import type { AppEnv } from '../src/config/env.js';
import {
  createCandles,
  marketSymbols,
} from '../src/modules/api-contract/fixtures.js';
import type {
  MarketDataProvider,
} from '../src/modules/market-data/market-data.provider.js';
import type {
  RealtimeMarketDataService,
} from '../src/modules/realtime-market-data/realtime-market-data.types.js';

const testEnv: AppEnv = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 4100,
  apiPrefix: '/api/v1',
  corsOrigins: ['http://localhost:5173'],
  logLevel: 'silent',
};

const fixtureProvider: MarketDataProvider = {
  getMarketSymbols: async () => marketSymbols,
  getCandles: async (symbol, timeframe) =>
    createCandles(symbol, timeframe),
};

test(
  'scanner metrics route forwards and validates scannerWindow',
  async () => {
    let requestedScannerWindow:
      string | undefined;

    const realtimeService:
      RealtimeMarketDataService = {
        start() {},
        stop() {},
        getStatus: () => ({
          state: 'connected',
          connectedAt:
            '2026-07-18T16:00:00.000Z',
          disconnectedAt: null,
          lastMessageAt: null,
          reconnectAttempts: 0,
          subscribedSymbols: ['BTCUSDT'],
          streamCount: 2,
          lastError: null,
        }),
        getSnapshots: () => [],
        getScannerMetrics: (
          _symbol,
          scannerWindow,
        ) => {
          requestedScannerWindow =
            scannerWindow;

          return [{
            symbol: 'BTCUSDT',
            scannerWindow:
              scannerWindow ?? '1m',
            windowMs:
              scannerWindow === '3m'
                ? 180_000
                : 60_000,
            price: null,
            priceChangePct: null,
            volatilityPct: null,
            spreadPct: null,
            topBookQuoteValue: null,
            orderBookImbalancePct: null,
            liquidityScore: null,
            activityScore: null,
            quoteVolume: 0,
            tradesCount: 0,
            tradesPerMinute: 0,
            buyTradesCount: 0,
            sellTradesCount: 0,
            buyQuoteVolume: 0,
            sellQuoteVolume: 0,
            windowStartedAt: null,
            updatedAt: null,
          }];
        },
        acquireSymbol: () =>
          () => undefined,
        subscribe: () =>
          () => undefined,
      };

    const app = await buildApp({
      env: testEnv,
      marketDataProvider:
        fixtureProvider,
      realtimeMarketDataService:
        realtimeService,
    });

    const response = await app.inject({
      method: 'GET',
      url:
        '/api/v1/market/realtime/scanner-metrics'
        + '?symbols=BTCUSDT'
        + '&scannerWindow=3m',
    });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      requestedScannerWindow,
      '3m',
    );

    assert.equal(
      response.json()[0].scannerWindow,
      '3m',
    );

    assert.equal(
      response.json()[0].windowMs,
      180_000,
    );

    const invalid = await app.inject({
      method: 'GET',
      url:
        '/api/v1/market/realtime/scanner-metrics'
        + '?symbols=BTCUSDT'
        + '&scannerWindow=2m',
    });

    assert.equal(
      invalid.statusCode,
      400,
    );

    assert.equal(
      invalid.json().error,
      'invalid_scanner_window',
    );

    await app.close();
  },
);
