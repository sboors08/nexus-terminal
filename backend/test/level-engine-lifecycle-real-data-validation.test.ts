import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLevelCandidate,
} from '../src/modules/level-engine/level-engine.contract.js';
import {
  buildLevelEngineLifecycleRealDataReviewHtml,
} from '../src/modules/level-engine/level-engine-lifecycle-real-data-review-html.js';
import {
  buildLevelEngineLifecycleRealDataValidationReport,
} from '../src/modules/level-engine/level-engine-lifecycle-real-data-validation.js';
import type {
  LevelCandidate,
  LevelEngineKind,
  TouchEpisode,
} from '../src/modules/level-engine/level-engine.types.js';
import type {
  LevelLifecycleCycle,
  LevelLifecycleResult,
  LevelLifecycleTransitionType,
} from '../src/modules/level-engine/level-engine-lifecycle.types.js';
import type {
  LevelEngineCandle,
} from '../src/modules/level-engine/level-engine-touch-detector.types.js';
import type {
  LevelEngineRealDataValidationReport,
  LevelEngineValidationReviewDiagnostic,
  LevelEngineValidationReviewState,
} from '../src/modules/level-engine/level-engine-real-data-validation.types.js';

const BASE = Date.UTC(2026, 0, 1);
const ZONE = Object.freeze({ low: 99.5, reference: 100, high: 100.5 });

function timestamp(index: number, close = true): string {
  return new Date(BASE + index * 60_000 + (close ? 59_999 : 0)).toISOString();
}

function candle(index: number): LevelEngineCandle {
  return Object.freeze({
    openTime: timestamp(index, false),
    closeTime: timestamp(index),
    open: 100,
    high: 100.2,
    low: 99.8,
    close: 100,
    isClosed: true,
  });
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
  id: string,
  kind: LevelEngineKind,
  episodes: readonly TouchEpisode[],
  status: 'active' | 'broken' = 'active',
): LevelCandidate {
  return createLevelCandidate({
    id,
    symbol: 'BTCUSDT',
    sourceTimeframe: '1m',
    kind,
    zone: ZONE,
    activeFrom: episodes[0]!.confirmedAt,
    detectedAt: episodes.at(-1)!.confirmedAt,
    maturity: episodes.length >= 2 ? 'confirmed' : 'candidate',
    status,
    decision: 'accepted',
    touchEpisodes: episodes,
    acceptanceReasons: episodes.length >= 2
      ? ['confirmed_departure', 'independent_touch_episode']
      : ['confirmed_departure'],
  });
}

function cycle(
  sourceCandidateId: string,
  sequence: number,
  value: LevelCandidate,
  transition: LevelLifecycleTransitionType,
  broken: boolean,
): LevelLifecycleCycle {
  return Object.freeze({
    id: value.id,
    sequence,
    sourceCandidateId,
    symbol: value.symbol,
    sourceTimeframe: value.sourceTimeframe,
    kind: value.kind,
    zone: value.zone,
    transition: Object.freeze({
      type: transition,
      fromCycleId: sequence === 1 ? null : `${sourceCandidateId}-cycle-${sequence - 1}`,
      occurredAt: value.activeFrom,
      triggerEpisodeId: value.touchEpisodes[0]!.id,
    }),
    candidate: value,
    endedAt: broken ? timestamp(12) : null,
    breakEvidence: broken
      ? Object.freeze({
          mode: 'decisive_body_break' as const,
          fromKind: value.kind,
          candleIndex: 12,
          brokenAt: timestamp(12),
          boundary: value.kind === 'support' ? ZONE.low : ZONE.high,
          close: value.kind === 'support' ? 99 : 101,
          distanceBeyondBoundary: 0.5,
          distanceBeyondBoundaryAtr: 0.5,
        })
      : null,
  });
}

function lifecycle(
  source: LevelCandidate,
  cycles: readonly LevelLifecycleCycle[],
  currentCycleId: string | null,
): LevelLifecycleResult {
  return Object.freeze({
    sourceCandidateId: source.id,
    symbol: source.symbol,
    sourceTimeframe: source.sourceTimeframe,
    zone: source.zone,
    cycles: Object.freeze([...cycles]),
    currentCycleId,
    ignoredEpisodes: Object.freeze([]),
    breakCount: cycles.filter((value) => value.breakEvidence !== null).length,
    flipCount: cycles.filter((value) => value.transition.type === 'flip').length,
    reclaimCount: cycles.filter((value) => value.transition.type === 'reclaim').length,
    observationalOnly: true,
    createsSetup: false,
    usesQualityScore: false,
  });
}

