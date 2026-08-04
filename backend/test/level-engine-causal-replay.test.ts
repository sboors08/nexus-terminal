import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLevelCandidate,
} from '../src/modules/level-engine/level-engine.contract.js';
import {
  replayLevelEngineCausally,
} from '../src/modules/level-engine/level-engine-causal-replay.js';
import type {
  LevelCandidate,
  LevelEngineKind,
  TouchEpisode,
} from '../src/modules/level-engine/level-engine.types.js';
import type {
  LevelEngineCandle,
} from '../src/modules/level-engine/level-engine-touch-detector.types.js';
import type {
  LevelEngineTimeframeDataset,
  MultiTimeframeLevelDetectionResult,
} from '../src/modules/level-engine/level-engine-multi-timeframe-detector.types.js';
import type {
  LevelLifecycleBreakEvidence,
  LevelLifecycleCycle,
  LevelLifecycleResult,
  LevelLifecycleTransitionType,
} from '../src/modules/level-engine/level-engine-lifecycle.types.js';

const BASE = Date.UTC(2026, 0, 1);
const ZONE = Object.freeze({
  low: 99.5,
  reference: 100,
  high: 100.5,
});
const OPTIONS = Object.freeze({
  detector: Object.freeze({
    atrPeriod: 2,
    pivotLeftBars: 1,
    pivotRightBars: 1,
    zoneHalfWidthAtr: 0.35,
    clusterDistanceAtr: 0.75,
    touchEpisodes: Object.freeze({
      atrPeriod: 2,
      minDepartureAtr: 0.8,
      maxDepartureCandles: 8,
      minBarsBetweenEpisodes: 1,
      maxEpisodeSpanCandles: 6,
    }),
  }),
  lifecycle: Object.freeze({
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
  }),
  startAtClosedCandleCount: 2,
});

function timestamp(index: number, close = true): string {
  return new Date(
    BASE + index * 60_000 + (close ? 59_999 : 0),
  ).toISOString();
}

function candle(
  index: number,
  isClosed = true,
): LevelEngineCandle {
  return Object.freeze({
    openTime: timestamp(index, false),
    closeTime: timestamp(index, true),
    open: 100,
    high: 100.4,
    low: 99.6,
    close: 100,
    isClosed,
  });
}

function dataset(
  closedCount = 7,
  withOpen = false,
): LevelEngineTimeframeDataset {
  const values = Array.from(
    { length: closedCount },
    (_, index) => candle(index),
  );
  if (withOpen) {
    values.push(candle(closedCount, false));
  }
  return Object.freeze({
    symbol: 'BTCUSDT',
    sourceTimeframe: '1m',
    candles: Object.freeze(values),
  });
}

function episode(
  id: string,
  kind: LevelEngineKind,
  index: number,
): TouchEpisode {
  return Object.freeze({
    id,
    symbol: 'BTCUSDT',
    sourceTimeframe: '1m',
    kind,
    startCandleIndex: index,
    endCandleIndex: index,
    anchorCandleIndex: index,
    startedAt: timestamp(index),
    endedAt: timestamp(index),
    anchorAt: timestamp(index),
    confirmedAt: timestamp(index),
    extremePrice: kind === 'support' ? 99.7 : 100.3,
    atrAtTouch: 1,
    departureDistance: 1,
    departureAtr: 1,
    departureCandles: 1,
  });
}

function candidate(
  touches: number,
  detectedIndex: number,
  id = 'BTCUSDT-1m-level-support-source',
  kind: LevelEngineKind = 'support',
): LevelCandidate {
  const episodes = Array.from(
    { length: touches },
    (_, index) => episode(`${id}-touch-${index + 1}`, kind, index + 1),
  );
  return createLevelCandidate({
    id,
    symbol: 'BTCUSDT',
    sourceTimeframe: '1m',
    kind,
    zone: ZONE,
    activeFrom: episodes[0]!.confirmedAt,
    detectedAt: timestamp(detectedIndex),
    maturity: touches >= 2 ? 'confirmed' : 'candidate',
    status: 'active',
    decision: 'accepted',
    touchEpisodes: episodes,
    acceptanceReasons: touches >= 2
      ? ['confirmed_departure', 'independent_touch_episode']
      : ['confirmed_departure'],
  });
}

