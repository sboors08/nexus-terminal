import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCausalLevelLinesView,
} from '../node_modules/.tmp/realtime-test/level-lines/model/causalLevelLines.js';

function buildSnapshot(
  status,
) {
  const line = {
    id:
      'BTCUSDT-5m-line-resistance-1',
    symbol:
      'BTCUSDT',
    timeframe:
      '5m',
    price:
      102,
    kind:
      'resistance',
    originCandleIndex:
      0,
    originExtremumAt:
      '2026-08-07T12:00:00.000Z',
    originExtremumPrice:
      102,
    activeFrom:
      '2026-08-07T12:00:59.999Z',
    confirmedAt:
      '2026-08-07T12:01:59.999Z',
    touchCount:
      2,
    status:
      'confirmed',
    workedAt:
      null,
    supersededAt:
      null,
    supersessionEvidence:
      null,
    brokenAt:
      null,
    breakEvidence:
      null,
  };
  const approach = {
    lineId:
      line.id,
    symbol:
      line.symbol,
    timeframe:
      line.timeframe,
    kind:
      line.kind,
    levelPrice:
      line.price,
    currentPrice:
      101.9,
    currentCandleIndex:
      1,
    currentCandleOpenTime:
      '2026-08-07T12:01:00.000Z',
    observedAt:
      '2026-08-07T12:01:59.999Z',
    observationProgress:
      1,
    observationStage:
      'OBSERVATION',
    distanceToLevelPercent:
      0.1,
    maxDistanceToLevelPercent:
      0.5,
    stage:
      'APPROACH',
  };
  const confirmation = {
    lineId:
      line.id,
    symbol:
      line.symbol,
    timeframe:
      line.timeframe,
    kind:
      line.kind,
    levelPrice:
      line.price,
    currentPrice:
      approach.currentPrice,
    currentCandleIndex:
      approach.currentCandleIndex,
    currentCandleOpenTime:
      approach.currentCandleOpenTime,
    observedAt:
      approach.observedAt,
    approachStage:
      'APPROACH',
    interactionDirection:
      'up',
    approachSideValid:
      true,
    candleIntersectsLevelZone:
      true,
    tapePressurePercent:
      12,
    directionalTapePressurePercent:
      12,
    tapeState:
      status === 'collecting'
        ? 'unavailable'
        : 'supports',
    orderBookImbalancePercent:
      status === 'confirmed'
        ? 9
        : 1,
    directionalOrderBookPressurePercent:
      status === 'confirmed'
        ? 9
        : 1,
    orderBookState:
      status === 'confirmed'
        ? 'supports'
        : status === 'collecting'
          ? 'unavailable'
          : 'neutral',
    status,
    stage:
      status === 'confirmed'
        ? 'CONFIRMATION'
        : null,
    reasons:
      status === 'confirmed'
        ? ['trade_flow_and_order_book_support_interaction']
        : status === 'partial'
          ? ['one_live_source_supports_interaction']
          : ['tape_collecting'],
  };

  return {
    closedCandlesCount:
      1,
    candles: [
      {
        openTime:
          '2026-08-07T12:01:00.000Z',
        closeTime:
          '2026-08-07T12:01:59.999Z',
        open:
          101.5,
        high:
          102.1,
        low:
          101.4,
        close:
          101.9,
        volume:
          1_000,
        tradesCount:
          100,
        isClosed:
          true,
      },
    ],
    activeLevels: [
      line,
    ],
    lines: [
      line,
    ],
    observationTracking: {
      currentPrice:
        101.9,
      activeProgress: [],
    },
    approachEvaluation: {
      currentPrice:
        101.9,
      evaluations: [
        approach,
      ],
    },
    realtimeConfirmation: {
      evaluations: [
        confirmation,
      ],
    },
    appliedOptions: {
      touchTolerancePercent:
        0.15,
    },
  };
}

