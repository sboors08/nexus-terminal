import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MarketScannerMetricsSeries,
} from '../src/modules/realtime-market-data/market-scanner-metrics-series.js';
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

test(
  'aggregates multiple scanner windows from one trade stream',
  () => {
    const series =
      new MarketScannerMetricsSeries(
        'SOLUSDT',
      );

    const firstTrade = trade(
      'SOLUSDT-series-1',
      '2026-07-19T11:58:30.000Z',
      100,
      1,
      'buy',
    );

    assert.equal(
      series.addTrade(firstTrade),
      true,
    );

    assert.equal(
      series.addTrade(firstTrade),
      false,
    );

    series.addTrade(
      trade(
        'SOLUSDT-series-2',
        '2026-07-19T12:00:30.000Z',
        110,
        2,
        'sell',
      ),
    );

    const bookTicker: RealtimeBookTicker = {
      symbol: 'SOLUSDT',
      bidPrice: 109.9,
      bidQuantity: 50,
      askPrice: 110.1,
      askQuantity: 40,
      spread: 0.2,
      spreadPct: (0.2 / 110) * 100,
      updatedAt:
        '2026-07-19T12:00:40.000Z',
    };

    series.updateBookTicker(bookTicker);

    const at =
      new Date(
        '2026-07-19T12:01:00.000Z',
      );

    const oneMinute =
      series.getMetrics('1m', at);

    const threeMinutes =
      series.getMetrics('3m', at);

    assert.equal(
      oneMinute.tradesCount,
      1,
    );

    assert.equal(
      threeMinutes.scannerWindow,
      '3m',
    );

    assert.equal(
      threeMinutes.windowMs,
      180_000,
    );

    assert.equal(
      threeMinutes.tradesCount,
      2,
    );

    assert.equal(
      threeMinutes.quoteVolume,
      320,
    );

    assert.equal(
      threeMinutes.price,
      110,
    );

    assert.equal(
      threeMinutes.priceChangePct,
      10,
    );

    assert.equal(
      threeMinutes.volatilityPct,
      10,
    );

    assert.ok(
      Math.abs(
        threeMinutes.tradesPerMinute
        - 2 / 3,
      ) < 0.000000001,
    );

    assert.ok(
      threeMinutes.liquidityScore
        !== null,
    );
  },
);
