import {
  detectLevelLines,
} from '../level-engine/level-lines-detector.js';
import type {
  DepartureExtremum,
} from '../level-engine/departure-extremum-tracker.types.js';
import type {
  LevelEngineCandle,
} from '../level-engine/level-engine-touch-detector.types.js';
import type {
  LevelLineApproachEvaluation,
} from '../level-engine/approach-engine.types.js';
import type {
  ObservationPathProgress,
} from '../level-engine/observation-tracker.types.js';
import type {
  LevelLine,
} from '../level-engine/level-lines.types.js';
import {
  CAUSAL_OBSERVATION_ENTRY_GEOMETRY_ANALYSIS_VERSION,
} from './causal-observation-entry-geometry-analysis.types.js';
import type {
  CausalObservationChurnTotals,
  CausalObservationCurrentStagePoint,
  CausalObservationEligibilityChurn,
  CausalObservationEntryGeometryAnalysisReport,
  CausalObservationEntryLineAnalysis,
  CausalObservationEntryPolicy,
  CausalObservationEntryPolicyResult,
  CausalObservationEntryPolicyTotals,
  CausalObservationEntrySymbolAnalysis,
  CausalObservationGeometryPoint,
} from './causal-observation-entry-geometry-analysis.types.js';
import type {
  CausalSetupCandidateTrack,
  CausalSetupRealDataLatencyStats,
  CausalSetupRealDataValidationReport,
  CausalSetupStageObservation,
} from './causal-setup-real-data-validation.types.js';

const PROGRESS_THRESHOLDS =
  Object.freeze([
    0.5,
    0.4,
    0.3,
    0.2,
    0.1,
  ] as const);

const POLICIES:
readonly CausalObservationEntryPolicy[] =
  Object.freeze([
    'current_progress_0_50',
    'progress_0_40',
    'progress_0_30',
    'progress_0_20',
    'progress_0_10',
    'geometry_before_approach',
  ]);

interface IndexedClosedCandle {
  readonly originalIndex: number;
  readonly candle: LevelEngineCandle;
}

interface MutableChurn {
  seenEligible: boolean;
  previousEligible: boolean;
  replayDisappearanceCount: number;
  replayReappearanceCount: number;
  progressRegressionDisappearanceCount:
    number;
  geometryUnavailableDisappearanceCount:
    number;
}

export interface CausalObservationEntryGeometryAnalysisProgress {
  readonly symbol: string;
  readonly completedStepCount: number;
  readonly totalStepCount: number;
  readonly currentClosedCandleCount: number;
  readonly totalClosedCandleCount: number;
}

export interface CausalObservationEntryGeometryAnalysisDependencies {
  readonly onReplayProgress?: (
    progress:
      CausalObservationEntryGeometryAnalysisProgress,
  ) => void;
}

export class CausalObservationEntryGeometryAnalysisError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      'CausalObservationEntryGeometryAnalysisError';
  }
}

function fail(
  message: string,
): never {
  throw new CausalObservationEntryGeometryAnalysisError(
    message,
  );
}

function latencyStats(
  values: readonly number[],
): CausalSetupRealDataLatencyStats {
  if (values.length === 0) {
    return Object.freeze({
      sampleCount: 0,
      minimumBars: null,
      medianBars: null,
      averageBars: null,
      maximumBars: null,
    });
  }

  const sorted =
    [...values].sort(
      (left, right) =>
        left - right,
    );
  const middle =
    Math.floor(
      sorted.length / 2,
    );
  const median =
    sorted.length % 2 === 1
      ? sorted[middle]!
      : (
          sorted[middle - 1]!
          + sorted[middle]!
        ) / 2;
  const average =
    sorted.reduce(
      (total, value) =>
        total + value,
      0,
    ) / sorted.length;

  return Object.freeze({
    sampleCount:
      sorted.length,
    minimumBars:
      sorted[0]!,
    medianBars:
      median,
    averageBars:
      Number(
        average.toFixed(4),
      ),
    maximumBars:
      sorted.at(-1)!,
  });
}