test(
  'promotes only backend confirmed evidence to the Confirmation stage',
  () => {
    const view =
      buildCausalLevelLinesView(
        buildSnapshot('confirmed'),
        [],
      );
    const state =
      view.primaryStates[0];

    assert.equal(
      state?.stage,
      'CONFIRMATION',
    );
    assert.equal(
      state?.realtimeConfirmation?.status,
      'confirmed',
    );
    assert.equal(
      view.horizontalSegments[0]?.title,
      'CONFIRMATION',
    );
  },
);

test(
  'keeps partial backend evidence in Approach while preserving its status',
  () => {
    const state =
      buildCausalLevelLinesView(
        buildSnapshot('partial'),
        [],
      ).primaryStates[0];

    assert.equal(
      state?.stage,
      'APPROACH',
    );
    assert.equal(
      state?.realtimeConfirmation?.status,
      'partial',
    );
  },
);

test(
  'does not invent confirmation while backend evidence is collecting',
  () => {
    const state =
      buildCausalLevelLinesView(
        buildSnapshot('collecting'),
        [],
      ).primaryStates[0];

    assert.equal(
      state?.stage,
      'APPROACH',
    );
    assert.equal(
      state?.realtimeConfirmation?.status,
      'collecting',
    );
  },
);

test(
  'focuses the causal level nearest the live price regardless of the stale setup direction',
  () => {
    const snapshot =
      buildSnapshot('collecting');
    const resistance =
      snapshot.activeLevels[0];
    const support = {
      ...resistance,
      id:
        'BTCUSDT-5m-line-support-1',
      price:
        100,
      kind:
        'support',
      originExtremumPrice:
        100,
      touchCount:
        2,
    };

    resistance.price =
      108;
    resistance.originExtremumPrice =
      108;
    resistance.touchCount =
      1;
    snapshot.activeLevels = [
      resistance,
      support,
    ];
    snapshot.lines = [
      resistance,
      support,
    ];
    snapshot.candles[0].close =
      100.4;
    snapshot.approachEvaluation.currentPrice =
      100.4;
    snapshot.observationTracking.currentPrice =
      100.4;

    const view =
      buildCausalLevelLinesView(
        snapshot,
        [],
      );

    assert.equal(
      view.focusState?.line.kind,
      'support',
    );
    assert.equal(
      view.focusState?.line.price,
      100,
    );
    assert.equal(
      view.focusState?.line.touchCount,
      2,
    );
  },
);

test(
  'marks a live move beyond the causal zone as a breakout attempt without inventing an outcome',
  () => {
    const snapshot =
      buildSnapshot('confirmed');

    snapshot.activeLevels[0].kind =
      'support';

    const liveCandle = {
      ...snapshot.candles[0],
      close:
        101.5,
      isClosed:
        false,
    };
    const state =
      buildCausalLevelLinesView(
        snapshot,
        [liveCandle],
      ).focusState;

    assert.equal(
      state?.interactionState,
      'break_attempt',
    );
    assert.equal(
      state?.currentPrice,
      101.5,
    );
    assert.equal(
      state?.stage,
      'CONFIRMATION',
    );
    assert.ok(
      state?.currentPrice
      < state?.zoneLow,
    );
  },
);

test(
  'exposes only a recent backend-broken line as a confirmed breakout outcome',
  () => {
    const snapshot =
      buildSnapshot('confirmed');
    const line =
      snapshot.lines[0];

    line.status =
      'broken';
    line.brokenAt =
      '2026-08-07T12:01:59.999Z';
    line.breakEvidence = {
      mode:
        'consecutive_closes',
      fromKind:
        line.kind,
      candleIndex:
        0,
      brokenAt:
        line.brokenAt,
      boundary:
        line.price,
      close:
        102.4,
      distanceBeyondBoundary:
        0.4,
      distanceBeyondBoundaryAtr:
        0.5,
    };
    snapshot.activeLevels = [];

    const view =
      buildCausalLevelLinesView(
        snapshot,
        [],
      );

    assert.equal(
      view.states.length,
      0,
    );
    assert.equal(
      view.confirmedBreakoutStates[0]
        ?.interactionState,
      'break_confirmed',
    );
    assert.equal(
      view.confirmedBreakoutStates[0]
        ?.line.id,
      line.id,
    );
  },
);
