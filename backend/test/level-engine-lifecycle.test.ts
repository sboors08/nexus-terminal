import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLevelCandidate,
} from '../src/modules/level-engine/level-engine.contract.js';
import {
  buildLevelLifecycle,
} from '../src/modules/level-engine/level-engine-lifecycle.js';
import type {
  LevelEngineKind,
  TouchEpisode,
} from '../src/modules/level-engine/level-engine.types.js';
import type {
  LevelEngineCandle,
  TouchEpisodeDetectionResult,
  TouchEpisodeDetectionTarget,
} from '../src/modules/level-engine/level-engine-touch-detector.types.js';

const BASE = Date.UTC(2026, 0, 1);
const ZONE = Object.freeze({
  low: 99.5,
  reference: 100,
  high: 100.5,
});
const OPTIONS = Object.freeze({
  atrPeriod: 2,
  decisiveBreakAtr: 0.35,
  consecutiveBreakCloses: 2,
  touchEpisodes: Object.freeze({
    atrPeriod: 2,
    minDepartureAtr: 0.8,
    maxDepartureCandles: 8,
    minBarsBetweenEpisodes: 1,
    maxEpisodeSpanCandles: 6,
  }),
});

function timestamp(index: number, close = true): string {
  const value = BASE + index * 60_000 + (close ? 59_999 : 0);
  return new Date(value).toISOString();
}

function candle(
  index: number,
  values: Partial<Pick<
    LevelEngineCandle,
    'open' | 'high' | 'low' | 'close' | 'isClosed'
  >> = {},
): LevelEngineCandle {
  return Object.freeze({
    openTime: timestamp(index, false),
    closeTime: timestamp(index, true),
    open: values.open ?? 100,
    high: values.high ?? 100.2,
    low: values.low ?? 99.8,
    close: values.close ?? 100,
    isClosed: values.isClosed ?? true,
  });
}

function candles(count = 22): LevelEngineCandle[] {
  return Array.from({ length: count }, (_, index) => candle(index));
}

function episode(
  id: string,
  kind: LevelEngineKind,
  startIndex: number,
  confirmedIndex: number,
): TouchEpisode {
  return Object.freeze({
    id,
    symbol: 'BTCUSDT',
    sourceTimeframe: '1m',
    kind,
    startCandleIndex: startIndex,
    endCandleIndex: startIndex,
    anchorCandleIndex: startIndex,
    startedAt: timestamp(startIndex),
    endedAt: timestamp(startIndex),
    anchorAt: timestamp(startIndex),
    confirmedAt: timestamp(confirmedIndex),
    extremePrice: kind === 'support' ? 99.8 : 100.2,
    atrAtTouch: 1,
    departureDistance: 1,
    departureAtr: 1,
    departureCandles: confirmedIndex - startIndex,
  });
}

function candidate(
  kind: LevelEngineKind,
  episodes: readonly TouchEpisode[],
) {
  return createLevelCandidate({
    id: `BTCUSDT-1m-source-${kind}`,
    symbol: 'BTCUSDT',
    sourceTimeframe: '1m',
    kind,
    zone: ZONE,
    activeFrom: episodes[0]!.confirmedAt,
    detectedAt: episodes.at(-1)!.confirmedAt,
    maturity: episodes.length >= 2 ? 'confirmed' : 'candidate',
    status: 'active',
    decision: 'accepted',
    touchEpisodes: episodes,
    acceptanceReasons: episodes.length >= 2
      ? ['confirmed_departure', 'independent_touch_episode']
      : ['confirmed_departure'],
  });
}

function detector(
  episodesByKind: Partial<Record<
    LevelEngineKind,
    readonly TouchEpisode[]
  >> = {},
) {
  return (
    target: TouchEpisodeDetectionTarget,
    values: readonly LevelEngineCandle[],
  ): TouchEpisodeDetectionResult => Object.freeze({
    symbol: target.symbol,
    sourceTimeframe: target.sourceTimeframe,
    kind: target.kind,
    zone: target.zone,
    closedCandlesCount: values.filter((value) => value.isClosed).length,
    ignoredOpenCandlesCount: values.filter((value) => !value.isClosed).length,
    episodes: Object.freeze([...(episodesByKind[target.kind] ?? [])]),
    rejectedInteractions: Object.freeze([]),
    pendingInteraction: null,
    observationalOnly: true,
    createsSetup: false,
  });
}

function dataset(values: readonly LevelEngineCandle[]) {
  return Object.freeze({
    symbol: 'BTCUSDT',
    sourceTimeframe: '1m' as const,
    candles: Object.freeze([...values]),
  });
}