function detection(
  candidates: readonly LevelCandidate[],
  closedCandlesCount: number,
): MultiTimeframeLevelDetectionResult {
  return Object.freeze({
    symbol: 'BTCUSDT',
    requestedTimeframes: Object.freeze(['1m'] as const),
    timeframes: Object.freeze([Object.freeze({
      symbol: 'BTCUSDT',
      sourceTimeframe: '1m' as const,
      closedCandlesCount,
      ignoredOpenCandlesCount: 0,
      pivotSeeds: Object.freeze([]),
      candidates: Object.freeze([...candidates]),
      rejectedClusters: Object.freeze([]),
    })]),
    candidates: Object.freeze([...candidates]),
    observationalOnly: true,
    createsSetup: false,
    mergesAcrossTimeframes: false,
  });
}

function cycle(
  source: LevelCandidate,
  sequence: number,
  transitionType: LevelLifecycleTransitionType,
  kind: LevelEngineKind,
  touches: number,
  broken: LevelLifecycleBreakEvidence | null = null,
): LevelLifecycleCycle {
  const cycleCandidate = candidate(
    touches,
    Math.max(2, touches + sequence),
    `${source.id}-cycle-${sequence}-${kind}`,
    kind,
  );
  return Object.freeze({
    id: cycleCandidate.id,
    sequence,
    sourceCandidateId: source.id,
    symbol: source.symbol,
    sourceTimeframe: source.sourceTimeframe,
    kind,
    zone: ZONE,
    transition: Object.freeze({
      type: transitionType,
      fromCycleId: sequence === 1
        ? null
        : `${source.id}-cycle-${sequence - 1}-support`,
      occurredAt: cycleCandidate.activeFrom,
      triggerEpisodeId: cycleCandidate.touchEpisodes[0]!.id,
    }),
    candidate: broken === null
      ? cycleCandidate
      : createLevelCandidate({
          id: cycleCandidate.id,
          symbol: cycleCandidate.symbol,
          sourceTimeframe: cycleCandidate.sourceTimeframe,
          kind: cycleCandidate.kind,
          zone: cycleCandidate.zone,
          activeFrom: cycleCandidate.activeFrom,
          detectedAt: cycleCandidate.detectedAt,
          maturity: cycleCandidate.maturity,
          status: 'broken',
          decision: 'accepted',
          touchEpisodes: cycleCandidate.touchEpisodes,
          acceptanceReasons: cycleCandidate.acceptanceReasons,
        }),
    endedAt: broken?.brokenAt ?? null,
    breakEvidence: broken,
  });
}

function lifecycle(
  source: LevelCandidate,
  cycles: readonly LevelLifecycleCycle[],
): LevelLifecycleResult {
  const current = cycles.at(-1);
  return Object.freeze({
    sourceCandidateId: source.id,
    symbol: source.symbol,
    sourceTimeframe: source.sourceTimeframe,
    zone: source.zone,
    cycles: Object.freeze([...cycles]),
    currentCycleId: current && current.breakEvidence === null
      ? current.id
      : null,
    ignoredEpisodes: Object.freeze([]),
    breakCount: cycles.filter((value) => value.breakEvidence !== null).length,
    flipCount: cycles.filter(
      (value) => value.transition.type === 'flip',
    ).length,
    reclaimCount: cycles.filter(
      (value) => value.transition.type === 'reclaim',
    ).length,
    observationalOnly: true,
    createsSetup: false,
    usesQualityScore: false,
  });
}

function emptyLifecycle(source: LevelCandidate): LevelLifecycleResult {
  return lifecycle(source, []);
}

