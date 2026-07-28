import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OrderBookDepthBook,
} from '../src/modules/realtime-market-data/order-book-depth-book.js';
import {
  bucketOrderBookDepth,
  calculateOrderBookDepthMetrics,
} from '../src/modules/realtime-market-data/order-book-depth-metrics.js';
import type {
  OrderBookDepthDelta,
  OrderBookDepthSnapshot,
} from '../src/modules/realtime-market-data/order-book-depth.types.js';

const SYMBOL =
  'BTCUSDT';

const SNAPSHOT_TIME =
  '2026-07-28T19:00:00.000Z';

function snapshot(
  lastUpdateId = 100,
): OrderBookDepthSnapshot {
  return {
    symbol:
      SYMBOL,
    lastUpdateId,
    bids: [
      {
        price:
          100,
        quantity:
          2,
      },
      {
        price:
          99.9,
        quantity:
          3,
      },
    ],
    asks: [
      {
        price:
          100.1,
        quantity:
          4,
      },
      {
        price:
          100.2,
        quantity:
          5,
      },
    ],
    receivedAt:
      SNAPSHOT_TIME,
  };
}

function delta(
  options: {
    firstUpdateId: number;
    finalUpdateId: number;
    previousFinalUpdateId:
      number
      | null;
    bids?: Array<{
      price: number;
      quantity: number;
    }>;
    asks?: Array<{
      price: number;
      quantity: number;
    }>;
    timestamp?: string;
  },
): OrderBookDepthDelta {
  const timestamp =
    options.timestamp
    ?? '2026-07-28T19:00:01.000Z';

  return {
    symbol:
      SYMBOL,
    firstUpdateId:
      options.firstUpdateId,
    finalUpdateId:
      options.finalUpdateId,
    previousFinalUpdateId:
      options.previousFinalUpdateId,
    bids:
      options.bids
      ?? [],
    asks:
      options.asks
      ?? [],
    eventTime:
      timestamp,
    receivedAt:
      timestamp,
  };
}

test(
  'buffers depth deltas until a REST snapshot arrives',
  () => {
    const book =
      new OrderBookDepthBook({
        symbol:
          SYMBOL,
      });

    const result =
      book.applyDelta(
        delta({
          firstUpdateId:
            99,
          finalUpdateId:
            101,
          previousFinalUpdateId:
            98,
          bids: [
            {
              price:
                100,
              quantity:
                6,
            },
          ],
        }),
      );

    assert.equal(
      result.status,
      'buffered',
    );

    assert.equal(
      book.getBufferedDeltaCount(),
      1,
    );

    assert.equal(
      book.getView()
        .synchronized,
      false,
    );
  },
);

test(
  'bridges the REST snapshot with buffered futures depth events',
  () => {
    const book =
      new OrderBookDepthBook({
        symbol:
          SYMBOL,
      });

    book.applyDelta(
      delta({
        firstUpdateId:
          99,
        finalUpdateId:
          101,
        previousFinalUpdateId:
          98,
        bids: [
          {
            price:
              100,
            quantity:
              6,
          },
        ],
      }),
    );

    book.applyDelta(
      delta({
        firstUpdateId:
          102,
        finalUpdateId:
          103,
        previousFinalUpdateId:
          101,
        asks: [
          {
            price:
              100.1,
            quantity:
              7,
          },
        ],
        timestamp:
          '2026-07-28T19:00:02.000Z',
      }),
    );

    const result =
      book.applySnapshot(
        snapshot(
          100,
        ),
      );

    assert.equal(
      result.status,
      'applied',
    );

    assert.equal(
      result.synchronized,
      true,
    );

    assert.equal(
      result.lastUpdateId,
      103,
    );

    const view =
      book.getView();

    assert.equal(
      view.bids[0]
        ?.quantity,
      6,
    );

    assert.equal(
      view.asks[0]
        ?.quantity,
      7,
    );
  },
);

test(
  'drops buffered events older than the REST snapshot',
  () => {
    const book =
      new OrderBookDepthBook({
        symbol:
          SYMBOL,
      });

    book.applyDelta(
      delta({
        firstUpdateId:
          90,
        finalUpdateId:
          99,
        previousFinalUpdateId:
          89,
        bids: [
          {
            price:
              100,
            quantity:
              50,
          },
        ],
      }),
    );

    book.applyDelta(
      delta({
        firstUpdateId:
          99,
        finalUpdateId:
          101,
        previousFinalUpdateId:
          98,
        bids: [
          {
            price:
              100,
            quantity:
              8,
          },
        ],
      }),
    );

    const result =
      book.applySnapshot(
        snapshot(
          100,
        ),
      );

    assert.equal(
      result.status,
      'applied',
    );

    assert.equal(
      book.getView()
        .bids[0]
        ?.quantity,
      8,
    );
  },
);

test(
  'detects a snapshot bridge gap',
  () => {
    const book =
      new OrderBookDepthBook({
        symbol:
          SYMBOL,
      });

    book.applyDelta(
      delta({
        firstUpdateId:
          105,
        finalUpdateId:
          106,
        previousFinalUpdateId:
          104,
      }),
    );

    const result =
      book.applySnapshot(
        snapshot(
          100,
        ),
      );

    assert.equal(
      result.status,
      'gap',
    );

    assert.equal(
      result.reason,
      'snapshot-update-id-not-bridged',
    );

    assert.equal(
      result.synchronized,
      false,
    );
  },
);

