import {
  LEVEL_ENGINE_FROZEN_SAMPLE_DIAGNOSTIC_FLAGS,
  LEVEL_ENGINE_FROZEN_SAMPLE_VERSION,
} from './level-engine-frozen-sample.types.js';
import type {
  BuildLevelEngineFrozenSampleOptions,
  LevelEngineFrozenSample,
  LevelEngineFrozenSampleCounts,
  LevelEngineFrozenSampleDataset,
  LevelEngineFrozenSampleDiagnosticFlag,
  LevelEngineFrozenSampleItem,
} from './level-engine-frozen-sample.types.js';
import type {
  LevelEngineCausalReplayRealDataValidationReport,
  LevelEngineCausalReplayValidationReviewItem,
} from './level-engine-causal-replay-real-data-validation.types.js';

const DEFAULT_FROZEN_SAMPLE_LIMIT = 120;
const MAXIMUM_FROZEN_SAMPLE_LIMIT = 5_000;

function fail(message: string): never {
  throw new Error(`Level Engine Frozen Sample: ${message}`);
}

function cloneFrozen<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((item) => cloneFrozen(item)),
    ) as T;
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      result[key] = cloneFrozen(nested);
    }
    return Object.freeze(result) as T;
  }

  return value;
}

function readLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_FROZEN_SAMPLE_LIMIT;
  if (
    !Number.isInteger(limit)
    || limit <= 0
    || limit > MAXIMUM_FROZEN_SAMPLE_LIMIT
  ) {
    fail(
      `limit must be a positive integer not greater than `
      + `${MAXIMUM_FROZEN_SAMPLE_LIMIT}`,
    );
  }
  return limit;
}

function datasetKey(
  symbol: string,
  sourceTimeframe: string,
): string {
  return `${symbol}:${sourceTimeframe}`;
}

function compareReviewItems(
  left: LevelEngineCausalReplayValidationReviewItem,
  right: LevelEngineCausalReplayValidationReviewItem,
): number {
  if (left.reviewOrder !== right.reviewOrder) {
    return left.reviewOrder - right.reviewOrder;
  }
  return left.sourceCandidate.id.localeCompare(
    right.sourceCandidate.id,
  );
}

function diagnosticFlags(
  item: LevelEngineCausalReplayValidationReviewItem,
): readonly LevelEngineFrozenSampleDiagnosticFlag[] {
  const result: LevelEngineFrozenSampleDiagnosticFlag[] = [];
  const lifecycle = item.lifecycleDiagnostic;
  const causal = item.causalReplayDiagnostic;
  const confirmation = causal.selectedCycle.confirmationState;

  if (lifecycle.sourceDetectedBeforeFirstBreak === false) {
    result.push('source_detected_late_or_post_break');
  }
  if (!causal.trackFound) {
    result.push('causal_track_missing');
  }
  if (causal.disappearanceCount > 0) {
    result.push('detector_disappeared');
  }
  if (causal.reappearanceCount > 0) {
    result.push('detector_reappeared');
  }
  if (!lifecycle.selectedCycleIsCurrent) {
    result.push('selected_cycle_not_current');
  }
  if (item.sourceCandidate.kind !== item.candidate.kind) {
    result.push('selected_cycle_role_changed');
  }
  if (lifecycle.discardedSourceTouchEpisodeCount > 0) {
    result.push('source_touch_history_discarded');
  }
  if (confirmation === 'not_confirmed_broken') {
    result.push('selected_cycle_broke_before_confirmation');
  }
  if (
    confirmation === 'confirmed_at_break'
    || confirmation === 'confirmed_after_break'
  ) {
    result.push('selected_cycle_confirmed_at_or_after_break');
  }
  if (confirmation === 'cycle_not_observed') {
    result.push('selected_cycle_not_observed');
  }

  return Object.freeze(result);
}

function increment(
  target: Record<string, number>,
  key: string,
): void {
  target[key] = (target[key] ?? 0) + 1;
}

function buildCounts(
  items: readonly LevelEngineFrozenSampleItem[],
): LevelEngineFrozenSampleCounts {
  const bySymbol: Record<string, number> = {};
  const byTimeframe: Record<string, number> = {};
  const byReviewState: Record<string, number> = {};
  const byTransition: Record<string, number> = {};
  const byConfirmation: Record<string, number> = {};
  const byDiagnosticFlag = Object.fromEntries(
    LEVEL_ENGINE_FROZEN_SAMPLE_DIAGNOSTIC_FLAGS.map(
      (flag) => [flag, 0],
    ),
  ) as Record<LevelEngineFrozenSampleDiagnosticFlag, number>;

  for (const item of items) {
    increment(bySymbol, item.symbol);
    increment(byTimeframe, item.sourceTimeframe);
    increment(byReviewState, item.reviewState);
    increment(byTransition, item.selectedTransition);
    increment(
      byConfirmation,
      item.reviewItem.causalReplayDiagnostic
        .selectedCycle.confirmationState,
    );
    for (const flag of item.diagnosticFlags) {
      byDiagnosticFlag[flag] += 1;
    }
  }

  return Object.freeze({
    bySymbol: Object.freeze(bySymbol),
    byTimeframe: Object.freeze(byTimeframe),
    byReviewState: Object.freeze(byReviewState),
    byTransition: Object.freeze(byTransition),
    bySelectedCycleConfirmationState:
      Object.freeze(byConfirmation),
    byDiagnosticFlag: Object.freeze(byDiagnosticFlag),
  });
}