function diagnostic(
  state: LevelEngineValidationReviewState,
): LevelEngineValidationReviewDiagnostic {
  return Object.freeze({
    state,
    futureClosedCandlesCount: 5,
    firstFutureCandleIndex: 5,
    lastClosedCandleIndex: 20,
    lastClosedAt: timestamp(20),
    currentPrice: 100,
    currentAtr: 1,
    distanceFromZone: 0,
    distanceFromZoneAtr: 0,
    lastInteractionCandleIndex: 18,
    lastInteractionAt: timestamp(18),
    barsSinceLastInteraction: 2,
    breakEvidence: null,
  });
}

function sourceReport(
  source: LevelCandidate,
  state: LevelEngineValidationReviewState = 'broken',
): LevelEngineRealDataValidationReport {
  const candles = Object.freeze(Array.from({ length: 24 }, (_, index) => candle(index)));
  const sourceDiagnostic = diagnostic(state);
  return Object.freeze({
    version: 'level-engine-real-data-validation-v0.1',
    reviewDiagnosticsVersion: 'level-engine-review-diagnostics-v0.1',
    generatedAt: timestamp(23),
    binanceBaseUrl: 'https://fapi.binance.com',
    requestedSymbols: Object.freeze(['BTCUSDT']),
    requestedTimeframes: Object.freeze(['1m' as const]),
    candlesPerTimeframe: candles.length,
    reviewLimitPerSymbol: 20,
    reviewPolicy: Object.freeze({
      atrPeriod: 14,
      decisiveBreakAtr: 0.35,
      consecutiveBreakCloses: 2,
      staleAfterBars: 120,
      staleDistanceAtr: 3,
      minimumFutureBars: 2,
    }),
    symbolReports: Object.freeze([Object.freeze({
      symbol: 'BTCUSDT',
      datasets: Object.freeze([Object.freeze({
        symbol: 'BTCUSDT',
        sourceTimeframe: '1m' as const,
        candles,
      })]),
      detection: Object.freeze({
        symbol: 'BTCUSDT',
        requestedTimeframes: Object.freeze(['1m' as const]),
        timeframes: Object.freeze([]),
        candidates: Object.freeze([source]),
        observationalOnly: true,
        createsSetup: false,
        mergesAcrossTimeframes: false,
      }),
      timeframeSummaries: Object.freeze([]),
      reviewQueue: Object.freeze([Object.freeze({
        reviewOrder: 1,
        candidate: source,
        diagnostic: sourceDiagnostic,
        manualLabel: null,
        manualNote: null,
      })]),
    })]),
    totals: Object.freeze({
      symbolCount: 1,
      timeframeDatasetCount: 1,
      candleCount: candles.length,
      candidateCount: 1,
      confirmedCount: source.maturity === 'confirmed' ? 1 : 0,
      reviewItemCount: 1,
      reviewStateCounts: Object.freeze({
        active: state === 'active' ? 1 : 0,
        broken: state === 'broken' ? 1 : 0,
        stale: state === 'stale' ? 1 : 0,
        pending: state === 'pending' ? 1 : 0,
      }),
    }),
    observationalOnly: true,
    createsSetup: false,
    mergesAcrossTimeframes: false,
    usesQualityScore: false,
  });
}

