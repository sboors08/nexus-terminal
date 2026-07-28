import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWorkspaceMarketDynamics,
} from '../node_modules/.tmp/realtime-test/realtime/workspaceMarketDynamics.js';

function freshness(
  state,
  hasData,
) {
  const metadata = {
    live: {
      tone:
        'live',
      label:
        'LIVE',
    },
    collecting: {
      tone:
        'pending',
      label:
        'COLLECTING',
    },
    stale: {
      tone:
        'warning',
      label:
        'STALE',
    },
    error: {
      tone:
        'error',
      label:
        'ERROR',
    },
    offline: {
      tone:
        'offline',
      label:
        'OFFLINE',
    },
  }[state];

  return {
    state,
    tone:
      metadata.tone,
    label:
      metadata.label,
    hasData,
    lastUpdatedAt:
      hasData
        ? '2026-07-28T20:00:00.000Z'
        : null,
    ageMs:
      hasData
        ? 100
        : null,
    lastUpdatedLabel:
      hasData
        ? 'обновлено только что'
        : 'время обновления неизвестно',
    errorKind:
      state === 'error'
        ? 'network'
        : null,
    message:
      state,
  };
}

function tradeTape(
  options = {},
) {
  const state =
    options.state
    ?? 'live';

  const hasData =
    options.hasData
    ?? true;

  const buyQuoteValue =
    options.buyQuoteValue
    ?? 700_000;

  const sellQuoteValue =
    options.sellQuoteValue
    ?? 300_000;

  const totalQuoteValue =
    buyQuoteValue
    + sellQuoteValue;

  return {
    prints:
      hasData
        ? [
            {
              id:
                'trade-1',
            },
          ]
        : [],
    metrics: {
      tradeRate:
        options.tradeRate
        ?? 24,
      previousTradeRate:
        options.previousTradeRate
        ?? 16,
      accelerationPct:
        options.accelerationPct
        ?? 50,
      buyQuoteValue,
      sellQuoteValue,
      totalQuoteValue,
      deltaQuoteValue:
        buyQuoteValue
        - sellQuoteValue,
      buySharePct:
        totalQuoteValue > 0
          ? (
              buyQuoteValue
              / totalQuoteValue
            )
            * 100
          : null,
    },
    freshness:
      freshness(
        state,
        hasData,
      ),
    largeThresholdQuoteValue:
      null,
    lastTradeAt:
      hasData
        ? '2026-07-28T20:00:00.000Z'
        : null,
  };
}

function liquidityMap(
  options = {},
) {
  const state =
    options.state
    ?? 'live';

  const hasData =
    options.hasData
    ?? true;

  const tone = {
    live:
      'live',
    collecting:
      'pending',
    stale:
      'warning',
    error:
      'error',
  }[state];

  return {
    freshness: {
      state,
      tone,
      label:
        state.toUpperCase(),
      message:
        state,
      lastUpdatedLabel:
        hasData
          ? 'обновлено сейчас'
          : 'обновление ожидается',
    },
    asks:
      hasData
        ? [
            {
              price:
                101,
            },
          ]
        : [],
    bids:
      hasData
        ? [
            {
              price:
                100,
            },
          ]
        : [],
    imbalancePct:
      options.imbalancePct
      ?? 20,
    spread:
      options.spread
      ?? 0.1,
    spreadPct:
      options.spreadPct
      ?? 0.01,
    bidDepthQuote:
      options.bidDepthQuote
      ?? 12_000_000,
    askDepthQuote:
      options.askDepthQuote
      ?? 8_000_000,
  };
}

function build(
  tapeOptions = {},
  liquidityOptions = {},
) {
  return buildWorkspaceMarketDynamics({
    tradeTape:
      tradeTape(
        tapeOptions,
      ),
    liquidityMap:
      liquidityMap(
        liquidityOptions,
      ),
  });
}

