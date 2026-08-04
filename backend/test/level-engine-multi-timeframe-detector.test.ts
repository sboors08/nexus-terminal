import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectMultiTimeframeLevelCandidates,
} from '../src/modules/level-engine/level-engine-multi-timeframe-detector.js';
import type {
  LevelEngineTimeframe,
} from '../src/modules/level-engine/level-engine.types.js';
import type {
  LevelEngineCandle,
} from '../src/modules/level-engine/level-engine-touch-detector.types.js';
import type {
  LevelEngineTimeframeDataset,
  MultiTimeframeLevelDetectionOptions,
} from '../src/modules/level-engine/level-engine-multi-timeframe-detector.types.js';

type CandleTuple = readonly [
  open: number,
  high: number,
  low: number,
  close: number,
  isClosed?: boolean,
];

const OPTIONS = Object.freeze({
  atrPeriod: 3,
  pivotLeftBars: 1,
  pivotRightBars: 1,
  zoneHalfWidthAtr: 0.35,
  clusterDistanceAtr: 0.75,
  touchEpisodes: Object.freeze({
    atrPeriod: 3,
    minDepartureAtr: 0.6,
    maxDepartureCandles: 4,
    minBarsBetweenEpisodes: 2,
    maxEpisodeSpanCandles: 3,
  }),
}) satisfies MultiTimeframeLevelDetectionOptions;

function candles(
  values: readonly CandleTuple[],
  stepMs = 60_000,
): readonly LevelEngineCandle[] {
  const startMs = Date.parse('2026-01-01T00:00:00.000Z');
  return values.map((value, index) => ({
    openTime: new Date(startMs + index * stepMs).toISOString(),
    closeTime: new Date(startMs + (index + 1) * stepMs - 1).toISOString(),
    open: value[0],
    high: value[1],
    low: value[2],
    close: value[3],
    isClosed: value[4] ?? true,
  }));
}

function supportValues(twoTouches = true): CandleTuple[] {
  const values: CandleTuple[] = [
    [102, 103, 101, 102],
    [102, 103, 101, 102],
    [102, 103, 101, 102],
    [101.5, 102, 100, 100.5],
    [101, 103, 101, 102.5],
  ];
  if (twoTouches) {
    values.push(
      [102.5, 104, 102, 103],
      [103, 104, 102, 103],
      [101, 102, 100.1, 100.6],
      [101, 103, 101, 102.5],
      [102.5, 104, 102, 103],
    );
  }
  return values;
}

function resistanceValues(): CandleTuple[] {
  return [
    [108, 109, 107, 108],
    [108, 109, 107, 108],
    [108, 109, 107, 108],
    [108.5, 110, 108, 109.5],
    [109, 109, 107, 107.5],
    [107.5, 108, 106, 107],
    [107, 108, 106, 107],
    [108.5, 109.9, 108, 109.4],
    [109, 109, 107, 107.5],
    [107.5, 108, 106, 107],
  ];
}

function dataset(
  timeframe: LevelEngineTimeframe,
  values: readonly CandleTuple[] = supportValues(),
  symbol = 'btcusdt',
): LevelEngineTimeframeDataset {
  return {
    symbol,
    sourceTimeframe: timeframe,
    candles: candles(values),
  };
}

function supportCandidate(
  result: ReturnType<typeof detectMultiTimeframeLevelCandidates>,
) {
  const candidate = result.candidates.find(
    (item) => item.kind === 'support',
  );
  assert.ok(candidate);
  return candidate;
}

test('detects a confirmed support level from two independent reactions', () => {
  const result = detectMultiTimeframeLevelCandidates(
    [dataset('1m')],
    OPTIONS,
  );
  const candidate = supportCandidate(result);
  assert.equal(candidate.maturity, 'confirmed');
  assert.equal(candidate.touchEpisodes.length, 2);
  assert.deepEqual(candidate.acceptanceReasons, [
    'confirmed_departure',
    'independent_touch_episode',
    'coherent_price_cluster',
    'clean_reaction',
  ]);
});

