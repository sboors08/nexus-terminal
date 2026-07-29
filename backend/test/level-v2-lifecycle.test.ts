import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_LEVEL_V2_LIFECYCLE_OPTIONS,
  LevelV2LifecycleRegistry,
  evaluateLevelV2Lifecycle,
  registerLevelV2Lifecycle,
} from '../src/modules/setup-engine/level-v2/level-v2-lifecycle.js';
import type {
  LevelV2LifecycleObservation,
  LevelV2LifecycleOptions,
  LevelV2LifecycleState,
} from '../src/modules/setup-engine/level-v2/level-v2-lifecycle.types.js';
import type {
  LevelV2DetectedZone,
  LevelV2Kind,
  LevelV2TouchEvent,
} from '../src/modules/setup-engine/level-v2/level-v2-zones-score.types.js';

const baseTime = Date.parse('2026-07-01T00:00:00.000Z');

function must<T>(
  value: T | null | undefined,
): T {
  if (value === null || value === undefined) {
    throw new Error('Expected value');
  }
  return value;
}

function iso(index: number): string {
  return new Date(baseTime + index * 60_000 + 59_999).toISOString();
}

function touch(
  index: number,
  kind: LevelV2Kind,
): LevelV2TouchEvent {
  return {
    id: `touch-${kind}-${index}`,
    kind: kind === 'resistance' ? 'swing_high' : 'swing_low',
    extremumIds: [`extremum-${kind}-${index}`],
    representativeExtremumId: `extremum-${kind}-${index}`,
    firstCandleIndex: index,
    lastCandleIndex: index,
    occurredAt: iso(index),
    extremePrice: 100,
    qualityScore: 80,
  };
}

function level(
  kind: LevelV2Kind = 'resistance',
  touchIndexes: readonly number[] = [5, 10, 15],
  id = `BTCUSDT-1m-level-v2-${kind}`,
): LevelV2DetectedZone {
  const touches = touchIndexes.map((index) => touch(index, kind));
  const first = touchIndexes[0] ?? 0;
  const last = touchIndexes.at(-1) ?? first;
  return {
    id,
    version: 2,
    symbol: 'BTCUSDT',
    timeframe: '1m',
    kind,
    sourceKind: kind === 'resistance' ? 'swing_high' : 'swing_low',
    zone: kind === 'resistance'
      ? {
          referencePrice: 100,
          coreLow: 99.8,
          coreHigh: 100.2,
          outerLow: 99.5,
          outerHigh: 100.5,
          liquidityLow: 100.5,
          liquidityHigh: 101,
          widthPct: 1,
          widthAtr: 0.5,
        }
      : {
          referencePrice: 100,
          coreLow: 99.8,
          coreHigh: 100.2,
          outerLow: 99.5,
          outerHigh: 100.5,
          liquidityLow: 99,
          liquidityHigh: 99.5,
          widthPct: 1,
          widthAtr: 0.5,
        },
    touches,
    touchesCount: touches.length,
    firstTouchAt: iso(first),
    lastTouchAt: iso(last),
    firstTouchCandleIndex: first,
    lastTouchCandleIndex: last,
    cleanliness: {
      closesInsideRatio: 0.1,
      closesAboveRatio: kind === 'resistance' ? 0.05 : 0.8,
      closesBelowRatio: kind === 'support' ? 0.05 : 0.8,
      crossingsCount: 1,
      timeInsideCandles: 2,
      rangeEdgePosition: kind === 'resistance' ? 0.9 : 0.1,
      isAcceptanceZone: false,
    },
    score: {
      total: 80,
      touches: 75,
      reactions: 90,
      cleanliness: 90,
      spacing: 80,
      freshness: 90,
      precision: 85,
      structureEdge: 90,
    },
  };
}

function observation(
  candleIndex: number,
  open: number,
  high: number,
  low: number,
  close: number,
  isClosed = true,
): LevelV2LifecycleObservation {
  return {
    symbol: 'BTCUSDT',
    timeframe: '1m',
    candleIndex,
    openTime: new Date(baseTime + candleIndex * 60_000).toISOString(),
    closeTime: iso(candleIndex),
    open,
    high,
    low,
    close,
    isClosed,
  };
}

function options(
  overrides: Partial<LevelV2LifecycleOptions> = {},
): LevelV2LifecycleOptions {
  return {
    ...DEFAULT_LEVEL_V2_LIFECYCLE_OPTIONS,
    ...overrides,
  };
}

function register(
  levelValue: LevelV2DetectedZone,
  index = 20,
  customOptions = options(),
): LevelV2LifecycleState {
  return registerLevelV2Lifecycle(
    levelValue,
    index,
    iso(index),
    customOptions,
  ).state;
}

function apply(
  state: LevelV2LifecycleState,
  item: LevelV2LifecycleObservation,
  customOptions = options(),
): LevelV2LifecycleState {
  const result = must(evaluateLevelV2Lifecycle(state, item, customOptions));
  return result.state;
}

