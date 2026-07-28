import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWorkspaceLiquidityMap,
  resolveWorkspaceLiquidityBucketSize,
} from '../node_modules/.tmp/realtime-test/realtime/workspaceLiquidityMap.js';

const UPDATED_AT =
  '2026-07-28T19:08:30.000Z';

function snapshot(
  overrides = {},
) {
  return {
    symbol:
      'BTCUSDT',
    state:
      'live',
    synchronized:
      true,
    lastUpdateId:
      123,
    bids: [],
    asks: [],
    buckets: {
      bids: [
        {
          side:
            'bid',
          price:
            63_760,
          quantity:
            2,
          quoteValue:
            100_000,
          levelsCount:
            2,
        },
        {
          side:
            'bid',
          price:
            63_750,
          quantity:
            1,
          quoteValue:
            50_000,
          levelsCount:
            1,
        },
      ],
      asks: [
        {
          side:
            'ask',
          price:
            63_770,
          quantity:
            3,
          quoteValue:
            150_000,
          levelsCount:
            3,
        },
        {
          side:
            'ask',
          price:
            63_780,
          quantity:
            4,
          quoteValue:
            200_000,
          levelsCount:
            4,
        },
      ],
    },
    metrics: {
      symbol:
        'BTCUSDT',
      synchronized:
        true,
      bestBid:
        63_760,
      bestAsk:
        63_760.1,
      midpoint:
        63_760.05,
      spread:
        0.1,
      spreadPct:
        0.0001568,
      depthRangePct:
        0.2,
      bidDepthQuote:
        10_000_000,
      askDepthQuote:
        12_000_000,
      totalDepthQuote:
        22_000_000,
      imbalancePct:
        -9.09,
      updatedAt:
        UPDATED_AT,
    },
    updatedAt:
      UPDATED_AT,
    ageMs:
      10,
    staleAfterMs:
      5_000,
    lastError:
      null,
    ...overrides,
  };
}

function build(
  snapshotValue,
  overrides = {},
) {
  return buildWorkspaceLiquidityMap({
    snapshot:
      snapshotValue,
    lifecycleState:
      'open',
    status: {
      state:
        'connected',
      connectedAt:
        UPDATED_AT,
      disconnectedAt:
        null,
      lastMessageAt:
        UPDATED_AT,
      reconnectAttempts:
        0,
      subscribedSymbols: [
        'BTCUSDT',
      ],
      streamCount:
        1,
      lastError:
        null,
    },
    error:
      null,
    now:
      Date.parse(
        UPDATED_AT,
      )
      + 100,
    ...overrides,
  });
}

test(
  'chooses a stable adaptive bucket size for common price ranges',
  () => {
    assert.equal(
      resolveWorkspaceLiquidityBucketSize(
        63_760,
      ),
      10,
    );

    assert.equal(
      resolveWorkspaceLiquidityBucketSize(
        3_000,
      ),
      0.5,
    );

    assert.equal(
      resolveWorkspaceLiquidityBucketSize(
        180,
      ),
      0.05,
    );
  },
);

test(
  'builds a live map with asks above the divider and bids below it',
  () => {
    const view =
      build(
        snapshot(),
      );

    assert.equal(
      view.freshness.state,
      'live',
    );

    assert.equal(
      view.asks[0]
        ?.price,
      63_780,
    );

    assert.equal(
      view.asks[1]
        ?.price,
      63_770,
    );

    assert.equal(
      view.bids[0]
        ?.price,
      63_760,
    );

    assert.equal(
      view.asks[0]
        ?.intensity,
      1,
    );

    assert.ok(
      (
        view.asks[0]
          ?.distancePct
        ?? 0
      )
      > 0,
    );

    assert.ok(
      (
        view.bids[0]
          ?.distancePct
        ?? 0
      )
      < 0,
    );

    assert.equal(
      view.buyerPressurePct,
      45.455,
    );
  },
);

test(
  'keeps cached rows and marks them stale after a connection interruption',
  () => {
    const view =
      build(
        snapshot(),
        {
          lifecycleState:
            'reconnecting',
          error:
            new Error(
              'network lost',
            ),
        },
      );

    assert.equal(
      view.freshness.state,
      'stale',
    );

    assert.equal(
      view.freshness.label,
      'STALE',
    );

    assert.equal(
      view.asks.length,
      2,
    );

    assert.equal(
      view.bids.length,
      2,
    );
  },
);

test(
  'shows collecting before the first synchronized snapshot',
  () => {
    const view =
      build(
        null,
        {
          lifecycleState:
            'connecting',
          status:
            null,
        },
      );

    assert.equal(
      view.freshness.state,
      'collecting',
    );

    assert.equal(
      view.asks.length,
      0,
    );

    assert.equal(
      view.bids.length,
      0,
    );
  },
);

test(
  'shows an error when no cached snapshot exists',
  () => {
    const view =
      build(
        null,
        {
          lifecycleState:
            'error',
          status:
            null,
          error:
            new Error(
              'connection failed',
            ),
        },
      );

    assert.equal(
      view.freshness.state,
      'error',
    );

    assert.match(
      view.freshness.message,
      /connection failed/u,
    );
  },
);
