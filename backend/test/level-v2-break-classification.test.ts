import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_LEVEL_V2_BREAK_CLASSIFICATION_OPTIONS,
  evaluateLevelV2BreakClassification,
  registerLevelV2BreakClassification,
} from '../src/modules/setup-engine/level-v2/level-v2-break-classification.js';
import type {
  LevelV2BreakClassificationObservation,
  LevelV2BreakClassificationOptions,
  LevelV2BreakClassificationState,
} from '../src/modules/setup-engine/level-v2/level-v2-break-classification.types.js';
import type {
  LevelV2TouchEvent,
} from '../src/modules/setup-engine/level-v2/level-v2.types.js';
import type {
  LevelV2DetectedZone,
  LevelV2Kind,
} from '../src/modules/setup-engine/level-v2/level-v2-zones-score.types.js';

const baseTime = Date.parse('2026-07-01T00:00:00.000Z');

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected value');
  }
  return value;
}

function iso(index: number): string {
  return new Date(baseTime + index * 60_000 + 59_999).toISOString();
}

function openIso(index: number): string {
  return new Date(baseTime + index * 60_000).toISOString();
}

function touch(index: number, kind: LevelV2Kind): LevelV2TouchEvent {
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

function level(kind: LevelV2Kind = 'resistance'): LevelV2DetectedZone {
  const touches = [touch(5, kind), touch(10, kind), touch(15, kind)];
  return {
    id: `BTCUSDT-1m-level-v2-${kind}`,
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
    firstTouchAt: iso(5),
    lastTouchAt: iso(15),
    firstTouchCandleIndex: 5,
    lastTouchCandleIndex: 15,
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
): LevelV2BreakClassificationObservation {
  return {
    symbol: 'BTCUSDT',
    timeframe: '1m',
    candleIndex,
    openTime: openIso(candleIndex),
    closeTime: iso(candleIndex),
    open,
    high,
    low,
    close,
    isClosed,
  };
}

function options(
  overrides: Partial<LevelV2BreakClassificationOptions> = {},
): LevelV2BreakClassificationOptions {
  return {
    ...DEFAULT_LEVEL_V2_BREAK_CLASSIFICATION_OPTIONS,
    ...overrides,
  };
}

function register(
  kind: LevelV2Kind = 'resistance',
  customOptions = options(),
): LevelV2BreakClassificationState {
  return registerLevelV2BreakClassification(
    level(kind),
    20,
    iso(20),
    kind,
    customOptions,
  ).state;
}

function apply(
  state: LevelV2BreakClassificationState,
  item: LevelV2BreakClassificationObservation,
  customOptions = options(),
): ReturnType<typeof evaluateLevelV2BreakClassification> {
  return must(evaluateLevelV2BreakClassification(state, item, customOptions));
}

test('registers idle state with a bounded registration event', () => {
  const result = registerLevelV2BreakClassification(level(), 20, iso(20));
  assert.equal(result.state.status, 'idle');
  assert.equal(result.event.type, 'registered');
  assert.equal(result.state.events.length, 1);
});

test('classifies a wick beyond resistance as pierce', () => {
  const result = must(apply(
    register(),
    observation(21, 100.1, 101.1, 99.9, 100.4),
  ));
  assert.equal(result.state.status, 'pierce');
  assert.equal(result.event?.type, 'pierce_detected');
  assert.equal(result.event?.evidence?.acceptanceClose, false);
  assert.ok((result.event?.evidence?.penetrationDepthPct ?? 0) > 0.5);
});

test('classifies the first acceptance close as breakout pending', () => {
  const result = must(apply(
    register(),
    observation(21, 100.4, 101, 100.3, 100.7),
  ));
  assert.equal(result.state.status, 'breakout_pending');
  assert.equal(result.state.acceptanceClosesCount, 1);
  assert.equal(result.event?.type, 'breakout_pending');
});

test('confirms a breakout after consecutive acceptance closes', () => {
  let state = must(apply(
    register(),
    observation(21, 100.4, 101, 100.3, 100.7),
  )).state;
  const result = must(apply(
    state,
    observation(22, 100.7, 101.2, 100.6, 100.9),
  ));
  assert.equal(result.state.status, 'breakout_confirmed');
  assert.equal(result.state.acceptanceClosesCount, 2);
  assert.equal(result.event?.type, 'breakout_confirmed');
  assert.equal(result.state.firstAcceptanceCandleIndex, 21);
  assert.equal(result.state.breakoutConfirmedCandleIndex, 22);
});

test('restarts pending sequence when acceptance closes are not consecutive', () => {
  const state = must(apply(
    register(),
    observation(21, 100.4, 101, 100.3, 100.7),
  )).state;
  const result = must(apply(
    state,
    observation(23, 100.7, 101.2, 100.6, 100.9),
  ));
  assert.equal(result.state.status, 'breakout_pending');
  assert.equal(result.state.acceptanceClosesCount, 1);
  assert.equal(result.state.firstAcceptanceCandleIndex, 23);
  assert.equal(result.event?.reason, 'acceptance_sequence_broken');
});

test('classifies return inside after pending close as false breakout', () => {
  const state = must(apply(
    register(),
    observation(21, 100.4, 101, 100.3, 100.7),
  )).state;
  const result = must(apply(
    state,
    observation(22, 100.6, 100.8, 99.9, 100.2),
  ));
  assert.equal(result.state.status, 'false_breakout');
  assert.equal(result.event?.type, 'false_breakout');
  assert.equal(result.event?.reason, 'returned_inside_zone');
  assert.equal(result.event?.evidence?.acceptanceClosesCount, 1);
});

test('classifies a quick return after confirmed break as false breakout', () => {
  let state = must(apply(
    register(),
    observation(21, 100.4, 101, 100.3, 100.7),
  )).state;
  state = must(apply(
    state,
    observation(22, 100.7, 101.2, 100.6, 100.9),
  )).state;
  const result = must(apply(
    state,
    observation(23, 100.8, 101, 99.8, 100.1),
  ));
  assert.equal(result.state.status, 'false_breakout');
  assert.equal(result.event?.reason, 'quick_return_inside_zone');
});

test('keeps a confirmed break after the false-breakout window', () => {
  const customOptions = options({
    falseBreakoutMaxCandles: 2,
  });
  let state = must(apply(
    register('resistance', customOptions),
    observation(21, 100.4, 101, 100.3, 100.7),
    customOptions,
  )).state;
  state = must(apply(
    state,
    observation(22, 100.7, 101.2, 100.6, 100.9),
    customOptions,
  )).state;
  const result = must(apply(
    state,
    observation(25, 100.8, 101, 99.8, 100.1),
    customOptions,
  ));
  assert.equal(result.state.status, 'breakout_confirmed');
  assert.equal(result.event, null);
});

test('supports mirrored support breakdown classification', () => {
  let state = must(apply(
    register('support'),
    observation(21, 99.6, 99.7, 99, 99.3),
  )).state;
  const result = must(apply(
    state,
    observation(22, 99.3, 99.4, 98.8, 99.1),
  ));
  assert.equal(result.state.status, 'breakout_confirmed');
  assert.equal(result.event?.evidence?.boundaryPrice, 99.5);
});

test('uses current lifecycle kind for a flipped level', () => {
  const flipped = registerLevelV2BreakClassification(
    level('resistance'),
    20,
    iso(20),
    'support',
  ).state;
  let state = must(apply(
    flipped,
    observation(21, 99.6, 99.7, 99, 99.3),
  )).state;
  const result = must(apply(
    state,
    observation(22, 99.3, 99.4, 98.8, 99.1),
  ));
  assert.equal(result.state.currentKind, 'support');
  assert.equal(result.state.status, 'breakout_confirmed');
  assert.equal(result.event?.evidence?.boundaryPrice, 99.5);
});

test('ignores open and repeated candles', () => {
  const state = register();
  assert.equal(evaluateLevelV2BreakClassification(
    state,
    observation(21, 100.4, 101, 100.3, 100.7, false),
  ), null);
  assert.equal(evaluateLevelV2BreakClassification(
    state,
    observation(20, 100.4, 101, 100.3, 100.7),
  ), null);
});

test('retains maximum penetration depth across the episode', () => {
  const state = must(apply(
    register(),
    observation(21, 100.1, 100.8, 99.9, 100.4),
  )).state;
  const firstDepth = state.maxPenetrationDepthPct;
  const result = must(apply(
    state,
    observation(22, 100.3, 101.5, 100.2, 100.4),
  ));
  assert.ok(result.state.maxPenetrationDepthPct > firstDepth);
  assert.equal(
    result.event?.evidence?.maxPenetrationDepthPct,
    result.state.maxPenetrationDepthPct,
  );
});

test('bounds retained classification events', () => {
  const customOptions = options({
    maxEventsPerLevel: 2,
  });
  let state = register('resistance', customOptions);
  state = must(apply(
    state,
    observation(21, 100.1, 100.8, 99.9, 100.4),
    customOptions,
  )).state;
  state = must(apply(
    state,
    observation(22, 100.1, 100.9, 99.9, 100.4),
    customOptions,
  )).state;
  assert.equal(state.events.length, 2);
  assert.equal(state.events.at(-1)?.candleIndex, 22);
});
