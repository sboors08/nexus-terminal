import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceSetupEngineState,
} from '../src/modules/setup-engine/setup-engine.js';
import {
  evaluateSetupStage,
} from '../src/modules/setup-engine/setup-stage-evaluator.js';
import type {
  SetupStageMarketObservation,
} from '../src/modules/setup-engine/setup-stage-evaluator.types.js';
import type {
  SetupEngineLevelKind,
  SetupEngineSetupType,
  SetupEngineStage,
  SetupEngineState,
} from '../src/modules/setup-engine/setup-engine.types.js';

function buildState(
  input: {
    levelKind?:
      SetupEngineLevelKind;
    setupType?:
      SetupEngineSetupType;
    stage?:
      SetupEngineStage;
    updatedAt?: string;
    expiresAt?: string;
  } = {},
): SetupEngineState {
  const levelKind =
    input.levelKind
    ?? 'resistance';

  const setupType =
    input.setupType
    ?? 'level_breakout';

  return {
    id:
      `setup-solusdt-${levelKind}-${setupType}`,
    symbol: 'SOLUSDT',
    timeframe: '1m',
    setupType,
    direction:
      levelKind === 'resistance'
        ? setupType
          === 'level_breakout'
            ? 'long'
            : 'short'
        : setupType
          === 'level_breakout'
            ? 'short'
            : 'long',
    stage:
      input.stage
      ?? 'LEVEL_CONFIRMED',
    outcome: null,
    level: {
      kind:
        levelKind,
      centerPrice: 100,
      zoneLow: 99.8,
      zoneHigh: 100.2,
      touches:
        input.stage
          === 'THIRD_TOUCH_CONFIRMED'
            ? 3
            : 2,
      confirmedAt:
        '2026-07-26T12:00:00.000Z',
    },
    currentPrice:
      levelKind
        === 'resistance'
          ? 98
          : 102,
    distanceToLevelPct: 2,
    createdAt:
      '2026-07-26T12:00:00.000Z',
    updatedAt:
      input.updatedAt
      ?? '2026-07-26T12:00:00.000Z',
    expiresAt:
      input.expiresAt
      ?? '2026-07-26T13:00:00.000Z',
  };
}

function buildObservation(
  input: {
    currentPrice?: number;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    isClosed?: boolean;
    minute?: number;
    evaluatedAt?: string;
    symbol?: string;
  } = {},
): SetupStageMarketObservation {
  const minute =
    input.minute
    ?? 5;

  const openTime =
    `2026-07-26T12:${String(minute).padStart(2, '0')}:00.000Z`;

  const closeTime =
    `2026-07-26T12:${String(minute).padStart(2, '0')}:59.999Z`;

  const observedAt =
    input.isClosed === false
      ? `2026-07-26T12:${String(minute).padStart(2, '0')}:30.000Z`
      : closeTime;

  return {
    symbol:
      input.symbol
      ?? 'SOLUSDT',
    openTime,
    closeTime,
    open:
      input.open
      ?? 99.5,
    high:
      input.high
      ?? 100.1,
    low:
      input.low
      ?? 99.4,
    close:
      input.close
      ?? 99.9,
    currentPrice:
      input.currentPrice
      ?? input.close
      ?? 99.9,
    isClosed:
      input.isClosed
      ?? true,
    observedAt,
    evaluatedAt:
      input.evaluatedAt
      ?? observedAt,
  };
}

test(
  'detects a resistance approach only from below',
  () => {
    const state =
      buildState();

    const approach =
      evaluateSetupStage(
        state,
        buildObservation({
          currentPrice: 99.5,
          close: 99.5,
        }),
      );

    assert.equal(
      approach?.type,
      'APPROACH_DETECTED',
    );

    const wrongSide =
      evaluateSetupStage(
        state,
        buildObservation({
          currentPrice: 100.3,
          open: 100.3,
          high: 100.4,
          low: 100.25,
          close: 100.3,
        }),
      );

    assert.equal(
      wrongSide,
      null,
    );
  },
);

