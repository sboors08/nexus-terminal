import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWatchlistRealtimeView,
} from '../node_modules/.tmp/realtime-test/realtime/watchlistRealtime.js';

test('builds a pending Watchlist row without a snapshot', () => {
  const view = buildWatchlistRealtimeView(
    undefined,
    'connecting',
    null,
  );

  assert.equal(view.isLive, false);
  assert.equal(view.priceLabel, '\u2014');
  assert.equal(view.connectionTone, 'pending');
});

test('builds live Watchlist prices from a realtime snapshot', () => {
  const view = buildWatchlistRealtimeView(
    {
      symbol: 'SOLUSDT',
      lastTrade: {
        id: 'trade-1',
        symbol: 'SOLUSDT',
        timestamp: '2026-07-19T08:00:00.000Z',
        price: 187.42,
        quantity: 1.25,
        quoteValue: 234.275,
        side: 'buy',
        isBuyerMaker: false,
      },
      bookTicker: {
        symbol: 'SOLUSDT',
        bidPrice: 187.41,
        bidQuantity: 12,
        askPrice: 187.42,
        askQuantity: 8,
        spread: 0.01,
        spreadPct: 0.005336,
        updatedAt: '2026-07-19T08:00:00.000Z',
      },
      recentTrades: [],
      updatedAt: '2026-07-19T08:00:00.000Z',
    },
    'open',
    'connected',
  );

  assert.equal(view.isLive, true);
  assert.equal(view.priceLabel, '187.42');
  assert.equal(view.bidLabel, '187.41');
  assert.equal(view.askLabel, '187.42');
  assert.equal(view.connectionTone, 'live');
});

test('marks an interrupted Watchlist connection as an error', () => {
  const view = buildWatchlistRealtimeView(
    undefined,
    'error',
    'stopped',
  );

  assert.equal(view.connectionTone, 'error');
});
