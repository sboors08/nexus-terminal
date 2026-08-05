import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLevelEngineFrozenSample,
} from '../src/modules/level-engine/level-engine-frozen-sample.js';
import type {
  LevelEngineCausalReplayRealDataValidationReport,
  LevelEngineCausalReplaySelectedCycleConfirmationState,
  LevelEngineCausalReplayValidationReviewItem,
} from '../src/modules/level-engine/level-engine-causal-replay-real-data-validation.types.js';
import type {
  LevelEngineKind,
  LevelEngineTimeframe,
} from '../src/modules/level-engine/level-engine.types.js';

const BASE = Date.UTC(2026, 0, 1);
const ZONE = { low: 99.5, reference: 100, high: 100.5 };

function timestamp(index: number): string {
  return new Date(BASE + index * 60_000).toISOString();
}

function candidate(
  id: string,
  symbol: string,
  sourceTimeframe: LevelEngineTimeframe,
  kind: LevelEngineKind = 'support',
) {
  return {
    id,
    symbol,
    sourceTimeframe,
    kind,
    zone: { ...ZONE },
    activeFrom: timestamp(1),
    detectedAt: timestamp(2),
    maturity: 'confirmed',
    status: 'active',
    decision: 'accepted',
    touchEpisodes: [],
    acceptanceReasons: [],
  };
}

interface ReviewItemSpec {
  readonly id: string;
  readonly symbol: string;
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly reviewOrder: number;
  readonly sourceKind?: LevelEngineKind;
  readonly selectedKind?: LevelEngineKind;
  readonly state?: 'active' | 'broken' | 'stale' | 'pending';
  readonly transition?: 'origin' | 'flip' | 'reclaim';
  readonly selectedCycleIsCurrent?: boolean;
  readonly sourceDetectedBeforeFirstBreak?: boolean | null;
  readonly discardedSourceTouchEpisodeCount?: number;
  readonly trackFound?: boolean;
  readonly disappearanceCount?: number;
  readonly reappearanceCount?: number;
  readonly confirmationState?:
    LevelEngineCausalReplaySelectedCycleConfirmationState;
}

function reviewItem(
  spec: ReviewItemSpec,
): LevelEngineCausalReplayValidationReviewItem {
  const sourceCandidate = candidate(
    `${spec.id}-source`,
    spec.symbol,
    spec.sourceTimeframe,
    spec.sourceKind ?? 'support',
  );
  const selectedCandidate = candidate(
    `${spec.id}-selected`,
    spec.symbol,
    spec.sourceTimeframe,
    spec.selectedKind ?? spec.sourceKind ?? 'support',
  );

  return {
    reviewOrder: spec.reviewOrder,
    sourceCandidate,
    candidate: selectedCandidate,
    sourceDiagnostic: { state: spec.state ?? 'active' },
    diagnostic: { state: spec.state ?? 'active' },
    lifecycle: {},
    lifecycleDiagnostic: {
      selectedCycleId: `${spec.id}-cycle`,
      selectedCycleSequence: 1,
      selectedTransition: spec.transition ?? 'origin',
      selectedCycleIsCurrent:
        spec.selectedCycleIsCurrent ?? true,
      sourceTouchEpisodeCount: 2,
      selectedCycleTouchEpisodeCount: 2,
      retainedSourceTouchEpisodeCount: 2,
      discardedSourceTouchEpisodeCount:
        spec.discardedSourceTouchEpisodeCount ?? 0,
      lifecycleCycleCount: 1,
      lifecycleBreakCount: 0,
      lifecycleFlipCount: 0,
      lifecycleReclaimCount: 0,
      ignoredLifecycleEpisodeCount: 0,
      firstBreakAt: null,
      sourceDetectedBeforeFirstBreak:
        spec.sourceDetectedBeforeFirstBreak ?? true,
    },
    manualLabel: null,
    manualNote: null,
    causalReplayTrack: null,
    causalReplayEvents: [],
    causalReplayDiagnostic: {
      trackFound: spec.trackFound ?? true,
      firstSeen: null,
      firstSeenFromActiveFromBars: null,
      firstConfirmed: null,
      firstBreakAt: null,
      firstSeenBreakTiming: 'no_break',
      firstConfirmedBreakTiming: 'no_break',
      detectorObservationCount: 1,
      disappearanceCount: spec.disappearanceCount ?? 0,
      reappearanceCount: spec.reappearanceCount ?? 0,
      maxDetectorTouchEpisodeCount: 2,
      presentAtEnd: true,
      cycleTrackCount: 1,
      confirmedCycleTrackCount: 1,
      brokenCycleTrackCount: 0,
      originCycleTrackCount: 1,
      flipCycleTrackCount: 0,
      reclaimCycleTrackCount: 0,
      transitionObservations: [],
      breakObservations: [],
      selectedCycle: {
        cycleFound: true,
        cycleId: `${spec.id}-cycle`,
        kind: spec.selectedKind ?? spec.sourceKind ?? 'support',
        transition: spec.transition ?? 'origin',
        firstObservedAt: timestamp(3),
        firstObservedCandleIndex: 3,
        firstConfirmedAt: timestamp(4),
        firstConfirmedCandleIndex: 4,
        brokenAt: null,
        firstObservedBreakTiming: 'no_break',
        confirmationState:
          spec.confirmationState ?? 'confirmed_unbroken',
      },
    },
  } as unknown as LevelEngineCausalReplayValidationReviewItem;
}