function breakResistance(
  customOptions = options(),
): LevelV2LifecycleState {
  let state = register(level(), 20, customOptions);
  state = apply(state, observation(21, 100.4, 100.9, 100.3, 100.7), customOptions);
  return apply(state, observation(22, 100.7, 101, 100.6, 100.8), customOptions);
}

function breakSupport(
  customOptions = options(),
): LevelV2LifecycleState {
  let state = register(level('support'), 20, customOptions);
  state = apply(state, observation(21, 99.6, 99.7, 99.1, 99.3), customOptions);
  return apply(state, observation(22, 99.3, 99.4, 98.9, 99.2), customOptions);
}

test('registers a two-touch level as forming and setup-ineligible', () => {
  const registration = registerLevelV2Lifecycle(
    level('resistance', [5, 10]),
    20,
    iso(20),
  );
  assert.equal(registration.state.status, 'forming');
  assert.equal(registration.state.eligibleForSetups, false);
  assert.equal(registration.event.reason, 'initial_forming');
});

test('registers a three-touch level as active and setup-eligible', () => {
  const registration = registerLevelV2Lifecycle(level(), 20, iso(20));
  assert.equal(registration.state.status, 'active');
  assert.equal(registration.state.eligibleForSetups, true);
  assert.equal(registration.event.reason, 'initial_active');
});

test('moves an active level into testing when price enters the outer zone', () => {
  const state = register(level());
  const result = must(evaluateLevelV2Lifecycle(
    state,
    observation(21, 99.4, 100.2, 99.2, 99.8),
  ));
  assert.equal(result.state.status, 'testing');
  assert.equal(result.state.eligibleForSetups, true);
  assert.equal(result.event?.type, 'test_started');
});

test('promotes a forming level after a third independent touch and reaction', () => {
  const state = register(level('resistance', [5, 10]));
  const result = must(evaluateLevelV2Lifecycle(
    state,
    observation(21, 99.6, 100.2, 99.2, 99.3),
  ));
  assert.equal(result.state.status, 'active');
  assert.equal(result.state.qualifiedTouchesCount, 3);
  assert.equal(result.event?.type, 'activated');
});

test('does not count an adjacent candle as another independent touch', () => {
  const state = register(level('resistance', [5, 19]), 20);
  const result = must(evaluateLevelV2Lifecycle(
    state,
    observation(21, 99.6, 100.1, 99.2, 99.3),
  ));
  assert.equal(result.state.qualifiedTouchesCount, 2);
  assert.equal(result.state.status, 'forming');
});

test('does not treat a wick beyond liquidity as a confirmed break', () => {
  const state = register(level());
  const result = must(evaluateLevelV2Lifecycle(
    state,
    observation(21, 100.1, 101.4, 99.8, 100.4),
  ));
  assert.notEqual(result.state.status, 'broken');
  assert.equal(result.state.breakClosesCount, 0);
});

test('keeps a level alive after only one acceptance close', () => {
  const state = register(level());
  const result = must(evaluateLevelV2Lifecycle(
    state,
    observation(21, 100.4, 100.9, 100.3, 100.7),
  ));
  assert.equal(result.state.status, 'active');
  assert.equal(result.state.breakClosesCount, 1);
  assert.equal(result.event?.type, 'break_progress');
});

test('confirms a break after consecutive closes and ends the line at the first close', () => {
  const state = breakResistance();
  assert.equal(state.status, 'broken');
  assert.equal(state.eligibleForSetups, false);
  assert.equal(state.lineEndCandleIndex, 21);
  assert.equal(state.brokenCandleIndex, 21);
  assert.equal(state.breakConfirmedAt, iso(22));
});

test('does not continue a broken level as setup-eligible', () => {
  const state = breakResistance();
  const next = apply(state, observation(23, 100.9, 101.1, 100.7, 101));
  assert.equal(next.eligibleForSetups, false);
  assert.ok(next.status === 'broken' || next.status === 'retest_pending');
});

test('arms retest pending only after price has moved away from the broken zone', () => {
  const state = breakResistance();
  const next = apply(state, observation(23, 101.2, 101.6, 101.1, 101.4));
  assert.equal(next.status, 'retest_pending');
  assert.equal(next.eligibleForSetups, false);
});

test('does not flip a broken resistance without a retest touch', () => {
  let state = breakResistance();
  state = apply(state, observation(23, 101.2, 101.6, 101.1, 101.4));
  state = apply(state, observation(24, 101.4, 101.8, 101.2, 101.6));
  assert.equal(state.status, 'retest_pending');
  assert.equal(state.currentKind, 'resistance');
});

