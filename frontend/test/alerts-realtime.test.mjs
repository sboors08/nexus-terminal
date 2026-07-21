import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAlertsRealtimeView,
} from '../node_modules/.tmp/realtime-test/realtime/alertsRealtime.js';

test('preserves the alert price while Alerts realtime is pending', () => {
  const view = buildAlertsRealtimeView(
    undefined,
    '187.42',
    'connecting',
    null,
  );

  assert.equal(view.isLive, false);
  assert.equal(view.currentPriceLabel, '187.42');
  assert.equal(view.alertPriceLabel, '187.42');
  assert.equal(view.moveSinceAlertPct, null);
  assert.equal(view.moveSinceAlertLabel, '\u2014');
  assert.equal(view.connectionTone, 'pending');
});

test('builds the current Alerts price and move since the alert', () => {
  const view = buildAlertsRealtimeView(
    {
      symbol: 'SOLUSDT',
      lastTrade: {
        id: 'trade-1',
        symbol: 'SOLUSDT',
        timestamp: '2026-07-19T09:00:00.000Z',
        price: 190,
        quantity: 1,
        quoteValue: 190,
        side: 'buy',
        isBuyerMaker: false,
      },
      bookTicker: {
        symbol: 'SOLUSDT',
        bidPrice: 189.99,
        bidQuantity: 12,
        askPrice: 190,
        askQuantity: 10,
        spread: 0.01,
        spreadPct: 0.00526,
        updatedAt: '2026-07-19T09:00:00.000Z',
      },
      recentTrades: [],
      updatedAt: '2026-07-19T09:00:00.000Z',
    },
    '187.42',
    'open',
    'connected',
  );

  assert.equal(view.isLive, true);
  assert.equal(view.currentPriceLabel, '190.00');
  assert.equal(view.alertPriceLabel, '187.42');
  assert.equal(view.moveSinceAlertLabel, '+1.38%');
  assert.equal(view.connectionTone, 'live');
});

test('marks a failed Alerts realtime connection as an error', () => {
  const view = buildAlertsRealtimeView(
    undefined,
    '7.19',
    'error',
    'stopped',
  );

  assert.equal(view.connectionTone, 'error');
});
