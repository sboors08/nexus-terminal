import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectTouchEpisodes,
} from '../src/modules/level-engine/index.js';
import type {
  LevelEngineCandle,
  TouchEpisodeDetectionOptions,
  TouchEpisodeDetectionTarget,
} from '../src/modules/level-engine/index.js';

const baseTime = Date.parse('2026-08-01T00:00:00.000Z');

function candle(
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
  isClosed = true,
): LevelEngineCandle {
  return {
    openTime: new Date(baseTime + index * 60_000).toISOString(),
    closeTime: new Date(baseTime + index * 60_000 + 59_999).toISOString(),
    open,
    high,
    low,
    close,
    isClosed,
  };
}

const resistanceTarget: TouchEpisodeDetectionTarget = {
  symbol: 'BTCUSDT',
  sourceTimeframe: '1m',
  kind: 'resistance',
  zone: { low: 99, reference: 100, high: 101 },
};

const supportTarget: TouchEpisodeDetectionTarget = {
  ...resistanceTarget,
  kind: 'support',
};

const options: TouchEpisodeDetectionOptions = {
  atrPeriod: 2,
  minDepartureAtr: 0.5,
  maxDepartureCandles: 3,
  minBarsBetweenEpisodes: 2,
  maxEpisodeSpanCandles: 5,
};

const resistancePrefix = [
  candle(0, 95, 96, 94, 95),
  candle(1, 95, 97, 94.5, 96),
];

const supportPrefix = [
  candle(0, 105, 106, 104, 105),
  candle(1, 105, 105.5, 103.5, 104),
];

test('groups adjacent resistance contacts into one confirmed episode', () => {
  const result = detectTouchEpisodes(resistanceTarget, [
    ...resistancePrefix,
    candle(2, 98, 100.2, 97.5, 99.5),
    candle(3, 99.5, 100.8, 98.8, 99.2),
    candle(4, 98, 98.5, 96.5, 97),
  ], options);

  assert.equal(result.episodes.length, 1);
  assert.equal(result.episodes[0]?.startCandleIndex, 2);
  assert.equal(result.episodes[0]?.endCandleIndex, 3);
  assert.equal(result.episodes[0]?.anchorCandleIndex, 3);
  assert.equal(result.episodes[0]?.confirmedAt, candle(4, 98, 98.5, 96.5, 97).closeTime);
});

test('detects a support episode with an upward departure', () => {
  const result = detectTouchEpisodes(supportTarget, [
    ...supportPrefix,
    candle(2, 102, 102.5, 99.5, 100),
    candle(3, 100, 101.2, 99, 100.5),
    candle(4, 101.5, 103.5, 101.2, 103),
  ], options);

  assert.equal(result.episodes.length, 1);
  assert.equal(result.episodes[0]?.kind, 'support');
  assert.equal(result.episodes[0]?.anchorCandleIndex, 3);
  assert.equal(result.episodes[0]?.extremePrice, 99);
});

test('re-entry before a confirmed departure remains the same episode', () => {
  const result = detectTouchEpisodes(resistanceTarget, [
    ...resistancePrefix,
    candle(2, 98, 100.2, 97.8, 99.4),
    candle(3, 98.5, 98.8, 98.2, 98.5),
    candle(4, 98.8, 100.7, 98.6, 99.5),
    candle(5, 98, 98.2, 96.5, 97),
  ], options);

  assert.equal(result.episodes.length, 1);
  assert.equal(result.episodes[0]?.startCandleIndex, 2);
  assert.equal(result.episodes[0]?.endCandleIndex, 4);
  assert.equal(result.episodes[0]?.anchorCandleIndex, 4);
});

test('creates a second episode only after departure and minimum separation', () => {
  const result = detectTouchEpisodes(resistanceTarget, [
    ...resistancePrefix,
    candle(2, 98, 100.5, 97.5, 99.5),
    candle(3, 98, 98.2, 96, 97),
    candle(4, 97, 98, 95.5, 96),
    candle(5, 96, 98, 95, 97),
    candle(6, 98, 100.3, 97.8, 99.2),
    candle(7, 98, 98.2, 96, 97),
  ], options);

  assert.equal(result.episodes.length, 2);
  assert.equal(result.episodes[0]?.startCandleIndex, 2);
  assert.equal(result.episodes[1]?.startCandleIndex, 6);
});

test('rejects a too-soon return and waits for a fresh departure before recounting', () => {
  const result = detectTouchEpisodes(resistanceTarget, [
    ...resistancePrefix,
    candle(2, 98, 100.5, 97.5, 99.5),
    candle(3, 98, 98.2, 96, 97),
    candle(4, 98, 100.2, 97.8, 99.2),
    candle(5, 98, 98.2, 96, 97),
    candle(6, 97, 98, 95.5, 96),
    candle(7, 98, 100.4, 97.8, 99.3),
    candle(8, 98, 98.2, 96, 97),
  ], options);

  assert.equal(result.episodes.length, 2);
  assert.equal(result.episodes[1]?.startCandleIndex, 7);
  assert.equal(
    result.rejectedInteractions.some(
      (item) => item.reason === 'insufficient_time_separation',
    ),
    true,
  );
});

