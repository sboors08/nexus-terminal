import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWorkspaceRealtimeView,
} from '../node_modules/.tmp/realtime-test/workspaceRealtime.js';

const candles = [
  {
    high: 188,
    low: 186,
  },
  {
    high: 190,
    low: 187,
  },
];

test(
  'uses the Workspace fallback price while realtime is pending',
  () => {
    const view = buildWorkspaceRealtimeView(
      undefined,
      '188.00',
      candles,
      'connecting',
      null,
    );

    assert.equal(view.isLive, false);
    assert.equal(view.priceLabel, '188.00');
    assert.equal(view.priceY, 189);
    assert.equal(view.rangePosition, 'inside');
    assert.equal(view.connectionTone, 'pending');
    assert.deepEqual(
      view.axisLabels,
      [
        '190.00',
        '189.00',
        '188.00',
        '187.00',
        '186.00',
      ],
    );
  },
);

test(
  'builds the live Workspace price and chart position',
  () => {
    const view = buildWorkspaceRealtimeView(
      {
        symbol: 'SOLUSDT',
        lastTrade: {
          id: 'trade-1',
          symbol: 'SOLUSDT',
          timestamp: '2026-07-19T09:00:00.000Z',
          price: 187.5,
          quantity: 2,
          quoteValue: 375,
          side: 'buy',
          isBuyerMaker: false,
        },
        bookTicker: {
          symbol: 'SOLUSDT',
          bidPrice: 187.49,
          bidQuantity: 5,
          askPrice: 187.5,
          askQuantity: 4,
          spread: 0.01,
          spreadPct: 0.00533,
          updatedAt: '2026-07-19T09:00:00.000Z',
        },
        recentTrades: [],
        updatedAt: '2026-07-19T09:00:00.000Z',
      },
      '188.00',
      candles,
      'open',
      'connected',
    );

    assert.equal(view.isLive, true);
    assert.equal(view.priceValue, 187.5);
    assert.equal(view.priceLabel, '187.50');
    assert.equal(view.priceY, 230.3);
    assert.equal(view.rangePosition, 'inside');
    assert.equal(view.connectionTone, 'live');
  },
);

test(
  'clamps a Workspace price outside the candle range',
  () => {
    const view = buildWorkspaceRealtimeView(
      {
        symbol: 'SOLUSDT',
        lastTrade: {
          id: 'trade-2',
          symbol: 'SOLUSDT',
          timestamp: '2026-07-19T09:01:00.000Z',
          price: 76,
          quantity: 2,
          quoteValue: 152,
          side: 'sell',
          isBuyerMaker: true,
        },
        bookTicker: null,
        recentTrades: [],
        updatedAt: '2026-07-19T09:01:00.000Z',
      },
      '188.00',
      candles,
      'open',
      'connected',
    );

    assert.equal(view.priceY, 354);
    assert.equal(view.rangePosition, 'below');
  },
);

test(
  'marks a failed Workspace realtime connection as an error',
  () => {
    const view = buildWorkspaceRealtimeView(
      undefined,
      '188.00',
      candles,
      'error',
      'stopped',
    );

    assert.equal(view.connectionTone, 'error');
  },
);
