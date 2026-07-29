import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLevelV2Foundation,
  buildLevelV2TouchEvents,
  calculateLevelV2Atr,
  detectLevelV2Extrema,
} from '../src/modules/setup-engine/level-v2/index.js';
import type {
  LevelV2Candle,
  LevelV2Extremum,
  LevelV2FoundationOptions,
} from '../src/modules/setup-engine/level-v2/index.js';

const baseTime = Date.parse('2026-07-01T00:00:00.000Z');

function candle(
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
  isClosed = true,
): LevelV2Candle {
  return {
    openTime: new Date(baseTime + index * 60_000).toISOString(),
    closeTime: new Date(baseTime + index * 60_000 + 59_999).toISOString(),
    open,
    high,
    low,
    close,
    baseVolume: null,
    quoteVolume: null,
    tradesCount: null,
    isClosed,
  };
}

const options: LevelV2FoundationOptions = {
  atrPeriod: 2,
  swingLeftCandles: 1,
  swingRightCandles: 1,
  minReactionAtr: 0.5,
  maxReactionLookaheadCandles: 3,
  plateauToleranceAtr: 0.1,
  maxPlateauWidthCandles: 4,
  maxTouchMergeCandles: 2,
  touchMergeToleranceAtr: 0.2,
};

function extremum(
  overrides: Partial<LevelV2Extremum> = {},
): LevelV2Extremum {
  return {
    id: 'BTCUSDT-1m-v2-high-1',
    kind: 'swing_high',
    candleIndex: 10,
    segmentStartIndex: 10,
    segmentEndIndex: 10,
    occurredAt: new Date(baseTime + 10 * 60_000).toISOString(),
    confirmedAt: new Date(baseTime + 11 * 60_000).toISOString(),
    extremePrice: 100,
    atr: 2,
    reactionDistance: 2,
    reactionAtr: 1,
    reactionDurationCandles: 1,
    leftProminenceAtr: 1,
    rightProminenceAtr: 1,
    qualityScore: 70,
    ...overrides,
  };
}

test('calculates true range with gaps and rolling ATR', () => {
  const result = calculateLevelV2Atr([
    candle(0, 10, 12, 9, 11),
    candle(1, 15, 16, 14, 15),
  ], 2);

  assert.equal(result[0]?.trueRange, 3);
  assert.equal(result[0]?.atr, null);
  assert.equal(result[1]?.trueRange, 5);
  assert.equal(result[1]?.atr, 4);
});

test('detects a confirmed swing high only after a downward reaction', () => {
  const result = detectLevelV2Extrema('BTCUSDT', '1m', [
    candle(0, 10, 10.5, 9.5, 10),
    candle(1, 10, 12, 10, 11.5),
    candle(2, 11.5, 11.5, 10.5, 11),
    candle(3, 11, 11, 9.5, 10),
  ], options);

  const high = result.find((item) => item.kind === 'swing_high');
  assert.ok(high);
  assert.equal(high.extremePrice, 12);
  assert.ok(high.reactionAtr >= options.minReactionAtr);
  assert.equal(high.reactionDurationCandles, 1);
});

test('detects a confirmed swing low only after an upward reaction', () => {
  const result = detectLevelV2Extrema('ETHUSDT', '1m', [
    candle(0, 12, 12.5, 11.5, 12),
    candle(1, 12, 12, 9, 9.5),
    candle(2, 9.5, 10.5, 9.5, 10),
    candle(3, 10, 12, 10, 11.5),
  ], options);

  const low = result.find((item) => item.kind === 'swing_low');
  assert.ok(low);
  assert.equal(low.extremePrice, 9);
  assert.ok(low.reactionAtr >= options.minReactionAtr);
});

test('rejects a local high when the required reaction does not happen', () => {
  const strictOptions = {
    ...options,
    minReactionAtr: 1.5,
  };
  const result = detectLevelV2Extrema('BTCUSDT', '1m', [
    candle(0, 10, 10.5, 9.5, 10),
    candle(1, 11, 12, 10.5, 11.8),
    candle(2, 11.8, 11.9, 11.4, 11.7),
    candle(3, 11.7, 11.8, 11.3, 11.5),
    candle(4, 11.5, 11.7, 11.2, 11.4),
  ], strictOptions);

  assert.equal(result.filter((item) => item.kind === 'swing_high').length, 0);
});

test('does not use an open candle as an extremum', () => {
  const result = detectLevelV2Extrema('BTCUSDT', '1m', [
    candle(0, 10, 10.5, 9.5, 10),
    candle(1, 10, 11, 9.8, 10.5),
    candle(2, 10.5, 15, 10.4, 14, false),
    candle(3, 10.5, 11, 9.5, 10),
    candle(4, 10, 10.5, 9, 9.5),
  ], options);

  assert.equal(result.some((item) => item.extremePrice === 15), false);
});

test('does not confirm a swing without enough closed candles on the right', () => {
  const result = detectLevelV2Extrema('BTCUSDT', '1m', [
    candle(0, 10, 10.5, 9.5, 10),
    candle(1, 10, 11, 9.8, 10.5),
    candle(2, 10.5, 13, 10, 12.5),
  ], options);

  assert.equal(result.some((item) => item.extremePrice === 13), false);
});

