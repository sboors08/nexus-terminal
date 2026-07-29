import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLevelV2ZonesScore,
  DEFAULT_LEVEL_V2_ZONES_SCORE_OPTIONS,
} from '../src/modules/setup-engine/level-v2/level-v2-zones-score.js';
import type {
  LevelV2Candle,
  LevelV2Extremum,
  LevelV2FoundationResult,
  LevelV2TouchEvent,
} from '../src/modules/setup-engine/level-v2/level-v2.types.js';
import type {
  LevelV2ZonesScoreOptions,
} from '../src/modules/setup-engine/level-v2/level-v2-zones-score.types.js';

const baseTime = Date.parse('2026-07-01T00:00:00.000Z');

function candle(
  index: number,
  close: number,
  high = close + 0.5,
  low = close - 0.5,
  isClosed = true,
): LevelV2Candle {
  return {
    openTime: new Date(baseTime + index * 60_000).toISOString(),
    closeTime: new Date(baseTime + index * 60_000 + 59_999).toISOString(),
    open: close,
    high,
    low,
    close,
    baseVolume: null,
    quoteVolume: null,
    tradesCount: null,
    isClosed,
  };
}

function resistanceCandles(length = 40): LevelV2Candle[] {
  return Array.from({ length }, (_, index) => {
    const close = 94 + (index % 5) * 0.5;
    const high = index % 10 === 5 ? 100.2 : close + 0.7;
    return candle(index, close, high, close - 0.7);
  });
}

function supportCandles(length = 40): LevelV2Candle[] {
  return Array.from({ length }, (_, index) => {
    const close = 94 + (index % 5) * 0.5;
    const low = index % 10 === 5 ? 89.8 : close - 0.7;
    return candle(index, close, close + 0.7, low);
  });
}

function midrangeCandles(length = 40): LevelV2Candle[] {
  return Array.from({ length }, (_, index) => {
    const close = index % 2 === 0 ? 99.95 : 100.05;
    const high = index === 0 ? 110 : close + 0.5;
    const low = index === 1 ? 90 : close - 0.5;
    return candle(index, close, high, low);
  });
}

function extremum(
  id: string,
  kind: LevelV2Extremum['kind'],
  index: number,
  price: number,
  qualityScore = 80,
  reactionAtr = 1.5,
  atr = 2,
): LevelV2Extremum {
  return {
    id,
    kind,
    candleIndex: index,
    segmentStartIndex: index,
    segmentEndIndex: index,
    occurredAt: new Date(baseTime + index * 60_000 + 59_999).toISOString(),
    confirmedAt: new Date(baseTime + (index + 1) * 60_000 + 59_999).toISOString(),
    extremePrice: price,
    atr,
    reactionDistance: reactionAtr * atr,
    reactionAtr,
    reactionDurationCandles: 1,
    leftProminenceAtr: 1,
    rightProminenceAtr: 1,
    qualityScore,
  };
}

function touch(
  item: LevelV2Extremum,
): LevelV2TouchEvent {
  return {
    id: `touch-${item.id}`,
    kind: item.kind,
    extremumIds: [item.id],
    representativeExtremumId: item.id,
    firstCandleIndex: item.candleIndex,
    lastCandleIndex: item.candleIndex,
    occurredAt: item.occurredAt,
    extremePrice: item.extremePrice,
    qualityScore: item.qualityScore,
  };
}

function foundation(
  candles: readonly LevelV2Candle[],
  extrema: readonly LevelV2Extremum[],
): LevelV2FoundationResult {
  const closed = candles.filter((item) => item.isClosed);
  return {
    closedCandlesCount: closed.length,
    atr: closed.map((_, index) => ({
      candleIndex: index,
      trueRange: 2,
      atr: 2,
    })),
    extrema,
    touchEvents: extrema.map(touch),
  };
}

const options: LevelV2ZonesScoreOptions = {
  ...DEFAULT_LEVEL_V2_ZONES_SCORE_OPTIONS,
  minLevelScore: 0,
  maxClosesInsideRatio: 0.5,
  maxCrossingsCount: 5,
  minStructureEdgePosition: 0.6,
};

test('clusters nearby swing highs into one resistance zone', () => {
  const candles = resistanceCandles();
  const extrema = [
    extremum('h1', 'swing_high', 5, 100),
    extremum('h2', 'swing_high', 15, 100.1),
    extremum('h3', 'swing_high', 25, 99.95),
  ];
  const result = buildLevelV2ZonesScore(
    'BTCUSDT',
    '1m',
    candles,
    foundation(candles, extrema),
    options,
  );

  assert.equal(result.levels.length, 1);
  assert.equal(result.levels[0]?.kind, 'resistance');
  assert.equal(result.levels[0]?.touchesCount, 3);
});

