import {
  replayLevelEngineCausally,
} from './level-engine-causal-replay.js';
import type {
  LevelEngineCausalReplayCandidateTrack,
  LevelEngineCausalReplayCycleTrack,
  LevelEngineCausalReplayEvent,
  LevelEngineCausalReplayOptions,
  LevelEngineCausalReplayResult,
} from './level-engine-causal-replay.types.js';
import type {
  LevelEngineTimeframe,
} from './level-engine.types.js';
import type {
  LevelEngineTimeframeDataset,
} from './level-engine-multi-timeframe-detector.types.js';
import type {
  LevelLifecycleTransitionType,
} from './level-engine-lifecycle.types.js';
import type {
  LevelEngineLifecycleRealDataValidationReport,
} from './level-engine-lifecycle-real-data-validation.types.js';
import {
  LEVEL_ENGINE_CAUSAL_REPLAY_REAL_DATA_VALIDATION_VERSION,
  LEVEL_ENGINE_CAUSAL_REPLAY_SELECTED_CYCLE_CONFIRMATION_STATES,
} from './level-engine-causal-replay-real-data-validation.types.js';
import type {
  LevelEngineCausalReplayBreakTiming,
  LevelEngineCausalReplayDatasetSummary,
  LevelEngineCausalReplayLagObservation,
  LevelEngineCausalReplayLatencyStats,
  LevelEngineCausalReplayRealDataValidationReport,
  LevelEngineCausalReplayReviewDiagnostic,
  LevelEngineCausalReplaySelectedCycleConfirmationState,
  LevelEngineCausalReplaySelectedCycleDiagnostic,
  LevelEngineCausalReplayTimeframeSummary,
  LevelEngineCausalReplayTransitionObservation,
  LevelEngineCausalReplayValidationReviewItem,
  LevelEngineCausalReplayValidationSymbolReport,
} from './level-engine-causal-replay-real-data-validation.types.js';

export type ReplayLevelEngineForRealData = (
  dataset: LevelEngineTimeframeDataset,
  options: LevelEngineCausalReplayOptions,
) => LevelEngineCausalReplayResult;

export interface BuildLevelEngineCausalReplayRealDataValidationDependencies {
  readonly replayDataset?: ReplayLevelEngineForRealData;
  readonly onDatasetStart?: (
    dataset: LevelEngineTimeframeDataset,
    datasetIndex: number,
    datasetCount: number,
  ) => void;
  readonly onDatasetComplete?: (
    dataset: LevelEngineTimeframeDataset,
    replay: LevelEngineCausalReplayResult,
    datasetIndex: number,
    datasetCount: number,
  ) => void;
}

interface DatasetReplayEntry {
  readonly key: string;
  readonly dataset: LevelEngineTimeframeDataset;
  readonly replay: LevelEngineCausalReplayResult;
}

function fail(message: string): never {
  throw new Error(
    `Level Engine causal replay real-data validation: ${message}`,
  );
}

function canonicalTimestamp(
  value: string,
  field: string,
): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    fail(`${field} must be a valid timestamp`);
  }
  return new Date(timestamp).toISOString();
}

function datasetKey(
  symbol: string,
  sourceTimeframe: LevelEngineTimeframe,
): string {
  return `${symbol}:${sourceTimeframe}`;
}

function closedCandleIndexByTimestamp(
  dataset: LevelEngineTimeframeDataset,
): ReadonlyMap<string, number> {
  const result = new Map<string, number>();
  dataset.candles.forEach((candle, index) => {
    if (!candle.isClosed) {
      return;
    }
    const closeTime = canonicalTimestamp(
      candle.closeTime,
      `dataset ${dataset.symbol} ${dataset.sourceTimeframe} candle closeTime`,
    );
    result.set(closeTime, index);
  });
  return result;
}