export function buildLevelEngineFrozenSample(
  report: LevelEngineCausalReplayRealDataValidationReport,
  options: BuildLevelEngineFrozenSampleOptions = {},
): LevelEngineFrozenSample {
  const limit = readLimit(options.limit);
  const datasets = new Map<string, LevelEngineFrozenSampleDataset>();
  const datasetOrder: string[] = [];
  const buckets = new Map<
    string,
    LevelEngineCausalReplayValidationReviewItem[]
  >();

  for (const symbolReport of report.symbolReports) {
    for (const dataset of symbolReport.datasets) {
      const key = datasetKey(
        dataset.symbol,
        dataset.sourceTimeframe,
      );
      if (datasets.has(key)) {
        fail(`duplicate dataset ${key}`);
      }
      datasets.set(key, cloneFrozen({ key, ...dataset }));
      datasetOrder.push(key);
      buckets.set(key, []);
    }

    for (const item of symbolReport.reviewQueue) {
      const key = datasetKey(
        item.sourceCandidate.symbol,
        item.sourceCandidate.sourceTimeframe,
      );
      const bucket = buckets.get(key);
      if (!bucket) {
        fail(
          `review item ${item.sourceCandidate.id} `
          + `has no dataset ${key}`,
        );
      }
      bucket.push(item);
    }
  }

  for (const bucket of buckets.values()) {
    bucket.sort(compareReviewItems);
  }

  const availableItemCount = [...buckets.values()].reduce(
    (sum, bucket) => sum + bucket.length,
    0,
  );
  const selectedReviewItems:
    LevelEngineCausalReplayValidationReviewItem[] = [];
  const cursors = new Map<string, number>(
    datasetOrder.map((key) => [key, 0]),
  );

  while (selectedReviewItems.length < limit) {
    let added = false;

    for (const key of datasetOrder) {
      if (selectedReviewItems.length >= limit) {
        break;
      }
      const bucket = buckets.get(key);
      if (!bucket) {
        continue;
      }
      const cursor = cursors.get(key) ?? 0;
      const item = bucket[cursor];
      if (!item) {
        continue;
      }
      selectedReviewItems.push(item);
      cursors.set(key, cursor + 1);
      added = true;
    }

    if (!added) {
      break;
    }
  }

  const usedDatasetKeys = new Set(
    selectedReviewItems.map((item) => datasetKey(
      item.sourceCandidate.symbol,
      item.sourceCandidate.sourceTimeframe,
    )),
  );
  const frozenDatasets = Object.freeze(
    datasetOrder
      .filter((key) => usedDatasetKeys.has(key))
      .map((key) => datasets.get(key)!),
  );

  const items = Object.freeze(
    selectedReviewItems.map((sourceItem, index) => {
      const reviewItem = cloneFrozen(sourceItem);
      const key = datasetKey(
        reviewItem.sourceCandidate.symbol,
        reviewItem.sourceCandidate.sourceTimeframe,
      );
      const flags = diagnosticFlags(reviewItem);
      const item: LevelEngineFrozenSampleItem = Object.freeze({
        id:
          `${key}:${reviewItem.sourceCandidate.id}:`
          + `${reviewItem.lifecycleDiagnostic.selectedCycleId}`,
        selectionIndex: index,
        datasetKey: key,
        symbol: reviewItem.sourceCandidate.symbol,
        sourceTimeframe:
          reviewItem.sourceCandidate.sourceTimeframe,
        sourceCandidateId: reviewItem.sourceCandidate.id,
        selectedCandidateId: reviewItem.candidate.id,
        sourceKind: reviewItem.sourceCandidate.kind,
        selectedKind: reviewItem.candidate.kind,
        selectedMaturity: reviewItem.candidate.maturity,
        selectedTransition:
          reviewItem.lifecycleDiagnostic.selectedTransition,
        reviewState: reviewItem.diagnostic.state,
        selectedZone: cloneFrozen(reviewItem.candidate.zone),
        sourceActiveFrom: reviewItem.sourceCandidate.activeFrom,
        sourceDetectedAt: reviewItem.sourceCandidate.detectedAt,
        selectedActiveFrom: reviewItem.candidate.activeFrom,
        selectedDetectedAt: reviewItem.candidate.detectedAt,
        diagnosticFlags: flags,
        reviewItem,
      });
      return item;
    }),
  );

  const selectedItemCount = items.length;
  const selection = Object.freeze({
    strategy:
      'round_robin_symbol_timeframe_then_review_order' as const,
    requestedLimit: limit,
    availableItemCount,
    selectedItemCount,
    omittedItemCount: availableItemCount - selectedItemCount,
    datasetCount: frozenDatasets.length,
    complete: selectedItemCount === availableItemCount,
  });

  return Object.freeze({
    id: `level-engine-frozen-sample:${report.generatedAt}`,
    version: LEVEL_ENGINE_FROZEN_SAMPLE_VERSION,
    sourceReportVersion: report.version,
    generatedAt: report.generatedAt,
    requestedSymbols: cloneFrozen(report.requestedSymbols),
    requestedTimeframes: cloneFrozen(
      report.requestedTimeframes,
    ),
    appliedOptions: cloneFrozen(report.appliedOptions),
    selection,
    datasets: frozenDatasets,
    items,
    counts: buildCounts(items),
    observationalOnly: true,
    createsSetup: false,
    mergesAcrossTimeframes: false,
    usesQualityScore: false,
    usesFutureCandles: false,
    intendedForManualReview: true,
  });
}