test('never combines swing highs and swing lows', () => {
  const candles = [...resistanceCandles()];
  const extrema = [
    extremum('h1', 'swing_high', 5, 100),
    extremum('h2', 'swing_high', 15, 100.1),
    extremum('l1', 'swing_low', 6, 90),
    extremum('l2', 'swing_low', 16, 90.1),
  ];
  const result = buildLevelV2ZonesScore(
    'BTCUSDT',
    '1m',
    candles,
    foundation(candles, extrema),
    options,
  );

  assert.equal(result.levels.length + result.rejected.length, 2);
  assert.ok(result.levels.concat().every((level) =>
    level.touches.every((item) => item.kind === level.sourceKind)));
});

test('keeps separate resistance levels at meaningfully different prices', () => {
  const candles = resistanceCandles();
  const extrema = [
    extremum('h1', 'swing_high', 5, 100),
    extremum('h2', 'swing_high', 15, 100.1),
    extremum('h3', 'swing_high', 6, 102),
    extremum('h4', 'swing_high', 16, 102.1),
  ];
  const result = buildLevelV2ZonesScore(
    'DODOUSDT',
    '1m',
    candles,
    foundation(candles, extrema),
    {
      ...options,
      minStructureEdgePosition: 0.5,
    },
  );

  assert.equal(result.levels.length + result.rejected.length, 2);
});

test('uses a quality-weighted median instead of an arithmetic mean', () => {
  const candles = resistanceCandles();
  const extrema = [
    extremum('h1', 'swing_high', 5, 100, 95),
    extremum('h2', 'swing_high', 15, 100.1, 20),
    extremum('h3', 'swing_high', 25, 100.2, 10),
  ];
  const result = buildLevelV2ZonesScore(
    'BTCUSDT',
    '1m',
    candles,
    foundation(candles, extrema),
    options,
  );

  assert.equal(result.levels[0]?.zone.referencePrice, 100);
});

test('places resistance liquidity beyond wick extrema', () => {
  const candles = resistanceCandles();
  const extrema = [
    extremum('h1', 'swing_high', 5, 100),
    extremum('h2', 'swing_high', 15, 100.1),
  ];
  const result = buildLevelV2ZonesScore(
    'BTCUSDT',
    '1m',
    candles,
    foundation(candles, extrema),
    options,
  );
  const zone = result.levels[0]?.zone;

  assert.ok(zone);
  assert.ok(zone.outerHigh > 100.1);
  assert.equal(zone.liquidityLow, zone.outerHigh);
  assert.ok(zone.liquidityHigh > zone.outerHigh);
  assert.ok(zone.coreLow < zone.referencePrice);
});

test('places support liquidity below wick extrema', () => {
  const candles = supportCandles();
  const extrema = [
    extremum('l1', 'swing_low', 5, 90),
    extremum('l2', 'swing_low', 15, 90.1),
  ];
  const result = buildLevelV2ZonesScore(
    'BTCUSDT',
    '1m',
    candles,
    foundation(candles, extrema),
    options,
  );
  const zone = result.levels[0]?.zone;

  assert.ok(zone);
  assert.ok(zone.outerLow < 90);
  assert.equal(zone.liquidityHigh, zone.outerLow);
  assert.ok(zone.liquidityLow < zone.outerLow);
  assert.ok(zone.coreHigh > zone.referencePrice);
});

test('rejects a level in the middle of accepted chop', () => {
  const candles = midrangeCandles();
  const extrema = [
    extremum('h1', 'swing_high', 5, 100),
    extremum('h2', 'swing_high', 15, 100.05),
    extremum('h3', 'swing_high', 25, 99.95),
  ];
  const result = buildLevelV2ZonesScore(
    'BTCUSDT',
    '1m',
    candles,
    foundation(candles, extrema),
    options,
  );

  assert.equal(result.levels.length, 0);
  assert.ok(result.rejected[0]?.reasons.includes('acceptance_zone'));
  assert.ok(result.rejected[0]?.reasons.includes('structure_midrange'));
});

test('accepts upper and lower range boundaries as separate zones', () => {
  const candles = Array.from({ length: 40 }, (_, index) => {
    const close = 94 + (index % 4);
    return candle(index, close, 100.2, 89.8);
  });
  const extrema = [
    extremum('h1', 'swing_high', 5, 100),
    extremum('h2', 'swing_high', 15, 100.1),
    extremum('l1', 'swing_low', 6, 90),
    extremum('l2', 'swing_low', 16, 90.1),
  ];
  const result = buildLevelV2ZonesScore(
    'BTCUSDT',
    '1m',
    candles,
    foundation(candles, extrema),
    options,
  );

  assert.equal(result.levels.length, 2);
  assert.deepEqual(
    result.levels.map((level) => level.kind).sort(),
    ['resistance', 'support'],
  );
});

test('rejects a cluster that has only one independent touch', () => {
  const candles = resistanceCandles();
  const extrema = [extremum('h1', 'swing_high', 5, 100)];
  const result = buildLevelV2ZonesScore(
    'BTCUSDT',
    '1m',
    candles,
    foundation(candles, extrema),
    options,
  );

  assert.equal(result.levels.length, 0);
  assert.ok(result.rejected[0]?.reasons.includes('insufficient_touches'));
});

