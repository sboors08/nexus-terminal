import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLevelCandidate,
} from '../src/modules/level-engine/level-engine.contract.js';
import {
  buildLevelEngineCausalReplayRealDataValidationReport,
} from '../src/modules/level-engine/level-engine-causal-replay-real-data-validation.js';
import {
  LEVEL_ENGINE_BREAK_SEARCH_WINDOWS,
} from '../src/modules/level-engine/level-engine-break-evaluator.js';
import {
  DEFAULT_LEVEL_LIFECYCLE_OPTIONS,
} from '../src/modules/level-engine/level-engine-lifecycle.js';
import type {
  LevelCandidate,
  LevelEngineKind,
  LevelEngineTimeframe,
  TouchEpisode,
} from '../src/modules/level-engine/level-engine.types.js';
import type {
  LevelEngineCausalReplayCandidateTrack,
  LevelEngineCausalReplayCycleTrack,
  LevelEngineCausalReplayEvent,
  LevelEngineCausalReplayResult,
} from '../src/modules/level-engine/level-engine-causal-replay.types.js';
import type {
  LevelLifecycleCycle,
  LevelLifecycleResult,
  LevelLifecycleTransitionType,
} from '../src/modules/level-engine/level-engine-lifecycle.types.js';
import type {
  LevelEngineCandle,
} from '../src/modules/level-engine/level-engine-touch-detector.types.js';
import type {
  LevelEngineLifecycleRealDataValidationReport,
  LevelEngineLifecycleValidationReviewItem,
} from '../src/modules/level-engine/level-engine-lifecycle-real-data-validation.types.js';
import type {
  LevelEngineValidationReviewDiagnostic,
} from '../src/modules/level-engine/level-engine-real-data-validation.types.js';

const BASE = Date.UTC(2026, 0, 1);
const ZONE = Object.freeze({ low: 99.5, reference: 100, high: 100.5 });

function timestamp(index: number, close = true): string {
  return new Date(
    BASE + index * 60_000 + (close ? 59_999 : 0),
  ).toISOString();
}

function candle(index: number): LevelEngineCandle {
  return Object.freeze({
    openTime: timestamp(index, false),
    closeTime: timestamp(index),
    open: 100,
    high: 100.3,
    low: 99.7,
    close: 100,
    isClosed: true,
  });
}

