import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWorkspaceTradeTape,
} from '../node_modules/.tmp/realtime-test/realtime/workspaceTradeTape.js';

const NOW =
  Date.parse(
    '2026-07-29T12:00:20.000Z',
  );

function trade(
  id,
  timestamp,
  side,
  price,
  quantity,
  tradesCount = 1,
) {
  return {
    id,
    symbol:
      'BTCUSDT',
    timestamp,
    price,
    quantity,
    quoteValue:
      price * quantity,
    tradesCount,
    side,
    isBuyerMaker:
      side === 'sell',
  };
}

function build(
  trades,
  options = {},
) {
  return buildWorkspaceTradeTape({
    snapshot: {
      symbol:
        'BTCUSDT',
      lastTrade:
        trades[
          trades.length - 1
        ]
        ?? null,
      bookTicker:
        null,
      recentTrades:
        trades,
      updatedAt:
        trades[
          trades.length - 1
        ]?.timestamp
        ?? null,
    },
    lifecycleState:
      options.lifecycleState
      ?? 'open',
    backendState:
      options.backendState
      ?? 'connected',
    error:
      options.error
      ?? null,
    now:
      options.now
      ?? NOW,
  });
}

test(
  'aggregates same-side prints inside the merge window',
  () => {
    const view =
      build([
        trade(
          'buy-1',
          '2026-07-29T12:00:19.000Z',
          'buy',
          100,
          1,
          2,
        ),
        trade(
          'buy-2',
          '2026-07-29T12:00:19.120Z',
          'buy',
          100.01,
          2,
          3,
        ),
        trade(
          'sell-1',
          '2026-07-29T12:00:19.250Z',
          'sell',
          100.02,
          1,
          1,
        ),
      ]);

    assert.equal(
      view.prints.length,
      2,
    );

    assert.equal(
      view.prints[0].id,
      'sell-1',
    );

    assert.equal(
      view.prints[1].id,
      'buy-1:buy-2',
    );

    assert.equal(
      view.prints[1].quantity,
      3,
    );

    assert.equal(
      view.prints[1].tradesCount,
      5,
    );

    assert.ok(
      Math.abs(
        view.prints[1].quoteValue
        - 300.02,
      ) < 0.000001,
    );
  },
);

test(
  'keeps prints separate when side, time, or price differs',
  () => {
    const view =
      build([
        trade(
          'buy-1',
          '2026-07-29T12:00:18.000Z',
          'buy',
          100,
          1,
        ),
        trade(
          'buy-2',
          '2026-07-29T12:00:18.500Z',
          'buy',
          100,
          1,
        ),
        trade(
          'sell-1',
          '2026-07-29T12:00:18.600Z',
          'sell',
          100,
          1,
        ),
        trade(
          'sell-2',
          '2026-07-29T12:00:18.700Z',
          'sell',
          101,
          1,
        ),
      ]);

    assert.equal(
      view.prints.length,
      4,
    );
  },
);

test(
  'calculates trade rate, acceleration, quote delta, and buy share',
  () => {
    const view =
      build([
        trade(
          'previous',
          '2026-07-29T12:00:05.000Z',
          'buy',
          100,
          5,
          5,
        ),
        trade(
          'current-buy',
          '2026-07-29T12:00:15.000Z',
          'buy',
          100,
          10,
          10,
        ),
        trade(
          'current-sell',
          '2026-07-29T12:00:16.000Z',
          'sell',
          100,
          4,
          5,
        ),
      ]);

    assert.equal(
      view.metrics.tradeRate,
      1.5,
    );

    assert.equal(
      view.metrics.previousTradeRate,
      0.5,
    );

    assert.equal(
      view.metrics.accelerationPct,
      200,
    );

    assert.equal(
      view.metrics.deltaQuoteValue,
      600,
    );

    assert.equal(
      view.metrics.buySharePct,
      71.4,
    );
  },
);