function freezeLatencyStats(
  values: readonly number[],
): LevelEngineCausalReplayLatencyStats {
  if (values.length === 0) {
    return Object.freeze({
      sampleCount: 0,
      minimumBars: null,
      medianBars: null,
      averageBars: null,
      maximumBars: null,
    });
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
  const average = sorted.reduce((sum, value) => sum + value, 0)
    / sorted.length;

  return Object.freeze({
    sampleCount: sorted.length,
    minimumBars: sorted[0]!,
    medianBars: median,
    averageBars: Number(average.toFixed(4)),
    maximumBars: sorted.at(-1)!,
  });
}

function observationFromEvent(
  event: LevelEngineCausalReplayEvent,
  dataset: LevelEngineTimeframeDataset,
  candleIndexes: ReadonlyMap<string, number>,
): LevelEngineCausalReplayLagObservation | null {
  if (event.marketOccurredAt === null) {
    return null;
  }
  const marketOccurredAt = canonicalTimestamp(
    event.marketOccurredAt,
    `event ${event.eventIndex} marketOccurredAt`,
  );
  const observedAt = canonicalTimestamp(
    event.observedAt,
    `event ${event.eventIndex} observedAt`,
  );
  const marketCandleIndex = candleIndexes.get(marketOccurredAt);
  if (marketCandleIndex === undefined) {
    fail(
      `event ${event.eventIndex} market timestamp is unavailable in `
      + `${dataset.symbol} ${dataset.sourceTimeframe}`,
    );
  }
  const lagBars = event.observedCandleIndex - marketCandleIndex;
  if (lagBars < 0) {
    fail(`event ${event.eventIndex} observes the market in the future`);
  }

  return Object.freeze({
    marketOccurredAt,
    observedAt,
    marketCandleIndex,
    observedCandleIndex: event.observedCandleIndex,
    lagBars,
  });
}

function firstEvent(
  events: readonly LevelEngineCausalReplayEvent[],
  type: LevelEngineCausalReplayEvent['type'],
): LevelEngineCausalReplayEvent | null {
  return events.find((event) => event.type === type) ?? null;
}

function firstBreakAt(
  track: LevelEngineCausalReplayCandidateTrack,
): string | null {
  const values = track.cycles
    .map((cycle) => cycle.brokenAt)
    .filter((value): value is string => value !== null)
    .sort((left, right) => Date.parse(left) - Date.parse(right));
  return values[0] ?? null;
}

function timingRelativeToBreak(
  observedAt: string | null,
  breakAt: string | null,
): LevelEngineCausalReplayBreakTiming {
  if (observedAt === null) {
    return 'not_observed';
  }
  if (breakAt === null) {
    return 'no_break';
  }
  const observedMs = Date.parse(observedAt);
  const breakMs = Date.parse(breakAt);
  if (observedMs < breakMs) {
    return 'before_break';
  }
  if (observedMs === breakMs) {
    return 'at_break';
  }
  return 'after_break';
}


const BREAK_TIMINGS: readonly LevelEngineCausalReplayBreakTiming[] =
  Object.freeze([
    'before_break',
    'at_break',
    'after_break',
    'no_break',
    'not_observed',
  ]);

function selectedCycleConfirmationState(
  cycle: LevelEngineCausalReplayCycleTrack | null,
): LevelEngineCausalReplaySelectedCycleConfirmationState {
  if (cycle === null) {
    return 'cycle_not_observed';
  }
  if (cycle.firstConfirmedAt === null) {
    return cycle.brokenAt === null
      ? 'not_confirmed_unbroken'
      : 'not_confirmed_broken';
  }
  if (cycle.brokenAt === null) {
    return 'confirmed_unbroken';
  }
  const confirmedMs = Date.parse(cycle.firstConfirmedAt);
  const brokenMs = Date.parse(cycle.brokenAt);
  if (confirmedMs < brokenMs) {
    return 'confirmed_before_break';
  }
  if (confirmedMs === brokenMs) {
    return 'confirmed_at_break';
  }
  return 'confirmed_after_break';
}

function selectedCycleDiagnostic(
  track: LevelEngineCausalReplayCandidateTrack | null,
  selectedCycleId: string,
): LevelEngineCausalReplaySelectedCycleDiagnostic {
  const cycle = track?.cycles.find(
    (value) => value.id === selectedCycleId,
  ) ?? null;
  if (cycle === null) {
    return Object.freeze({
      cycleFound: false,
      cycleId: selectedCycleId,
      kind: null,
      transition: null,
      firstObservedAt: null,
      firstObservedCandleIndex: null,
      firstConfirmedAt: null,
      firstConfirmedCandleIndex: null,
      brokenAt: null,
      firstObservedBreakTiming: 'not_observed',
      confirmationState: 'cycle_not_observed',
    });
  }
  return Object.freeze({
    cycleFound: true,
    cycleId: cycle.id,
    kind: cycle.kind,
    transition: cycle.transition.type,
    firstObservedAt: cycle.firstObservedAt,
    firstObservedCandleIndex: cycle.firstObservedCandleIndex,
    firstConfirmedAt: cycle.firstConfirmedAt,
    firstConfirmedCandleIndex: cycle.firstConfirmedCandleIndex,
    brokenAt: cycle.brokenAt,
    firstObservedBreakTiming: timingRelativeToBreak(
      cycle.firstObservedAt,
      cycle.brokenAt,
    ),
    confirmationState: selectedCycleConfirmationState(cycle),
  });
}

function freezeBreakTimingCounts(
  diagnostics: readonly LevelEngineCausalReplayReviewDiagnostic[],
  select: (
    diagnostic: LevelEngineCausalReplayReviewDiagnostic,
  ) => LevelEngineCausalReplayBreakTiming,
): Readonly<Record<LevelEngineCausalReplayBreakTiming, number>> {
  const counts: Record<LevelEngineCausalReplayBreakTiming, number> = {
    before_break: 0,
    at_break: 0,
    after_break: 0,
    no_break: 0,
    not_observed: 0,
  };
  diagnostics.forEach((diagnostic) => {
    counts[select(diagnostic)] += 1;
  });
  return Object.freeze(counts);
}

function freezeSelectedCycleConfirmationStateCounts(
  diagnostics: readonly LevelEngineCausalReplayReviewDiagnostic[],
): Readonly<Record<
  LevelEngineCausalReplaySelectedCycleConfirmationState,
  number
>> {
  const counts = Object.fromEntries(
    LEVEL_ENGINE_CAUSAL_REPLAY_SELECTED_CYCLE_CONFIRMATION_STATES.map(
      (state) => [state, 0],
    ),
  ) as Record<LevelEngineCausalReplaySelectedCycleConfirmationState, number>;
  diagnostics.forEach((diagnostic) => {
    counts[diagnostic.selectedCycle.confirmationState] += 1;
  });
  return Object.freeze(counts);
}

function combineBreakTimingCounts(
  values: readonly Readonly<Record<
    LevelEngineCausalReplayBreakTiming,
    number
  >>[],
): Readonly<Record<LevelEngineCausalReplayBreakTiming, number>> {
  const counts: Record<LevelEngineCausalReplayBreakTiming, number> = {
    before_break: 0,
    at_break: 0,
    after_break: 0,
    no_break: 0,
    not_observed: 0,
  };
  values.forEach((value) => {
    BREAK_TIMINGS.forEach((timing) => {
      counts[timing] += value[timing];
    });
  });
  return Object.freeze(counts);
}

function combineSelectedCycleConfirmationStateCounts(
  values: readonly Readonly<Record<
    LevelEngineCausalReplaySelectedCycleConfirmationState,
    number
  >>[],
): Readonly<Record<
  LevelEngineCausalReplaySelectedCycleConfirmationState,
  number
>> {
  const counts = Object.fromEntries(
    LEVEL_ENGINE_CAUSAL_REPLAY_SELECTED_CYCLE_CONFIRMATION_STATES.map(
      (state) => [state, 0],
    ),
  ) as Record<LevelEngineCausalReplaySelectedCycleConfirmationState, number>;
  values.forEach((value) => {
    LEVEL_ENGINE_CAUSAL_REPLAY_SELECTED_CYCLE_CONFIRMATION_STATES.forEach(
      (state) => {
        counts[state] += value[state];
      },
    );
  });
  return Object.freeze(counts);
}

function transitionObservation(
  event: LevelEngineCausalReplayEvent,
  dataset: LevelEngineTimeframeDataset,
  candleIndexes: ReadonlyMap<string, number>,
): LevelEngineCausalReplayTransitionObservation | null {
  if (event.cycleId === null || event.transition === null) {
    return null;
  }
  const base = observationFromEvent(event, dataset, candleIndexes);
  if (base === null) {
    return null;
  }
  return Object.freeze({
    ...base,
    cycleId: event.cycleId,
    transition: event.transition,
  });
}

function diagnosticForTrack(
  track: LevelEngineCausalReplayCandidateTrack | null,
  events: readonly LevelEngineCausalReplayEvent[],
  dataset: LevelEngineTimeframeDataset,
  selectedCycleId: string,
): LevelEngineCausalReplayReviewDiagnostic {
  if (track === null) {
    return Object.freeze({
      trackFound: false,
      firstSeen: null,
      firstSeenFromActiveFromBars: null,
      firstConfirmed: null,
      firstBreakAt: null,
      firstSeenBreakTiming: 'not_observed',
      firstConfirmedBreakTiming: 'not_observed',
      detectorObservationCount: 0,
      disappearanceCount: 0,
      reappearanceCount: 0,
      maxDetectorTouchEpisodeCount: 0,
      presentAtEnd: false,
      cycleTrackCount: 0,
      confirmedCycleTrackCount: 0,
      brokenCycleTrackCount: 0,
      originCycleTrackCount: 0,
      flipCycleTrackCount: 0,
      reclaimCycleTrackCount: 0,
      transitionObservations: Object.freeze([]),
      breakObservations: Object.freeze([]),
      selectedCycle: selectedCycleDiagnostic(null, selectedCycleId),
    });
  }

  const candleIndexes = closedCandleIndexByTimestamp(dataset);
  const seenEvent = firstEvent(events, 'candidate_first_seen');
  if (seenEvent === null) {
    fail(`candidate track ${track.id} has no candidate_first_seen event`);
  }
  const firstSeen = observationFromEvent(
    seenEvent,
    dataset,
    candleIndexes,
  );
  if (firstSeen === null) {
    fail(`candidate track ${track.id} first-seen event has no market time`);
  }
  const activeFrom = canonicalTimestamp(
    track.sourceCandidate.activeFrom,
    `candidate track ${track.id} activeFrom`,
  );
  const activeFromCandleIndex = candleIndexes.get(activeFrom);
  if (activeFromCandleIndex === undefined) {
    fail(`candidate track ${track.id} activeFrom candle is unavailable`);
  }
  const firstSeenFromActiveFromBars =
    track.firstSeenCandleIndex - activeFromCandleIndex;
  if (firstSeenFromActiveFromBars < 0) {
    fail(`candidate track ${track.id} was observed before activeFrom`);
  }

  const confirmedEvent = firstEvent(events, 'candidate_confirmed');
  const firstConfirmed = confirmedEvent === null
    ? null
    : observationFromEvent(confirmedEvent, dataset, candleIndexes);
  const breakAt = firstBreakAt(track);
  const transitionObservations = Object.freeze(
    events
      .filter((event) => event.type === 'cycle_started')
      .map((event) => transitionObservation(event, dataset, candleIndexes))
      .filter(
        (value): value is LevelEngineCausalReplayTransitionObservation =>
          value !== null,
      ),
  );
  const breakObservations = Object.freeze(
    events
      .filter((event) => event.type === 'cycle_broken')
      .map((event) => observationFromEvent(event, dataset, candleIndexes))
      .filter(
        (value): value is LevelEngineCausalReplayLagObservation =>
          value !== null,
      ),
  );

  return Object.freeze({
    trackFound: true,
    firstSeen,
    firstSeenFromActiveFromBars,
    firstConfirmed,
    firstBreakAt: breakAt,
    firstSeenBreakTiming: timingRelativeToBreak(
      firstSeen.observedAt,
      breakAt,
    ),
    firstConfirmedBreakTiming: timingRelativeToBreak(
      firstConfirmed?.observedAt ?? null,
      breakAt,
    ),
    detectorObservationCount: track.detectorObservationCount,
    disappearanceCount: track.disappearanceCount,
    reappearanceCount: track.reappearanceCount,
    maxDetectorTouchEpisodeCount: track.maxDetectorTouchEpisodeCount,
    presentAtEnd: track.presentAtEnd,
    cycleTrackCount: track.cycles.length,
    confirmedCycleTrackCount: track.cycles.filter(
      (cycle) => cycle.firstConfirmedAt !== null,
    ).length,
    brokenCycleTrackCount: track.cycles.filter(
      (cycle) => cycle.breakEvidence !== null,
    ).length,
    originCycleTrackCount: track.cycles.filter(
      (cycle) => cycle.transition.type === 'origin',
    ).length,
    flipCycleTrackCount: track.cycles.filter(
      (cycle) => cycle.transition.type === 'flip',
    ).length,
    reclaimCycleTrackCount: track.cycles.filter(
      (cycle) => cycle.transition.type === 'reclaim',
    ).length,
    transitionObservations,
    breakObservations,
    selectedCycle: selectedCycleDiagnostic(track, selectedCycleId),
  });
}

function lagValues(
  events: readonly LevelEngineCausalReplayEvent[],
  dataset: LevelEngineTimeframeDataset,
  type: LevelEngineCausalReplayEvent['type'],
  transition?: LevelLifecycleTransitionType,
): readonly number[] {
  const candleIndexes = closedCandleIndexByTimestamp(dataset);
  return Object.freeze(
    events
      .filter((event) => (
        event.type === type
        && (transition === undefined || event.transition === transition)
      ))
      .map((event) => observationFromEvent(event, dataset, candleIndexes))
      .filter(
        (value): value is LevelEngineCausalReplayLagObservation =>
          value !== null,
      )
      .map((value) => value.lagBars),
  );
}

function firstSeenFromActiveLagValues(
  replay: LevelEngineCausalReplayResult,
  dataset: LevelEngineTimeframeDataset,
): readonly number[] {
  const candleIndexes = closedCandleIndexByTimestamp(dataset);
  return Object.freeze(replay.candidateTracks.map((track) => {
    const activeFrom = canonicalTimestamp(
      track.sourceCandidate.activeFrom,
      `candidate track ${track.id} activeFrom`,
    );
    const activeIndex = candleIndexes.get(activeFrom);
    if (activeIndex === undefined) {
      fail(`candidate track ${track.id} activeFrom candle is unavailable`);
    }
    const lag = track.firstSeenCandleIndex - activeIndex;
    if (lag < 0) {
      fail(`candidate track ${track.id} was observed before activeFrom`);
    }
    return lag;
  }));
}

function datasetSummary(
  entry: DatasetReplayEntry,
  reviewItems: readonly LevelEngineCausalReplayValidationReviewItem[],
): LevelEngineCausalReplayDatasetSummary {
  const diagnostics = reviewItems.map(
    (item) => item.causalReplayDiagnostic,
  );
  const atOrAfterBreak = diagnostics.filter((diagnostic) => (
    diagnostic.firstSeenBreakTiming === 'at_break'
    || diagnostic.firstSeenBreakTiming === 'after_break'
  )).length;

  return Object.freeze({
    symbol: entry.replay.symbol,
    sourceTimeframe: entry.replay.sourceTimeframe,
    closedCandlesCount: entry.replay.closedCandlesCount,
    ignoredOpenCandlesCount: entry.replay.ignoredOpenCandlesCount,
    replayStepCount: entry.replay.totals.replayStepCount,
    candidateTrackCount: entry.replay.totals.candidateTrackCount,
    confirmedCandidateTrackCount:
      entry.replay.totals.confirmedCandidateTrackCount,
    cycleTrackCount: entry.replay.totals.cycleTrackCount,
    confirmedCycleTrackCount:
      entry.replay.totals.confirmedCycleTrackCount,
    brokenCycleTrackCount:
      entry.replay.totals.brokenCycleTrackCount,
    originCycleTrackCount:
      entry.replay.totals.originCycleTrackCount,
    flipCycleTrackCount: entry.replay.totals.flipCycleTrackCount,
    reclaimCycleTrackCount:
      entry.replay.totals.reclaimCycleTrackCount,
    candidateDisappearanceCount:
      entry.replay.totals.candidateDisappearanceCount,
    candidateReappearanceCount:
      entry.replay.totals.candidateReappearanceCount,
    reviewItemCount: reviewItems.length,
    reviewTrackFoundCount: diagnostics.filter(
      (diagnostic) => diagnostic.trackFound,
    ).length,
    reviewTrackMissingCount: diagnostics.filter(
      (diagnostic) => !diagnostic.trackFound,
    ).length,
    reviewFirstSeenBeforeBreakCount: diagnostics.filter(
      (diagnostic) => diagnostic.firstSeenBreakTiming === 'before_break',
    ).length,
    reviewFirstSeenAtOrAfterBreakCount: atOrAfterBreak,
    reviewFirstSeenNoBreakCount: diagnostics.filter(
      (diagnostic) => diagnostic.firstSeenBreakTiming === 'no_break',
    ).length,
    selectedCycleFirstObservedTimingCounts: freezeBreakTimingCounts(
      diagnostics,
      (diagnostic) => diagnostic.selectedCycle.firstObservedBreakTiming,
    ),
    selectedCycleConfirmationStateCounts:
      freezeSelectedCycleConfirmationStateCounts(diagnostics),
    candidateFirstSeenLagBars: freezeLatencyStats(
      lagValues(
        entry.replay.events,
        entry.dataset,
        'candidate_first_seen',
      ),
    ),
    candidateFirstSeenFromActiveFromLagBars: freezeLatencyStats(
      firstSeenFromActiveLagValues(entry.replay, entry.dataset),
    ),
    candidateConfirmedLagBars: freezeLatencyStats(
      lagValues(
        entry.replay.events,
        entry.dataset,
        'candidate_confirmed',
      ),
    ),
    originStartLagBars: freezeLatencyStats(
      lagValues(
        entry.replay.events,
        entry.dataset,
        'cycle_started',
        'origin',
      ),
    ),
    flipStartLagBars: freezeLatencyStats(
      lagValues(
        entry.replay.events,
        entry.dataset,
        'cycle_started',
        'flip',
      ),
    ),
    reclaimStartLagBars: freezeLatencyStats(
      lagValues(
        entry.replay.events,
        entry.dataset,
        'cycle_started',
        'reclaim',
      ),
    ),
    breakObservationLagBars: freezeLatencyStats(
      lagValues(
        entry.replay.events,
        entry.dataset,
        'cycle_broken',
      ),
    ),
  });
}

function sum(
  values: readonly number[],
): number {
  return values.reduce((total, value) => total + value, 0);
}

function combineStats(
  summaries: readonly LevelEngineCausalReplayDatasetSummary[],
  select: (
    summary: LevelEngineCausalReplayDatasetSummary,
  ) => LevelEngineCausalReplayLatencyStats,
  rawValues: readonly number[],
): LevelEngineCausalReplayLatencyStats {
  const expectedCount = sum(
    summaries.map((summary) => select(summary).sampleCount),
  );
  if (expectedCount !== rawValues.length) {
    fail('latency sample count mismatch');
  }
  return freezeLatencyStats(rawValues);
}

function timeframeSummary(
  sourceTimeframe: LevelEngineTimeframe,
  summaries: readonly LevelEngineCausalReplayDatasetSummary[],
  entries: readonly DatasetReplayEntry[],
): LevelEngineCausalReplayTimeframeSummary {
  const selected = summaries.filter(
    (summary) => summary.sourceTimeframe === sourceTimeframe,
  );
  const selectedEntries = entries.filter(
    (entry) => entry.replay.sourceTimeframe === sourceTimeframe,
  );
  const eventLags = (
    type: LevelEngineCausalReplayEvent['type'],
    transition?: LevelLifecycleTransitionType,
  ): number[] => selectedEntries.flatMap((entry) =>
    lagValues(
      entry.replay.events,
      entry.dataset,
      type,
      transition,
    ));

  return Object.freeze({
    sourceTimeframe,
    datasetCount: selected.length,
    closedCandlesCount: sum(selected.map((value) => value.closedCandlesCount)),
    ignoredOpenCandlesCount: sum(
      selected.map((value) => value.ignoredOpenCandlesCount),
    ),
    replayStepCount: sum(selected.map((value) => value.replayStepCount)),
    candidateTrackCount: sum(
      selected.map((value) => value.candidateTrackCount),
    ),
    confirmedCandidateTrackCount: sum(
      selected.map((value) => value.confirmedCandidateTrackCount),
    ),
    cycleTrackCount: sum(selected.map((value) => value.cycleTrackCount)),
    confirmedCycleTrackCount: sum(
      selected.map((value) => value.confirmedCycleTrackCount),
    ),
    brokenCycleTrackCount: sum(
      selected.map((value) => value.brokenCycleTrackCount),
    ),
    originCycleTrackCount: sum(
      selected.map((value) => value.originCycleTrackCount),
    ),
    flipCycleTrackCount: sum(
      selected.map((value) => value.flipCycleTrackCount),
    ),
    reclaimCycleTrackCount: sum(
      selected.map((value) => value.reclaimCycleTrackCount),
    ),
    candidateDisappearanceCount: sum(
      selected.map((value) => value.candidateDisappearanceCount),
    ),
    candidateReappearanceCount: sum(
      selected.map((value) => value.candidateReappearanceCount),
    ),
    reviewItemCount: sum(selected.map((value) => value.reviewItemCount)),
    reviewTrackFoundCount: sum(
      selected.map((value) => value.reviewTrackFoundCount),
    ),
    reviewTrackMissingCount: sum(
      selected.map((value) => value.reviewTrackMissingCount),
    ),
    reviewFirstSeenBeforeBreakCount: sum(
      selected.map((value) => value.reviewFirstSeenBeforeBreakCount),
    ),
    reviewFirstSeenAtOrAfterBreakCount: sum(
      selected.map((value) => value.reviewFirstSeenAtOrAfterBreakCount),
    ),
    reviewFirstSeenNoBreakCount: sum(
      selected.map((value) => value.reviewFirstSeenNoBreakCount),
    ),
    selectedCycleFirstObservedTimingCounts: combineBreakTimingCounts(
      selected.map((value) => value.selectedCycleFirstObservedTimingCounts),
    ),
    selectedCycleConfirmationStateCounts:
      combineSelectedCycleConfirmationStateCounts(
        selected.map(
          (value) => value.selectedCycleConfirmationStateCounts,
        ),
      ),
    candidateFirstSeenLagBars: freezeLatencyStats(
      eventLags('candidate_first_seen'),
    ),
    candidateFirstSeenFromActiveFromLagBars: freezeLatencyStats(
      selectedEntries.flatMap((entry) =>
        firstSeenFromActiveLagValues(entry.replay, entry.dataset)),
    ),
    candidateConfirmedLagBars: freezeLatencyStats(
      eventLags('candidate_confirmed'),
    ),
    originStartLagBars: freezeLatencyStats(
      eventLags('cycle_started', 'origin'),
    ),
    flipStartLagBars: freezeLatencyStats(
      eventLags('cycle_started', 'flip'),
    ),
    reclaimStartLagBars: freezeLatencyStats(
      eventLags('cycle_started', 'reclaim'),
    ),
    breakObservationLagBars: freezeLatencyStats(
      eventLags('cycle_broken'),
    ),
  });
}

function timingCount(
  items: readonly LevelEngineCausalReplayValidationReviewItem[],
  field: 'firstSeenBreakTiming' | 'firstConfirmedBreakTiming',
  values: readonly LevelEngineCausalReplayBreakTiming[],
): number {
  return items.filter((item) =>
    values.includes(item.causalReplayDiagnostic[field])).length;
}

export function buildLevelEngineCausalReplayRealDataValidationReport(
  report: LevelEngineLifecycleRealDataValidationReport,
  dependencies: BuildLevelEngineCausalReplayRealDataValidationDependencies = {},
): LevelEngineCausalReplayRealDataValidationReport {
  const appliedOptions = report.appliedOptions;
  if (appliedOptions === undefined) {
    fail('source lifecycle report must include appliedOptions');
  }

  const replayOptions: LevelEngineCausalReplayOptions = Object.freeze({
    lifecycle: appliedOptions.lifecycle,
  });
  const replayDataset =
    dependencies.replayDataset ?? replayLevelEngineCausally;
  const replayEntries: DatasetReplayEntry[] = [];
  const replayByKey = new Map<string, DatasetReplayEntry>();
  const datasetCount = report.symbolReports.reduce(
    (sum, symbolReport) => sum + symbolReport.datasets.length,
    0,
  );
  let datasetIndex = 0;

  for (const symbolReport of report.symbolReports) {
    for (const dataset of symbolReport.datasets) {
      datasetIndex += 1;
      dependencies.onDatasetStart?.(
        dataset,
        datasetIndex,
        datasetCount,
      );
      const key = datasetKey(dataset.symbol, dataset.sourceTimeframe);
      if (replayByKey.has(key)) {
        fail(`duplicate replay dataset ${key}`);
      }
      const replay = replayDataset(dataset, replayOptions);
      if (
        replay.symbol !== dataset.symbol
        || replay.sourceTimeframe !== dataset.sourceTimeframe
      ) {
        fail(`replay result does not match dataset ${key}`);
      }
      const entry = Object.freeze({ key, dataset, replay });
      replayEntries.push(entry);
      replayByKey.set(key, entry);
      dependencies.onDatasetComplete?.(
        dataset,
        replay,
        datasetIndex,
        datasetCount,
      );
    }
  }

  const symbolReports: LevelEngineCausalReplayValidationSymbolReport[] =
    report.symbolReports.map((symbolReport) => {
      const reviewQueue: LevelEngineCausalReplayValidationReviewItem[] =
        symbolReport.reviewQueue.map((item) => {
          const key = datasetKey(
            item.sourceCandidate.symbol,
            item.sourceCandidate.sourceTimeframe,
          );
          const entry = replayByKey.get(key);
          if (!entry) {
            fail(`replay dataset is unavailable for ${key}`);
          }
          const track = entry.replay.candidateTracks.find(
            (value) => value.id === item.sourceCandidate.id,
          ) ?? null;
          const events = Object.freeze(
            entry.replay.events.filter(
              (event) => event.sourceCandidateId === item.sourceCandidate.id,
            ),
          );
          const causalReplayDiagnostic = diagnosticForTrack(
            track,
            events,
            entry.dataset,
            item.lifecycleDiagnostic.selectedCycleId,
          );

          return Object.freeze({
            ...item,
            causalReplayTrack: track,
            causalReplayEvents: events,
            causalReplayDiagnostic,
          });
        });

      const causalReplayDatasets = Object.freeze(
        symbolReport.datasets.map((dataset) => {
          const key = datasetKey(dataset.symbol, dataset.sourceTimeframe);
          const entry = replayByKey.get(key);
          if (!entry) {
            fail(`replay dataset is unavailable for ${key}`);
          }
          const items = reviewQueue.filter(
            (item) =>
              item.sourceCandidate.sourceTimeframe === dataset.sourceTimeframe,
          );
          return datasetSummary(entry, items);
        }),
      );

      return Object.freeze({
        symbol: symbolReport.symbol,
        datasets: symbolReport.datasets,
        detection: symbolReport.detection,
        timeframeSummaries: symbolReport.timeframeSummaries,
        reviewQueue: Object.freeze(reviewQueue),
        causalReplayDatasets,
      });
    });

  const frozenSymbolReports = Object.freeze(symbolReports);
  const datasetSummaries = Object.freeze(
    frozenSymbolReports.flatMap(
      (symbolReport) => symbolReport.causalReplayDatasets,
    ),
  );
  const reviewItems = Object.freeze(
    frozenSymbolReports.flatMap((symbolReport) => symbolReport.reviewQueue),
  );
  const firstSeenLagValues = replayEntries.flatMap((entry) =>
    lagValues(
      entry.replay.events,
      entry.dataset,
      'candidate_first_seen',
    ));
  const firstSeenFromActiveValues = replayEntries.flatMap((entry) =>
    firstSeenFromActiveLagValues(entry.replay, entry.dataset));
  const confirmedLagValues = replayEntries.flatMap((entry) =>
    lagValues(
      entry.replay.events,
      entry.dataset,
      'candidate_confirmed',
    ));
  const transitionLagValues = (
    transition: LevelLifecycleTransitionType,
  ): number[] => replayEntries.flatMap((entry) =>
    lagValues(
      entry.replay.events,
      entry.dataset,
      'cycle_started',
      transition,
    ));
  const breakLagValues = replayEntries.flatMap((entry) =>
    lagValues(
      entry.replay.events,
      entry.dataset,
      'cycle_broken',
    ));

  const timeframeCausalReplaySummaries = Object.freeze(
    report.requestedTimeframes.map((sourceTimeframe) =>
      timeframeSummary(sourceTimeframe, datasetSummaries, replayEntries)),
  );

  const totals = Object.freeze({
    ...report.totals,
    replayDatasetCount: replayEntries.length,
    replayStepCount: sum(
      replayEntries.map((entry) => entry.replay.totals.replayStepCount),
    ),
    causalCandidateTrackCount: sum(
      replayEntries.map((entry) => entry.replay.totals.candidateTrackCount),
    ),
    causalConfirmedCandidateTrackCount: sum(
      replayEntries.map(
        (entry) => entry.replay.totals.confirmedCandidateTrackCount,
      ),
    ),
    causalCycleTrackCount: sum(
      replayEntries.map((entry) => entry.replay.totals.cycleTrackCount),
    ),
    causalConfirmedCycleTrackCount: sum(
      replayEntries.map(
        (entry) => entry.replay.totals.confirmedCycleTrackCount,
      ),
    ),
    causalBrokenCycleTrackCount: sum(
      replayEntries.map(
        (entry) => entry.replay.totals.brokenCycleTrackCount,
      ),
    ),
    causalOriginCycleTrackCount: sum(
      replayEntries.map(
        (entry) => entry.replay.totals.originCycleTrackCount,
      ),
    ),
    causalFlipCycleTrackCount: sum(
      replayEntries.map(
        (entry) => entry.replay.totals.flipCycleTrackCount,
      ),
    ),
    causalReclaimCycleTrackCount: sum(
      replayEntries.map(
        (entry) => entry.replay.totals.reclaimCycleTrackCount,
      ),
    ),
    causalCandidateDisappearanceCount: sum(
      replayEntries.map(
        (entry) => entry.replay.totals.candidateDisappearanceCount,
      ),
    ),
    causalCandidateReappearanceCount: sum(
      replayEntries.map(
        (entry) => entry.replay.totals.candidateReappearanceCount,
      ),
    ),
    reviewTrackFoundCount: reviewItems.filter(
      (item) => item.causalReplayDiagnostic.trackFound,
    ).length,
    reviewTrackMissingCount: reviewItems.filter(
      (item) => !item.causalReplayDiagnostic.trackFound,
    ).length,
    reviewFirstSeenBeforeBreakCount: timingCount(
      reviewItems,
      'firstSeenBreakTiming',
      ['before_break'],
    ),
    reviewFirstSeenAtOrAfterBreakCount: timingCount(
      reviewItems,
      'firstSeenBreakTiming',
      ['at_break', 'after_break'],
    ),
    reviewFirstSeenNoBreakCount: timingCount(
      reviewItems,
      'firstSeenBreakTiming',
      ['no_break'],
    ),
    reviewFirstSeenNotObservedCount: timingCount(
      reviewItems,
      'firstSeenBreakTiming',
      ['not_observed'],
    ),
    reviewFirstConfirmedBeforeBreakCount: timingCount(
      reviewItems,
      'firstConfirmedBreakTiming',
      ['before_break'],
    ),
    reviewFirstConfirmedAtOrAfterBreakCount: timingCount(
      reviewItems,
      'firstConfirmedBreakTiming',
      ['at_break', 'after_break'],
    ),
    reviewFirstConfirmedNoBreakCount: timingCount(
      reviewItems,
      'firstConfirmedBreakTiming',
      ['no_break'],
    ),
    reviewFirstConfirmedNotObservedCount: timingCount(
      reviewItems,
      'firstConfirmedBreakTiming',
      ['not_observed'],
    ),
    selectedCycleFirstObservedTimingCounts: freezeBreakTimingCounts(
      reviewItems.map((item) => item.causalReplayDiagnostic),
      (diagnostic) => diagnostic.selectedCycle.firstObservedBreakTiming,
    ),
    selectedCycleConfirmationStateCounts:
      freezeSelectedCycleConfirmationStateCounts(
        reviewItems.map((item) => item.causalReplayDiagnostic),
      ),
    candidateFirstSeenLagBars: combineStats(
      datasetSummaries,
      (summary) => summary.candidateFirstSeenLagBars,
      firstSeenLagValues,
    ),
    candidateFirstSeenFromActiveFromLagBars: combineStats(
      datasetSummaries,
      (summary) => summary.candidateFirstSeenFromActiveFromLagBars,
      firstSeenFromActiveValues,
    ),
    candidateConfirmedLagBars: combineStats(
      datasetSummaries,
      (summary) => summary.candidateConfirmedLagBars,
      confirmedLagValues,
    ),
    originStartLagBars: combineStats(
      datasetSummaries,
      (summary) => summary.originStartLagBars,
      transitionLagValues('origin'),
    ),
    flipStartLagBars: combineStats(
      datasetSummaries,
      (summary) => summary.flipStartLagBars,
      transitionLagValues('flip'),
    ),
    reclaimStartLagBars: combineStats(
      datasetSummaries,
      (summary) => summary.reclaimStartLagBars,
      transitionLagValues('reclaim'),
    ),
    breakObservationLagBars: combineStats(
      datasetSummaries,
      (summary) => summary.breakObservationLagBars,
      breakLagValues,
    ),
  });

  return Object.freeze({
    version: LEVEL_ENGINE_CAUSAL_REPLAY_REAL_DATA_VALIDATION_VERSION,
    sourceLifecycleValidationVersion: report.version,
    sourceValidationVersion: report.sourceValidationVersion,
    reviewDiagnosticsVersion: report.reviewDiagnosticsVersion,
    generatedAt: report.generatedAt,
    binanceBaseUrl: report.binanceBaseUrl,
    requestedSymbols: report.requestedSymbols,
    requestedTimeframes: report.requestedTimeframes,
    candlesPerTimeframe: report.candlesPerTimeframe,
    reviewLimitPerSymbol: report.reviewLimitPerSymbol,
    reviewPolicy: report.reviewPolicy,
    appliedOptions,
    symbolReports: frozenSymbolReports,
    timeframeCausalReplaySummaries,
    totals,
    observationalOnly: true,
    createsSetup: false,
    mergesAcrossTimeframes: false,
    usesQualityScore: false,
    usesFutureCandles: false,
    reusesFetchedDatasets: true,
  });
}