test('selects the current flip cycle and resets source touch history', () => {
  const source = candidate('source-resistance', 'resistance', [
    episode('r1', 'resistance', 2, 3),
    episode('r2', 'resistance', 6, 7),
    episode('r3', 'resistance', 10, 11),
  ]);
  const originCandidate = candidate('origin-cycle', 'resistance', [source.touchEpisodes[0]!], 'broken');
  const flipCandidate = candidate('flip-cycle', 'support', [episode('s1', 'support', 16, 17)]);
  const origin = cycle(source.id, 1, originCandidate, 'origin', true);
  const flip = cycle(source.id, 2, flipCandidate, 'flip', false);

  const report = buildLevelEngineLifecycleRealDataValidationReport(
    sourceReport(source),
    {
      buildLifecycle: () => lifecycle(source, [origin, flip], flip.id),
      diagnoseCandidate: () => diagnostic('active'),
    },
  );

  const item = report.symbolReports[0]?.reviewQueue[0];
  assert.equal(item?.candidate.kind, 'support');
  assert.equal(item?.lifecycleDiagnostic.selectedTransition, 'flip');
  assert.equal(item?.lifecycleDiagnostic.sourceTouchEpisodeCount, 3);
  assert.equal(item?.lifecycleDiagnostic.selectedCycleTouchEpisodeCount, 1);
  assert.equal(item?.lifecycleDiagnostic.retainedSourceTouchEpisodeCount, 0);
  assert.equal(item?.lifecycleDiagnostic.discardedSourceTouchEpisodeCount, 3);
  assert.equal(item?.diagnostic.state, 'active');
  assert.equal(item?.sourceDiagnostic.state, 'broken');
  assert.equal(item?.lifecycleDiagnostic.sourceDetectedBeforeFirstBreak, true);
  assert.equal(report.totals.preBreakDetectionCount, 1);
});

test('selects the terminal broken cycle when no current cycle exists', () => {
  const source = candidate('source-support', 'support', [
    episode('s1', 'support', 2, 3),
    episode('s2', 'support', 8, 9),
  ]);
  const brokenCandidate = candidate('broken-cycle', 'support', source.touchEpisodes, 'broken');
  const brokenCycle = cycle(source.id, 1, brokenCandidate, 'origin', true);

  const report = buildLevelEngineLifecycleRealDataValidationReport(
    sourceReport(source, 'active'),
    {
      buildLifecycle: () => lifecycle(source, [brokenCycle], null),
      diagnoseCandidate: () => diagnostic('broken'),
    },
  );

  const item = report.symbolReports[0]?.reviewQueue[0];
  assert.equal(item?.candidate.id, brokenCandidate.id);
  assert.equal(item?.lifecycleDiagnostic.selectedCycleIsCurrent, false);
  assert.equal(report.totals.terminalBrokenLifecycleCount, 1);
  assert.equal(report.totals.currentLifecycleCycleCount, 0);
});

test('aggregates lifecycle transitions and discarded touches', () => {
  const source = candidate('source', 'resistance', [
    episode('r1', 'resistance', 2, 3),
    episode('r2', 'resistance', 6, 7),
  ]);
  const originCandidate = candidate('origin', 'resistance', [source.touchEpisodes[0]!], 'broken');
  const reclaimCandidate = candidate('reclaim', 'resistance', [episode('r3', 'resistance', 14, 15)]);
  const origin = cycle(source.id, 1, originCandidate, 'origin', true);
  const reclaim = cycle(source.id, 2, reclaimCandidate, 'reclaim', false);

  const report = buildLevelEngineLifecycleRealDataValidationReport(
    sourceReport(source),
    {
      buildLifecycle: () => lifecycle(source, [origin, reclaim], reclaim.id),
      diagnoseCandidate: () => diagnostic('active'),
    },
  );

  assert.equal(report.totals.lifecycleCycleCount, 2);
  assert.equal(report.totals.lifecycleBreakCount, 1);
  assert.equal(report.totals.lifecycleReclaimCount, 1);
  assert.equal(report.totals.transitionCounts.reclaim, 1);
  assert.equal(report.totals.discardedSourceTouchEpisodeCount, 2);
  assert.equal(report.totals.selectedCycleTouchEpisodeCount, 1);
  assert.equal(report.totals.preBreakDetectionCount, 1);
  assert.equal(report.totals.lateOrPostBreakDetectionCount, 0);
});

test('recomputes review state counts from the selected lifecycle cycle', () => {
  const source = candidate('source', 'support', [episode('s1', 'support', 2, 3)]);
  const activeCandidate = candidate('active-cycle', 'support', source.touchEpisodes);
  const activeCycle = cycle(source.id, 1, activeCandidate, 'origin', false);

  const report = buildLevelEngineLifecycleRealDataValidationReport(
    sourceReport(source, 'broken'),
    {
      buildLifecycle: () => lifecycle(source, [activeCycle], activeCycle.id),
      diagnoseCandidate: () => diagnostic('pending'),
    },
  );

  assert.equal(report.totals.sourceReviewStateCounts.broken, 1);
  assert.equal(report.totals.reviewStateCounts.pending, 1);
  assert.equal(report.totals.reviewStateCounts.broken, 0);
});