test(
  'builds a live buyer regime from flow and order book pressure',
  () => {
    const view =
      build();

    assert.equal(
      view.freshness.state,
      'live',
    );

    assert.equal(
      view.mode,
      'buyers',
    );

    assert.equal(
      view.modeLabel,
      'ПОКУПАТЕЛИ',
    );

    assert.equal(
      view.pressureScore,
      31,
    );

    assert.equal(
      view.buyerPressurePct,
      65.5,
    );

    assert.equal(
      view.sellerPressurePct,
      34.5,
    );

    assert.equal(
      view.agreement,
      'aligned',
    );
  },
);

test(
  'builds a seller regime from negative flow and book imbalance',
  () => {
    const view =
      build(
        {
          buyQuoteValue:
            300_000,
          sellQuoteValue:
            700_000,
          accelerationPct:
            -25,
        },
        {
          imbalancePct:
            -20,
          bidDepthQuote:
            8_000_000,
          askDepthQuote:
            12_000_000,
        },
      );

    assert.equal(
      view.mode,
      'sellers',
    );

    assert.equal(
      view.pressureScore,
      -31,
    );

    assert.equal(
      view.activityTrend,
      'slowing',
    );
  },
);

test(
  'reports balance when flow and order book disagree without a strong combined edge',
  () => {
    const view =
      build(
        {
          buyQuoteValue:
            700_000,
          sellQuoteValue:
            300_000,
        },
        {
          imbalancePct:
            -30,
        },
      );

    assert.equal(
      view.mode,
      'balanced',
    );

    assert.equal(
      view.agreement,
      'mixed',
    );

    assert.equal(
      view.pressureScore,
      8.5,
    );
  },
);

test(
  'calculates delta pressure, activity trend, spread, and depth metrics',
  () => {
    const view =
      build();

    assert.equal(
      view.deltaPressurePct,
      40,
    );

    assert.equal(
      view.activityTrend,
      'accelerating',
    );

    assert.equal(
      view.tradeRate,
      24,
    );

    assert.equal(
      view.spread,
      0.1,
    );

    assert.equal(
      view.bidDepthQuote,
      12_000_000,
    );

    assert.equal(
      view.askDepthQuote,
      8_000_000,
    );
  },
);

test(
  'shows collecting before both sources contain data',
  () => {
    const view =
      build(
        {
          state:
            'collecting',
          hasData:
            false,
        },
        {
          state:
            'collecting',
          hasData:
            false,
          imbalancePct:
            null,
        },
      );

    assert.equal(
      view.freshness.state,
      'collecting',
    );

    assert.equal(
      view.mode,
      'collecting',
    );

    assert.equal(
      view.tradeRate,
      null,
    );

    assert.equal(
      view.bookImbalancePct,
      null,
    );

    assert.equal(
      view.pressureScore,
      null,
    );
  },
);

test(
  'keeps cached metrics visible and marks combined dynamics stale',
  () => {
    const view =
      build(
        {
          state:
            'stale',
        },
        {
          state:
            'live',
        },
      );

    assert.equal(
      view.freshness.state,
      'stale',
    );

    assert.equal(
      view.mode,
      'buyers',
    );

    assert.equal(
      view.tradeRate,
      24,
    );

    assert.equal(
      view.bookImbalancePct,
      20,
    );
  },
);

test(
  'shows an error without fabricating metrics when both sources fail before data',
  () => {
    const view =
      build(
        {
          state:
            'error',
          hasData:
            false,
        },
        {
          state:
            'error',
          hasData:
            false,
          imbalancePct:
            null,
        },
      );

    assert.equal(
      view.freshness.state,
      'error',
    );

    assert.equal(
      view.mode,
      'unavailable',
    );

    assert.equal(
      view.tradeRate,
      null,
    );

    assert.equal(
      view.spread,
      null,
    );

    assert.equal(
      view.bidDepthQuote,
      null,
    );
  },
);

test(
  'marks partial live data as collecting until both inputs are ready',
  () => {
    const view =
      build(
        {
          state:
            'live',
          hasData:
            true,
        },
        {
          state:
            'collecting',
          hasData:
            false,
          imbalancePct:
            null,
        },
      );

    assert.equal(
      view.freshness.state,
      'collecting',
    );

    assert.equal(
      view.mode,
      'collecting',
    );

    assert.equal(
      view.tradeRate,
      24,
    );

    assert.equal(
      view.pressureScore,
      null,
    );
  },
);
