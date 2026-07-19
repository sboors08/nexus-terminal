import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MarketScannerMetricsWindow,
} from '../src/modules/realtime-market-data/market-scanner-metrics.js';
import type {
  RealtimeBookTicker,
  RealtimeTrade,
} from '../src/modules/realtime-market-data/realtime-market-data.types.js';

function trade(
  id: string,
  timestamp: string,
  price: number,
  quantity: number,
  side: 'buy' | 'sell',
): RealtimeTrade {
  return {
    id,
    symbol: 'SOLUSDT',
    timestamp,
    price,
    quantity,
    quoteValue: price * quantity,
    side,
    isBuyerMaker: side === 'sell',
  };
}

function bookTicker(): RealtimeBookTicker {
  return {
    symbol: 'SOLUSDT',
    bidPrice: 100,
    bidQuantity: 100,
    askPrice: 100.02,
    askQuantity: 80,
    spread: 0.02,
    spreadPct:
      (0.02 / 100.01) * 100,
    updatedAt:
      '2026-07-19T12:00:50.000Z',
  };
}

test(
  'returns empty market scanner metrics before trades arrive',
  () => {
    const window =
      new MarketScannerMetricsWindow(
        'solusdt',
      );

    const metrics = window.getMetrics(
      new Date('2026-07-19T12:01:00.000Z'),
    );

    assert.equal(metrics.symbol, 'SOLUSDT');
    assert.equal(metrics.price, null);
    assert.equal(metrics.priceChangePct, null);
    assert.equal(metrics.volatilityPct, null);
    assert.equal(metrics.spreadPct, null);
    assert.equal(
      metrics.topBookQuoteValue,
      null,
    );
    assert.equal(
      metrics.orderBookImbalancePct,
      null,
    );
    assert.equal(
      metrics.liquidityScore,
      null,
    );
    assert.equal(metrics.quoteVolume, 0);
    assert.equal(metrics.tradesCount, 0);
    assert.equal(metrics.tradesPerMinute, 0);
    assert.equal(metrics.updatedAt, null);
  },
);

test(
  'aggregates price volume trades and direction for one minute',
  () => {
    const window =
      new MarketScannerMetricsWindow(
        'SOLUSDT',
      );

    window.addTrade(
      trade(
        'SOLUSDT-1',
        '2026-07-19T12:00:10.000Z',
        100,
        2,
        'buy',
      ),
    );

    window.addTrade(
      trade(
        'SOLUSDT-2',
        '2026-07-19T12:00:40.000Z',
        105,
        3,
        'sell',
      ),
    );

    const metrics = window.getMetrics(
      new Date('2026-07-19T12:01:00.000Z'),
    );

    assert.equal(metrics.price, 105);
    assert.equal(metrics.priceChangePct, 5);
    assert.equal(metrics.volatilityPct, 5);
    assert.equal(metrics.quoteVolume, 515);
    assert.equal(metrics.tradesCount, 2);
    assert.equal(metrics.tradesPerMinute, 2);
    assert.equal(metrics.buyTradesCount, 1);
    assert.equal(metrics.sellTradesCount, 1);
    assert.equal(metrics.buyQuoteVolume, 200);
    assert.equal(metrics.sellQuoteVolume, 315);
    assert.equal(
      metrics.updatedAt,
      '2026-07-19T12:00:40.000Z',
    );
  },
);

test(
  'removes trades older than the rolling window',
  () => {
    const window =
      new MarketScannerMetricsWindow(
        'SOLUSDT',
      );

    window.addTrade(
      trade(
        'SOLUSDT-old',
        '2026-07-19T11:59:59.000Z',
        90,
        1,
        'buy',
      ),
    );

    window.addTrade(
      trade(
        'SOLUSDT-current',
        '2026-07-19T12:00:30.000Z',
        100,
        1,
        'sell',
      ),
    );

    const metrics = window.getMetrics(
      new Date('2026-07-19T12:01:00.000Z'),
    );

    assert.equal(metrics.tradesCount, 1);
    assert.equal(metrics.price, 100);
    assert.equal(metrics.quoteVolume, 100);
    assert.equal(metrics.priceChangePct, null);
    assert.equal(metrics.volatilityPct, null);
  },
);

test(
  'calculates top-of-book liquidity',
  () => {
    const window =
      new MarketScannerMetricsWindow(
        'SOLUSDT',
      );

    window.updateBookTicker(
      bookTicker(),
    );

    const metrics = window.getMetrics(
      new Date(
        '2026-07-19T12:01:00.000Z',
      ),
    );

    assert.ok(
      metrics.spreadPct !== null,
    );

    assert.ok(
      Math.abs(
        metrics.spreadPct
        - 0.01999800019998
      ) < 0.000000001,
    );

    assert.equal(
      metrics.topBookQuoteValue,
      18_001.6,
    );

    assert.ok(
      metrics.orderBookImbalancePct
        !== null,
    );

    assert.ok(
      Math.abs(
        metrics.orderBookImbalancePct
        - 11.101235445938322
      ) < 0.000000001,
    );

    assert.equal(
      metrics.liquidityScore,
      7,
    );
  },
);

test(
  'ignores duplicate trade ids',
  () => {
    const window =
      new MarketScannerMetricsWindow(
        'SOLUSDT',
      );

    const item = trade(
      'SOLUSDT-duplicate',
      '2026-07-19T12:00:30.000Z',
      100,
      1,
      'buy',
    );

    assert.equal(window.addTrade(item), true);
    assert.equal(window.addTrade(item), false);

    const metrics = window.getMetrics(
      new Date('2026-07-19T12:01:00.000Z'),
    );

    assert.equal(metrics.tradesCount, 1);
    assert.equal(metrics.quoteVolume, 100);
  },
);
