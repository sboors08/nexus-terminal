import {
  buildLevelLifecycle,
} from './level-engine-lifecycle.js';
import type {
  LevelCandidate,
} from './level-engine.types.js';
import type {
  LevelLifecycleCycle,
  LevelLifecycleResult,
} from './level-engine-lifecycle.types.js';
import type {
  LevelEngineTimeframeDataset,
} from './level-engine-multi-timeframe-detector.types.js';
import {
  diagnoseLevelCandidateForReview,
} from './level-engine-real-data-validation.js';
import type {
  LevelEngineRealDataValidationReport,
  LevelEngineValidationReviewDiagnostic,
  LevelEngineValidationReviewPolicy,
  LevelEngineValidationReviewState,
} from './level-engine-real-data-validation.types.js';
import {
  LEVEL_ENGINE_LIFECYCLE_REAL_DATA_VALIDATION_VERSION,
} from './level-engine-lifecycle-real-data-validation.types.js';
import type {
  LevelEngineLifecycleRealDataValidationReport,
  LevelEngineLifecycleReviewDiagnostic,
  LevelEngineLifecycleValidationReviewItem,
  LevelEngineLifecycleValidationSymbolReport,
} from './level-engine-lifecycle-real-data-validation.types.js';

export type BuildLevelLifecycleForRealData = (
  candidate: LevelCandidate,
  dataset: LevelEngineTimeframeDataset,
) => LevelLifecycleResult;

export type DiagnoseLifecycleCandidateForReview = (
  dataset: LevelEngineTimeframeDataset,
  candidate: LevelCandidate,
  policy: LevelEngineValidationReviewPolicy,
) => LevelEngineValidationReviewDiagnostic;

export interface BuildLevelEngineLifecycleRealDataValidationDependencies {
  readonly buildLifecycle?: BuildLevelLifecycleForRealData;
  readonly diagnoseCandidate?: DiagnoseLifecycleCandidateForReview;
}

function fail(message: string): never {
  throw new Error(
    `Level Engine lifecycle real-data validation: ${message}`,
  );
}

function selectReviewCycle(
  lifecycle: LevelLifecycleResult,
): LevelLifecycleCycle {
  if (lifecycle.cycles.length === 0) {
    fail(`lifecycle ${lifecycle.sourceCandidateId} has no cycles`);
  }

  if (lifecycle.currentCycleId !== null) {
    const current = lifecycle.cycles.find(
      (cycle) => cycle.id === lifecycle.currentCycleId,
    );
    if (!current) {
      fail(
        `current lifecycle cycle ${lifecycle.currentCycleId} is unavailable`,
      );
    }
    return current;
  }

  const terminal = lifecycle.cycles.at(-1);
  if (!terminal) {
    fail(`terminal lifecycle cycle ${lifecycle.sourceCandidateId} is unavailable`);
  }
  return terminal;
}

