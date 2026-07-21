import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import type {
  MarketScannerMetrics,
} from '../src/modules/realtime-market-data/market-scanner-metrics.js';
import {
  marketWideRealtimeRoutes,
  type MarketWideRealtimeRouteService,
} from '../src/modules/realtime-market-data/market-wide-realtime.routes.js';

function createMetric(
  symbol: string,
  price: number,
): MarketScannerMetrics {
  return {
    symbol,
    scannerWindow: '1m',
    windowMs: 60_000,
    price,
    priceChangePct: 1,
    btcCorrelation: null,
    relativeStrengthPct: 0.5,
    volatilityPct: 2,
    spreadPct: 0.01,
    topBookQuoteValue: 100_000,
    orderBookImbalancePct: 10,
    liquidityScore: 8,
    activityScore: 75,
    quoteVolume: 250_000,
    tradesCount: 500,
    tradesPerMinute: 500,
    buyTradesCount: 0,
    sellTradesCount: 0,
    buyQuoteVolume: 140_000,
    sellQuoteVolume: 110_000,
    windowStartedAt:
      '2026-07-21T12:00:00.000Z',
    updatedAt:
      '2026-07-21T12:00:30.000Z',
  };
}

class TestMarketWideService
implements MarketWideRealtimeRouteService {
  private readonly metrics = [
    createMetric(
      'BTCUSDT',
      100_000,
    ),
    createMetric(
      'SOLUSDT',
      200,
    ),
  ];

  getStatus() {
    return {
      state:
        'connected' as const,
      symbolsCount: 2,
      streamCount: 4,
      socketCount: 1,
      connectedSockets: 1,
      lastMessageAt:
        '2026-07-21T12:00:30.000Z',
      reconnectAttempts: 0,
      lastError: null,
    };
  }

  getMetrics(
    symbol?: string,
  ): MarketScannerMetrics[] {
    return symbol
      ? this.metrics.filter(
          (metric) =>
            metric.symbol
            === symbol,
        )
      : this.metrics.map(
          (metric) => ({
            ...metric,
          }),
        );
  }
}

async function createApp() {
  const app = Fastify({
    logger: false,
  });

  await app.register(
    marketWideRealtimeRoutes,
    {
      prefix: '/api/v1',
      marketWideRealtimeService:
        new TestMarketWideService(),
    },
  );

  return app;
}

test(
  'market-wide status route exposes socket and symbol state',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/status',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      response.json(),
      {
        state: 'connected',
        symbolsCount: 2,
        streamCount: 4,
        socketCount: 1,
        connectedSockets: 1,
        lastMessageAt:
          '2026-07-21T12:00:30.000Z',
        reconnectAttempts: 0,
        lastError: null,
      },
    );

    await app.close();
  },
);

test(
  'market-wide metrics route returns all one-minute metrics',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/scanner-metrics?scannerWindow=1m',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    const payload =
      response.json();

    assert.equal(
      payload.length,
      2,
    );

    assert.equal(
      payload[0].symbol,
      'BTCUSDT',
    );

    assert.equal(
      payload[1].symbol,
      'SOLUSDT',
    );

    await app.close();
  },
);

test(
  'market-wide metrics route filters one symbol',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/scanner-metrics?symbol=solusdt',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    const payload =
      response.json();

    assert.equal(
      payload.length,
      1,
    );

    assert.equal(
      payload[0].symbol,
      'SOLUSDT',
    );

    await app.close();
  },
);

test(
  'market-wide metrics route validates symbols and scanner windows',
  async () => {
    const app =
      await createApp();

    const invalidSymbol =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/scanner-metrics?symbol=bad!',
      });

    assert.equal(
      invalidSymbol.statusCode,
      400,
    );

    assert.equal(
      invalidSymbol.json().error,
      'invalid_symbol',
    );

    const missingSymbol =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/scanner-metrics?symbol=ADAUSDT',
      });

    assert.equal(
      missingSymbol.statusCode,
      404,
    );

    assert.equal(
      missingSymbol.json().error,
      'market_wide_symbol_not_found',
    );

    const unsupportedWindow =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/scanner-metrics?scannerWindow=5m',
      });

    assert.equal(
      unsupportedWindow.statusCode,
      400,
    );

    assert.equal(
      unsupportedWindow
        .json()
        .error,
      'unsupported_market_wide_scanner_window',
    );

    await app.close();
  },
);