test('applies review policy to lifecycle, diagnostics, and report options', () => {
  const source = candidate('options-source', 'support', [
    episode('options-s1', 'support', 2, 3),
  ]);
  const activeCandidate = candidate(
    'options-active',
    'support',
    source.touchEpisodes,
  );
  const activeCycle = cycle(
    source.id,
    1,
    activeCandidate,
    'origin',
    false,
  );
  const baseReport = sourceReport(source);
  const customReport = Object.freeze({
    ...baseReport,
    reviewPolicy: Object.freeze({
      ...baseReport.reviewPolicy,
      atrPeriod: 21,
      decisiveBreakAtr: 0.47,
      consecutiveBreakCloses: 3,
    }),
  });

  let receivedLifecycleOptions: unknown = null;
  let receivedReviewPolicy: unknown = null;

  const report = buildLevelEngineLifecycleRealDataValidationReport(
    customReport,
    {
      buildLifecycle: (_candidate, _dataset, options) => {
        receivedLifecycleOptions = options;
        return lifecycle(
          source,
          [activeCycle],
          activeCycle.id,
        );
      },
      diagnoseCandidate: (_dataset, _candidate, policy) => {
        receivedReviewPolicy = policy;
        return diagnostic('active');
      },
    },
  );

  assert.equal(
    receivedLifecycleOptions,
    report.appliedOptions.lifecycle,
  );
  assert.equal(
    receivedReviewPolicy,
    report.appliedOptions.reviewPolicy,
  );
  assert.equal(
    report.reviewPolicy,
    report.appliedOptions.reviewPolicy,
  );
  assert.equal(report.appliedOptions.lifecycle.atrPeriod, 21);
  assert.equal(report.appliedOptions.lifecycle.decisiveBreakAtr, 0.47);
  assert.equal(report.appliedOptions.lifecycle.consecutiveBreakCloses, 3);
  assert.ok(Object.isFrozen(report.appliedOptions));
  assert.ok(Object.isFrozen(report.appliedOptions.lifecycle));
  assert.ok(Object.isFrozen(report.appliedOptions.reviewPolicy));
});

test('returns frozen observational structures without setup or score', () => {
  const source = candidate('source', 'support', [episode('s1', 'support', 2, 3)]);
  const activeCandidate = candidate('active', 'support', source.touchEpisodes);
  const activeCycle = cycle(source.id, 1, activeCandidate, 'origin', false);
  const report = buildLevelEngineLifecycleRealDataValidationReport(
    sourceReport(source),
    {
      buildLifecycle: () => lifecycle(source, [activeCycle], activeCycle.id),
      diagnoseCandidate: () => diagnostic('active'),
    },
  );

  assert.equal(report.version, 'level-engine-lifecycle-real-data-validation-v0.1');
  assert.equal(report.observationalOnly, true);
  assert.equal(report.createsSetup, false);
  assert.equal(report.usesQualityScore, false);
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.totals));
  assert.ok(Object.isFrozen(report.symbolReports[0]?.reviewQueue));
});

test('builds lifecycle HTML with transition filters and cycle diagnostics', () => {
  const source = candidate('source', 'resistance', [episode('r1', 'resistance', 2, 3)]);
  const flipCandidate = candidate('flip', 'support', [episode('s1', 'support', 12, 13)]);
  const originCandidate = candidate('origin', 'resistance', source.touchEpisodes, 'broken');
  const origin = cycle(source.id, 1, originCandidate, 'origin', true);
  const flip = cycle(source.id, 2, flipCandidate, 'flip', false);
  const report = buildLevelEngineLifecycleRealDataValidationReport(
    sourceReport(source),
    {
      buildLifecycle: () => lifecycle(source, [origin, flip], flip.id),
      diagnoseCandidate: () => diagnostic('active'),
    },
  );
  const html = buildLevelEngineLifecycleRealDataReviewHtml(report);

  assert.match(html, /Level Lifecycle Review/);
  assert.match(html, /transitionFilter/);
  assert.match(html, /Отсечено исходных/);
  assert.match(html, /Source найден до break/);
  assert.match(html, /nexus-level-lifecycle-review-labels-v0\.1/);
  assert.match(html, /level-engine-lifecycle-real-data-validation-v0\.1/);
  assert.doesNotMatch(html, /__LEVEL_ENGINE_LIFECYCLE_REVIEW_PAYLOAD__/);
});