test(
  'detects a support approach only from above',
  () => {
    const state =
      buildState({
        levelKind:
          'support',
      });

    const approach =
      evaluateSetupStage(
        state,
        buildObservation({
          currentPrice: 100.5,
          open: 100.5,
          high: 100.6,
          low: 100.4,
          close: 100.5,
        }),
      );

    assert.equal(
      approach?.type,
      'APPROACH_DETECTED',
    );

    const wrongSide =
      evaluateSetupStage(
        state,
        buildObservation({
          currentPrice: 99.7,
          open: 99.7,
          high: 99.75,
          low: 99.6,
          close: 99.7,
        }),
      );

    assert.equal(
      wrongSide,
      null,
    );
  },
);

test(
  'confirms a third touch only from a closed candle intersecting the zone',
  () => {
    const state =
      buildState({
        stage:
          'APPROACHING_THIRD_TOUCH',
        updatedAt:
          '2026-07-26T12:04:59.999Z',
      });

    const unfinished =
      evaluateSetupStage(
        state,
        buildObservation({
          isClosed: false,
          minute: 5,
        }),
      );

    assert.equal(
      unfinished,
      null,
    );

    const closed =
      evaluateSetupStage(
        state,
        buildObservation({
          minute: 5,
          open: 99.8,
          high: 100.1,
          low: 99.7,
          close: 99.9,
        }),
      );

    assert.equal(
      closed?.type,
      'THIRD_TOUCH_DETECTED',
    );
  },
);

test(
  'advances a resistance breakout through the full lifecycle',
  () => {
    let state =
      buildState({
        levelKind:
          'resistance',
        setupType:
          'level_breakout',
      });

    const approach =
      evaluateSetupStage(
        state,
        buildObservation({
          minute: 5,
          currentPrice: 99.5,
          close: 99.5,
        }),
      );

    assert.ok(approach);

    state =
      advanceSetupEngineState(
        state,
        approach,
      );

    const thirdTouch =
      evaluateSetupStage(
        state,
        buildObservation({
          minute: 6,
          open: 99.7,
          high: 100.15,
          low: 99.6,
          close: 100,
          currentPrice: 100,
        }),
      );

    assert.ok(thirdTouch);

    state =
      advanceSetupEngineState(
        state,
        thirdTouch,
      );

    const breakout =
      evaluateSetupStage(
        state,
        buildObservation({
          minute: 7,
          open: 100.1,
          high: 100.5,
          low: 100,
          close: 100.3,
          currentPrice: 100.3,
        }),
      );

    assert.equal(
      breakout?.type,
      'BREAKOUT_DETECTED',
    );

    assert.ok(breakout);

    state =
      advanceSetupEngineState(
        state,
        breakout,
      );

    assert.equal(
      state.stage,
      'BREAKOUT_CONFIRMED',
    );

    assert.equal(
      state.outcome,
      'breakout',
    );
  },
);

test(
  'confirms a support breakout below the level zone',
  () => {
    const event =
      evaluateSetupStage(
        buildState({
          levelKind:
            'support',
          setupType:
            'level_breakout',
          stage:
            'THIRD_TOUCH_CONFIRMED',
          updatedAt:
            '2026-07-26T12:06:59.999Z',
        }),
        buildObservation({
          minute: 7,
          open: 99.9,
          high: 100,
          low: 99.5,
          close: 99.7,
          currentPrice: 99.7,
        }),
      );

    assert.equal(
      event?.type,
      'BREAKOUT_DETECTED',
    );
  },
);

test(
  'confirms a resistance rejection for a bounce setup',
  () => {
    const event =
      evaluateSetupStage(
        buildState({
          levelKind:
            'resistance',
          setupType:
            'level_bounce',
          stage:
            'THIRD_TOUCH_CONFIRMED',
          updatedAt:
            '2026-07-26T12:06:59.999Z',
        }),
        buildObservation({
          minute: 7,
          open: 99.9,
          high: 100,
          low: 99.4,
          close: 99.6,
          currentPrice: 99.6,
        }),
      );

    assert.equal(
      event?.type,
      'REJECTION_DETECTED',
    );
  },
);