test('detects resistance independently from support', () => {
  const result = detectMultiTimeframeLevelCandidates(
    [dataset('5m', resistanceValues())],
    OPTIONS,
  );
  const candidate = result.candidates.find(
    (item) => item.kind === 'resistance',
  );
  assert.ok(candidate);
  assert.equal(candidate.sourceTimeframe, '5m');
  assert.equal(candidate.touchEpisodes.length, 2);
});

test('keeps a single confirmed reaction at candidate maturity', () => {
  const result = detectMultiTimeframeLevelCandidates(
    [dataset('1m', supportValues(false))],
    OPTIONS,
  );
  const candidate = supportCandidate(result);
  assert.equal(candidate.maturity, 'candidate');
  assert.equal(candidate.touchEpisodes.length, 1);
});

test('does not merge equal price structures across timeframes', () => {
  const result = detectMultiTimeframeLevelCandidates(
    [dataset('1m'), dataset('5m')],
    OPTIONS,
  );
  const supports = result.candidates.filter(
    (candidate) => candidate.kind === 'support',
  );
  assert.equal(supports.length, 2);
  assert.deepEqual(
    supports.map((candidate) => candidate.sourceTimeframe),
    ['1m', '5m'],
  );
  assert.notEqual(supports[0]?.id, supports[1]?.id);
  assert.equal(result.mergesAcrossTimeframes, false);
});

test('returns timeframe buckets in canonical order', () => {
  const result = detectMultiTimeframeLevelCandidates(
    [dataset('4h'), dataset('15m'), dataset('1m')],
    OPTIONS,
  );
  assert.deepEqual(result.requestedTimeframes, ['1m', '15m', '4h']);
});

test('remains setup-neutral and exposes no score', () => {
  const result = detectMultiTimeframeLevelCandidates(
    [dataset('1m')],
    OPTIONS,
  );
  const candidate = supportCandidate(result);
  assert.equal(result.observationalOnly, true);
  assert.equal(result.createsSetup, false);
  assert.equal(candidate.createsSetup, false);
  assert.equal('score' in candidate, false);
  assert.equal('direction' in candidate, false);
});

test('starts the causal line at the first confirmed reaction', () => {
  const result = detectMultiTimeframeLevelCandidates(
    [dataset('1m')],
    OPTIONS,
  );
  const candidate = supportCandidate(result);
  assert.equal(
    candidate.activeFrom,
    candidate.touchEpisodes[0]?.confirmedAt,
  );
  assert.equal(
    candidate.detectedAt,
    candidate.touchEpisodes.at(-1)?.confirmedAt,
  );
});

test('ignores a trailing open candle during pivot discovery', () => {
  const values = supportValues();
  values.push([100, 105, 90, 91, false]);
  const result = detectMultiTimeframeLevelCandidates(
    [dataset('1m', values)],
    OPTIONS,
  );
  const bucket = result.timeframes[0];
  assert.ok(bucket);
  assert.equal(bucket.ignoredOpenCandlesCount, 1);
  assert.equal(
    bucket.pivotSeeds.some((seed) => seed.candleIndex === values.length - 1),
    false,
  );
});

test('does not confirm the final closed candle as a pivot without right-side data', () => {
  const values = supportValues();
  values.push([95, 96, 90, 91]);
  const result = detectMultiTimeframeLevelCandidates(
    [dataset('1m', values)],
    OPTIONS,
  );
  const bucket = result.timeframes[0];
  assert.ok(bucket);
  assert.equal(
    bucket.pivotSeeds.some((seed) => seed.candleIndex === values.length - 1),
    false,
  );
});

test('produces stable candidate and pivot identifiers', () => {
  const first = detectMultiTimeframeLevelCandidates(
    [dataset('1m')],
    OPTIONS,
  );
  const second = detectMultiTimeframeLevelCandidates(
    [dataset('1m')],
    OPTIONS,
  );
  assert.deepEqual(
    first.candidates.map((candidate) => candidate.id),
    second.candidates.map((candidate) => candidate.id),
  );
  assert.deepEqual(
    first.timeframes[0]?.pivotSeeds.map((seed) => seed.id),
    second.timeframes[0]?.pivotSeeds.map((seed) => seed.id),
  );
});