test('feeds only closed candle prefixes and never exposes the open candle', () => {
  const prefixLengths: number[] = [];
  const result = replayLevelEngineCausally(
    dataset(6, true),
    OPTIONS,
    {
      detectCandidates: (datasets) => {
        const values = datasets[0]!.candles;
        prefixLengths.push(values.length);
        assert.ok(values.every((value) => value.isClosed));
        return detection([], values.length);
      },
      buildLifecycle: emptyLifecycle,
    },
  );

  assert.deepEqual(prefixLengths, [2, 3, 4, 5, 6]);
  assert.equal(result.closedCandlesCount, 6);
  assert.equal(result.ignoredOpenCandlesCount, 1);
  assert.equal(result.totals.replayStepCount, 5);
  assert.equal(result.usesFutureCandles, false);
});

test('records exact first appearance and confirmation without replacing the source snapshot', () => {
  const source = candidate(1, 2);
  const confirmed = candidate(2, 3);
  const later = candidate(3, 5);

  const result = replayLevelEngineCausally(
    dataset(),
    OPTIONS,
    {
      detectCandidates: (datasets) => {
        const count = datasets[0]!.candles.length;
        if (count < 3) return detection([], count);
        if (count === 3) return detection([source], count);
        if (count < 6) return detection([confirmed], count);
        return detection([later], count);
      },
      buildLifecycle: (value) => lifecycle(
        value,
        [cycle(value, 1, 'origin', 'support', 1)],
      ),
    },
  );

  const track = result.candidateTracks[0]!;
  assert.equal(track.firstSeenAt, timestamp(2));
  assert.equal(track.firstConfirmedAt, timestamp(3));
  assert.equal(track.sourceCandidate.detectedAt, timestamp(2));
  assert.equal(track.sourceCandidate.touchEpisodes.length, 1);
  assert.equal(track.latestDetectorCandidate.detectedAt, timestamp(5));
  assert.equal(track.maxDetectorTouchEpisodeCount, 3);
  assert.equal(result.totals.confirmedCandidateTrackCount, 1);
});

test('observes a break only when its confirming prefix is available', () => {
  const source = candidate(1, 2);
  const breakEvidence: LevelLifecycleBreakEvidence = Object.freeze({
    mode: 'consecutive_closes',
    fromKind: 'support',
    candleIndex: 4,
    brokenAt: timestamp(4),
    boundary: ZONE.low,
    close: 99,
    distanceBeyondBoundary: 0.5,
    distanceBeyondBoundaryAtr: 0.5,
  });

  const result = replayLevelEngineCausally(
    dataset(),
    OPTIONS,
    {
      detectCandidates: (datasets) => {
        const count = datasets[0]!.candles.length;
        return detection(count >= 3 ? [source] : [], count);
      },
      buildLifecycle: (value, replayDataset) => {
        const count = replayDataset.candles.length;
        return lifecycle(value, [
          cycle(
            value,
            1,
            'origin',
            'support',
            1,
            count >= 5 ? breakEvidence : null,
          ),
        ]);
      },
    },
  );

  const broken = result.events.find(
    (value) => value.type === 'cycle_broken',
  );
  assert.equal(broken?.observedAt, timestamp(4));
  assert.equal(broken?.marketOccurredAt, timestamp(4));
  assert.equal(result.totals.brokenCycleTrackCount, 1);
});

test('records flip only after the broken origin and opposite-role cycle become observable', () => {
  const source = candidate(1, 2);
  const breakEvidence: LevelLifecycleBreakEvidence = Object.freeze({
    mode: 'decisive_body_break',
    fromKind: 'support',
    candleIndex: 4,
    brokenAt: timestamp(4),
    boundary: ZONE.low,
    close: 99,
    distanceBeyondBoundary: 0.5,
    distanceBeyondBoundaryAtr: 0.7,
  });

  const result = replayLevelEngineCausally(
    dataset(),
    OPTIONS,
    {
      detectCandidates: (datasets) => {
        const count = datasets[0]!.candles.length;
        return detection(count >= 3 ? [source] : [], count);
      },
      buildLifecycle: (value, replayDataset) => {
        const count = replayDataset.candles.length;
        const origin = cycle(
          value,
          1,
          'origin',
          'support',
          1,
          count >= 5 ? breakEvidence : null,
        );
        const cycles = count >= 6
          ? [origin, cycle(value, 2, 'flip', 'resistance', 1)]
          : [origin];
        return lifecycle(value, cycles);
      },
    },
  );

  const flip = result.events.find(
    (value) =>
      value.type === 'cycle_started'
      && value.transition === 'flip',
  );
  assert.equal(flip?.observedAt, timestamp(5));
  assert.equal(flip?.kind, 'resistance');
  assert.equal(result.totals.flipCycleTrackCount, 1);
  assert.equal(result.totals.originCycleTrackCount, 1);
});

