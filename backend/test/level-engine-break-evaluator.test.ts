import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findConfirmedLevelEngineBreak,
  LEVEL_ENGINE_BREAK_SEARCH_WINDOWS,
} from '../src/modules/level-engine/level-engine-break-evaluator.js';
import type { LevelEngineCandle } from '../src/modules/level-engine/level-engine-touch-detector.types.js';

const BASE = Date.UTC(2026, 0, 1);
const ZONE = Object.freeze({ low: 99.5, reference: 100, high: 100.5 });
const POLICY = Object.freeze({
  decisiveBreakAtr: 0.35,
  consecutiveBreakCloses: 2,
});

function candle(
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
): LevelEngineCandle {
  return Object.freeze({
    openTime: new Date(BASE + index * 60_000).toISOString(),
    closeTime: new Date(BASE + index * 60_000 + 59_999).toISOString(),
    open,
    high,
    low,
    close,
    isClosed: true,
  });
}

function indexed(values: readonly LevelEngineCandle[]) {
  return Object.freeze(values.map((value, candleIndex) =>
    Object.freeze({ candleIndex, candle: value, atr: 1 })));
}

test('finds a consecutive-close break', () => {
  const values = indexed([
    candle(0, 100, 100.2, 99.2, 99.4),
    candle(1, 99.4, 99.6, 99.1, 99.3),
  ]);
  const result = findConfirmedLevelEngineBreak(
    values,
    Object.freeze({ zone: ZONE, kind: 'support' as const }),
    Object.freeze({
      afterExclusiveMs: BASE - 1,
      throughInclusiveMs: Number.POSITIVE_INFINITY,
    }),
    POLICY,
  );
  assert.equal(result?.mode, 'consecutive_closes');
  assert.equal(result?.candleIndex, 1);
});

test('finds a decisive body break', () => {
  const result = findConfirmedLevelEngineBreak(
    indexed([candle(0, 98.8, 99, 98.5, 98.7)]),
    Object.freeze({ zone: ZONE, kind: 'support' as const }),
    Object.freeze({
      afterExclusiveMs: BASE - 1,
      throughInclusiveMs: Number.POSITIVE_INFINITY,
    }),
    POLICY,
  );
  assert.equal(result?.mode, 'decisive_body_break');
  assert.equal(result?.candleIndex, 0);
});

test('uses an exclusive start and inclusive end for break searches', () => {
  const values = indexed([
    candle(0, 100, 100.2, 99.2, 99.4),
    candle(1, 100, 100.2, 99.2, 99.4),
    candle(2, 100, 100.2, 99.2, 99.4),
  ]);
  const result = findConfirmedLevelEngineBreak(
    values,
    Object.freeze({ zone: ZONE, kind: 'support' as const }),
    Object.freeze({
      afterExclusiveMs: Date.parse(values[0]!.candle.closeTime),
      throughInclusiveMs: Date.parse(values[2]!.candle.closeTime),
    }),
    POLICY,
  );

  assert.equal(result?.mode, 'consecutive_closes');
  assert.equal(result?.candleIndex, 2);
});

test('keeps lifecycle and review windows explicit', () => {
  assert.equal(
    LEVEL_ENGINE_BREAK_SEARCH_WINDOWS.lifecycle,
    'cycle_active_from_exclusive_to_observation_inclusive',
  );
  assert.equal(
    LEVEL_ENGINE_BREAK_SEARCH_WINDOWS.review,
    'candidate_detected_at_exclusive_to_dataset_end_inclusive',
  );
});