test('returns frozen defensive structures', () => {
  const result = detectMultiTimeframeLevelCandidates(
    [dataset('1m')],
    OPTIONS,
  );
  const bucket = result.timeframes[0];
  const candidate = supportCandidate(result);
  assert.ok(bucket);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.timeframes), true);
  assert.equal(Object.isFrozen(bucket), true);
  assert.equal(Object.isFrozen(bucket.pivotSeeds), true);
  assert.equal(Object.isFrozen(candidate), true);
  assert.equal(Object.isFrozen(candidate.zone), true);
  assert.equal(Object.isFrozen(candidate.touchEpisodes), true);
});

test('rejects duplicate timeframe datasets', () => {
  assert.throws(
    () => detectMultiTimeframeLevelCandidates(
      [dataset('1m'), dataset('1m')],
      OPTIONS,
    ),
    /duplicate timeframe dataset: 1m/,
  );
});

test('rejects mixed symbols in one multi-timeframe request', () => {
  assert.throws(
    () => detectMultiTimeframeLevelCandidates(
      [dataset('1m'), dataset('5m', supportValues(), 'ethusdt')],
      OPTIONS,
    ),
    /symbol must match BTCUSDT/,
  );
});

test('rejects unsupported timeframes', () => {
  assert.throws(
    () => detectMultiTimeframeLevelCandidates(
      [dataset('30m' as LevelEngineTimeframe)],
      OPTIONS,
    ),
    /unsupported timeframe: 30m/,
  );
});

test('requires pivot and touch ATR periods to match', () => {
  assert.throws(
    () => detectMultiTimeframeLevelCandidates(
      [dataset('1m')],
      {
        ...OPTIONS,
        touchEpisodes: {
          ...OPTIONS.touchEpisodes,
          atrPeriod: 4,
        },
      },
    ),
    /touchEpisodes\.atrPeriod must equal atrPeriod/,
  );
});

test('reports insufficient history without fabricating a candidate', () => {
  const result = detectMultiTimeframeLevelCandidates(
    [dataset('1h', supportValues(false).slice(0, 3))],
    OPTIONS,
  );
  const bucket = result.timeframes[0];
  assert.ok(bucket);
  assert.equal(bucket.candidates.length, 0);
  assert.deepEqual(
    bucket.rejectedClusters.map((item) => item.reason),
    ['insufficient_history', 'insufficient_history'],
  );
});

test('rejects a pivot cluster with no confirmed departure', () => {
  const values: CandleTuple[] = [
    [102, 103, 101, 102],
    [102, 103, 101, 102],
    [102, 103, 101, 102],
    [101, 101.2, 100, 100.5],
    [100.5, 100.6, 100.1, 100.4],
    [100.4, 100.6, 100.2, 100.5],
    [100.5, 100.7, 100.3, 100.6],
    [100.6, 100.8, 100.4, 100.7],
  ];
  const result = detectMultiTimeframeLevelCandidates(
    [dataset('15m', values)],
    {
      ...OPTIONS,
      touchEpisodes: {
        ...OPTIONS.touchEpisodes,
        maxDepartureCandles: 2,
      },
    },
  );
  const bucket = result.timeframes[0];
  assert.ok(bucket);
  assert.equal(bucket.candidates.length, 0);
  assert.equal(
    bucket.rejectedClusters.some(
      (item) => item.reason === 'no_confirmed_touch_episode',
    ),
    true,
  );
});

test('uses the causal origin ATR to size the zone', () => {
  const result = detectMultiTimeframeLevelCandidates(
    [dataset('1m')],
    OPTIONS,
  );
  const bucket = result.timeframes[0];
  const candidate = supportCandidate(result);
  const origin = bucket?.pivotSeeds.find(
    (seed) => seed.kind === 'support',
  );
  assert.ok(origin);
  const width = candidate.zone.high - candidate.zone.low;
  assert.ok(Math.abs(width / origin.atrAtPivot - 0.7) < 1e-9);
});
