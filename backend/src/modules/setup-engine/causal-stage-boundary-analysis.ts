import type {
  LevelEngineCandle,
} from '../level-engine/level-engine-touch-detector.types.js';
import type {
  SetupCausalContext,
} from './causal-setup-adapter.types.js';
import {
  replayCausalSetupRealDataDataset,
} from './causal-setup-real-data-validation.js';
import type {
  CausalSetupRealDataReplayProgress,
} from './causal-setup-real-data-validation.js';
import type {
  CausalSetupCandidateTrack,
  CausalSetupRealDataLatencyStats,
  CausalSetupRealDataValidationReport,
  CausalSetupStageObservation,
} from './causal-setup-real-data-validation.types.js';
import {
  CAUSAL_STAGE_BOUNDARY_ANALYSIS_VERSION,
} from './causal-stage-boundary-analysis.types.js';
import type {
  CausalStageBoundaryAnalysisReport,
  CausalStageBoundaryChurnTotals,
  CausalStageBoundaryLineAnalysis,
  CausalStageBoundaryPoint,
  CausalStageBoundaryPolicy,
  CausalStageBoundaryPolicyTotals,
  CausalStageBoundaryPreviousCandle,
  CausalStageBoundarySameBarReason,
  CausalStageBoundarySameBarReasonTotals,
  CausalStageBoundarySymbolAnalysis,
} from './causal-stage-boundary-analysis.types.js';

interface BoundaryTracePoint {
  readonly observedAt: string;
  readonly observedCandleIndex: number;
  readonly context: SetupCausalContext;
}

export interface CausalStageBoundaryAnalysisDependencies {
  readonly onReplayProgress?: (
    progress: CausalSetupRealDataReplayProgress,
  ) => void;
}

export class CausalStageBoundaryAnalysisError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      'CausalStageBoundaryAnalysisError';
  }
}