function dataset(
  symbol: string,
  sourceTimeframe: LevelEngineTimeframe,
) {
  return {
    symbol,
    sourceTimeframe,
    candles: [{
      openTime: timestamp(0),
      closeTime: timestamp(1),
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      isClosed: true,
    }],
  };
}

function report(
  specs: readonly {
    readonly symbol: string;
    readonly sourceTimeframe: LevelEngineTimeframe;
    readonly items: readonly LevelEngineCausalReplayValidationReviewItem[];
  }[],
): LevelEngineCausalReplayRealDataValidationReport {
  return {
    version:
      'level-engine-causal-replay-real-data-validation-v0.1',
    generatedAt: timestamp(20),
    requestedSymbols: specs.map((spec) => spec.symbol),
    requestedTimeframes:
      [...new Set(specs.map((spec) => spec.sourceTimeframe))],
    appliedOptions: {
      lifecycle: {},
      reviewPolicy: {},
      breakSearchWindows: {},
    },
    symbolReports: specs.map((spec) => ({
      symbol: spec.symbol,
      datasets: [dataset(spec.symbol, spec.sourceTimeframe)],
      reviewQueue: [...spec.items],
    })),
    observationalOnly: true,
    createsSetup: false,
    usesQualityScore: false,
    usesFutureCandles: false,
    reusesFetchedDatasets: true,
  } as unknown as LevelEngineCausalReplayRealDataValidationReport;
}

test('selects review items round-robin across datasets', () => {
  const source = report([
    {
      symbol: 'BTCUSDT',
      sourceTimeframe: '1m',
      items: [
        reviewItem({
          id: 'btc-2',
          symbol: 'BTCUSDT',
          sourceTimeframe: '1m',
          reviewOrder: 2,
        }),
        reviewItem({
          id: 'btc-1',
          symbol: 'BTCUSDT',
          sourceTimeframe: '1m',
          reviewOrder: 1,
        }),
      ],
    },
    {
      symbol: 'ETHUSDT',
      sourceTimeframe: '5m',
      items: [
        reviewItem({
          id: 'eth-1',
          symbol: 'ETHUSDT',
          sourceTimeframe: '5m',
          reviewOrder: 1,
        }),
        reviewItem({
          id: 'eth-2',
          symbol: 'ETHUSDT',
          sourceTimeframe: '5m',
          reviewOrder: 2,
        }),
      ],
    },
  ]);

  const sample = buildLevelEngineFrozenSample(
    source,
    { limit: 3 },
  );

  assert.deepEqual(
    sample.items.map((item) => item.sourceCandidateId),
    ['btc-1-source', 'eth-1-source', 'btc-2-source'],
  );
  assert.equal(sample.selection.availableItemCount, 4);
  assert.equal(sample.selection.selectedItemCount, 3);
  assert.equal(sample.selection.omittedItemCount, 1);
  assert.equal(sample.selection.datasetCount, 2);
  assert.equal(sample.selection.complete, false);
});