test(
  'detects a futures pu sequence mismatch after synchronization',
  () => {
    const book =
      new OrderBookDepthBook({
        symbol:
          SYMBOL,
      });

    book.applyDelta(
      delta({
        firstUpdateId:
          99,
        finalUpdateId:
          101,
        previousFinalUpdateId:
          98,
      }),
    );

    book.applySnapshot(
      snapshot(
        100,
      ),
    );

    const result =
      book.applyDelta(
        delta({
          firstUpdateId:
            102,
          finalUpdateId:
            103,
          previousFinalUpdateId:
            100,
        }),
      );

    assert.equal(
      result.status,
      'gap',
    );

    assert.equal(
      result.reason,
      'previous-final-update-id-mismatch',
    );

    assert.equal(
      book.getView()
        .synchronized,
      false,
    );
  },
);

test(
  'uses absolute quantities and removes zero-quantity levels',
  () => {
    const book =
      new OrderBookDepthBook({
        symbol:
          SYMBOL,
      });

    book.applyDelta(
      delta({
        firstUpdateId:
          99,
        finalUpdateId:
          101,
        previousFinalUpdateId:
          98,
        bids: [
          {
            price:
              100,
            quantity:
              10,
          },
        ],
        asks: [
          {
            price:
              100.1,
            quantity:
              0,
          },
        ],
      }),
    );

    book.applySnapshot(
      snapshot(
        100,
      ),
    );

    const view =
      book.getView();

    assert.equal(
      view.bids[0]
        ?.quantity,
      10,
    );

    assert.equal(
      view.asks.some(
        (level) =>
          level.price
          === 100.1,
      ),
      false,
    );
  },
);

test(
  'ignores duplicate or stale depth events',
  () => {
    const book =
      new OrderBookDepthBook({
        symbol:
          SYMBOL,
      });

    book.applyDelta(
      delta({
        firstUpdateId:
          99,
        finalUpdateId:
          101,
        previousFinalUpdateId:
          98,
      }),
    );

    book.applySnapshot(
      snapshot(
        100,
      ),
    );

    const result =
      book.applyDelta(
        delta({
          firstUpdateId:
            100,
          finalUpdateId:
            101,
          previousFinalUpdateId:
            100,
        }),
      );

    assert.equal(
      result.status,
      'ignored',
    );

    assert.equal(
      result.reason,
      'stale-delta',
    );
  },
);

test(
  'builds side-aware price buckets',
  () => {
    const book =
      new OrderBookDepthBook({
        symbol:
          SYMBOL,
      });

    book.applyDelta(
      delta({
        firstUpdateId:
          99,
        finalUpdateId:
          101,
        previousFinalUpdateId:
          98,
      }),
    );

    book.applySnapshot(
      snapshot(
        100,
      ),
    );

    const buckets =
      bucketOrderBookDepth(
        book.getView(),
        {
          bucketSize:
            0.2,
        },
      );

    assert.equal(
      buckets.bids[0]
        ?.price,
      100,
    );

    assert.equal(
      buckets.asks[0]
        ?.price,
      100.2,
    );

    assert.equal(
      buckets.asks[0]
        ?.levelsCount,
      2,
    );
  },
);

test(
  'calculates spread, depth, and order-book imbalance',
  () => {
    const book =
      new OrderBookDepthBook({
        symbol:
          SYMBOL,
      });

    book.applyDelta(
      delta({
        firstUpdateId:
          99,
        finalUpdateId:
          101,
        previousFinalUpdateId:
          98,
      }),
    );

    book.applySnapshot(
      snapshot(
        100,
      ),
    );

    const metrics =
      calculateOrderBookDepthMetrics(
        book.getView(),
        {
          depthRangePct:
            0.2,
        },
      );

    assert.equal(
      metrics.bestBid,
      100,
    );

    assert.equal(
      metrics.bestAsk,
      100.1,
    );

    assert.ok(
      metrics.spread !== null
      && Math.abs(
        metrics.spread
        - 0.1,
      ) < 1e-9,
    );

    assert.ok(
      metrics.bidDepthQuote
      > 0,
    );

    assert.ok(
      metrics.askDepthQuote
      > metrics.bidDepthQuote,
    );

    assert.ok(
      metrics.imbalancePct !== null
      && metrics.imbalancePct < 0,
    );
  },
);

test(
  'rejects malformed depth data',
  () => {
    const book =
      new OrderBookDepthBook({
        symbol:
          SYMBOL,
      });

    assert.throws(
      () =>
        book.applySnapshot({
          ...snapshot(),
          bids: [
            {
              price:
                Number.NaN,
              quantity:
                1,
            },
          ],
        }),
      /invalid price/u,
    );

    assert.throws(
      () =>
        book.applyDelta(
          delta({
            firstUpdateId:
              102,
            finalUpdateId:
              101,
            previousFinalUpdateId:
              100,
          }),
        ),
      /finalUpdateId/u,
    );
  },
);