function fail(
  message: string,
): never {
  throw new CausalStageBoundaryAnalysisError(
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

function pointFromContext(
  context: SetupCausalContext,
  observedCandleIndex: number,
  observationCandleIndex: number,
): CausalStageBoundaryPoint {
  const distance =
    context.distanceToLevelPercent;

  if (
    distance === null
    || !Number.isFinite(distance)
  ) {
    fail(
      `line ${context.lineId} has no finite distance at ${context.observedAt}`,
    );
  }

  return Object.freeze({
    observedAt:
      context.observedAt,
    observedCandleIndex,
    distanceToLevelPercent:
      distance,
    maxDistanceToLevelPercent:
      context.maxDistanceToLevelPercent,
    observationProgress:
      context.observationProgress,
    lagFromObservationBars:
      observedCandleIndex
      - observationCandleIndex,
  });
}

function pointFromObservation(
  value: CausalSetupStageObservation,
  observationCandleIndex: number,
): CausalStageBoundaryPoint {
  return pointFromContext(
    value.context,
    value.observedCandleIndex,
    observationCandleIndex,
  );
}

function sameTraceContext(
  left: SetupCausalContext,
  right: SetupCausalContext,
): boolean {
  return left.lineId === right.lineId
    && left.observedAt === right.observedAt
    && left.stage === right.stage
    && left.distanceToLevelPercent
      === right.distanceToLevelPercent
    && left.maxDistanceToLevelPercent
      === right.maxDistanceToLevelPercent
    && left.observationProgress
      === right.observationProgress;
}

function previousClosedCandle(
  candles: readonly LevelEngineCandle[],
  observationIndex: number,
  levelPrice: number,
  threshold: number,
): CausalStageBoundaryPreviousCandle | null {
  let previous:
    {
      readonly candle: LevelEngineCandle;
      readonly originalIndex: number;
    } | undefined;

  for (
    let index = observationIndex - 1;
    index >= 0;
    index -= 1
  ) {
    const candle =
      candles[index];

    if (candle?.isClosed) {
      previous = {
        candle,
        originalIndex: index,
      };
      break;
    }
  }

  if (!previous) {
    return null;
  }

  const distance =
    distancePercent(
      previous.candle.close,
      levelPrice,
    );

  return Object.freeze({
    observedAt:
      previous.candle.closeTime,
    observedCandleIndex:
      previous.originalIndex,
    close:
      previous.candle.close,
    distanceToLevelPercent:
      distance,
    insideApproachBoundary:
      distance <= threshold,
  });
}

function firstInside(
  trace: readonly BoundaryTracePoint[],
  observationIndex: number,
  requireLaterCandle: boolean,
): CausalStageBoundaryPoint | null {
  const selected =
    trace.find(
      (value) => {
        const distance =
          value.context
            .distanceToLevelPercent;

        return distance !== null
          && distance <= value.context
            .maxDistanceToLevelPercent
          && (
            !requireLaterCandle
            || value.observedCandleIndex
              > observationIndex
          );
      },
    );

  return selected
    ? pointFromContext(
        selected.context,
        selected.observedCandleIndex,
        observationIndex,
      )
    : null;
}

function firstCrossing(
  trace: readonly BoundaryTracePoint[],
  candles: readonly LevelEngineCandle[],
  observationIndex: number,
  levelPrice: number,
): CausalStageBoundaryPoint | null {
  for (const value of trace) {
    const distance =
      value.context
        .distanceToLevelPercent;

    if (
      distance === null
      || distance > value.context
        .maxDistanceToLevelPercent
    ) {
      continue;
    }

    const previous =
      previousClosedCandle(
        candles,
        value.observedCandleIndex,
        levelPrice,
        value.context
          .maxDistanceToLevelPercent,
      );

    if (
      previous
      && !previous.insideApproachBoundary
    ) {
      return pointFromContext(
        value.context,
        value.observedCandleIndex,
        observationIndex,
      );
    }
  }

  return null;
}

function currentApproach(
  tracks: readonly CausalSetupCandidateTrack[],
  observationIndex: number,
): CausalStageBoundaryPoint | null {
  const approaches =
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

  return approaches[0]
    ? pointFromObservation(
        approaches[0],
        observationIndex,
      )
    : null;
}

function sameBarReason(
  approach: CausalStageBoundaryPoint | null,
  observationIndex: number,
  previous:
    CausalStageBoundaryPreviousCandle | null,
): CausalStageBoundarySameBarReason | null {
  if (
    !approach
    || approach.observedCandleIndex
      !== observationIndex
  ) {
    return null;
  }

  if (!previous) {
    return 'previous_closed_candle_unavailable';
  }

  return previous.insideApproachBoundary
    ? 'already_inside_boundary_before_observation'
    : 'entered_boundary_on_observation_candle';
}

function policyPoint(
  line: CausalStageBoundaryLineAnalysis,
  policy: CausalStageBoundaryPolicy,
): CausalStageBoundaryPoint | null {
  switch (policy) {
    case 'current_same_snapshot':
      return line.currentApproach;
    case 'next_closed_candle':
      return line.nextClosedCandleApproach;
    case 'outside_to_inside_crossing':
      return line
        .outsideToInsideCrossingApproach;
  }
}

function policyTotals(
  lines: readonly CausalStageBoundaryLineAnalysis[],
  policy: CausalStageBoundaryPolicy,
): CausalStageBoundaryPolicyTotals {
  const selected =
    lines.map(
      (line) => ({
        current:
          line.currentApproach,
        policy:
          policyPoint(
            line,
            policy,
          ),
      }),
    );
  const reached =
    selected.filter(
      (value) =>
        value.policy !== null,
    );

  return Object.freeze({
    policy,
    approachCount:
      reached.length,
    sameBarApproachCount:
      reached.filter(
        (value) =>
          value.policy
            ?.lagFromObservationBars
          === 0,
      ).length,
    delayedApproachCount:
      reached.filter(
        (value) =>
          (
            value.policy
              ?.lagFromObservationBars
            ?? 0
          ) > 0,
      ).length,
    neverApproachCount:
      lines.length
      - reached.length,
    retainedCurrentApproachCount:
      selected.filter(
        (value) =>
          value.current !== null
          && value.policy !== null,
      ).length,
    delayedFromCurrentCount:
      selected.filter(
        (value) =>
          value.current !== null
          && value.policy !== null
          && value.policy
            .observedCandleIndex
            > value.current
              .observedCandleIndex,
      ).length,
    lostFromCurrentCount:
      selected.filter(
        (value) =>
          value.current !== null
          && value.policy === null,
      ).length,
    newComparedWithCurrentCount:
      selected.filter(
        (value) =>
          value.current === null
          && value.policy !== null,
      ).length,
    observationToApproachBars:
      latencyStats(
        reached.map(
          (value) =>
            value.policy!
              .lagFromObservationBars,
        ),
      ),
  });
}

function reasonTotals(
  lines: readonly CausalStageBoundaryLineAnalysis[],
): CausalStageBoundarySameBarReasonTotals {
  return Object.freeze({
    enteredBoundaryOnObservationCandle:
      lines.filter(
        (line) =>
          line.sameBarReason
          === 'entered_boundary_on_observation_candle',
      ).length,
    alreadyInsideBoundaryBeforeObservation:
      lines.filter(
        (line) =>
          line.sameBarReason
          === 'already_inside_boundary_before_observation',
      ).length,
    previousClosedCandleUnavailable:
      lines.filter(
        (line) =>
          line.sameBarReason
          === 'previous_closed_candle_unavailable',
      ).length,
  });
}

function churnTotals(
  lines: readonly CausalStageBoundaryLineAnalysis[],
): CausalStageBoundaryChurnTotals {
  return Object.freeze({
    disappearanceCount:
      lines.reduce(
        (total, line) =>
          total
          + line.churn
            .disappearanceCount,
        0,
      ),
    reappearanceCount:
      lines.reduce(
        (total, line) =>
          total
          + line.churn
            .reappearanceCount,
        0,
      ),
    linesWithDisappearance:
      lines.filter(
        (line) =>
          line.churn
            .disappearanceCount > 0,
      ).length,
    linesWithReappearance:
      lines.filter(
        (line) =>
          line.churn
            .reappearanceCount > 0,
      ).length,
    linesWithMultipleReappearances:
      lines.filter(
        (line) =>
          line.churn
            .reappearanceCount > 1,
      ).length,
    linesPresentAtEnd:
      lines.filter(
        (line) =>
          line.churn.presentAtEnd,
      ).length,
    linesAbsentAtEnd:
      lines.filter(
        (line) =>
          !line.churn.presentAtEnd,
      ).length,
  });
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

export function buildCausalStageBoundaryAnalysisReport(
  source: CausalSetupRealDataValidationReport,
  dependencies:
    CausalStageBoundaryAnalysisDependencies = {},
): CausalStageBoundaryAnalysisReport {
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
    CausalStageBoundarySymbolAnalysis[] = [];
  let pairAnomalyCount = 0;

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

    const traceByLine =
      new Map<
        string,
        BoundaryTracePoint[]
      >();
    const replayed =
      replayCausalSetupRealDataDataset(
        dataset,
        {
          startAtClosedCandleCount:
            source.appliedOptions
              .startAtClosedCandleCount,
          pipelineOptions:
            source.appliedOptions
              .pipelineOptions,
        },
        {
          ...(dependencies
            .onReplayProgress
            ? {
                onReplayProgress:
                  dependencies
                    .onReplayProgress,
              }
            : {}),
          onReplayStep:
            (step) => {
              const seen =
                new Map<
                  string,
                  SetupCausalContext
                >();

              for (const update of step.updates) {
                const previous =
                  seen.get(
                    update.context.lineId,
                  );

                if (
                  previous
                  && !sameTraceContext(
                    previous,
                    update.context,
                  )
                ) {
                  fail(
                    `candidate pair for ${update.context.lineId} disagrees at ${step.currentObservedAt}`,
                  );
                }
                if (previous) {
                  continue;
                }

                seen.set(
                  update.context.lineId,
                  update.context,
                );
                const values =
                  traceByLine.get(
                    update.context.lineId,
                  )
                  ?? [];

                values.push(
                  Object.freeze({
                    observedAt:
                      step.currentObservedAt,
                    observedCandleIndex:
                      step.currentCandleIndex,
                    context:
                      update.context,
                  }),
                );
                traceByLine.set(
                  update.context.lineId,
                  values,
                );
              }
            },
        },
      );

    if (
      replayed.totals.violationCount !== 0
      || replayed.totals.candidateTrackCount
        !== sourceSymbolReport
          .dataset.totals
          .candidateTrackCount
    ) {
      fail(
        `replay drift detected for ${sourceSymbolReport.symbol}`,
      );
    }

    const tracksByLine =
      new Map<
        string,
        CausalSetupCandidateTrack[]
      >();

    for (const track of replayed.candidateTracks) {
      const values =
        tracksByLine.get(track.lineId)
        ?? [];

      values.push(track);
      tracksByLine.set(
        track.lineId,
        values,
      );
    }

    const lines:
      CausalStageBoundaryLineAnalysis[] = [];

    for (
      const [lineId, tracks]
      of [...tracksByLine.entries()]
        .sort(
          (left, right) =>
            left[0].localeCompare(
              right[0],
            ),
        )
    ) {
      if (pairIsAnomalous(tracks)) {
        pairAnomalyCount += 1;
      }

      const first =
        tracks[0];

      if (!first) {
        continue;
      }

      const observationIndex =
        first.observation
          .observedCandleIndex;
      const observation =
        pointFromObservation(
          first.observation,
          observationIndex,
        );
      const trace =
        Object.freeze([
          ...(traceByLine.get(lineId)
            ?? []),
        ]);
      const current =
        currentApproach(
          tracks,
          observationIndex,
        );
      const previous =
        previousClosedCandle(
          dataset.candles,
          observationIndex,
          first.levelPrice,
          observation
            .maxDistanceToLevelPercent,
        );
      const setupTypes =
        Object.freeze(
          [...new Set(
            tracks.map(
              (track) =>
                track.setupType,
            ),
          )].sort(),
        );
      const directions =
        Object.freeze(
          [...new Set(
            tracks.map(
              (track) =>
                track.direction,
            ),
          )].sort(),
        );

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
          setupTypes,
          directions,
          observation,
          previousClosedCandle:
            previous,
          currentApproach:
            current,
          nextClosedCandleApproach:
            firstInside(
              trace,
              observationIndex,
              true,
            ),
          outsideToInsideCrossingApproach:
            firstCrossing(
              trace,
              dataset.candles,
              observationIndex,
              first.levelPrice,
            ),
          sameBarReason:
            sameBarReason(
              current,
              observationIndex,
              previous,
            ),
          churn:
            Object.freeze({
              scanObservationCount:
                Math.max(
                  ...tracks.map(
                    (track) =>
                      track
                        .scanObservationCount,
                  ),
                ),
              disappearanceCount:
                Math.max(
                  ...tracks.map(
                    (track) =>
                      track
                        .disappearanceCount,
                  ),
                ),
              reappearanceCount:
                Math.max(
                  ...tracks.map(
                    (track) =>
                      track
                        .reappearanceCount,
                  ),
                ),
              presentAtEnd:
                tracks.some(
                  (track) =>
                    track.presentAtEnd,
                ),
            }),
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
        current:
          policyTotals(
            frozenLines,
            'current_same_snapshot',
          ),
        nextClosedCandle:
          policyTotals(
            frozenLines,
            'next_closed_candle',
          ),
        outsideToInsideCrossing:
          policyTotals(
            frozenLines,
            'outside_to_inside_crossing',
          ),
        sameBarReasons:
          reasonTotals(frozenLines),
        churn:
          churnTotals(frozenLines),
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
      CAUSAL_STAGE_BOUNDARY_ANALYSIS_VERSION,
    sourceValidationVersion:
      source.version,
    generatedAt:
      source.generatedAt,
    requestedSymbols:
      Object.freeze([
        ...source.requestedSymbols,
      ]),
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
        candidatePairAnomalyCount:
          pairAnomalyCount,
        current:
          policyTotals(
            lines,
            'current_same_snapshot',
          ),
        nextClosedCandle:
          policyTotals(
            lines,
            'next_closed_candle',
          ),
        outsideToInsideCrossing:
          policyTotals(
            lines,
            'outside_to_inside_crossing',
          ),
        sameBarReasons:
          reasonTotals(lines),
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
    usesFutureRealtimeEvidence: false,
  });
}