test('tracks detector disappearance and reappearance without losing lifecycle history', () => {
  const source = candidate(1, 2);
  const result = replayLevelEngineCausally(
    dataset(),
    OPTIONS,
    {
      detectCandidates: (datasets) => {
        const count = datasets[0]!.candles.length;
        if (count === 3 || count === 4 || count >= 6) {
          return detection([source], count);
        }
        return detection([], count);
      },
      buildLifecycle: (value) => lifecycle(
        value,
        [cycle(value, 1, 'origin', 'support', 1)],
      ),
    },
  );

  const track = result.candidateTracks[0]!;
  assert.equal(track.disappearanceCount, 1);
  assert.equal(track.reappearanceCount, 1);
  assert.equal(track.presentAtEnd, true);
  assert.equal(track.cycles.length, 1);
  assert.equal(result.totals.candidateDisappearanceCount, 1);
  assert.equal(result.totals.candidateReappearanceCount, 1);
});

test('records detector and lifecycle touch growth as separate causal events', () => {
  const source = candidate(1, 2);
  const confirmed = candidate(2, 3);
  const result = replayLevelEngineCausally(
    dataset(5),
    OPTIONS,
    {
      detectCandidates: (datasets) => {
        const count = datasets[0]!.candles.length;
        if (count < 3) return detection([], count);
        return detection([count === 3 ? source : confirmed], count);
      },
      buildLifecycle: (value, replayDataset) => lifecycle(
        value,
        [cycle(
          value,
          1,
          'origin',
          'support',
          replayDataset.candles.length >= 4 ? 2 : 1,
        )],
      ),
    },
  );

  assert.equal(result.events.filter(
    (value) => value.type === 'candidate_touch_added',
  ).length, 1);
  assert.equal(result.events.filter(
    (value) => value.type === 'cycle_touch_added',
  ).length, 1);
  assert.equal(result.events.filter(
    (value) => value.type === 'candidate_confirmed',
  ).length, 1);
  assert.equal(result.events.filter(
    (value) => value.type === 'cycle_confirmed',
  ).length, 1);
});

test('returns deterministic frozen observational structures without setup or score', () => {
  const source = candidate(1, 2);
  const dependencies = {
    detectCandidates: (datasets: readonly LevelEngineTimeframeDataset[]) => {
      const count = datasets[0]!.candles.length;
      return detection(count >= 3 ? [source] : [], count);
    },
    buildLifecycle: (value: LevelCandidate) => lifecycle(
      value,
      [cycle(value, 1, 'origin', 'support', 1)],
    ),
  };
  const first = replayLevelEngineCausally(
    dataset(4, true),
    OPTIONS,
    dependencies,
  );
  const second = replayLevelEngineCausally(
    dataset(4, true),
    OPTIONS,
    dependencies,
  );

  assert.deepEqual(first, second);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.candidateTracks));
  assert.ok(Object.isFrozen(first.candidateTracks[0]));
  assert.ok(Object.isFrozen(first.candidateTracks[0]?.cycles));
  assert.ok(Object.isFrozen(first.events));
  assert.equal(first.observationalOnly, true);
  assert.equal(first.createsSetup, false);
  assert.equal(first.usesQualityScore, false);
  assert.equal(first.usesFutureCandles, false);
  assert.equal(first.mergesAcrossTimeframes, false);
});

test('rejects detector output that references a future candle', () => {
  const future = candidate(1, 6);
  assert.throws(
    () => replayLevelEngineCausally(
      dataset(4),
      OPTIONS,
      {
        detectCandidates: (datasets) => {
          const count = datasets[0]!.candles.length;
          return detection(count >= 3 ? [future] : [], count);
        },
        buildLifecycle: emptyLifecycle,
      },
    ),
    /cannot depend on a future candle/,
  );
});