test('keeps independent same-role touches in one active cycle', () => {
  const touches = [
    episode('support-1', 'support', 2, 3),
    episode('support-2', 'support', 9, 10),
  ];
  const result = buildLevelLifecycle(
    candidate('support', touches),
    dataset(candles()),
    OPTIONS,
    { detectTouchEpisodes: detector() },
  );

  assert.equal(result.cycles.length, 1);
  assert.equal(result.cycles[0]?.candidate.maturity, 'confirmed');
  assert.equal(result.cycles[0]?.candidate.touchEpisodes.length, 2);
  assert.equal(result.cycles[0]?.transition.type, 'origin');
  assert.equal(result.cycles[0]?.candidate.status, 'active');
  assert.equal(result.currentCycleId, result.cycles[0]?.id);
});

test('splits support history after a break and starts a reclaim cycle', () => {
  const values = candles();
  values[6] = candle(6, {
    open: 100,
    high: 100.2,
    low: 99.1,
    close: 99.3,
  });
  values[7] = candle(7, {
    open: 99.8,
    high: 100,
    low: 99,
    close: 99.2,
  });
  const touches = [
    episode('support-before-break', 'support', 2, 3),
    episode('support-after-reclaim', 'support', 12, 13),
  ];

  const result = buildLevelLifecycle(
    candidate('support', touches),
    dataset(values),
    OPTIONS,
    { detectTouchEpisodes: detector() },
  );

  assert.equal(result.cycles.length, 2);
  assert.equal(result.cycles[0]?.candidate.status, 'broken');
  assert.equal(result.cycles[0]?.candidate.touchEpisodes.length, 1);
  assert.equal(result.cycles[1]?.transition.type, 'reclaim');
  assert.equal(result.cycles[1]?.kind, 'support');
  assert.equal(result.cycles[1]?.candidate.touchEpisodes.length, 1);
  assert.equal(result.cycles[1]?.candidate.maturity, 'candidate');
  assert.equal(
    result.cycles[1]?.candidate.activeFrom,
    touches[1]?.confirmedAt,
  );
  assert.equal(result.reclaimCount, 1);
});

test('creates a support flip only after resistance is broken', () => {
  const values = candles();
  values[6] = candle(6, {
    open: 101.1,
    high: 101.6,
    low: 101,
    close: 101.5,
  });
  const resistance = episode(
    'resistance-origin',
    'resistance',
    2,
    3,
  );
  const support = episode(
    'support-flip',
    'support',
    10,
    11,
  );

  const result = buildLevelLifecycle(
    candidate('resistance', [resistance]),
    dataset(values),
    OPTIONS,
    {
      detectTouchEpisodes: detector({
        support: [support],
      }),
    },
  );

  assert.equal(result.cycles.length, 2);
  assert.equal(result.cycles[0]?.kind, 'resistance');
  assert.equal(result.cycles[0]?.candidate.status, 'broken');
  assert.equal(result.cycles[1]?.kind, 'support');
  assert.equal(result.cycles[1]?.transition.type, 'flip');
  assert.deepEqual(
    result.cycles[1]?.candidate.acceptanceReasons,
    ['confirmed_departure', 'role_flip_evidence'],
  );
  assert.equal(result.flipCount, 1);
});

test('does not let touches from opposite sides confirm one cycle', () => {
  const values = candles();
  values[6] = candle(6, {
    open: 100,
    high: 100.1,
    low: 99,
    close: 99.3,
  });
  values[7] = candle(7, {
    open: 99.8,
    high: 99.9,
    low: 99,
    close: 99.2,
  });
  const touches = [
    episode('old-support', 'support', 2, 3),
    episode('new-support', 'support', 12, 13),
  ];

  const result = buildLevelLifecycle(
    candidate('support', touches),
    dataset(values),
    OPTIONS,
    { detectTouchEpisodes: detector() },
  );

  assert.deepEqual(
    result.cycles.map((cycle) => cycle.candidate.maturity),
    ['candidate', 'candidate'],
  );
  assert.deepEqual(
    result.cycles.map(
      (cycle) => cycle.candidate.touchEpisodes.map((item) => item.id),
    ),
    [['old-support'], ['new-support']],
  );
});

test('ends a broken cycle without inventing a replacement role', () => {
  const values = candles(12);
  values[6] = candle(6, {
    open: 99,
    high: 99.2,
    low: 98.5,
    close: 98.8,
  });

  const result = buildLevelLifecycle(
    candidate('support', [episode('support', 'support', 2, 3)]),
    dataset(values),
    OPTIONS,
    { detectTouchEpisodes: detector() },
  );

  assert.equal(result.cycles.length, 1);
  assert.equal(result.cycles[0]?.breakEvidence?.mode, 'decisive_body_break');
  assert.equal(result.currentCycleId, null);
  assert.equal(result.breakCount, 1);
});

test('does not break support on only one non-decisive close', () => {
  const values = candles(12);
  values[6] = candle(6, {
    open: 100,
    high: 100.2,
    low: 99,
    close: 99.3,
  });

  const result = buildLevelLifecycle(
    candidate('support', [episode('support', 'support', 2, 3)]),
    dataset(values),
    OPTIONS,
    { detectTouchEpisodes: detector() },
  );

  assert.equal(result.cycles[0]?.breakEvidence, null);
  assert.notEqual(result.currentCycleId, null);
});