test('flips broken resistance to support only after retest and upward reaction', () => {
  let state = breakResistance();
  state = apply(state, observation(23, 101.2, 101.6, 101.1, 101.4));
  state = apply(state, observation(24, 101.1, 101.2, 100.2, 100.8));
  assert.equal(state.status, 'flipped');
  assert.equal(state.currentKind, 'support');
  assert.equal(state.eligibleForSetups, true);
  assert.equal(state.flippedLineStartCandleIndex, 24);
});

test('flips broken support to resistance only after retest and downward reaction', () => {
  let state = breakSupport();
  state = apply(state, observation(23, 98.8, 98.9, 98.4, 98.6));
  assert.equal(state.status, 'retest_pending');
  state = apply(state, observation(24, 98.9, 99.8, 98.7, 99.2));
  assert.equal(state.status, 'flipped');
  assert.equal(state.currentKind, 'resistance');
  assert.equal(state.eligibleForSetups, true);
});

test('ignores an open candle without mutating lifecycle progress', () => {
  const state = register(level());
  const result = evaluateLevelV2Lifecycle(
    state,
    observation(21, 100.4, 101.2, 100.2, 100.8, false),
  );
  assert.equal(result, null);
  assert.equal(state.lastProcessedCandleIndex, 20);
});

test('expires an old active level', () => {
  const customOptions = options({
    maxActiveAgeCandles: 3,
  });
  const state = register(level(), 20, customOptions);
  const next = apply(
    state,
    observation(23, 98.8, 99.1, 98.5, 98.9),
    customOptions,
  );
  assert.equal(next.status, 'expired');
  assert.equal(next.eligibleForSetups, false);
});

test('expires a retest pending level when no retest arrives', () => {
  const customOptions = options({
    maxRetestWaitCandles: 3,
  });
  let state = breakResistance(customOptions);
  state = apply(
    state,
    observation(23, 101.2, 101.6, 101.1, 101.4),
    customOptions,
  );
  state = apply(
    state,
    observation(24, 101.3, 101.7, 101.2, 101.5),
    customOptions,
  );
  state = apply(
    state,
    observation(25, 101.4, 101.8, 101.3, 101.6),
    customOptions,
  );
  assert.equal(state.status, 'expired');
});

test('ignores stale and duplicate closed observations', () => {
  const state = register(level());
  assert.equal(
    evaluateLevelV2Lifecycle(
      state,
      observation(20, 99.5, 100, 99, 99.6),
    ),
    null,
  );
});

test('returns testing to its origin status when the testing window expires', () => {
  const customOptions = options({
    maxTestingCandles: 2,
  });
  let state = register(level(), 20, customOptions);
  state = apply(
    state,
    observation(21, 99.6, 100.2, 99.4, 99.8),
    customOptions,
  );
  assert.equal(state.status, 'testing');
  state = apply(
    state,
    observation(23, 99.8, 100.1, 99.6, 99.9),
    customOptions,
  );
  assert.equal(state.status, 'active');
  assert.equal(state.eligibleForSetups, true);
});

test('registry isolates levels and returns defensive state copies', () => {
  const registry = new LevelV2LifecycleRegistry();
  registry.register(level('resistance', [5, 10, 15], 'resistance-a'), 20, iso(20));
  registry.register(level('support', [6, 11, 16], 'support-b'), 20, iso(20));
  registry.observe(
    'resistance-a',
    observation(21, 99.6, 100.2, 99.4, 99.8),
  );
  const resistance = registry.get('resistance-a');
  const support = registry.get('support-b');
  assert.equal(resistance?.status, 'testing');
  assert.equal(support?.status, 'active');
  const checkedResistance = must(resistance);
  checkedResistance.level.zone.outerHigh = 999;
  assert.equal(registry.get('resistance-a')?.level.zone.outerHigh, 100.5);
});

test('registry returns defensive event copies', () => {
  const registry = new LevelV2LifecycleRegistry();
  registry.register(level(), 20, iso(20));
  const events = registry.events();
  assert.equal(events.length, 1);
  const first = must(events[0]);
  first.eligibleForSetups = false;
  assert.equal(registry.events()[0]?.eligibleForSetups, true);
});

test('produces stable lifecycle event identifiers for identical input', () => {
  const first = registerLevelV2Lifecycle(level(), 20, iso(20));
  const second = registerLevelV2Lifecycle(level(), 20, iso(20));
  assert.equal(first.event.id, second.event.id);
  const firstTest = evaluateLevelV2Lifecycle(
    first.state,
    observation(21, 99.6, 100.2, 99.4, 99.8),
  );
  const secondTest = evaluateLevelV2Lifecycle(
    second.state,
    observation(21, 99.6, 100.2, 99.4, 99.8),
  );
  assert.equal(firstTest?.event?.id, secondTest?.event?.id);
});

test('rejects invalid lifecycle options', () => {
  assert.throws(
    () => new LevelV2LifecycleRegistry(options({
      minActiveTouches: 2,
    })),
    /at least three/u,
  );
});