function distancePercent(
  price: number,
  levelPrice: number,
): number {
  return Math.abs(
    price - levelPrice,
  ) / levelPrice * 100;
}

function closedCandles(
  values: readonly LevelEngineCandle[],
): readonly IndexedClosedCandle[] {
  return Object.freeze(
    values.flatMap(
      (candle, originalIndex) =>
        candle.isClosed
          ? [
              Object.freeze({
                originalIndex,
                candle,
              }),
            ]
          : [],
    ),
  );
}

function tracksByLine(
  tracks: readonly CausalSetupCandidateTrack[],
): ReadonlyMap<
  string,
  readonly CausalSetupCandidateTrack[]
> {
  const grouped =
    new Map<
      string,
      CausalSetupCandidateTrack[]
    >();

  for (const track of tracks) {
    const values =
      grouped.get(track.lineId)
      ?? [];

    values.push(track);
    grouped.set(
      track.lineId,
      values,
    );
  }

  return grouped;
}

function pairIsAnomalous(
  tracks: readonly CausalSetupCandidateTrack[],
): boolean {
  const setupTypes =
    [...new Set(
      tracks.map(
        (track) =>
          track.setupType,
      ),
    )].sort();
  const directions =
    [...new Set(
      tracks.map(
        (track) =>
          track.direction,
      ),
    )].sort();

  return tracks.length !== 2
    || setupTypes.join(',')
      !== 'level_bounce,level_breakout'
    || directions.join(',')
      !== 'long,short';
}

function stagePoint(
  value: CausalSetupStageObservation,
): CausalObservationCurrentStagePoint {
  const distance =
    value.context
      .distanceToLevelPercent;

  if (
    distance === null
    || !Number.isFinite(distance)
  ) {
    fail(
      `line ${value.context.lineId} has no finite distance at ${value.observedAt}`,
    );
  }

  return Object.freeze({
    observedAt:
      value.observedAt,
    observedCandleIndex:
      value.observedCandleIndex,
    distanceToLevelPercent:
      distance,
    progress:
      value.context
        .observationProgress,
  });
}

function firstApproach(
  tracks: readonly CausalSetupCandidateTrack[],
): CausalObservationCurrentStagePoint | null {
  const values =
    tracks
      .map(
        (track) =>
          track.approach,
      )
      .filter(
        (
          value,
        ): value is CausalSetupStageObservation =>
          value !== null,
      )
      .sort(
        (left, right) =>
          left.observedCandleIndex
          - right.observedCandleIndex,
      );

  return values[0]
    ? stagePoint(values[0])
    : null;
}

function point(
  observedCandleIndex: number,
  line: LevelLine,
  extremum: DepartureExtremum,
  progress: ObservationPathProgress,
  approach: LevelLineApproachEvaluation,
): CausalObservationGeometryPoint {
  if (
    line.confirmedAt === null
    || (
      line.status !== 'confirmed'
      && line.status !== 'worked'
    )
    || extremum.lineId !== line.id
    || progress.lineId !== line.id
    || approach.lineId !== line.id
  ) {
    fail(
      `line ${line.id} has inconsistent causal geometry`,
    );
  }

  const departureDistance =
    distancePercent(
      extremum.price,
      line.price,
    );
  const insideApproach =
    approach.distanceToLevelPercent
      <= approach.maxDistanceToLevelPercent;
  const geometryEligible =
    progress.progress > 0
    && progress.progress < 1
    && !insideApproach
    && approach.distanceToLevelPercent
      < departureDistance;

  return Object.freeze({
    observedAt:
      progress.observedAt,
    observedCandleIndex,
    lineStatus:
      line.status,
    lineConfirmedAt:
      line.confirmedAt,
    departureTrackingStartedAt:
      extremum.trackingStartedAt,
    levelPrice:
      line.price,
    departureExtremumPrice:
      extremum.price,
    departureExtremumObservedAt:
      extremum.observedAt,
    departureDistanceToLevelPercent:
      departureDistance,
    currentPrice:
      progress.currentPrice,
    distanceToLevelPercent:
      approach.distanceToLevelPercent,
    maxDistanceToLevelPercent:
      approach.maxDistanceToLevelPercent,
    progress:
      progress.progress,
    currentObservationEligible:
      progress.stage === 'OBSERVATION',
    insideApproachBoundary:
      insideApproach,
    geometryBeforeApproachEligible:
      geometryEligible,
  });
}