function episode(
  id: string,
  timeframe: LevelEngineTimeframe,
  kind: LevelEngineKind,
  index: number,
): TouchEpisode {
  return Object.freeze({
    id,
    symbol: 'BTCUSDT',
    sourceTimeframe: timeframe,
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
  id: string,
  timeframe: LevelEngineTimeframe,
  activeIndex: number,
  detectedIndex: number,
  kind: LevelEngineKind = 'support',
  touchCount = 2,
): LevelCandidate {
  const episodes = Array.from(
    { length: touchCount },
    (_, index) => episode(
      `${id}-touch-${index + 1}`,
      timeframe,
      kind,
      index === 0 ? activeIndex : detectedIndex,
    ),
  );
  return createLevelCandidate({
    id,
    symbol: 'BTCUSDT',
    sourceTimeframe: timeframe,
    kind,
    zone: ZONE,
    activeFrom: timestamp(activeIndex),
    detectedAt: timestamp(detectedIndex),
    maturity: touchCount >= 2 ? 'confirmed' : 'candidate',
    status: 'active',
    decision: 'accepted',
    touchEpisodes: episodes,
    acceptanceReasons: touchCount >= 2
      ? ['confirmed_departure', 'independent_touch_episode']
      : ['confirmed_departure'],
  });
}

function diagnostic(): LevelEngineValidationReviewDiagnostic {
  return Object.freeze({
    state: 'active',
    futureClosedCandlesCount: 5,
    firstFutureCandleIndex: 5,
    lastClosedCandleIndex: 19,
    lastClosedAt: timestamp(19),
    currentPrice: 100,
    currentAtr: 1,
    distanceFromZone: 0,
    distanceFromZoneAtr: 0,
    lastInteractionCandleIndex: 18,
    lastInteractionAt: timestamp(18),
    barsSinceLastInteraction: 1,
    breakEvidence: null,
  });
}

function lifecycleCycle(
  source: LevelCandidate,
): LevelLifecycleCycle {
  return Object.freeze({
    id: `${source.id}-lifecycle-origin`,
    sequence: 1,
    sourceCandidateId: source.id,
    symbol: source.symbol,
    sourceTimeframe: source.sourceTimeframe,
    kind: source.kind,
    zone: source.zone,
    transition: Object.freeze({
      type: 'origin' as const,
      fromCycleId: null,
      occurredAt: source.activeFrom,
      triggerEpisodeId: source.touchEpisodes[0]!.id,
    }),
    candidate: source,
    endedAt: null,
    breakEvidence: null,
  });
}

function lifecycle(source: LevelCandidate): LevelLifecycleResult {
  const cycle = lifecycleCycle(source);
  return Object.freeze({
    sourceCandidateId: source.id,
    symbol: source.symbol,
    sourceTimeframe: source.sourceTimeframe,
    zone: source.zone,
    cycles: Object.freeze([cycle]),
    currentCycleId: cycle.id,
    ignoredEpisodes: Object.freeze([]),
    breakCount: 0,
    flipCount: 0,
    reclaimCount: 0,
    observationalOnly: true,
    createsSetup: false,
    usesQualityScore: false,
  });
}

function reviewItem(
  source: LevelCandidate,
  reviewOrder: number,
): LevelEngineLifecycleValidationReviewItem {
  const sourceDiagnostic = diagnostic();
  const value = lifecycle(source);
  return Object.freeze({
    reviewOrder,
    sourceCandidate: source,
    candidate: source,
    sourceDiagnostic,
    diagnostic: sourceDiagnostic,
    lifecycle: value,
    lifecycleDiagnostic: Object.freeze({
      selectedCycleId: value.currentCycleId!,
      selectedCycleSequence: 1,
      selectedTransition: 'origin' as const,
      selectedCycleIsCurrent: true,
      sourceTouchEpisodeCount: source.touchEpisodes.length,
      selectedCycleTouchEpisodeCount: source.touchEpisodes.length,
      retainedSourceTouchEpisodeCount: source.touchEpisodes.length,
      discardedSourceTouchEpisodeCount: 0,
      lifecycleCycleCount: 1,
      lifecycleBreakCount: 0,
      lifecycleFlipCount: 0,
      lifecycleReclaimCount: 0,
      ignoredLifecycleEpisodeCount: 0,
      firstBreakAt: null,
      sourceDetectedBeforeFirstBreak: null,
    }),
    manualLabel: null,
    manualNote: null,
  });
}

interface ReportSpec {
  readonly timeframe: LevelEngineTimeframe;
  readonly candidates: readonly LevelCandidate[];
}

function report(
  specs: readonly ReportSpec[],
): LevelEngineLifecycleRealDataValidationReport {
  const datasets = specs.map((spec) => Object.freeze({
    symbol: 'BTCUSDT',
    sourceTimeframe: spec.timeframe,
    candles: Object.freeze(
      Array.from({ length: 20 }, (_, index) => candle(index)),
    ),
  }));
  const items = specs.flatMap((spec) =>
    spec.candidates.map((value, index) => reviewItem(value, index + 1)));
  const requestedTimeframes = Object.freeze(
    specs.map((spec) => spec.timeframe),
  );

  return Object.freeze({
    version: 'level-engine-lifecycle-real-data-validation-v0.1',
    sourceValidationVersion: 'level-engine-real-data-validation-v0.1',
    reviewDiagnosticsVersion: 'level-engine-review-diagnostics-v0.1',
    generatedAt: timestamp(19),
    binanceBaseUrl: 'https://fapi.binance.com',
    requestedSymbols: Object.freeze(['BTCUSDT']),
    requestedTimeframes,
    candlesPerTimeframe: 20,
    reviewLimitPerSymbol: 20,
    reviewPolicy: Object.freeze({
      atrPeriod: 14,
      decisiveBreakAtr: 0.35,
      consecutiveBreakCloses: 2,
      staleAfterBars: 120,
      staleDistanceAtr: 3,
      minimumFutureBars: 2,
    }),
    appliedOptions: Object.freeze({
      lifecycle: DEFAULT_LEVEL_LIFECYCLE_OPTIONS,
      reviewPolicy: Object.freeze({
        atrPeriod: 14,
        decisiveBreakAtr: 0.35,
        consecutiveBreakCloses: 2,
        staleAfterBars: 120,
        staleDistanceAtr: 3,
        minimumFutureBars: 2,
      }),
      breakSearchWindows: LEVEL_ENGINE_BREAK_SEARCH_WINDOWS,
    }),
    symbolReports: Object.freeze([Object.freeze({
      symbol: 'BTCUSDT',
      datasets: Object.freeze(datasets),
      detection: Object.freeze({
        symbol: 'BTCUSDT',
        requestedTimeframes,
        timeframes: Object.freeze([]),
        candidates: Object.freeze(specs.flatMap((spec) => spec.candidates)),
        observationalOnly: true,
        createsSetup: false,
        mergesAcrossTimeframes: false,
      }),
      timeframeSummaries: Object.freeze([]),
      reviewQueue: Object.freeze(items),
    })]),
    totals: Object.freeze({
      symbolCount: 1,
      timeframeDatasetCount: specs.length,
      candleCount: specs.length * 20,
      candidateCount: items.length,
      confirmedCount: items.length,
      reviewItemCount: items.length,
      reviewStateCounts: Object.freeze({
        active: items.length,
        broken: 0,
        stale: 0,
        pending: 0,
      }),
      sourceReviewStateCounts: Object.freeze({
        active: items.length,
        broken: 0,
        stale: 0,
        pending: 0,
      }),
      lifecycleCycleCount: items.length,
      lifecycleBreakCount: 0,
      lifecycleFlipCount: 0,
      lifecycleReclaimCount: 0,
      ignoredLifecycleEpisodeCount: 0,
      currentLifecycleCycleCount: items.length,
      terminalBrokenLifecycleCount: 0,
      sourceTouchEpisodeCount: items.length * 2,
      selectedCycleTouchEpisodeCount: items.length * 2,
      retainedSourceTouchEpisodeCount: items.length * 2,
      discardedSourceTouchEpisodeCount: 0,
      transitionCounts: Object.freeze({
        origin: items.length,
        flip: 0,
        reclaim: 0,
      }),
      preBreakDetectionCount: 0,
      lateOrPostBreakDetectionCount: 0,
      noBreakObservedCount: items.length,
    }),
    observationalOnly: true,
    createsSetup: false,
    mergesAcrossTimeframes: false,
    usesQualityScore: false,
  });
}

function replayEvent(
  eventIndex: number,
  type: LevelEngineCausalReplayEvent['type'],
  sourceCandidateId: string,
  observedIndex: number,
  marketIndex: number | null,
  transition: LevelLifecycleTransitionType | null = null,
  cycleId: string | null = null,
): LevelEngineCausalReplayEvent {
  return Object.freeze({
    eventIndex,
    type,
    observedAt: timestamp(observedIndex),
    observedCandleIndex: observedIndex,
    marketOccurredAt: marketIndex === null ? null : timestamp(marketIndex),
    sourceCandidateId,
    cycleId,
    kind: transition === 'flip' ? 'resistance' : 'support',
    transition,
    maturity: type.includes('confirmed') ? 'confirmed' : 'candidate',
    touchEpisodeCount: type.includes('confirmed') ? 2 : 1,
  });
}

function replayCycle(
  source: LevelCandidate,
  sequence: number,
  transition: LevelLifecycleTransitionType,
  marketIndex: number,
  observedIndex: number,
  brokenIndex: number | null = null,
): LevelEngineCausalReplayCycleTrack {
  const id = sequence === 1
    ? `${source.id}-lifecycle-origin`
    : `${source.id}-cycle-${sequence}`;
  return Object.freeze({
    id,
    sourceCandidateId: source.id,
    sequence,
    kind: transition === 'flip' ? 'resistance' : 'support',
    transition: Object.freeze({
      type: transition,
      fromCycleId: sequence === 1 ? null : `${source.id}-cycle-${sequence - 1}`,
      occurredAt: timestamp(marketIndex),
      triggerEpisodeId: source.touchEpisodes[0]!.id,
    }),
    firstObservedAt: timestamp(observedIndex),
    firstObservedCandleIndex: observedIndex,
    firstConfirmedAt: source.maturity === 'confirmed'
      ? timestamp(observedIndex + 1)
      : null,
    firstConfirmedCandleIndex: source.maturity === 'confirmed'
      ? observedIndex + 1
      : null,
    marketActiveFrom: timestamp(marketIndex),
    brokenAt: brokenIndex === null ? null : timestamp(brokenIndex),
    breakObservedAt: brokenIndex === null ? null : timestamp(brokenIndex + 1),
    breakObservedCandleIndex: brokenIndex === null ? null : brokenIndex + 1,
    breakEvidence: brokenIndex === null
      ? null
      : Object.freeze({
          mode: 'decisive_body_break' as const,
          fromKind: source.kind,
          candleIndex: brokenIndex,
          brokenAt: timestamp(brokenIndex),
          boundary: ZONE.low,
          close: 99,
          distanceBeyondBoundary: 0.5,
          distanceBeyondBoundaryAtr: 0.5,
        }),
    maxTouchEpisodeCount: 2,
    latestCandidate: source,
  });
}

function replayTrack(
  source: LevelCandidate,
  firstSeenIndex: number,
  firstConfirmedIndex: number | null,
  cycles: readonly LevelEngineCausalReplayCycleTrack[],
  disappearanceCount = 0,
  reappearanceCount = 0,
): LevelEngineCausalReplayCandidateTrack {
  return Object.freeze({
    id: source.id,
    symbol: source.symbol,
    sourceTimeframe: source.sourceTimeframe,
    kind: source.kind,
    sourceCandidate: source,
    latestDetectorCandidate: source,
    firstSeenAt: timestamp(firstSeenIndex),
    firstSeenCandleIndex: firstSeenIndex,
    firstConfirmedAt:
      firstConfirmedIndex === null ? null : timestamp(firstConfirmedIndex),
    firstConfirmedCandleIndex: firstConfirmedIndex,
    lastSeenAt: timestamp(19),
    lastSeenCandleIndex: 19,
    detectorObservationCount: 10,
    disappearanceCount,
    reappearanceCount,
    maxDetectorTouchEpisodeCount: 3,
    presentAtEnd: true,
    cycles: Object.freeze([...cycles]),
  });
}

interface ReplaySpec {
  readonly timeframe: LevelEngineTimeframe;
  readonly tracks: readonly LevelEngineCausalReplayCandidateTrack[];
  readonly events: readonly LevelEngineCausalReplayEvent[];
}

function replay(spec: ReplaySpec): LevelEngineCausalReplayResult {
  const cycles = spec.tracks.flatMap((track) => track.cycles);
  return Object.freeze({
    version: 'level-engine-causal-replay-v0.1',
    symbol: 'BTCUSDT',
    sourceTimeframe: spec.timeframe,
    closedCandlesCount: 20,
    ignoredOpenCandlesCount: 0,
    startAtClosedCandleCount: 4,
    candidateTracks: Object.freeze([...spec.tracks]),
    events: Object.freeze([...spec.events]),
    totals: Object.freeze({
      replayStepCount: 17,
      candidateTrackCount: spec.tracks.length,
      confirmedCandidateTrackCount: spec.tracks.filter(
        (track) => track.firstConfirmedAt !== null,
      ).length,
      cycleTrackCount: cycles.length,
      confirmedCycleTrackCount: cycles.filter(
        (cycle) => cycle.firstConfirmedAt !== null,
      ).length,
      brokenCycleTrackCount: cycles.filter(
        (cycle) => cycle.breakEvidence !== null,
      ).length,
      originCycleTrackCount: cycles.filter(
        (cycle) => cycle.transition.type === 'origin',
      ).length,
      flipCycleTrackCount: cycles.filter(
        (cycle) => cycle.transition.type === 'flip',
      ).length,
      reclaimCycleTrackCount: cycles.filter(
        (cycle) => cycle.transition.type === 'reclaim',
      ).length,
      candidateDisappearanceCount: spec.tracks.reduce(
        (sum, track) => sum + track.disappearanceCount,
        0,
      ),
      candidateReappearanceCount: spec.tracks.reduce(
        (sum, track) => sum + track.reappearanceCount,
        0,
      ),
    }),
    observationalOnly: true,
    createsSetup: false,
    usesQualityScore: false,
    usesFutureCandles: false,
    mergesAcrossTimeframes: false,
  });
}

function replayForCandidate(
  source: LevelCandidate,
  options: {
    readonly firstSeenMarketIndex: number;
    readonly firstSeenObservedIndex: number;
    readonly firstConfirmedMarketIndex?: number;
    readonly firstConfirmedObservedIndex?: number;
    readonly breakMarketIndex?: number;
    readonly disappearanceCount?: number;
    readonly reappearanceCount?: number;
    readonly includeFlip?: boolean;
    readonly includeReclaim?: boolean;
  },
): LevelEngineCausalReplayResult {
  const events: LevelEngineCausalReplayEvent[] = [];
  let eventIndex = 0;
  const origin = replayCycle(
    source,
    1,
    'origin',
    source.activeFrom === timestamp(2) ? 2 : options.firstSeenMarketIndex,
    options.firstSeenObservedIndex,
    options.breakMarketIndex ?? null,
  );
  const cycles: LevelEngineCausalReplayCycleTrack[] = [origin];
  events.push(replayEvent(
    eventIndex++,
    'candidate_first_seen',
    source.id,
    options.firstSeenObservedIndex,
    options.firstSeenMarketIndex,
  ));
  events.push(replayEvent(
    eventIndex++,
    'cycle_started',
    source.id,
    options.firstSeenObservedIndex,
    Number(source.activeFrom === timestamp(2) ? 2 : options.firstSeenMarketIndex),
    'origin',
    origin.id,
  ));
  if (
    options.firstConfirmedMarketIndex !== undefined
    && options.firstConfirmedObservedIndex !== undefined
  ) {
    events.push(replayEvent(
      eventIndex++,
      'candidate_confirmed',
      source.id,
      options.firstConfirmedObservedIndex,
      options.firstConfirmedMarketIndex,
    ));
  }
  if (options.breakMarketIndex !== undefined) {
    events.push(replayEvent(
      eventIndex++,
      'cycle_broken',
      source.id,
      options.breakMarketIndex + 1,
      options.breakMarketIndex,
      'origin',
      origin.id,
    ));
  }
  if (options.includeFlip) {
    const flip = replayCycle(source, 2, 'flip', 11, 14);
    cycles.push(flip);
    events.push(replayEvent(
      eventIndex++,
      'cycle_started',
      source.id,
      14,
      11,
      'flip',
      flip.id,
    ));
  }
  if (options.includeReclaim) {
    const reclaim = replayCycle(source, cycles.length + 1, 'reclaim', 15, 16);
    cycles.push(reclaim);
    events.push(replayEvent(
      eventIndex++,
      'cycle_started',
      source.id,
      16,
      15,
      'reclaim',
      reclaim.id,
    ));
  }
  const track = replayTrack(
    source,
    options.firstSeenObservedIndex,
    options.firstConfirmedObservedIndex ?? null,
    cycles,
    options.disappearanceCount ?? 0,
    options.reappearanceCount ?? 0,
  );
  return replay({
    timeframe: source.sourceTimeframe,
    tracks: [track],
    events,
  });
}

test('measures first-seen and confirmation lag without future candles', () => {
  const source = candidate('btc-1m-support', '1m', 2, 4);
  const sourceReport = report([{ timeframe: '1m', candidates: [source] }]);
  const result = buildLevelEngineCausalReplayRealDataValidationReport(
    sourceReport,
    {
      replayDataset: () => replayForCandidate(source, {
        firstSeenMarketIndex: 4,
        firstSeenObservedIndex: 6,
        firstConfirmedMarketIndex: 7,
        firstConfirmedObservedIndex: 8,
        breakMarketIndex: 10,
      }),
    },
  );

  const item = result.symbolReports[0]!.reviewQueue[0]!;
  assert.equal(item.causalReplayDiagnostic.firstSeen?.lagBars, 2);
  assert.equal(item.causalReplayDiagnostic.firstSeenFromActiveFromBars, 4);
  assert.equal(item.causalReplayDiagnostic.firstConfirmed?.lagBars, 1);
  assert.equal(item.causalReplayDiagnostic.firstSeenBreakTiming, 'before_break');
  assert.equal(
    item.causalReplayDiagnostic.firstConfirmedBreakTiming,
    'before_break',
  );
  assert.equal(
    item.causalReplayDiagnostic.selectedCycle.confirmationState,
    'confirmed_before_break',
  );
  assert.equal(result.totals.candidateFirstSeenLagBars.medianBars, 2);
  assert.equal(result.usesFutureCandles, false);
});

test('separates late, no-break, and unobserved review candidates', () => {
  const late = candidate('late', '1m', 2, 4);
  const missing = candidate('missing', '1m', 3, 5);
  const sourceReport = report([{
    timeframe: '1m',
    candidates: [late, missing],
  }]);
  const lateReplay = replayForCandidate(late, {
    firstSeenMarketIndex: 4,
    firstSeenObservedIndex: 7,
    breakMarketIndex: 6,
  });

  const result = buildLevelEngineCausalReplayRealDataValidationReport(
    sourceReport,
    { replayDataset: () => lateReplay },
  );

  const items = result.symbolReports[0]!.reviewQueue;
  assert.equal(
    items[0]!.causalReplayDiagnostic.firstSeenBreakTiming,
    'after_break',
  );
  assert.equal(items[1]!.causalReplayDiagnostic.trackFound, false);
  assert.equal(
    items[1]!.causalReplayDiagnostic.firstSeenBreakTiming,
    'not_observed',
  );
  assert.equal(result.totals.reviewFirstSeenAtOrAfterBreakCount, 1);
  assert.equal(result.totals.reviewFirstSeenNotObservedCount, 1);
});

test('aggregates origin, flip, reclaim, and break observation latency', () => {
  const source = candidate('cycles', '1m', 2, 4);
  const sourceReport = report([{ timeframe: '1m', candidates: [source] }]);
  const result = buildLevelEngineCausalReplayRealDataValidationReport(
    sourceReport,
    {
      replayDataset: () => replayForCandidate(source, {
        firstSeenMarketIndex: 4,
        firstSeenObservedIndex: 5,
        breakMarketIndex: 10,
        includeFlip: true,
        includeReclaim: true,
      }),
    },
  );

  assert.equal(result.totals.originStartLagBars.maximumBars, 3);
  assert.equal(result.totals.flipStartLagBars.maximumBars, 3);
  assert.equal(result.totals.reclaimStartLagBars.maximumBars, 1);
  assert.equal(result.totals.breakObservationLagBars.maximumBars, 1);
  assert.equal(result.totals.causalFlipCycleTrackCount, 1);
  assert.equal(result.totals.causalReclaimCycleTrackCount, 1);
});

test('reports detector disappearance and reappearance instability', () => {
  const source = candidate('unstable', '1m', 2, 4);
  const sourceReport = report([{ timeframe: '1m', candidates: [source] }]);
  const result = buildLevelEngineCausalReplayRealDataValidationReport(
    sourceReport,
    {
      replayDataset: () => replayForCandidate(source, {
        firstSeenMarketIndex: 4,
        firstSeenObservedIndex: 5,
        disappearanceCount: 3,
        reappearanceCount: 2,
      }),
    },
  );

  const diagnostic = result.symbolReports[0]!
    .reviewQueue[0]!.causalReplayDiagnostic;
  assert.equal(diagnostic.disappearanceCount, 3);
  assert.equal(diagnostic.reappearanceCount, 2);
  assert.equal(result.totals.causalCandidateDisappearanceCount, 3);
  assert.equal(result.totals.causalCandidateReappearanceCount, 2);
});

test('builds exact per-timeframe summaries and replays every dataset once', () => {
  const oneMinute = candidate('one-minute', '1m', 2, 4);
  const fiveMinute = candidate('five-minute', '5m', 2, 5);
  const sourceReport = report([
    { timeframe: '1m', candidates: [oneMinute] },
    { timeframe: '5m', candidates: [fiveMinute] },
  ]);
  const calls: string[] = [];
  const receivedLifecycleOptions: unknown[] = [];
  const receivedReplayOptionsFrozen: boolean[] = [];

  const result = buildLevelEngineCausalReplayRealDataValidationReport(
    sourceReport,
    {
      replayDataset: (datasetValue, replayOptions) => {
        calls.push(datasetValue.sourceTimeframe);
        receivedLifecycleOptions.push(replayOptions.lifecycle);
        receivedReplayOptionsFrozen.push(Object.isFrozen(replayOptions));
        const source = datasetValue.sourceTimeframe === '1m'
          ? oneMinute
          : fiveMinute;
        return replayForCandidate(source, {
          firstSeenMarketIndex: source.detectedAt === timestamp(4) ? 4 : 5,
          firstSeenObservedIndex:
            datasetValue.sourceTimeframe === '1m' ? 5 : 8,
        });
      },
    },
  );

  assert.deepEqual(calls, ['1m', '5m']);
  assert.equal(receivedLifecycleOptions.length, 2);
  assert.equal(
    receivedLifecycleOptions[0],
    sourceReport.appliedOptions.lifecycle,
  );
  assert.equal(
    receivedLifecycleOptions[1],
    sourceReport.appliedOptions.lifecycle,
  );
  assert.deepEqual(receivedReplayOptionsFrozen, [true, true]);
  assert.equal(result.totals.replayDatasetCount, 2);
  assert.equal(result.timeframeCausalReplaySummaries.length, 2);
  assert.equal(
    result.timeframeCausalReplaySummaries[0]!
      .candidateFirstSeenLagBars.medianBars,
    1,
  );
  assert.equal(
    result.timeframeCausalReplaySummaries[1]!
      .candidateFirstSeenLagBars.medianBars,
    3,
  );
  assert.equal(result.reusesFetchedDatasets, true);
});

test('returns deterministic frozen observational structures', () => {
  const source = candidate('frozen', '1m', 2, 4);
  const sourceReport = report([{ timeframe: '1m', candidates: [source] }]);
  const result = buildLevelEngineCausalReplayRealDataValidationReport(
    sourceReport,
    {
      replayDataset: () => replayForCandidate(source, {
        firstSeenMarketIndex: 4,
        firstSeenObservedIndex: 5,
      }),
    },
  );

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.symbolReports), true);
  assert.equal(Object.isFrozen(result.totals), true);
  assert.equal(Object.isFrozen(
    result.symbolReports[0]!.reviewQueue[0]!.causalReplayEvents,
  ), true);
  assert.equal(result.observationalOnly, true);
  assert.equal(result.createsSetup, false);
  assert.equal(result.usesQualityScore, false);
});