function lifecycleDiagnostic(
  sourceCandidate: LevelCandidate,
  selectedCycle: LevelLifecycleCycle,
  lifecycle: LevelLifecycleResult,
): LevelEngineLifecycleReviewDiagnostic {
  const selectedEpisodeIds = new Set(
    selectedCycle.candidate.touchEpisodes.map((episode) => episode.id),
  );
  const retainedSourceTouchEpisodeCount =
    sourceCandidate.touchEpisodes.filter(
      (episode) => selectedEpisodeIds.has(episode.id),
    ).length;
  const sourceTouchEpisodeCount = sourceCandidate.touchEpisodes.length;
  const firstBreakAt = lifecycle.cycles
    .find((cycle) => cycle.breakEvidence !== null)
    ?.breakEvidence?.brokenAt ?? null;
  const sourceDetectedBeforeFirstBreak = firstBreakAt === null
    ? null
    : Date.parse(sourceCandidate.detectedAt) < Date.parse(firstBreakAt);

  return Object.freeze({
    selectedCycleId: selectedCycle.id,
    selectedCycleSequence: selectedCycle.sequence,
    selectedTransition: selectedCycle.transition.type,
    selectedCycleIsCurrent:
      lifecycle.currentCycleId === selectedCycle.id,
    sourceTouchEpisodeCount,
    selectedCycleTouchEpisodeCount:
      selectedCycle.candidate.touchEpisodes.length,
    retainedSourceTouchEpisodeCount,
    discardedSourceTouchEpisodeCount:
      sourceTouchEpisodeCount - retainedSourceTouchEpisodeCount,
    lifecycleCycleCount: lifecycle.cycles.length,
    lifecycleBreakCount: lifecycle.breakCount,
    lifecycleFlipCount: lifecycle.flipCount,
    lifecycleReclaimCount: lifecycle.reclaimCount,
    ignoredLifecycleEpisodeCount: lifecycle.ignoredEpisodes.length,
    firstBreakAt,
    sourceDetectedBeforeFirstBreak,
  });
}

function freezeStateCounts(
  items: readonly LevelEngineLifecycleValidationReviewItem[],
  source: boolean,
): Readonly<Record<LevelEngineValidationReviewState, number>> {
  const counts: Record<LevelEngineValidationReviewState, number> = {
    active: 0,
    broken: 0,
    stale: 0,
    pending: 0,
  };

  for (const item of items) {
    const diagnostic = source
      ? item.sourceDiagnostic
      : item.diagnostic;
    counts[diagnostic.state] += 1;
  }

  return Object.freeze(counts);
}