test('ignores an unfinished candle as break evidence', () => {
  const values = candles(8);
  values[7] = candle(7, {
    open: 98.9,
    high: 99,
    low: 98,
    close: 98.2,
    isClosed: false,
  });

  const result = buildLevelLifecycle(
    candidate('support', [episode('support', 'support', 2, 3)]),
    dataset(values),
    OPTIONS,
    { detectTouchEpisodes: detector() },
  );

  assert.equal(result.cycles[0]?.breakEvidence, null);
});

test('ignores opposite-role episodes when no causal break exists', () => {
  const resistance = episode('resistance-no-break', 'resistance', 8, 9);
  const result = buildLevelLifecycle(
    candidate('support', [episode('support', 'support', 2, 3)]),
    dataset(candles()),
    OPTIONS,
    {
      detectTouchEpisodes: detector({
        resistance: [resistance],
      }),
    },
  );

  assert.equal(result.cycles.length, 1);
  assert.equal(result.flipCount, 0);
  assert.equal(
    result.ignoredEpisodes.some(
      (item) => item.episodeId === resistance.id
        && item.reason === 'opposite_role_without_break',
    ),
    true,
  );
});

test('supports multiple causal role cycles with reset touch history', () => {
  const values = candles(24);
  values[6] = candle(6, {
    open: 101.1,
    high: 101.7,
    low: 101,
    close: 101.5,
  });
  values[14] = candle(14, {
    open: 99,
    high: 99.2,
    low: 98.6,
    close: 98.8,
  });
  const origin = episode('resistance-origin', 'resistance', 2, 3);
  const supportFlip = episode('support-flip', 'support', 10, 11);
  const resistanceFlip = episode('resistance-flip', 'resistance', 18, 19);

  const result = buildLevelLifecycle(
    candidate('resistance', [origin]),
    dataset(values),
    OPTIONS,
    {
      detectTouchEpisodes: detector({
        support: [supportFlip],
        resistance: [resistanceFlip],
      }),
    },
  );

  assert.deepEqual(
    result.cycles.map((cycle) => cycle.kind),
    ['resistance', 'support', 'resistance'],
  );
  assert.deepEqual(
    result.cycles.map((cycle) => cycle.transition.type),
    ['origin', 'flip', 'flip'],
  );
  assert.deepEqual(
    result.cycles.map((cycle) => cycle.candidate.touchEpisodes.length),
    [1, 1, 1],
  );
  assert.equal(result.flipCount, 2);
});

test('does not use an episode that began before break confirmation', () => {
  const values = candles(14);
  values[6] = candle(6, {
    open: 101.1,
    high: 101.5,
    low: 101,
    close: 101.4,
  });
  const straddling = episode(
    'straddling-support',
    'support',
    5,
    7,
  );

  const result = buildLevelLifecycle(
    candidate(
      'resistance',
      [episode('resistance', 'resistance', 2, 3)],
    ),
    dataset(values),
    OPTIONS,
    {
      detectTouchEpisodes: detector({
        support: [straddling],
      }),
    },
  );

  assert.equal(result.cycles.length, 1);
  assert.equal(result.currentCycleId, null);
  assert.equal(
    result.ignoredEpisodes.some(
      (item) => item.episodeId === straddling.id
        && item.reason === 'started_before_break_confirmation',
    ),
    true,
  );
});

test('rejects a dataset from another symbol or timeframe', () => {
  const source = candidate(
    'support',
    [episode('support', 'support', 2, 3)],
  );

  assert.throws(
    () => buildLevelLifecycle(
      source,
      {
        symbol: 'ETHUSDT',
        sourceTimeframe: '1m',
        candles: candles(),
      },
      OPTIONS,
      { detectTouchEpisodes: detector() },
    ),
    /dataset symbol must match candidate symbol/,
  );

  assert.throws(
    () => buildLevelLifecycle(
      source,
      {
        symbol: 'BTCUSDT',
        sourceTimeframe: '5m',
        candles: candles(),
      },
      OPTIONS,
      { detectTouchEpisodes: detector() },
    ),
    /dataset timeframe must match candidate timeframe/,
  );
});

test('returns deterministic frozen observational lifecycle structures', () => {
  const source = candidate(
    'support',
    [episode('support', 'support', 2, 3)],
  );
  const first = buildLevelLifecycle(
    source,
    dataset(candles()),
    OPTIONS,
    { detectTouchEpisodes: detector() },
  );
  const second = buildLevelLifecycle(
    source,
    dataset(candles()),
    OPTIONS,
    { detectTouchEpisodes: detector() },
  );

  assert.equal(first.cycles[0]?.id, second.cycles[0]?.id);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.cycles), true);
  assert.equal(Object.isFrozen(first.cycles[0]), true);
  assert.equal(Object.isFrozen(first.cycles[0]?.candidate), true);
  assert.equal(first.observationalOnly, true);
  assert.equal(first.createsSetup, false);
  assert.equal(first.usesQualityScore, false);
});