test('does not count touches that are too close in time', () => {
  const candles = resistanceCandles();
  const extrema = [
    extremum('h1', 'swing_high', 5, 100),
    extremum('h2', 'swing_high', 6, 100.1),
  ];
  const result = buildLevelV2ZonesScore(
    'BTCUSDT',
    '1m',
    candles,
    foundation(candles, extrema),
    options,
  );

  assert.equal(result.levels.length, 0);
  assert.equal(result.rejected.length, 2);
  assert.ok(result.rejected.every((item) =>
    item.reasons.includes('insufficient_touches')));
});

test('scores stronger reactions higher', () => {
  const candles = resistanceCandles();
  const weakExtrema = [
    extremum('w1', 'swing_high', 5, 100, 80, 0.8),
    extremum('w2', 'swing_high', 15, 100.1, 80, 0.8),
  ];
  const strongExtrema = [
    extremum('s1', 'swing_high', 5, 100, 80, 2),
    extremum('s2', 'swing_high', 15, 100.1, 80, 2),
  ];
  const weak = buildLevelV2ZonesScore(
    'BTCUSDT', '1m', candles, foundation(candles, weakExtrema), options,
  );
  const strong = buildLevelV2ZonesScore(
    'BTCUSDT', '1m', candles, foundation(candles, strongExtrema), options,
  );

  assert.ok((strong.levels[0]?.score.total ?? 0) > (weak.levels[0]?.score.total ?? 0));
});

test('scores a fresher level higher than an older equivalent level', () => {
  const candles = resistanceCandles(100);
  const oldExtrema = [
    extremum('o1', 'swing_high', 5, 100),
    extremum('o2', 'swing_high', 15, 100.1),
  ];
  const freshExtrema = [
    extremum('f1', 'swing_high', 75, 100),
    extremum('f2', 'swing_high', 85, 100.1),
  ];
  const old = buildLevelV2ZonesScore(
    'BTCUSDT', '1m', candles, foundation(candles, oldExtrema), options,
  );
  const fresh = buildLevelV2ZonesScore(
    'BTCUSDT', '1m', candles, foundation(candles, freshExtrema), options,
  );

  assert.ok((fresh.levels[0]?.score.freshness ?? 0) > (old.levels[0]?.score.freshness ?? 0));
});

test('produces stable level identifiers for identical input', () => {
  const candles = resistanceCandles();
  const extrema = [
    extremum('h1', 'swing_high', 5, 100),
    extremum('h2', 'swing_high', 15, 100.1),
  ];
  const snapshot = foundation(candles, extrema);
  const first = buildLevelV2ZonesScore('BTCUSDT', '1m', candles, snapshot, options);
  const second = buildLevelV2ZonesScore('BTCUSDT', '1m', candles, snapshot, options);

  assert.equal(first.levels[0]?.id, second.levels[0]?.id);
});

test('ignores the open candle when measuring cleanliness and freshness', () => {
  const candles = resistanceCandles();
  candles.push(candle(40, 100, 101, 99, false));
  const extrema = [
    extremum('h1', 'swing_high', 5, 100),
    extremum('h2', 'swing_high', 15, 100.1),
  ];
  const result = buildLevelV2ZonesScore(
    'BTCUSDT',
    '1m',
    candles,
    foundation(candles, extrema),
    options,
  );

  assert.equal(result.levels.length, 1);
  assert.equal(result.foundation.closedCandlesCount, 40);
});

test('rejects a foundation snapshot with a mismatched candle count', () => {
  const candles = resistanceCandles();
  const snapshot = foundation(candles, []);
  assert.throws(
    () => buildLevelV2ZonesScore(
      'BTCUSDT',
      '1m',
      candles,
      {
        ...snapshot,
        closedCandlesCount: 1,
      },
      options,
    ),
    /candle count does not match/u,
  );
});

test('rejects invalid zone options', () => {
  const candles = resistanceCandles();
  const snapshot = foundation(candles, []);
  assert.throws(
    () => buildLevelV2ZonesScore(
      'BTCUSDT',
      '1m',
      candles,
      snapshot,
      {
        ...options,
        minTouches: 1,
      },
    ),
    /at least two touches/u,
  );
});

test('keeps the production score threshold as an explicit rejection reason', () => {
  const candles = resistanceCandles();
  const extrema = [
    extremum('h1', 'swing_high', 5, 100, 20, 0.1),
    extremum('h2', 'swing_high', 8, 100.2, 20, 0.1),
  ];
  const result = buildLevelV2ZonesScore(
    'BTCUSDT',
    '1m',
    candles,
    foundation(candles, extrema),
    {
      ...options,
      minLevelScore: 95,
    },
  );

  assert.equal(result.levels.length, 0);
  assert.ok(result.rejected[0]?.reasons.includes('score_below_threshold'));
});