test('rejects an interaction when departure is not large enough in time', () => {
  const result = detectTouchEpisodes(resistanceTarget, [
    ...resistancePrefix,
    candle(2, 98, 100.4, 97.8, 99.3),
    candle(3, 98.8, 98.9, 98.5, 98.7),
    candle(4, 98.7, 98.8, 98.4, 98.6),
    candle(5, 98.6, 98.7, 98.3, 98.5),
  ], options);

  assert.equal(result.episodes.length, 0);
  assert.equal(result.rejectedInteractions.at(-1)?.reason, 'insufficient_departure');
  assert.equal(result.pendingInteraction, null);
});

test('rejects a resistance interaction that closes through the wrong side', () => {
  const result = detectTouchEpisodes(resistanceTarget, [
    ...resistancePrefix,
    candle(2, 99, 100.5, 98.5, 99.8),
    candle(3, 100, 102, 99.5, 101.5),
  ], options);

  assert.equal(result.episodes.length, 0);
  assert.equal(result.rejectedInteractions.at(-1)?.reason, 'wrong_side_break');
});

test('does not use an open candle to confirm departure', () => {
  const result = detectTouchEpisodes(resistanceTarget, [
    ...resistancePrefix,
    candle(2, 98, 100.5, 97.8, 99.5),
    candle(3, 98, 98.2, 95, 96, false),
  ], options);

  assert.equal(result.episodes.length, 0);
  assert.equal(result.ignoredOpenCandlesCount, 1);
  assert.equal(result.pendingInteraction?.startCandleIndex, 2);
});

test('keeps an unresolved interaction pending instead of using future data', () => {
  const initial = detectTouchEpisodes(resistanceTarget, [
    ...resistancePrefix,
    candle(2, 98, 100.5, 97.8, 99.5),
    candle(3, 98.8, 98.9, 98.4, 98.6),
  ], options);
  const completed = detectTouchEpisodes(resistanceTarget, [
    ...resistancePrefix,
    candle(2, 98, 100.5, 97.8, 99.5),
    candle(3, 98.8, 98.9, 98.4, 98.6),
    candle(4, 98, 98.2, 96, 97),
  ], options);

  assert.equal(initial.episodes.length, 0);
  assert.equal(initial.pendingInteraction?.status, 'awaiting_departure_confirmation');
  assert.equal(completed.episodes.length, 1);
  assert.equal(completed.episodes[0]?.confirmedAt, candle(4, 98, 98.2, 96, 97).closeTime);
});

test('rejects prolonged zone chop as one interaction, not many touches', () => {
  const strictSpan = { ...options, maxEpisodeSpanCandles: 3 };
  const result = detectTouchEpisodes(resistanceTarget, [
    ...resistancePrefix,
    candle(2, 99, 100.2, 98.8, 99.5),
    candle(3, 99.5, 100.4, 98.9, 99.4),
    candle(4, 99.4, 100.3, 98.7, 99.2),
    candle(5, 99.2, 100.5, 98.8, 99.6),
  ], strictSpan);

  assert.equal(result.episodes.length, 0);
  assert.equal(result.rejectedInteractions.at(-1)?.reason, 'prolonged_zone_chop');
});

test('rejects a contact before ATR is available', () => {
  const result = detectTouchEpisodes(resistanceTarget, [
    candle(0, 99, 100.2, 98.5, 99.5),
    candle(1, 98, 98.5, 96, 97),
  ], { ...options, atrPeriod: 3 });

  assert.equal(result.episodes.length, 0);
  assert.equal(result.rejectedInteractions[0]?.reason, 'missing_atr');
});

test('produces stable identifiers and does not mutate a confirmed episode', () => {
  const candles = [
    ...resistancePrefix,
    candle(2, 98, 100.5, 97.5, 99.5),
    candle(3, 98, 98.2, 96, 97),
  ];
  const first = detectTouchEpisodes(resistanceTarget, candles, options);
  const second = detectTouchEpisodes(resistanceTarget, [
    ...candles,
    candle(4, 97, 98, 95.5, 96),
  ], options);

  assert.equal(first.episodes[0]?.id, second.episodes[0]?.id);
  assert.deepEqual(first.episodes[0], second.episodes[0]);
});

test('returns frozen defensive result structures', () => {
  const result = detectTouchEpisodes(resistanceTarget, [
    ...resistancePrefix,
    candle(2, 98, 100.5, 97.5, 99.5),
    candle(3, 98, 98.2, 96, 97),
  ], options);

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.zone), true);
  assert.equal(Object.isFrozen(result.episodes), true);
  assert.equal(Object.isFrozen(result.episodes[0]), true);
  assert.equal(Object.isFrozen(result.rejectedInteractions), true);
});

test('validates candle ordering, OHLC and zone geometry', () => {
  assert.throws(
    () => detectTouchEpisodes(
      { ...resistanceTarget, zone: { low: 101, reference: 100, high: 99 } },
      resistancePrefix,
      options,
    ),
    /zone must satisfy/,
  );

  assert.throws(
    () => detectTouchEpisodes(resistanceTarget, [
      candle(1, 95, 96, 94, 95),
      candle(0, 95, 97, 94.5, 96),
    ], options),
    /strictly ordered/,
  );

  assert.throws(
    () => detectTouchEpisodes(resistanceTarget, [
      candle(0, 95, 94, 96, 95),
    ], options),
    /invalid OHLC/,
  );
});

test('rejects a closed candle after an open candle', () => {
  assert.throws(
    () => detectTouchEpisodes(resistanceTarget, [
      candle(0, 95, 96, 94, 95, false),
      candle(1, 95, 97, 94.5, 96),
    ], options),
    /closed candles cannot appear after an open candle/,
  );
});