test('expands diagnostic flags and aggregate counts', () => {
  const source = report([{
    symbol: 'BTCUSDT',
    sourceTimeframe: '1m',
    items: [reviewItem({
      id: 'flagged',
      symbol: 'BTCUSDT',
      sourceTimeframe: '1m',
      reviewOrder: 1,
      sourceKind: 'resistance',
      selectedKind: 'support',
      state: 'broken',
      transition: 'flip',
      selectedCycleIsCurrent: false,
      sourceDetectedBeforeFirstBreak: false,
      discardedSourceTouchEpisodeCount: 3,
      trackFound: false,
      disappearanceCount: 2,
      reappearanceCount: 1,
      confirmationState: 'not_confirmed_broken',
    })],
  }]);

  const sample = buildLevelEngineFrozenSample(source);
  const flags = sample.items[0]!.diagnosticFlags;

  assert.deepEqual(flags, [
    'source_detected_late_or_post_break',
    'causal_track_missing',
    'detector_disappeared',
    'detector_reappeared',
    'selected_cycle_not_current',
    'selected_cycle_role_changed',
    'source_touch_history_discarded',
    'selected_cycle_broke_before_confirmation',
  ]);
  assert.equal(sample.counts.bySymbol.BTCUSDT, 1);
  assert.equal(sample.counts.byTimeframe['1m'], 1);
  assert.equal(sample.counts.byReviewState.broken, 1);
  assert.equal(sample.counts.byTransition.flip, 1);
  assert.equal(
    sample.counts.bySelectedCycleConfirmationState
      .not_confirmed_broken,
    1,
  );
  assert.equal(
    sample.counts.byDiagnosticFlag.detector_disappeared,
    1,
  );
});

test('returns frozen defensive self-contained structures', () => {
  const item = reviewItem({
    id: 'defensive',
    symbol: 'BTCUSDT',
    sourceTimeframe: '1m',
    reviewOrder: 1,
  });
  const source = report([{
    symbol: 'BTCUSDT',
    sourceTimeframe: '1m',
    items: [item],
  }]);

  const sample = buildLevelEngineFrozenSample(source);
  const mutableZone = (
    item.sourceCandidate.zone as { low: number }
  );
  mutableZone.low = 1;

  assert.equal(sample.items[0]!.selectedZone.low, ZONE.low);
  assert.equal(
    sample.items[0]!.reviewItem.sourceCandidate.zone.low,
    ZONE.low,
  );
  assert.equal(Object.isFrozen(sample), true);
  assert.equal(Object.isFrozen(sample.items), true);
  assert.equal(Object.isFrozen(sample.items[0]), true);
  assert.equal(Object.isFrozen(sample.datasets), true);
  assert.equal(Object.isFrozen(sample.datasets[0]!.candles), true);
  assert.equal(sample.observationalOnly, true);
  assert.equal(sample.createsSetup, false);
  assert.equal(sample.usesQualityScore, false);
  assert.equal(sample.intendedForManualReview, true);
});

test('rejects invalid limits and review items without a dataset', () => {
  const source = report([{
    symbol: 'BTCUSDT',
    sourceTimeframe: '1m',
    items: [],
  }]);

  assert.throws(
    () => buildLevelEngineFrozenSample(source, { limit: 0 }),
    /limit must be a positive integer/,
  );

  const invalid = {
    ...source,
    symbolReports: [{
      ...source.symbolReports[0]!,
      reviewQueue: [reviewItem({
        id: 'missing',
        symbol: 'ETHUSDT',
        sourceTimeframe: '5m',
        reviewOrder: 1,
      })],
    }],
  } as unknown as LevelEngineCausalReplayRealDataValidationReport;

  assert.throws(
    () => buildLevelEngineFrozenSample(invalid),
    /has no dataset ETHUSDT:5m/,
  );
});
