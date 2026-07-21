import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildScannerRealtimeMarketView,
  formatScannerPrice,
  formatScannerQuantity,
  getScannerRealtimeConnectionLabel,
} from '../node_modules/.tmp/realtime-test/realtime/scannerRealtime.js';

test('formats realtime prices and quantities for Scanner', () => {
  assert.equal(formatScannerPrice(64292.81), '64 292.81');
  assert.equal(formatScannerPrice(187.42), '187.42');
  assert.equal(formatScannerPrice(0.00001234), '0.00001234');
  assert.equal(formatScannerQuantity(0.00388), '0.00388');
});

test('uses the mock price while a realtime snapshot is unavailable', () => {
  const view = buildScannerRealtimeMarketView(undefined, '187.42');

  assert.equal(view.isLive, false);
  assert.equal(view.priceLabel, '187.42');
  assert.equal(view.bidLabel, '—');
  assert.deepEqual(view.recentTrades, []);
});

test('builds bid, ask, spread and a newest-first trade tape', () => {
  const view = buildScannerRealtimeMarketView({
    symbol: 'BTCUSDT',
    lastTrade: {
      id: 'trade-2',
      symbol: 'BTCUSDT',
      timestamp: '2026-07-18T17:08:51.000Z',
      price: 64292.81,
      quantity: 0.00388,
      quoteValue: 249.4561028,
      side: 'buy',
      isBuyerMaker: false,
    },
    bookTicker: {
      symbol: 'BTCUSDT',
      bidPrice: 64292.8,
      bidQuantity: 0.5,
      askPrice: 64292.81,
      askQuantity: 0.4,
      spread: 0.01,
      spreadPct: 0.00001555,
      updatedAt: '2026-07-18T17:08:51.000Z',
    },
    recentTrades: [
      {
        id: 'trade-1',
        symbol: 'BTCUSDT',
        timestamp: '2026-07-18T17:08:50.000Z',
        price: 64292.8,
        quantity: 0.001,
        quoteValue: 64.2928,
        side: 'sell',
        isBuyerMaker: true,
      },
      {
        id: 'trade-2',
        symbol: 'BTCUSDT',
        timestamp: '2026-07-18T17:08:51.000Z',
        price: 64292.81,
        quantity: 0.00388,
        quoteValue: 249.4561028,
        side: 'buy',
        isBuyerMaker: false,
      },
    ],
    updatedAt: '2026-07-18T17:08:51.000Z',
  }, '64 000.00');

  assert.equal(view.isLive, true);
  assert.equal(view.priceLabel, '64 292.81');
  assert.equal(view.bidLabel, '64 292.80');
  assert.equal(view.askLabel, '64 292.81');
  assert.equal(view.spreadLabel, '0.0100 · 0.00002%');
  assert.deepEqual(view.recentTrades.map((trade) => trade.id), ['trade-2', 'trade-1']);
});

test('describes Scanner realtime connection states', () => {
  assert.equal(getScannerRealtimeConnectionLabel('open', 'connected'), 'Realtime подключён');
  assert.equal(getScannerRealtimeConnectionLabel('reconnecting', 'reconnecting'), 'Переподключение realtime');
  assert.equal(getScannerRealtimeConnectionLabel('error', 'stopped'), 'Ошибка realtime');
});
