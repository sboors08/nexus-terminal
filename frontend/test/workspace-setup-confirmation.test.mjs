import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWorkspaceSetupConfirmation,
} from '../node_modules/.tmp/realtime-test/realtime/workspaceSetupConfirmation.js';

function buildDynamics(
  overrides = {},
) {
  const freshnessState =
    overrides.freshness?.state
    ?? 'live';

  const freshnessTone = {
    live:
      'live',
    collecting:
      'pending',
    stale:
      'warning',
    error:
      'error',
  }[freshnessState];

  return {
    freshness: {
      state:
        freshnessState,
      tone:
        freshnessTone,
      label:
        freshnessState
          .toUpperCase(),
      message:
        'test',
      lastUpdatedLabel:
        'обновлено только что',
      tapeState:
        freshnessState
          === 'error'
          ? 'error'
          : freshnessState,
      orderBookState:
        freshnessState,
      ...overrides.freshness,
    },
    mode:
      'buyers',
    modeLabel:
      'ПОКУПАТЕЛИ',
    modeTone:
      'positive',
    modeDescription:
      'test',
    agreement:
      'aligned',
    pressureScore:
      30,
    buyerPressurePct:
      65,
    sellerPressurePct:
      35,
    tradeRate:
      10,
    previousTradeRate:
      8,
    accelerationPct:
      25,
    activityTrend:
      'accelerating',
    buyQuoteValue:
      7000,
    sellQuoteValue:
      3000,
    totalQuoteValue:
      10000,
    deltaQuoteValue:
      4000,
    deltaPressurePct:
      40,
    buySharePct:
      70,
    bookImbalancePct:
      25,
    spread:
      0.1,
    spreadPct:
      0.001,
    bidDepthQuote:
      100000,
    askDepthQuote:
      75000,
    hasTapeData:
      true,
    hasOrderBookData:
      true,
    ...overrides,
  };
}

test(
  'confirms a LONG setup when trade flow and order book both support buyers',
  () => {
    const result =
      buildWorkspaceSetupConfirmation({
        direction:
          'long',
        marketDynamics:
          buildDynamics(),
      });

    assert.equal(
      result.status,
      'confirmed',
    );

    assert.equal(
      result.statusLabel,
      'ПОДТВЕРЖДЕНО',
    );

    assert.equal(
      result.supportCount,
      4,
    );

    assert.equal(
      result.blockingCount,
      0,
    );

    assert.equal(
      result.isLiveConfirmation,
      true,
    );
  },
);

test(
  'confirms a SHORT setup by inverting negative seller pressure',
  () => {
    const result =
      buildWorkspaceSetupConfirmation({
        direction:
          'short',
        marketDynamics:
          buildDynamics({
            pressureScore:
              -34,
            deltaPressurePct:
              -45,
            bookImbalancePct:
              -22,
            mode:
              'sellers',
            modeLabel:
              'ПРОДАВЦЫ',
            modeTone:
              'negative',
          }),
      });

    assert.equal(
      result.status,
      'confirmed',
    );

    assert.equal(
      result.directionalPressurePct,
      34,
    );

    assert.match(
      result.summary,
      /SHORT/u,
    );
  },
);

test(
  'reports partial confirmation when one source supports and the other is neutral',
  () => {
    const result =
      buildWorkspaceSetupConfirmation({
        direction:
          'long',
        marketDynamics:
          buildDynamics({
            pressureScore:
              10,
            deltaPressurePct:
              18,
            bookImbalancePct:
              3,
          }),
      });

    assert.equal(
      result.status,
      'partial',
    );

    assert.equal(
      result.supportCount,
      1,
    );

    assert.equal(
      result.blockingCount,
      0,
    );
  },
);

test(
  'reports not ready when trade flow opposes the setup direction',
  () => {
    const result =
      buildWorkspaceSetupConfirmation({
        direction:
          'long',
        marketDynamics:
          buildDynamics({
            pressureScore:
              5,
            deltaPressurePct:
              -32,
            bookImbalancePct:
              28,
          }),
      });

    assert.equal(
      result.status,
      'not-ready',
    );

    assert.ok(
      result.blockingCount >= 1,
    );

    assert.match(
      result.summary,
      /против LONG/u,
    );
  },
);

test(
  'keeps the setup collecting without fabricating confirmation',
  () => {
    const result =
      buildWorkspaceSetupConfirmation({
        direction:
          'long',
        marketDynamics:
          buildDynamics({
            freshness: {
              state:
                'collecting',
            },
            pressureScore:
              null,
            deltaPressurePct:
              null,
            bookImbalancePct:
              null,
            hasTapeData:
              false,
            hasOrderBookData:
              false,
          }),
      });

    assert.equal(
      result.freshness.state,
      'collecting',
    );

    assert.equal(
      result.status,
      'not-ready',
    );

    assert.equal(
      result.directionalPressurePct,
      null,
    );

    assert.equal(
      result.isLiveConfirmation,
      false,
    );
  },
);

test(
  'preserves cached confirmed evidence while marking the result stale',
  () => {
    const result =
      buildWorkspaceSetupConfirmation({
        direction:
          'long',
        marketDynamics:
          buildDynamics({
            freshness: {
              state:
                'stale',
            },
          }),
      });

    assert.equal(
      result.freshness.state,
      'stale',
    );

    assert.equal(
      result.status,
      'confirmed',
    );

    assert.equal(
      result.isLiveConfirmation,
      false,
    );

    assert.match(
      result.summary,
      /сохранено/u,
    );
  },
);

test(
  'reports an error without live evidence',
  () => {
    const result =
      buildWorkspaceSetupConfirmation({
        direction:
          'short',
        marketDynamics:
          buildDynamics({
            freshness: {
              state:
                'error',
            },
            pressureScore:
              null,
            deltaPressurePct:
              null,
            bookImbalancePct:
              null,
            hasTapeData:
              false,
            hasOrderBookData:
              false,
          }),
      });

    assert.equal(
      result.freshness.state,
      'error',
    );

    assert.equal(
      result.status,
      'not-ready',
    );

    assert.equal(
      result.supportCount,
      0,
    );
  },
);

test(
  'exposes deterministic check details for UI integration',
  () => {
    const result =
      buildWorkspaceSetupConfirmation({
        direction:
          'long',
        marketDynamics:
          buildDynamics(),
      });

    assert.deepEqual(
      result.checks.map(
        (check) =>
          check.id,
      ),
      [
        'trade-flow',
        'order-book',
        'agreement',
        'combined-pressure',
      ],
    );

    assert.equal(
      result.reasons.length,
      4,
    );

    assert.ok(
      result.reasons.every(
        (reason) =>
          reason.length > 0,
      ),
    );
  },
);