test('merges equal neighbouring swing highs into one extremum segment', () => {
  const result = detectLevelV2Extrema('BTCUSDT', '1m', [
    candle(0, 10, 10.5, 9.5, 10),
    candle(1, 10, 12, 10, 11.5),
    candle(2, 11.5, 12, 10.8, 11),
    candle(3, 11, 11, 9.5, 10),
    candle(4, 10, 10.5, 9, 9.5),
  ], options);

  const highs = result.filter((item) => item.kind === 'swing_high');
  assert.equal(highs.length, 1);
  assert.equal(highs[0]?.segmentStartIndex, 1);
  assert.equal(highs[0]?.segmentEndIndex, 2);
});

test('merges equal neighbouring swing lows into one extremum segment', () => {
  const result = detectLevelV2Extrema('BTCUSDT', '1m', [
    candle(0, 12, 12.5, 11.5, 12),
    candle(1, 12, 12, 9, 9.5),
    candle(2, 9.5, 10.5, 9, 10),
    candle(3, 10, 12, 9.8, 11.5),
    candle(4, 11.5, 13, 11, 12.5),
  ], options);

  const lows = result.filter((item) => item.kind === 'swing_low');
  assert.equal(lows.length, 1);
  assert.equal(lows[0]?.segmentStartIndex, 1);
  assert.equal(lows[0]?.segmentEndIndex, 2);
});

test('merges nearby adjacent extrema into one touch event', () => {
  const events = buildLevelV2TouchEvents('BTCUSDT', '1m', [
    extremum(),
    extremum({
      id: 'BTCUSDT-1m-v2-high-2',
      candleIndex: 12,
      segmentStartIndex: 12,
      segmentEndIndex: 12,
      occurredAt: new Date(baseTime + 12 * 60_000).toISOString(),
      extremePrice: 100.2,
      qualityScore: 80,
    }),
  ], options);

  assert.equal(events.length, 1);
  assert.equal(events[0]?.extremumIds.length, 2);
  assert.equal(events[0]?.representativeExtremumId, 'BTCUSDT-1m-v2-high-2');
});

test('keeps temporally separated extrema as independent touch events', () => {
  const events = buildLevelV2TouchEvents('BTCUSDT', '1m', [
    extremum(),
    extremum({
      id: 'BTCUSDT-1m-v2-high-20',
      candleIndex: 20,
      segmentStartIndex: 20,
      segmentEndIndex: 20,
      occurredAt: new Date(baseTime + 20 * 60_000).toISOString(),
      extremePrice: 100.1,
    }),
  ], options);

  assert.equal(events.length, 2);
});

test('never merges swing highs and swing lows into one touch event', () => {
  const events = buildLevelV2TouchEvents('BTCUSDT', '1m', [
    extremum(),
    extremum({
      id: 'BTCUSDT-1m-v2-low-11',
      kind: 'swing_low',
      candleIndex: 11,
      segmentStartIndex: 11,
      segmentEndIndex: 11,
      occurredAt: new Date(baseTime + 11 * 60_000).toISOString(),
      extremePrice: 99.9,
    }),
  ], options);

  assert.equal(events.length, 2);
});

test('assigns a higher quality score to a stronger reaction', () => {
  const weak = detectLevelV2Extrema('BTCUSDT', '1m', [
    candle(0, 10, 10.5, 9.5, 10),
    candle(1, 10, 12, 10, 11.5),
    candle(2, 11.5, 11.5, 10.9, 11.1),
    candle(3, 11.1, 11.2, 10.8, 11),
  ], options).find((item) => item.kind === 'swing_high');

  const strong = detectLevelV2Extrema('BTCUSDT', '1m', [
    candle(0, 10, 10.5, 9.5, 10),
    candle(1, 10, 12, 10, 11.5),
    candle(2, 11.5, 11.5, 9.5, 10),
    candle(3, 10, 10.5, 9, 9.5),
  ], options).find((item) => item.kind === 'swing_high');

  assert.ok(weak);
  assert.ok(strong);
  assert.ok(strong.qualityScore > weak.qualityScore);
  assert.ok(strong.qualityScore <= 100);
});

test('produces stable extremum identifiers for identical input', () => {
  const candles = [
    candle(0, 10, 10.5, 9.5, 10),
    candle(1, 10, 12, 10, 11.5),
    candle(2, 11.5, 11.5, 9.5, 10),
    candle(3, 10, 10.5, 9, 9.5),
  ];
  const first = detectLevelV2Extrema('BTCUSDT', '1m', candles, options);
  const second = detectLevelV2Extrema('BTCUSDT', '1m', candles, options);

  assert.deepEqual(first.map((item) => item.id), second.map((item) => item.id));
});

test('rejects unsorted or duplicate candle timestamps', () => {
  const duplicate = candle(0, 10, 11, 9, 10);
  assert.throws(
    () => calculateLevelV2Atr([duplicate, duplicate], 2),
    /strictly ordered and unique/u,
  );
});

test('returns a complete foundation snapshot without changing v1', () => {
  const result = buildLevelV2Foundation('BTCUSDT', '1m', [
    candle(0, 10, 10.5, 9.5, 10),
    candle(1, 10, 12, 10, 11.5),
    candle(2, 11.5, 11.5, 9.5, 10),
    candle(3, 10, 10.5, 9, 9.5),
    candle(4, 9.5, 15, 9, 14, false),
  ], options);

  assert.equal(result.closedCandlesCount, 4);
  assert.equal(result.atr.length, 4);
  assert.ok(result.extrema.length >= 1);
  assert.ok(result.touchEvents.length >= 1);
});