test(
  'confirms a support rejection for a bounce setup',
  () => {
    const event =
      evaluateSetupStage(
        buildState({
          levelKind:
            'support',
          setupType:
            'level_bounce',
          stage:
            'THIRD_TOUCH_CONFIRMED',
          updatedAt:
            '2026-07-26T12:06:59.999Z',
        }),
        buildObservation({
          minute: 7,
          open: 100.1,
          high: 100.5,
          low: 100,
          close: 100.4,
          currentPrice: 100.4,
        }),
      );

    assert.equal(
      event?.type,
      'REJECTION_DETECTED',
    );
  },
);

test(
  'does not resolve a setup using the opposite hypothesis',
  () => {
    const breakoutCandidate =
      buildState({
        setupType:
          'level_breakout',
        stage:
          'THIRD_TOUCH_CONFIRMED',
        updatedAt:
          '2026-07-26T12:06:59.999Z',
      });

    const rejectionMove =
      evaluateSetupStage(
        breakoutCandidate,
        buildObservation({
          minute: 7,
          open: 99.9,
          high: 100,
          low: 99.4,
          close: 99.6,
          currentPrice: 99.6,
        }),
      );

    assert.equal(
      rejectionMove,
      null,
    );

    const bounceCandidate =
      buildState({
        setupType:
          'level_bounce',
        stage:
          'THIRD_TOUCH_CONFIRMED',
        updatedAt:
          '2026-07-26T12:06:59.999Z',
      });

    const breakoutMove =
      evaluateSetupStage(
        bounceCandidate,
        buildObservation({
          minute: 7,
          open: 100.1,
          high: 100.5,
          low: 100,
          close: 100.3,
          currentPrice: 100.3,
        }),
      );

    assert.equal(
      breakoutMove,
      null,
    );
  },
);

test(
  'expires an active setup using evaluation time',
  () => {
    const event =
      evaluateSetupStage(
        buildState({
          expiresAt:
            '2026-07-26T12:05:30.000Z',
        }),
        buildObservation({
          minute: 5,
          isClosed: false,
          evaluatedAt:
            '2026-07-26T12:05:30.000Z',
        }),
      );

    assert.deepEqual(
      event,
      {
        type: 'EXPIRED',
        occurredAt:
          '2026-07-26T12:05:30.000Z',
      },
    );
  },
);

test(
  'ignores duplicate and stale market observations',
  () => {
    const duplicate =
      evaluateSetupStage(
        buildState({
          updatedAt:
            '2026-07-26T12:05:59.999Z',
        }),
        buildObservation({
          minute: 5,
        }),
      );

    assert.equal(
      duplicate,
      null,
    );

    const oldObservation =
      evaluateSetupStage(
        buildState(),
        buildObservation({
          minute: 5,
          evaluatedAt:
            '2026-07-26T12:08:01.000Z',
        }),
      );

    assert.equal(
      oldObservation,
      null,
    );
  },
);

test(
  'returns no event for a terminal setup',
  () => {
    const event =
      evaluateSetupStage(
        buildState({
          stage:
            'BREAKOUT_CONFIRMED',
        }),
        buildObservation(),
      );

    assert.equal(
      event,
      null,
    );
  },
);

test(
  'rejects invalid options and malformed observations',
  () => {
    assert.throws(
      () =>
        evaluateSetupStage(
          buildState(),
          buildObservation(),
          {
            approachDistancePct:
              -1,
            breakoutConfirmationPct:
              0.05,
            rejectionConfirmationPct:
              0.1,
            maxObservationAgeSec:
              120,
          },
        ),
      /approachDistancePct/,
    );

    assert.throws(
      () =>
        evaluateSetupStage(
          buildState(),
          buildObservation({
            symbol:
              'ETHUSDT',
          }),
        ),
      /must match setup symbol/,
    );

    assert.throws(
      () =>
        evaluateSetupStage(
          buildState(),
          buildObservation({
            open: 101,
            high: 100,
            low: 99,
            close: 99.5,
          }),
        ),
      /invalid OHLC/,
    );
  },
);