function initialChurn(): MutableChurn {
  return {
    seenEligible: false,
    previousEligible: false,
    replayDisappearanceCount: 0,
    replayReappearanceCount: 0,
    progressRegressionDisappearanceCount:
      0,
    geometryUnavailableDisappearanceCount:
      0,
  };
}

function observeChurn(
  churn: MutableChurn,
  value: CausalObservationGeometryPoint | null,
): void {
  const eligible =
    value?.currentObservationEligible
    ?? false;

  if (
    churn.previousEligible
    && !eligible
  ) {
    churn.replayDisappearanceCount +=
      1;

    if (value !== null) {
      churn.progressRegressionDisappearanceCount +=
        1;
    } else {
      churn.geometryUnavailableDisappearanceCount +=
        1;
    }
  }

  if (
    !churn.previousEligible
    && eligible
    && churn.seenEligible
  ) {
    churn.replayReappearanceCount +=
      1;
  }

  churn.seenEligible ||= eligible;
  churn.previousEligible =
    eligible;
}

function thresholdForPolicy(
  policy: CausalObservationEntryPolicy,
): number | null {
  switch (policy) {
    case 'current_progress_0_50':
      return 0.5;
    case 'progress_0_40':
      return 0.4;
    case 'progress_0_30':
      return 0.3;
    case 'progress_0_20':
      return 0.2;
    case 'progress_0_10':
      return 0.1;
    case 'geometry_before_approach':
      return null;
  }
}

function policyEntry(
  trace: readonly CausalObservationGeometryPoint[],
  policy: CausalObservationEntryPolicy,
): CausalObservationGeometryPoint | null {
  const threshold =
    thresholdForPolicy(policy);

  return trace.find(
    (value) =>
      threshold === null
        ? value.geometryBeforeApproachEligible
        : value.progress >= threshold,
  ) ?? null;
}

function policyResult(
  trace: readonly CausalObservationGeometryPoint[],
  policy: CausalObservationEntryPolicy,
  currentObservation:
    CausalObservationCurrentStagePoint,
  currentApproach:
    CausalObservationCurrentStagePoint | null,
): CausalObservationEntryPolicyResult {
  const entry =
    policyEntry(
      trace,
      policy,
    );
  const retained =
    currentApproach !== null
    && entry !== null
    && entry.observedCandleIndex
      <= currentApproach
        .observedCandleIndex;
  const leadBeforeObservation =
    entry !== null
    && entry.observedCandleIndex
      < currentObservation
        .observedCandleIndex
      ? currentObservation
          .observedCandleIndex
        - entry.observedCandleIndex
      : null;
  const leadToApproach =
    retained
      ? currentApproach
          .observedCandleIndex
        - entry!.observedCandleIndex
      : null;

  return Object.freeze({
    policy,
    entry,
    enteredBeforeCurrentObservation:
      leadBeforeObservation !== null,
    leadBarsBeforeCurrentObservation:
      leadBeforeObservation,
    retainedCurrentApproach:
      retained,
    lostCurrentApproach:
      currentApproach !== null
      && !retained,
    sameBarAsCurrentApproach:
      retained
      && leadToApproach === 0,
    leadBarsToCurrentApproach:
      leadToApproach,
    falseEarlyObservationWithoutApproach:
      entry !== null
      && currentApproach === null,
  });
}