test('classifies selected-cycle confirmation against its own break', () => {
  const confirmed = candidate('selected-confirmed', '1m', 2, 4);
  const brokenUnconfirmed = candidate(
    'selected-broken-unconfirmed',
    '1m',
    2,
    4,
    'support',
    1,
  );
  const activeUnconfirmed = candidate(
    'selected-active-unconfirmed',
    '1m',
    2,
    4,
    'support',
    1,
  );
  const sourceReport = report([{
    timeframe: '1m',
    candidates: [confirmed, brokenUnconfirmed, activeUnconfirmed],
  }]);

  const confirmedReplay = replayForCandidate(confirmed, {
    firstSeenMarketIndex: 4,
    firstSeenObservedIndex: 4,
    firstConfirmedMarketIndex: 5,
    firstConfirmedObservedIndex: 5,
    breakMarketIndex: 10,
  });
  const brokenReplay = replayForCandidate(brokenUnconfirmed, {
    firstSeenMarketIndex: 4,
    firstSeenObservedIndex: 4,
    breakMarketIndex: 8,
  });
  const activeReplay = replayForCandidate(activeUnconfirmed, {
    firstSeenMarketIndex: 4,
    firstSeenObservedIndex: 4,
  });
  const combined = replay({
    timeframe: '1m',
    tracks: Object.freeze([
      ...confirmedReplay.candidateTracks,
      ...brokenReplay.candidateTracks,
      ...activeReplay.candidateTracks,
    ]),
    events: Object.freeze([
      ...confirmedReplay.events,
      ...brokenReplay.events.map((event, index) => Object.freeze({
        ...event,
        eventIndex: confirmedReplay.events.length + index,
      })),
      ...activeReplay.events.map((event, index) => Object.freeze({
        ...event,
        eventIndex:
          confirmedReplay.events.length + brokenReplay.events.length + index,
      })),
    ]),
  });

  const result = buildLevelEngineCausalReplayRealDataValidationReport(
    sourceReport,
    { replayDataset: () => combined },
  );
  const states = result.symbolReports[0]!.reviewQueue.map(
    (item) => item.causalReplayDiagnostic.selectedCycle.confirmationState,
  );

  assert.deepEqual(states, [
    'confirmed_before_break',
    'not_confirmed_broken',
    'not_confirmed_unbroken',
  ]);
  assert.equal(
    result.totals.selectedCycleConfirmationStateCounts
      .confirmed_before_break,
    1,
  );
  assert.equal(
    result.totals.selectedCycleConfirmationStateCounts
      .not_confirmed_broken,
    1,
  );
  assert.equal(
    result.totals.selectedCycleConfirmationStateCounts
      .not_confirmed_unbroken,
    1,
  );
});