export function buildLevelEngineLifecycleRealDataValidationReport(
  report: LevelEngineRealDataValidationReport,
  dependencies: BuildLevelEngineLifecycleRealDataValidationDependencies = {},
): LevelEngineLifecycleRealDataValidationReport {
  const buildLifecycle =
    dependencies.buildLifecycle ?? buildLevelLifecycle;
  const diagnoseCandidate =
    dependencies.diagnoseCandidate ?? diagnoseLevelCandidateForReview;

  const symbolReports: LevelEngineLifecycleValidationSymbolReport[] =
    report.symbolReports.map((symbolReport) => {
      const reviewQueue = symbolReport.reviewQueue.map((item) => {
        const dataset = symbolReport.datasets.find(
          (value) =>
            value.sourceTimeframe === item.candidate.sourceTimeframe,
        );
        if (!dataset) {
          fail(
            `dataset is unavailable for ${item.candidate.symbol} `
            + item.candidate.sourceTimeframe,
          );
        }

        const lifecycle = buildLifecycle(item.candidate, dataset);
        const selectedCycle = selectReviewCycle(lifecycle);
        const candidate = selectedCycle.candidate;
        const diagnostic = diagnoseCandidate(
          dataset,
          candidate,
          report.reviewPolicy,
        );

        return Object.freeze({
          reviewOrder: item.reviewOrder,
          sourceCandidate: item.candidate,
          candidate,
          sourceDiagnostic: item.diagnostic,
          diagnostic,
          lifecycle,
          lifecycleDiagnostic: lifecycleDiagnostic(
            item.candidate,
            selectedCycle,
            lifecycle,
          ),
          manualLabel: item.manualLabel,
          manualNote: item.manualNote,
        });
      });

      return Object.freeze({
        symbol: symbolReport.symbol,
        datasets: symbolReport.datasets,
        detection: symbolReport.detection,
        timeframeSummaries: symbolReport.timeframeSummaries,
        reviewQueue: Object.freeze(reviewQueue),
      });
    });

  const frozenSymbolReports = Object.freeze(symbolReports);
  const items = Object.freeze(
    frozenSymbolReports.flatMap((symbolReport) => symbolReport.reviewQueue),
  );
  const lifecycleCycleCount = items.reduce(
    (sum, item) => sum + item.lifecycleDiagnostic.lifecycleCycleCount,
    0,
  );
  const transitionCounts = Object.freeze({
    origin: items.filter(
      (item) => item.lifecycleDiagnostic.selectedTransition === 'origin',
    ).length,
    reclaim: items.filter(
      (item) => item.lifecycleDiagnostic.selectedTransition === 'reclaim',
    ).length,
    flip: items.filter(
      (item) => item.lifecycleDiagnostic.selectedTransition === 'flip',
    ).length,
  });

  const totals = Object.freeze({
    ...report.totals,
    reviewStateCounts: freezeStateCounts(items, false),
    sourceReviewStateCounts: freezeStateCounts(items, true),
    lifecycleCycleCount,
    lifecycleBreakCount: items.reduce(
      (sum, item) => sum + item.lifecycleDiagnostic.lifecycleBreakCount,
      0,
    ),
    lifecycleFlipCount: items.reduce(
      (sum, item) => sum + item.lifecycleDiagnostic.lifecycleFlipCount,
      0,
    ),
    lifecycleReclaimCount: items.reduce(
      (sum, item) => sum + item.lifecycleDiagnostic.lifecycleReclaimCount,
      0,
    ),
    ignoredLifecycleEpisodeCount: items.reduce(
      (sum, item) =>
        sum + item.lifecycleDiagnostic.ignoredLifecycleEpisodeCount,
      0,
    ),
    currentLifecycleCycleCount: items.filter(
      (item) => item.lifecycleDiagnostic.selectedCycleIsCurrent,
    ).length,
    terminalBrokenLifecycleCount: items.filter(
      (item) => !item.lifecycleDiagnostic.selectedCycleIsCurrent,
    ).length,
    sourceTouchEpisodeCount: items.reduce(
      (sum, item) =>
        sum + item.lifecycleDiagnostic.sourceTouchEpisodeCount,
      0,
    ),
    selectedCycleTouchEpisodeCount: items.reduce(
      (sum, item) =>
        sum + item.lifecycleDiagnostic.selectedCycleTouchEpisodeCount,
      0,
    ),
    retainedSourceTouchEpisodeCount: items.reduce(
      (sum, item) =>
        sum + item.lifecycleDiagnostic.retainedSourceTouchEpisodeCount,
      0,
    ),
    discardedSourceTouchEpisodeCount: items.reduce(
      (sum, item) =>
        sum + item.lifecycleDiagnostic.discardedSourceTouchEpisodeCount,
      0,
    ),
    transitionCounts,
    preBreakDetectionCount: items.filter(
      (item) =>
        item.lifecycleDiagnostic.sourceDetectedBeforeFirstBreak === true,
    ).length,
    lateOrPostBreakDetectionCount: items.filter(
      (item) =>
        item.lifecycleDiagnostic.sourceDetectedBeforeFirstBreak === false,
    ).length,
    noBreakObservedCount: items.filter(
      (item) =>
        item.lifecycleDiagnostic.sourceDetectedBeforeFirstBreak === null,
    ).length,
  });

  return Object.freeze({
    version: LEVEL_ENGINE_LIFECYCLE_REAL_DATA_VALIDATION_VERSION,
    sourceValidationVersion: report.version,
    reviewDiagnosticsVersion: report.reviewDiagnosticsVersion,
    generatedAt: report.generatedAt,
    binanceBaseUrl: report.binanceBaseUrl,
    requestedSymbols: report.requestedSymbols,
    requestedTimeframes: report.requestedTimeframes,
    candlesPerTimeframe: report.candlesPerTimeframe,
    reviewLimitPerSymbol: report.reviewLimitPerSymbol,
    reviewPolicy: report.reviewPolicy,
    symbolReports: frozenSymbolReports,
    totals,
    observationalOnly: true,
    createsSetup: false,
    mergesAcrossTimeframes: false,
    usesQualityScore: false,
  });
}