function sourceChurn(
  tracks: readonly CausalSetupCandidateTrack[],
  replay: MutableChurn,
): CausalObservationEligibilityChurn {
  const sourceDisappearanceCount =
    Math.max(
      ...tracks.map(
        (track) =>
          track.disappearanceCount,
      ),
    );
  const sourceReappearanceCount =
    Math.max(
      ...tracks.map(
        (track) =>
          track.reappearanceCount,
      ),
    );

  return Object.freeze({
    sourceDisappearanceCount,
    sourceReappearanceCount,
    replayDisappearanceCount:
      replay.replayDisappearanceCount,
    replayReappearanceCount:
      replay.replayReappearanceCount,
    progressRegressionDisappearanceCount:
      replay
        .progressRegressionDisappearanceCount,
    geometryUnavailableDisappearanceCount:
      replay
        .geometryUnavailableDisappearanceCount,
    sourceCountsMatchReplay:
      sourceDisappearanceCount
        === replay.replayDisappearanceCount
      && sourceReappearanceCount
        === replay.replayReappearanceCount,
  });
}

function policyTotals(
  lines: readonly CausalObservationEntryLineAnalysis[],
  policy: CausalObservationEntryPolicy,
): CausalObservationEntryPolicyTotals {
  const results =
    lines.map(
      (line) => {
        const value =
          line.policies.find(
            (candidate) =>
              candidate.policy === policy,
          );

        if (!value) {
          fail(
            `line ${line.lineId} is missing policy ${policy}`,
          );
        }

        return value;
      },
    );

  return Object.freeze({
    policy,
    entryCount:
      results.filter(
        (value) =>
          value.entry !== null,
      ).length,
    entryBeforeCurrentObservationCount:
      results.filter(
        (value) =>
          value.enteredBeforeCurrentObservation,
      ).length,
    retainedCurrentApproachCount:
      results.filter(
        (value) =>
          value.retainedCurrentApproach,
      ).length,
    lostCurrentApproachCount:
      results.filter(
        (value) =>
          value.lostCurrentApproach,
      ).length,
    sameBarAsCurrentApproachCount:
      results.filter(
        (value) =>
          value.sameBarAsCurrentApproach,
      ).length,
    falseEarlyObservationWithoutApproachCount:
      results.filter(
        (value) =>
          value
            .falseEarlyObservationWithoutApproach,
      ).length,
    leadBarsBeforeCurrentObservation:
      latencyStats(
        results.flatMap(
          (value) =>
            value.leadBarsBeforeCurrentObservation
              === null
              ? []
              : [
                  value
                    .leadBarsBeforeCurrentObservation,
                ],
        ),
      ),
    leadBarsToCurrentApproach:
      latencyStats(
        results.flatMap(
          (value) =>
            value.leadBarsToCurrentApproach
              === null
              ? []
              : [
                  value
                    .leadBarsToCurrentApproach,
                ],
        ),
      ),
  });
}

function churnTotals(
  lines: readonly CausalObservationEntryLineAnalysis[],
): CausalObservationChurnTotals {
  const total = (
    selector: (
      value: CausalObservationEligibilityChurn,
    ) => number,
  ) =>
    lines.reduce(
      (sum, line) =>
        sum + selector(line.churn),
      0,
    );
  const replayDisappearanceCount =
    total(
      (value) =>
        value.replayDisappearanceCount,
    );
  const progressRegressionDisappearanceCount =
    total(
      (value) =>
        value
          .progressRegressionDisappearanceCount,
    );

  return Object.freeze({
    sourceDisappearanceCount:
      total(
        (value) =>
          value.sourceDisappearanceCount,
      ),
    sourceReappearanceCount:
      total(
        (value) =>
          value.sourceReappearanceCount,
      ),
    replayDisappearanceCount,
    replayReappearanceCount:
      total(
        (value) =>
          value.replayReappearanceCount,
      ),
    progressRegressionDisappearanceCount,
    geometryUnavailableDisappearanceCount:
      total(
        (value) =>
          value
            .geometryUnavailableDisappearanceCount,
      ),
    linesWithSourceReplayMismatch:
      lines.filter(
        (line) =>
          !line.churn
            .sourceCountsMatchReplay,
      ).length,
    progressRegressionShareOfReplayDisappearance:
      replayDisappearanceCount === 0
        ? null
        : Number((
            progressRegressionDisappearanceCount
            / replayDisappearanceCount
          ).toFixed(6)),
  });
}