test(
  'marks only the adaptive high-value tail as large',
  () => {
    const view =
      build([
        trade(
          'small-1',
          '2026-07-29T12:00:15.000Z',
          'buy',
          1,
          100,
        ),
        trade(
          'small-2',
          '2026-07-29T12:00:15.500Z',
          'sell',
          1,
          200,
        ),
        trade(
          'small-3',
          '2026-07-29T12:00:16.000Z',
          'buy',
          1,
          300,
        ),
        trade(
          'large-1',
          '2026-07-29T12:00:16.500Z',
          'sell',
          1,
          5_000,
        ),
      ]);

    assert.ok(
      view.largeThresholdQuoteValue
      > 3_000,
    );

    assert.deepEqual(
      view.prints
        .filter(
          (print) =>
            print.isLarge,
        )
        .map(
          (print) =>
            print.id,
        ),
      [
        'large-1',
      ],
    );
  },
);

test(
  'reports LIVE for recent trades on a healthy source',
  () => {
    const view =
      build([
        trade(
          'live-1',
          '2026-07-29T12:00:19.000Z',
          'buy',
          100,
          1,
        ),
      ]);

    assert.equal(
      view.freshness.state,
      'live',
    );

    assert.equal(
      view.freshness.label,
      'LIVE',
    );
  },
);

test(
  'keeps cached prints visible as STALE during reconnect',
  () => {
    const view =
      build(
        [
          trade(
            'cached-1',
            '2026-07-29T12:00:19.000Z',
            'buy',
            100,
            1,
          ),
        ],
        {
          lifecycleState:
            'reconnecting',
          backendState:
            'reconnecting',
          error:
            new Error(
              'Realtime connection interrupted',
            ),
        },
      );

    assert.equal(
      view.prints.length,
      1,
    );

    assert.equal(
      view.freshness.state,
      'stale',
    );
  },
);

test(
  'reports STALE when the last trade is too old',
  () => {
    const view =
      build([
        trade(
          'old-1',
          '2026-07-29T11:59:30.000Z',
          'buy',
          100,
          1,
        ),
      ]);

    assert.equal(
      view.freshness.state,
      'stale',
    );
  },
);

test(
  'distinguishes collecting, error, and offline without data',
  () => {
    const collecting =
      build([], {
        lifecycleState:
          'connecting',
        backendState:
          null,
      });

    const failed =
      build([], {
        lifecycleState:
          'error',
        backendState:
          'stopped',
        error:
          new Error(
            'Realtime connection interrupted',
          ),
      });

    const offline =
      build([], {
        lifecycleState:
          'closed',
        backendState:
          'stopped',
      });

    assert.equal(
      collecting.freshness.state,
      'collecting',
    );

    assert.equal(
      failed.freshness.state,
      'error',
    );

    assert.equal(
      offline.freshness.state,
      'offline',
    );
  },
);

test(
  'preserves the last known flow metrics when tape data becomes stale',
  () => {
    const view =
      build(
        [
          trade(
            'cached-flow',
            '2026-07-29T12:00:19.000Z',
            'buy',
            100,
            10,
            20,
          ),
        ],
        {
          now:
            Date.parse(
              '2026-07-29T12:00:50.000Z',
            ),
        },
      );

    assert.equal(
      view.freshness.state,
      'stale',
    );

    assert.equal(
      view.metrics.tradeRate,
      2,
    );

    assert.equal(
      view.metrics.deltaQuoteValue,
      1_000,
    );

    assert.equal(
      view.metrics.buySharePct,
      100,
    );
  },
);
test(
  'ignores malformed trades instead of fabricating tape data',
  () => {
    const malformed = {
      id:
        'broken',
      symbol:
        'BTCUSDT',
      timestamp:
        'not-a-date',
      price:
        Number.NaN,
      quantity:
        -1,
      quoteValue:
        Number.NaN,
      tradesCount:
        0,
      side:
        'buy',
      isBuyerMaker:
        false,
    };

    const view =
      build([
        malformed,
      ]);

    assert.deepEqual(
      view.prints,
      [],
    );

    assert.equal(
      view.freshness.state,
      'collecting',
    );
  },
);
