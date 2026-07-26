import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceSetupEngineState,
  calculateDistanceToLevelPct,
} from '../src/modules/setup-engine/setup-engine.js';
import type {
  SetupEngineState,
} from '../src/modules/setup-engine/setup-engine.types.js';

function buildInitialState(): SetupEngineState {
  return {
    id: 'setup-solusdt-5m-1',
    symbol: 'SOLUSDT',
    timeframe: '5m',
    direction: 'long',
    setupType: 'level_breakout',
    stage: 'LEVEL_CONFIRMED',
    outcome: null,
    level: {
      kind: 'resistance',
      centerPrice: 100,
      zoneLow: 99.5,
      zoneHigh: 100.5,
      touches: 2,
      confirmedAt: '2026-07-26T12:00:00.000Z',
    },
    currentPrice: 97,
    distanceToLevelPct: 3,
    createdAt: '2026-07-26T12:00:00.000Z',
    updatedAt: '2026-07-26T12:00:00.000Z',
    expiresAt: '2026-07-26T13:00:00.000Z',
  };
}

test(
  'calculates absolute distance to the level',
  () => {
    assert.equal(
      calculateDistanceToLevelPct(
        98,
        100,
      ),
      2,
    );

    assert.equal(
      calculateDistanceToLevelPct(
        102,
        100,
      ),
      2,
    );
  },
);

test(
  'advances through the breakout lifecycle',
  () => {
    const approaching =
      advanceSetupEngineState(
        buildInitialState(),
        {
          type: 'APPROACH_DETECTED',
          price: 99,
          occurredAt:
            '2026-07-26T12:05:00.000Z',
        },
      );

    assert.equal(
      approaching.stage,
      'APPROACHING_THIRD_TOUCH',
    );

    assert.equal(
      approaching.distanceToLevelPct,
      1,
    );

    const thirdTouch =
      advanceSetupEngineState(
        approaching,
        {
          type: 'THIRD_TOUCH_DETECTED',
          price: 100,
          occurredAt:
            '2026-07-26T12:06:00.000Z',
        },
      );

    assert.equal(
      thirdTouch.stage,
      'THIRD_TOUCH_CONFIRMED',
    );

    assert.equal(
      thirdTouch.level.touches,
      3,
    );

    const breakout =
      advanceSetupEngineState(
        thirdTouch,
        {
          type: 'BREAKOUT_DETECTED',
          price: 101,
          occurredAt:
            '2026-07-26T12:07:00.000Z',
        },
      );

    assert.equal(
      breakout.stage,
      'BREAKOUT_CONFIRMED',
    );

    assert.equal(
      breakout.outcome,
      'breakout',
    );
  },
);

test(
  'records a confirmed rejection',
  () => {
    const approaching =
      advanceSetupEngineState(
        buildInitialState(),
        {
          type: 'APPROACH_DETECTED',
          price: 99.5,
          occurredAt:
            '2026-07-26T12:05:00.000Z',
        },
      );

    const thirdTouch =
      advanceSetupEngineState(
        approaching,
        {
          type: 'THIRD_TOUCH_DETECTED',
          price: 100,
          occurredAt:
            '2026-07-26T12:06:00.000Z',
        },
      );

    const rejection =
      advanceSetupEngineState(
        thirdTouch,
        {
          type: 'REJECTION_DETECTED',
          price: 98.5,
          occurredAt:
            '2026-07-26T12:07:00.000Z',
        },
      );

    assert.equal(
      rejection.stage,
      'REJECTION_CONFIRMED',
    );

    assert.equal(
      rejection.outcome,
      'rejection',
    );
  },
);

test(
  'expires an active setup',
  () => {
    const expired =
      advanceSetupEngineState(
        buildInitialState(),
        {
          type: 'EXPIRED',
          occurredAt:
            '2026-07-26T13:00:00.000Z',
        },
      );

    assert.equal(
      expired.stage,
      'SETUP_EXPIRED',
    );

    assert.equal(
      expired.outcome,
      null,
    );
  },
);

test(
  'rejects an invalid stage transition',
  () => {
    assert.throws(
      () =>
        advanceSetupEngineState(
          buildInitialState(),
          {
            type: 'BREAKOUT_DETECTED',
            price: 101,
            occurredAt:
              '2026-07-26T12:05:00.000Z',
          },
        ),
      /Invalid Setup Engine transition/,
    );
  },
);

test(
  'rejects an event older than the state',
  () => {
    assert.throws(
      () =>
        advanceSetupEngineState(
          buildInitialState(),
          {
            type: 'APPROACH_DETECTED',
            price: 99,
            occurredAt:
              '2026-07-26T11:59:00.000Z',
          },
        ),
      /cannot occur before/,
    );
  },
);