export function buildCausalObservationEntryGeometryAnalysisReport(
  source: CausalSetupRealDataValidationReport,
  dependencies:
    CausalObservationEntryGeometryAnalysisDependencies = {},
): CausalObservationEntryGeometryAnalysisReport {
  if (
    source.version
      !== 'causal-setup-real-data-validation-v0.1'
    || source.offlineOnly !== true
    || source.changesTradingRules !== false
    || source.usesFutureCandles !== false
    || source.totals.violationCount !== 0
  ) {
    fail(
      'source causal Setup validation contract is incompatible',
    );
  }

  const datasetsBySymbol =
    new Map(
      source.sourceDatasets.map(
        (dataset) => [
          dataset.symbol,
          dataset,
        ],
      ),
    );
  const symbolReports:
    CausalObservationEntrySymbolAnalysis[] = [];
  let candidatePairAnomalyCount = 0;
  let currentObservationReplayAnomalyCount =
    0;

  for (
    const sourceSymbolReport
    of source.symbolReports
  ) {
    const dataset =
      datasetsBySymbol.get(
        sourceSymbolReport.symbol,
      );

    if (!dataset) {
      fail(
        `source dataset is missing for ${sourceSymbolReport.symbol}`,
      );
    }

    const groupedTracks =
      tracksByLine(
        sourceSymbolReport
          .dataset.candidateTracks,
      );
    const targetLineIds =
      new Set(groupedTracks.keys());
    const traces =
      new Map<
        string,
        CausalObservationGeometryPoint[]
      >(
        [...targetLineIds].map(
          (lineId) => [
            lineId,
            [],
          ],
        ),
      );
    const churnByLine =
      new Map<string, MutableChurn>(
        [...targetLineIds].map(
          (lineId) => [
            lineId,
            initialChurn(),
          ],
        ),
      );
    const closed =
      closedCandles(
        dataset.candles,
      );
    const startCount =
      source.appliedOptions
        .startAtClosedCandleCount;
    const totalStepCount =
      closed.length
      - startCount
      + 1;
    let completedStepCount = 0;

    for (
      let closedCount = startCount;
      closedCount <= closed.length;
      closedCount += 1
    ) {
      const current =
        closed[closedCount - 1];

      if (!current) {
        continue;
      }

      completedStepCount += 1;
      const start =
        Math.max(
          0,
          closedCount
          - source.appliedOptions
            .pipelineOptions.maxCandles,
        );
      const prefix =
        closed.slice(
          start,
          closedCount,
        ).map(
          (value) =>
            value.candle,
        );
      const detection =
        detectLevelLines(
          {
            symbol:
              sourceSymbolReport.symbol,
            timeframe: '1m',
            candles: prefix,
          },
          source.appliedOptions
            .pipelineOptions
            .levelLinesOptions,
        );
      const levels =
        new Map(
          detection.activeLevels.map(
            (line) => [
              line.id,
              line,
            ],
          ),
        );
      const extrema =
        new Map(
          detection
            .departureExtremumTracking
            .activeExtrema.map(
              (value) => [
                value.lineId,
                value,
              ],
            ),
        );
      const progressValues =
        new Map(
          detection.observationTracking
            .activeProgress.map(
              (value) => [
                value.lineId,
                value,
              ],
            ),
        );
      const approaches =
        new Map(
          detection.approachEvaluation
            .evaluations.map(
              (value) => [
                value.lineId,
                value,
              ],
            ),
        );

      for (const lineId of targetLineIds) {
        const line =
          levels.get(lineId);
        const extremum =
          extrema.get(lineId);
        const progress =
          progressValues.get(lineId);
        const approach =
          approaches.get(lineId);
        const value =
          line
          && extremum
          && progress
          && approach
            ? point(
                current.originalIndex,
                line,
                extremum,
                progress,
                approach,
              )
            : null;

        if (value) {
          traces.get(lineId)!
            .push(value);
        }
        observeChurn(
          churnByLine.get(lineId)!,
          value,
        );
      }

      dependencies.onReplayProgress?.(
        Object.freeze({
          symbol:
            sourceSymbolReport.symbol,
          completedStepCount,
          totalStepCount,
          currentClosedCandleCount:
            closedCount,
          totalClosedCandleCount:
            closed.length,
        }),
      );
    }

    const lines:
      CausalObservationEntryLineAnalysis[] = [];

    for (
      const [lineId, tracks]
      of [...groupedTracks.entries()]
        .sort(
          (left, right) =>
            left[0].localeCompare(
              right[0],
            ),
        )
    ) {
      if (pairIsAnomalous(tracks)) {
        candidatePairAnomalyCount += 1;
      }

      const first = tracks[0];

      if (!first) {
        continue;
      }

      const currentObservation =
        stagePoint(
          first.observation,
        );
      const currentApproach =
        firstApproach(tracks);
      const trace =
        Object.freeze([
          ...(traces.get(lineId)
            ?? []),
        ]);
      const currentReplayEntry =
        policyEntry(
          trace,
          'current_progress_0_50',
        );

      if (
        currentReplayEntry === null
        || currentReplayEntry
          .observedCandleIndex
          !== currentObservation
            .observedCandleIndex
      ) {
        currentObservationReplayAnomalyCount +=
          1;
      }

      lines.push(
        Object.freeze({
          symbol:
            first.symbol,
          lineId,
          levelKind:
            first.levelKind,
          levelPrice:
            first.levelPrice,
          candidateCount:
            tracks.length,
          currentObservation,
          currentApproach,
          earliestGeometry:
            trace[0]
            ?? null,
          geometryTrace:
            trace,
          policies:
            Object.freeze(
              POLICIES.map(
                (policy) =>
                  policyResult(
                    trace,
                    policy,
                    currentObservation,
                    currentApproach,
                  ),
              ),
            ),
          churn:
            sourceChurn(
              tracks,
              churnByLine.get(lineId)!,
            ),
        }),
      );
    }

    const frozenLines =
      Object.freeze(lines);

    symbolReports.push(
      Object.freeze({
        symbol:
          sourceSymbolReport.symbol,
        lines:
          frozenLines,
        policies:
          Object.freeze(
            POLICIES.map(
              (policy) =>
                policyTotals(
                  frozenLines,
                  policy,
                ),
            ),
          ),
        churn:
          churnTotals(
            frozenLines,
          ),
      }),
    );
  }

  symbolReports.sort(
    (left, right) =>
      left.symbol.localeCompare(
        right.symbol,
      ),
  );
  const lines =
    Object.freeze(
      symbolReports.flatMap(
        (report) =>
          report.lines,
      ),
    );

  return Object.freeze({
    version:
      CAUSAL_OBSERVATION_ENTRY_GEOMETRY_ANALYSIS_VERSION,
    sourceValidationVersion:
      source.version,
    generatedAt:
      source.generatedAt,
    requestedSymbols:
      Object.freeze([
        ...source.requestedSymbols,
      ]),
    progressThresholds:
      PROGRESS_THRESHOLDS,
    symbolReports:
      Object.freeze([
        ...symbolReports,
      ]),
    totals:
      Object.freeze({
        symbolCount:
          symbolReports.length,
        uniqueLineCount:
          lines.length,
        candidateTrackCount:
          source.totals
            .candidateTrackCount,
        candidatePairAnomalyCount,
        currentObservationReplayAnomalyCount,
        policies:
          Object.freeze(
            POLICIES.map(
              (policy) =>
                policyTotals(
                  lines,
                  policy,
                ),
            ),
          ),
        churn:
          churnTotals(lines),
      }),
    offlineOnly: true,
    reusesFetchedDatasets: true,
    comparesPoliciesOnly: true,
    changesTradingRules: false,
    createsLiveSetup: false,
    createsSignal: false,
    usesQualityScore: false,
    appliesTraining: false,
    usesFutureCandles: false,
    usesFutureCandlesForEntry: false,
    usesFutureRealtimeEvidence: false,
  });
}
