import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMarketRealtimeView,
} from '../node_modules/.tmp/realtime-test/marketRealtime.js';

test('uses the Market fallback price while realtime is pending', () => {
  const view = buildMarketRealtimeView(
    undefined,
    '64 000.00',
    'connecting',
    null,
  );

  assert.equal(view.isLive, false);
  assert.equal(view.priceLabel, '64 000.00');
  assert.equal(view.connectionTone, 'pending');
});

test('builds live Market price, bid, ask and spread', () => {
  const view = buildMarketRealtimeView(
    {
      symbol: 'BTCUSDT',
      lastTrade: {
        id: 'trade-1',
        symbol: 'BTCUSDT',
        timestamp: '2026-07-19T09:00:00.000Z',
        price: 64721.51,
        quantity: 0.002,
        quoteValue: 129.44302,
        side: 'buy',
        isBuyerMaker: false,
      },
      bookTicker: {
        symbol: 'BTCUSDT',
        bidPrice: 64721.5,
        bidQuantity: 0.5,
        askPrice: 64721.51,
        askQuantity: 0.4,
        spread: 0.01,
        spreadPct: 0.00001545,
        updatedAt: '2026-07-19T09:00:00.000Z',
      },
      recentTrades: [],
      updatedAt: '2026-07-19T09:00:00.000Z',
    },
    '64 000.00',
    'open',
    'connected',
  );

  assert.equal(view.isLive, true);
  assert.equal(view.priceLabel, '64 721.51');
  assert.equal(view.bidLabel, '64 721.50');
  assert.equal(view.askLabel, '64 721.51');
  assert.equal(view.connectionTone, 'live');
});

test('marks a failed Market realtime connection as an error', () => {
  const view = buildMarketRealtimeView(
    undefined,
    '187.42',
    'error',
    'stopped',
  );

  assert.equal(view.connectionTone, 'error');
});
