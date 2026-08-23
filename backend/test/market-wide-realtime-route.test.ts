import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import type {
  MarketScannerMetrics,
} from '../src/modules/realtime-market-data/market-scanner-metrics.js';
import type {
  RealtimeLiquidation,
} from '../src/modules/realtime-market-data/realtime-market-data.types.js';
import {
  getMarketScannerWindowMs,
  type MarketScannerWindowId,
} from '../src/modules/realtime-market-data/scanner-windows.js';
import {
  marketWideRealtimeRoutes,
  type MarketWideHistoryWarmupRouteService,
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


  private readonly liquidations:
    RealtimeLiquidation[] = [
      {
        symbol: 'BTCUSDT',
        pairSymbol: 'BTCUSDT',
        side: 'sell',
        orderType: 'LIMIT',
        timeInForce: 'IOC',
        originalQuantity: 0.01,
        price: 100_000,
        averagePrice: 99_950,
        orderStatus: 'FILLED',
        lastFilledQuantity: 0.01,
        filledQuantity: 0.01,
        tradeAt:
          '2026-07-21T12:00:20.000Z',
        updatedAt:
          '2026-07-21T12:00:20.100Z',
      },
      {
        symbol: 'SOLUSDT',
        pairSymbol: 'SOLUSDT',
        side: 'buy',
        orderType: 'LIMIT',
        timeInForce: 'IOC',
        originalQuantity: 10,
        price: 200,
        averagePrice: 200.5,
        orderStatus: 'FILLED',
        lastFilledQuantity: 10,
        filledQuantity: 10,
        tradeAt:
          '2026-07-21T12:00:25.000Z',
        updatedAt:
          '2026-07-21T12:00:25.100Z',
      },
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
    scannerWindow:
      MarketScannerWindowId = '1m',
  ): MarketScannerMetrics[] {
    const metrics =
      symbol
        ? this.metrics.filter(
            (metric) =>
              metric.symbol
              === symbol,
          )
        : this.metrics;

    return metrics.map(
      (metric) => ({
        ...metric,
        scannerWindow,
        windowMs:
          getMarketScannerWindowMs(
            scannerWindow,
          ),
      }),
    );
  }

  getRecentLiquidations(
    symbol?: string,
    limit = 100,
  ): RealtimeLiquidation[] {
    const values =
      symbol
        ? this.liquidations.filter(
            (item) =>
              item.symbol
              === symbol,
          )
        : this.liquidations;

    return values
      .slice(-limit)
      .map(
        (item) => ({
          ...item,
        }),
      );
  }

}


class TestHistoryWarmupService
implements MarketWideHistoryWarmupRouteService {
  getStatus() {
    return {
      state:
        'running' as const,
      totalSymbols: 2,
      processedSymbols: 1,
      successfulSymbols: 1,
      failedSymbols: 0,
      appliedKlines: 60,
      currentSymbol:
        'SOLUSDT',
      lastError: null,
      currentStageIndex: 1,
      totalStages: 5,
      completedStages: 0,
      currentStageTargetMinutes:
        60,
    };
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
      marketWideHistoryWarmupService:
        new TestHistoryWarmupService(),
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
        historyWarmup: {
          state: 'running',
          totalSymbols: 2,
          processedSymbols: 1,
          successfulSymbols: 1,
          failedSymbols: 0,
          appliedKlines: 60,
          currentSymbol:
            'SOLUSDT',
          lastError: null,
          currentStageIndex: 1,
          totalStages: 5,
          completedStages: 0,
          currentStageTargetMinutes:
            60,
        },
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

    const supportedWindow =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/scanner-metrics?scannerWindow=5m',
      });

    assert.equal(
      supportedWindow.statusCode,
      200,
    );

    assert.equal(
      supportedWindow
        .json()[0]
        .scannerWindow,
      '5m',
    );

    assert.equal(
      supportedWindow
        .json()[0]
        .windowMs,
      300_000,
    );

    const invalidWindow =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/scanner-metrics?scannerWindow=2m',
      });

    assert.equal(
      invalidWindow.statusCode,
      400,
    );

    assert.equal(
      invalidWindow
        .json()
        .error,
      'invalid_market_wide_scanner_window',
    );

    await app.close();
  },
);

test(
  'market-wide liquidations route returns factual bounded history',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/liquidations',
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

    assert.equal(
      payload[1].side,
      'buy',
    );

    await app.close();
  },
);

test(
  'market-wide liquidations route filters symbol and limit',
  async () => {
    const app =
      await createApp();

    const symbolResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/liquidations?symbol=solusdt',
      });

    assert.equal(
      symbolResponse.statusCode,
      200,
    );

    assert.deepEqual(
      symbolResponse
        .json()
        .map(
          (item) =>
            item.symbol,
        ),
      [
        'SOLUSDT',
      ],
    );

    const limitResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/liquidations?limit=1',
      });

    assert.equal(
      limitResponse.statusCode,
      200,
    );

    assert.equal(
      limitResponse
        .json()
        .length,
      1,
    );

    assert.equal(
      limitResponse
        .json()[0]
        .symbol,
      'SOLUSDT',
    );

    await app.close();
  },
);

test(
  'market-wide liquidations route validates symbol and limit',
  async () => {
    const app =
      await createApp();

    const invalidSymbol =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/liquidations?symbol=bad!',
      });

    assert.equal(
      invalidSymbol.statusCode,
      400,
    );

    assert.equal(
      invalidSymbol
        .json()
        .error,
      'invalid_symbol',
    );

    const missingSymbol =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/liquidations?symbol=ADAUSDT',
      });

    assert.equal(
      missingSymbol.statusCode,
      404,
    );

    assert.equal(
      missingSymbol
        .json()
        .error,
      'market_wide_symbol_not_found',
    );

    for (
      const limit
      of [
        '0',
        '1001',
        '1.5',
        'bad',
      ]
    ) {
      const invalidLimit =
        await app.inject({
          method: 'GET',
          url:
            '/api/v1/market/realtime/market-wide/liquidations?limit='
            + limit,
        });

      assert.equal(
        invalidLimit.statusCode,
        400,
      );

      assert.equal(
        invalidLimit
          .json()
          .error,
        'invalid_liquidation_limit',
      );
    }

    await app.close();
  },
);
