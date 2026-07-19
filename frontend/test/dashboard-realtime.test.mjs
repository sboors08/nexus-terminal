import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDashboardRealtimeCoinView,
  buildDashboardRealtimeView,
  normalizeDashboardRealtimeSymbol,
} from '../node_modules/.tmp/realtime-test/dashboardRealtime.js';

function trade(id, symbol, price, timestamp) {
  return {
    id,
    symbol,
    timestamp,
    price,
    quantity: 1,
    quoteValue: price,
    side: 'buy',
    isBuyerMaker: false,
  };
}

test(
  'normalizes Dashboard trading symbols',
  () => {
    assert.equal(
      normalizeDashboardRealtimeSymbol('sol/usdt'),
      'SOLUSDT',
    );
  },
);

test(
  'uses Dashboard fallback data while realtime is pending',
  () => {
    const view = buildDashboardRealtimeCoinView(
      {
        symbol: 'SOL/USDT',
        fallbackPrice: '174.20',
        fallbackChange: '+2.81%',
      },
      undefined,
    );

    assert.equal(view.symbol, 'SOLUSDT');
    assert.equal(view.isLive, false);
    assert.equal(view.priceLabel, '174.20');
    assert.equal(view.changeLabel, '+2.81%');
    assert.equal(view.sourceLabel, 'TEST');
  },
);

test(
  'builds live Dashboard price and stream change',
  () => {
    const view = buildDashboardRealtimeCoinView(
      {
        symbol: 'BTCUSDT',
        fallbackPrice: 104250,
        fallbackChange: 1.82,
      },
      {
        symbol: 'BTCUSDT',
        lastTrade: trade(
          'trade-2',
          'BTCUSDT',
          76000,
          '2026-07-19T09:01:00.000Z',
        ),
        bookTicker: null,
        recentTrades: [
          trade(
            'trade-1',
            'BTCUSDT',
            75000,
            '2026-07-19T09:00:00.000Z',
          ),
          trade(
            'trade-2',
            'BTCUSDT',
            76000,
            '2026-07-19T09:01:00.000Z',
          ),
        ],
        updatedAt:
          '2026-07-19T09:01:00.000Z',
      },
    );

    assert.equal(view.isLive, true);
    assert.equal(view.priceValue, 76000);
    assert.equal(view.priceLabel, '76 000.00');
    assert.equal(view.changeLabel, '+1.33%');
    assert.equal(view.sourceLabel, 'LIVE');
  },
);

test(
  'shows a clear label when stream change is unavailable',
  () => {
    const view = buildDashboardRealtimeCoinView(
      {
        symbol: 'SOLUSDT',
        fallbackPrice: '174.20',
        fallbackChange: '+2.81%',
      },
      {
        symbol: 'SOLUSDT',
        lastTrade: trade(
          'trade-1',
          'SOLUSDT',
          76,
          '2026-07-19T09:00:00.000Z',
        ),
        bookTicker: null,
        recentTrades: [
          trade(
            'trade-1',
            'SOLUSDT',
            76,
            '2026-07-19T09:00:00.000Z',
          ),
        ],
        updatedAt:
          '2026-07-19T09:00:00.000Z',
      },
    );

    assert.equal(view.isLive, true);
    assert.equal(view.changePct, null);
    assert.equal(view.changeLabel, '\u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445');
  },
);

test(
  'counts live Dashboard symbols',
  () => {
    const snapshot = {
      symbol: 'BTCUSDT',
      lastTrade: trade(
        'trade-1',
        'BTCUSDT',
        76000,
        '2026-07-19T09:00:00.000Z',
      ),
      bookTicker: null,
      recentTrades: [],
      updatedAt:
        '2026-07-19T09:00:00.000Z',
    };

    const view = buildDashboardRealtimeView(
      [
        {
          symbol: 'BTCUSDT',
          fallbackPrice: 104250,
          fallbackChange: 1.82,
        },
        {
          symbol: 'SOL/USDT',
          fallbackPrice: '174.20',
          fallbackChange: '+2.81%',
        },
      ],
      {
        BTCUSDT: snapshot,
      },
      'open',
      'connected',
    );

    assert.equal(view.liveCount, 1);
    assert.equal(view.totalCount, 2);
    assert.equal(view.connectionTone, 'live');
  },
);

test(
  'marks a failed Dashboard realtime connection as an error',
  () => {
    const view = buildDashboardRealtimeView(
      [],
      {},
      'error',
      'stopped',
    );

    assert.equal(view.connectionTone, 'error');
  },
);
