import {
  detectLevelLines,
} from '../level-engine/level-lines-detector.js';
import type {
  DepartureExtremum,
} from '../level-engine/departure-extremum-tracker.types.js';
import type {
  LevelLineApproachEvaluation,
} from '../level-engine/approach-engine.types.js';
import type {
  LevelEngineCandle,
} from '../level-engine/level-engine-touch-detector.types.js';
import type {
  ObservationPathProgress,
} from '../level-engine/observation-tracker.types.js';
import type {
  LevelLine,
} from '../level-engine/level-lines.types.js';
import {
  CAUSAL_OBSERVATION_THRESHOLD_COUNTERFACTUAL_VALIDATION_VERSION,
} from './causal-observation-threshold-counterfactual-validation.types.js';
import type {
  CausalObservationThresholdCounterfactualValidationReport,
  CausalObservationThresholdEpisode,
  CausalObservationThresholdEpisodeEndReason,
  CausalObservationThresholdGeometryPoint,
  CausalObservationThresholdLineAnalysis,
  CausalObservationThresholdLinePolicyResult,
  CausalObservationThresholdPolicy,
  CausalObservationThresholdPolicyChurn,
  CausalObservationThresholdPolicyTotals,
  CausalObservationThresholdReplayAnomalies,
  CausalObservationThresholdStagePoint,
  CausalObservationThresholdSymbolAnalysis,
} from './causal-observation-threshold-counterfactual-validation.types.js';
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
readonly CausalObservationThresholdPolicy[] =
  Object.freeze([
    'progress_0_50',
    'progress_0_40',
    'progress_0_30',
    'progress_0_20',
    'progress_0_10',
  ]);

interface IndexedClosedCandle {
  readonly originalIndex: number;
  readonly candle: LevelEngineCandle;
}

interface MutableEpisode {
  readonly entry:
    CausalObservationThresholdGeometryPoint;
  firstApproach:
    CausalObservationThresholdGeometryPoint | null;
  exit:
    CausalObservationThresholdEpisode['exit'];
  endedBy:
    CausalObservationThresholdEpisodeEndReason | null;
  continuousObservationBars: number;
}

interface MutablePolicyState {
  readonly policy:
    CausalObservationThresholdPolicy;
  readonly threshold: number;
  seenEligible: boolean;
  previousEligible: boolean;
  openEpisode: MutableEpisode | null;
  readonly episodes: MutableEpisode[];
  disappearanceCount: number;
  reappearanceCount: number;
  progressRegressionDisappearanceCount:
    number;
  geometryUnavailableDisappearanceCount:
    number;
}

interface MutableLineState {
  readonly symbol: string;
  readonly lineId: string;
  readonly levelKind: LevelLine['kind'];
  readonly levelPrice: number;
  readonly levelConfirmedAt: string;
  firstGeometry:
    CausalObservationThresholdGeometryPoint;
  lastGeometry:
    CausalObservationThresholdGeometryPoint;
  geometryObservationCount: number;
  readonly policies:
    Map<
      CausalObservationThresholdPolicy,
      MutablePolicyState
    >;
}

interface MutableAnomalies {
  duplicateActiveLineIdCount: number;
  lineIdentityAnomalyCount: number;
  departureContractAnomalyCount: number;
  currentCandidatePairAnomalyCount: number;
  currentCandidateWithoutUniverseLineCount:
    number;
  currentPolicyEntryWithoutCandidateLineCount:
    number;
  currentObservationReplayAnomalyCount:
    number;
  currentApproachReplayAnomalyCount:
    number;
}

export interface CausalObservationThresholdCounterfactualValidationProgress {
  readonly symbol: string;
  readonly completedStepCount: number;
  readonly totalStepCount: number;
  readonly currentClosedCandleCount: number;
  readonly totalClosedCandleCount: number;
}

export interface CausalObservationThresholdCounterfactualValidationDependencies {
  readonly onReplayProgress?: (
    progress:
      CausalObservationThresholdCounterfactualValidationProgress,
  ) => void;
}

export class CausalObservationThresholdCounterfactualValidationError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      'CausalObservationThresholdCounterfactualValidationError';
  }
}

function fail(
  message: string,
): never {
  throw new CausalObservationThresholdCounterfactualValidationError(
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

function ratio(
  numerator: number,
  denominator: number,
): number | null {
  return denominator === 0
    ? null
    : Number((
        numerator / denominator
      ).toFixed(6));
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

function thresholdForPolicy(
  policy: CausalObservationThresholdPolicy,
): number {
  switch (policy) {
    case 'progress_0_50':
      return 0.5;
    case 'progress_0_40':
      return 0.4;
    case 'progress_0_30':
      return 0.3;
    case 'progress_0_20':
      return 0.2;
    case 'progress_0_10':
      return 0.1;
  }
}

function initialPolicyState(
  policy: CausalObservationThresholdPolicy,
): MutablePolicyState {
  return {
    policy,
    threshold:
      thresholdForPolicy(policy),
    seenEligible: false,
    previousEligible: false,
    openEpisode: null,
    episodes: [],
    disappearanceCount: 0,
    reappearanceCount: 0,
    progressRegressionDisappearanceCount:
      0,
    geometryUnavailableDisappearanceCount:
      0,
  };
}

function initialAnomalies(): MutableAnomalies {
  return {
    duplicateActiveLineIdCount: 0,
    lineIdentityAnomalyCount: 0,
    departureContractAnomalyCount: 0,
    currentCandidatePairAnomalyCount: 0,
    currentCandidateWithoutUniverseLineCount:
      0,
    currentPolicyEntryWithoutCandidateLineCount:
      0,
    currentObservationReplayAnomalyCount:
      0,
    currentApproachReplayAnomalyCount:
      0,
  };
}

function point(
  observedCandleIndex: number,
  line: LevelLine,
  extremum: DepartureExtremum,
  progress: ObservationPathProgress,
  approach: LevelLineApproachEvaluation,
): CausalObservationThresholdGeometryPoint | null {
  if (
    line.confirmedAt === null
    || (
      line.status !== 'confirmed'
      && line.status !== 'worked'
    )
    || extremum.lineId !== line.id
    || progress.lineId !== line.id
    || approach.lineId !== line.id
    || extremum.symbol !== line.symbol
    || progress.symbol !== line.symbol
    || approach.symbol !== line.symbol
    || extremum.kind !== line.kind
    || progress.kind !== line.kind
    || approach.kind !== line.kind
    || extremum.levelPrice !== line.price
    || progress.levelPrice !== line.price
    || approach.levelPrice !== line.price
  ) {
    return null;
  }

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
      distancePercent(
        extremum.price,
        line.price,
      ),
    currentPrice:
      progress.currentPrice,
    distanceToLevelPercent:
      approach.distanceToLevelPercent,
    maxDistanceToLevelPercent:
      approach.maxDistanceToLevelPercent,
    progress:
      progress.progress,
    insideApproachBoundary:
      approach.distanceToLevelPercent
      <= approach.maxDistanceToLevelPercent,
  });
}

function ensureLine(
  states: Map<string, MutableLineState>,
  line: LevelLine,
  value: CausalObservationThresholdGeometryPoint,
  anomalies: MutableAnomalies,
): MutableLineState {
  const existing =
    states.get(line.id);

  if (existing) {
    if (
      existing.symbol !== line.symbol
      || existing.lineId !== line.id
      || existing.levelKind !== line.kind
      || existing.levelPrice !== line.price
      || existing.levelConfirmedAt
        !== line.confirmedAt
    ) {
      anomalies.lineIdentityAnomalyCount +=
        1;
    }

    existing.lastGeometry =
      value;
    existing.geometryObservationCount +=
      1;

    return existing;
  }

  if (line.confirmedAt === null) {
    fail(
      `line ${line.id} entered the counterfactual universe without confirmation`,
    );
  }

  const created: MutableLineState = {
    symbol:
      line.symbol,
    lineId:
      line.id,
    levelKind:
      line.kind,
    levelPrice:
      line.price,
    levelConfirmedAt:
      line.confirmedAt,
    firstGeometry:
      value,
    lastGeometry:
      value,
    geometryObservationCount: 1,
    policies:
      new Map(
        POLICIES.map(
          (policy) => [
            policy,
            initialPolicyState(
              policy,
            ),
          ],
        ),
      ),
  };

  states.set(
    line.id,
    created,
  );

  return created;
}

function closeEpisode(
  state: MutablePolicyState,
  observedAt: string,
  observedCandleIndex: number,
  reason:
    Exclude<
      CausalObservationThresholdEpisodeEndReason,
      'dataset_end'
    >,
): void {
  const episode =
    state.openEpisode;

  if (!episode) {
    fail(
      `policy ${state.policy} has no open episode to close`,
    );
  }

  episode.exit =
    Object.freeze({
      observedAt,
      observedCandleIndex,
      reason,
    });
  episode.endedBy =
    reason;
  state.openEpisode =
    null;
}

function observePolicy(
  state: MutablePolicyState,
  value:
    CausalObservationThresholdGeometryPoint | null,
  observedAt: string,
  observedCandleIndex: number,
): void {
  const eligible =
    value !== null
    && value.progress >= state.threshold;

  if (
    eligible
    && !state.previousEligible
  ) {
    if (state.seenEligible) {
      state.reappearanceCount +=
        1;
    }

    const episode: MutableEpisode = {
      entry:
        value,
      firstApproach: null,
      exit: null,
      endedBy: null,
      continuousObservationBars: 0,
    };

    state.episodes.push(
      episode,
    );
    state.openEpisode =
      episode;
  }

  if (eligible) {
    const episode =
      state.openEpisode;

    if (!episode) {
      fail(
        `policy ${state.policy} is eligible without an open episode`,
      );
    }

    episode.continuousObservationBars +=
      1;

    if (
      episode.firstApproach === null
      && value.insideApproachBoundary
    ) {
      episode.firstApproach =
        value;
    }
  }

  if (
    state.previousEligible
    && !eligible
  ) {
    const reason =
      value === null
        ? 'geometry_unavailable'
        : 'progress_regression';

    state.disappearanceCount +=
      1;

    if (reason === 'progress_regression') {
      state.progressRegressionDisappearanceCount +=
        1;
    } else {
      state.geometryUnavailableDisappearanceCount +=
        1;
    }

    closeEpisode(
      state,
      observedAt,
      observedCandleIndex,
      reason,
    );
  }

  state.seenEligible ||= eligible;
  state.previousEligible =
    eligible;
}

function finalizePolicy(
  state: MutablePolicyState,
): void {
  if (state.openEpisode) {
    state.openEpisode.endedBy =
      'dataset_end';
    state.openEpisode =
      null;
  }
}

function freezeEpisode(
  value: MutableEpisode,
): CausalObservationThresholdEpisode {
  if (value.endedBy === null) {
    fail(
      'counterfactual episode was not finalized',
    );
  }

  const barsToApproach =
    value.firstApproach === null
      ? null
      : value.firstApproach
          .observedCandleIndex
        - value.entry
          .observedCandleIndex;

  return Object.freeze({
    entry:
      value.entry,
    firstApproach:
      value.firstApproach,
    exit:
      value.exit,
    endedBy:
      value.endedBy,
    continuousObservationBars:
      value.continuousObservationBars,
    barsToApproach,
    sameBarApproach:
      barsToApproach === 0,
  });
}

function freezeChurn(
  value: MutablePolicyState,
): CausalObservationThresholdPolicyChurn {
  return Object.freeze({
    disappearanceCount:
      value.disappearanceCount,
    reappearanceCount:
      value.reappearanceCount,
    progressRegressionDisappearanceCount:
      value
        .progressRegressionDisappearanceCount,
    geometryUnavailableDisappearanceCount:
      value
        .geometryUnavailableDisappearanceCount,
  });
}

function linePolicyResult(
  state: MutablePolicyState,
  currentCandidate: boolean,
): CausalObservationThresholdLinePolicyResult {
  const episodes =
    Object.freeze(
      state.episodes.map(
        freezeEpisode,
      ),
    );
  const firstEntry =
    episodes[0]?.entry
    ?? null;
  const firstApproach =
    episodes.flatMap(
      (episode) =>
        episode.firstApproach
          ? [episode.firstApproach]
          : [],
    )[0]
    ?? null;
  const barsToApproach =
    firstEntry !== null
    && firstApproach !== null
      ? firstApproach
          .observedCandleIndex
        - firstEntry
          .observedCandleIndex
      : null;
  const entered =
    firstEntry !== null;

  return Object.freeze({
    policy:
      state.policy,
    threshold:
      state.threshold,
    entered,
    currentCandidateEntry:
      entered
      && currentCandidate,
    additionalCounterfactualEntry:
      entered
      && !currentCandidate,
    firstEntry,
    firstApproach,
    reachedApproach:
      firstApproach !== null,
    noSubsequentApproach:
      entered
      && firstApproach === null,
    sameBarApproach:
      barsToApproach === 0,
    barsToApproach,
    episodes,
    churn:
      freezeChurn(state),
  });
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
): CausalObservationThresholdStagePoint {
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
): CausalObservationThresholdStagePoint | null {
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

function policyForLine(
  line: CausalObservationThresholdLineAnalysis,
  policy: CausalObservationThresholdPolicy,
): CausalObservationThresholdLinePolicyResult {
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
}

function policyTotals(
  lines: readonly CausalObservationThresholdLineAnalysis[],
  policy: CausalObservationThresholdPolicy,
  currentCandidateLineCount: number,
): CausalObservationThresholdPolicyTotals {
  const results =
    lines.map(
      (line) =>
        policyForLine(
          line,
          policy,
        ),
    );
  const entered =
    results.filter(
      (value) =>
        value.entered,
    );
  const currentEntries =
    entered.filter(
      (value) =>
        value.currentCandidateEntry,
    );
  const additionalEntries =
    entered.filter(
      (value) =>
        value.additionalCounterfactualEntry,
    );
  const approached =
    entered.filter(
      (value) =>
        value.reachedApproach,
    );
  const additionalApproached =
    additionalEntries.filter(
      (value) =>
        value.reachedApproach,
    );
  const episodes =
    entered.flatMap(
      (value) =>
        value.episodes,
    );
  const sumChurn = (
    selector: (
      value: CausalObservationThresholdPolicyChurn,
    ) => number,
  ) =>
    results.reduce(
      (total, value) =>
        total + selector(value.churn),
      0,
    );
  const churn =
    Object.freeze({
      disappearanceCount:
        sumChurn(
          (value) =>
            value.disappearanceCount,
        ),
      reappearanceCount:
        sumChurn(
          (value) =>
            value.reappearanceCount,
        ),
      progressRegressionDisappearanceCount:
        sumChurn(
          (value) =>
            value
              .progressRegressionDisappearanceCount,
        ),
      geometryUnavailableDisappearanceCount:
        sumChurn(
          (value) =>
            value
              .geometryUnavailableDisappearanceCount,
        ),
    });
  const noApproachCount =
    entered.length
    - approached.length;
  const additionalNoApproachCount =
    additionalEntries.length
    - additionalApproached.length;
  const sameBarCount =
    approached.filter(
      (value) =>
        value.sameBarApproach,
    ).length;

  return Object.freeze({
    policy,
    threshold:
      thresholdForPolicy(policy),
    universeLineCount:
      lines.length,
    currentCandidateLineCount,
    entryLineCount:
      entered.length,
    currentCandidateEntryLineCount:
      currentEntries.length,
    currentCandidateMissedLineCount:
      currentCandidateLineCount
      - currentEntries.length,
    additionalCounterfactualEntryLineCount:
      additionalEntries.length,
    approachReachedLineCount:
      approached.length,
    noSubsequentApproachLineCount:
      noApproachCount,
    approachRate:
      ratio(
        approached.length,
        entered.length,
      ),
    noSubsequentApproachRate:
      ratio(
        noApproachCount,
        entered.length,
      ),
    currentCandidateApproachReachedLineCount:
      currentEntries.filter(
        (value) =>
          value.reachedApproach,
      ).length,
    currentCandidateNoApproachLineCount:
      currentEntries.filter(
        (value) =>
          value.noSubsequentApproach,
      ).length,
    additionalApproachReachedLineCount:
      additionalApproached.length,
    additionalNoApproachLineCount:
      additionalNoApproachCount,
    additionalApproachRate:
      ratio(
        additionalApproached.length,
        additionalEntries.length,
      ),
    sameBarApproachLineCount:
      sameBarCount,
    sameBarApproachRate:
      ratio(
        sameBarCount,
        approached.length,
      ),
    entryEpisodeCount:
      episodes.length,
    episodesWithApproachCount:
      episodes.filter(
        (value) =>
          value.firstApproach !== null,
      ).length,
    episodesWithoutApproachCount:
      episodes.filter(
        (value) =>
          value.firstApproach === null,
      ).length,
    barsToApproach:
      latencyStats(
        approached.flatMap(
          (value) =>
            value.barsToApproach === null
              ? []
              : [value.barsToApproach],
        ),
      ),
    continuousObservationBars:
      latencyStats(
        episodes.map(
          (value) =>
            value.continuousObservationBars,
        ),
      ),
    churn,
    disappearancePerEntryLine:
      ratio(
        churn.disappearanceCount,
        entered.length,
      ),
    reappearancePerEntryLine:
      ratio(
        churn.reappearanceCount,
        entered.length,
      ),
  });
}

function freezeAnomalies(
  value: MutableAnomalies,
): CausalObservationThresholdReplayAnomalies {
  const totalCount =
    value.duplicateActiveLineIdCount
    + value.lineIdentityAnomalyCount
    + value.departureContractAnomalyCount
    + value.currentCandidatePairAnomalyCount
    + value.currentCandidateWithoutUniverseLineCount
    + value.currentPolicyEntryWithoutCandidateLineCount
    + value.currentObservationReplayAnomalyCount
    + value.currentApproachReplayAnomalyCount;

  return Object.freeze({
    ...value,
    totalCount,
  });
}

function sumAnomalies(
  values: readonly CausalObservationThresholdReplayAnomalies[],
): CausalObservationThresholdReplayAnomalies {
  const result =
    initialAnomalies();

  for (const value of values) {
    result.duplicateActiveLineIdCount +=
      value.duplicateActiveLineIdCount;
    result.lineIdentityAnomalyCount +=
      value.lineIdentityAnomalyCount;
    result.departureContractAnomalyCount +=
      value.departureContractAnomalyCount;
    result.currentCandidatePairAnomalyCount +=
      value.currentCandidatePairAnomalyCount;
    result.currentCandidateWithoutUniverseLineCount +=
      value.currentCandidateWithoutUniverseLineCount;
    result.currentPolicyEntryWithoutCandidateLineCount +=
      value.currentPolicyEntryWithoutCandidateLineCount;
    result.currentObservationReplayAnomalyCount +=
      value.currentObservationReplayAnomalyCount;
    result.currentApproachReplayAnomalyCount +=
      value.currentApproachReplayAnomalyCount;
  }

  return freezeAnomalies(result);
}

function mapById<T extends { readonly lineId: string }>(
  values: readonly T[],
): ReadonlyMap<string, T> {
  return new Map(
    values.map(
      (value) => [
        value.lineId,
        value,
      ],
    ),
  );
}

function sameCandle(
  left:
    CausalObservationThresholdGeometryPoint | null,
  right:
    CausalObservationThresholdStagePoint | null,
): boolean {
  return left === null
    ? right === null
    : right !== null
      && left.observedCandleIndex
        === right.observedCandleIndex;
}

export function buildCausalObservationThresholdCounterfactualValidationReport(
  source: CausalSetupRealDataValidationReport,
  dependencies:
    CausalObservationThresholdCounterfactualValidationDependencies = {},
): CausalObservationThresholdCounterfactualValidationReport {
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
    CausalObservationThresholdSymbolAnalysis[] = [];

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
    const states =
      new Map<string, MutableLineState>();
    const anomalies =
      initialAnomalies();
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
      const activeLineIds =
        detection.activeLevels.map(
          (line) =>
            line.id,
        );

      anomalies.duplicateActiveLineIdCount +=
        activeLineIds.length
        - new Set(activeLineIds).size;

      const eligibleLines =
        detection.activeLevels.filter(
          (line) =>
            line.status === 'confirmed'
            || line.status === 'worked',
        );
      const extrema =
        mapById(
          detection
            .departureExtremumTracking
            .activeExtrema,
        );
      const progressValues =
        mapById(
          detection.observationTracking
            .activeProgress,
        );
      const approaches =
        mapById(
          detection.approachEvaluation
            .evaluations,
        );
      const geometry =
        new Map<
          string,
          CausalObservationThresholdGeometryPoint
        >();

      for (const line of eligibleLines) {
        const extremum =
          extrema.get(line.id);
        const progress =
          progressValues.get(line.id);
        const approach =
          approaches.get(line.id);

        if (
          !extremum
          || !progress
          || !approach
        ) {
          anomalies.departureContractAnomalyCount +=
            1;
          continue;
        }

        const value =
          point(
            current.originalIndex,
            line,
            extremum,
            progress,
            approach,
          );

        if (!value) {
          anomalies.departureContractAnomalyCount +=
            1;
          continue;
        }

        geometry.set(
          line.id,
          value,
        );
        ensureLine(
          states,
          line,
          value,
          anomalies,
        );
      }

      const eligibleLineIds =
        new Set(
          eligibleLines.map(
            (line) =>
              line.id,
          ),
        );

      for (const lineId of extrema.keys()) {
        if (
          !eligibleLineIds.has(lineId)
          || !progressValues.has(lineId)
          || !approaches.has(lineId)
        ) {
          anomalies.departureContractAnomalyCount +=
            1;
        }
      }

      for (const state of states.values()) {
        const value =
          geometry.get(state.lineId)
          ?? null;

        for (
          const policyState
          of state.policies.values()
        ) {
          observePolicy(
            policyState,
            value,
            current.candle.closeTime,
            current.originalIndex,
          );
        }
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

    for (const state of states.values()) {
      for (
        const policyState
        of state.policies.values()
      ) {
        finalizePolicy(policyState);
      }
    }

    for (const tracks of groupedTracks.values()) {
      if (pairIsAnomalous(tracks)) {
        anomalies.currentCandidatePairAnomalyCount +=
          1;
      }
    }

    const lines:
      CausalObservationThresholdLineAnalysis[] = [];

    for (
      const state
      of [...states.values()].sort(
        (left, right) =>
          left.lineId.localeCompare(
            right.lineId,
          ),
      )
    ) {
      const tracks =
        groupedTracks.get(state.lineId)
        ?? [];
      const currentCandidate =
        tracks.length > 0;
      const currentObservation =
        tracks[0]
          ? stagePoint(
              tracks[0].observation,
            )
          : null;
      const currentApproach =
        firstApproach(tracks);
      const policies =
        Object.freeze(
          POLICIES.map(
            (policy) =>
              linePolicyResult(
                state.policies.get(policy)!,
                currentCandidate,
              ),
          ),
        );
      const currentPolicy =
        policies.find(
          (value) =>
            value.policy
            === 'progress_0_50',
        )!;

      if (
        currentCandidate
        && !sameCandle(
          currentPolicy.firstEntry,
          currentObservation,
        )
      ) {
        anomalies.currentObservationReplayAnomalyCount +=
          1;
      }
      if (
        currentCandidate
        && !sameCandle(
          currentPolicy.firstApproach,
          currentApproach,
        )
      ) {
        anomalies.currentApproachReplayAnomalyCount +=
          1;
      }
      if (
        currentPolicy.entered
        && !currentCandidate
      ) {
        anomalies.currentPolicyEntryWithoutCandidateLineCount +=
          1;
      }

      lines.push(
        Object.freeze({
          symbol:
            state.symbol,
          lineId:
            state.lineId,
          levelKind:
            state.levelKind,
          levelPrice:
            state.levelPrice,
          levelConfirmedAt:
            state.levelConfirmedAt,
          firstGeometry:
            state.firstGeometry,
          lastGeometry:
            state.lastGeometry,
          geometryObservationCount:
            state.geometryObservationCount,
          currentCandidate,
          currentCandidateCount:
            tracks.length,
          currentObservation,
          currentApproach,
          policies,
        }),
      );
    }

    for (const lineId of groupedTracks.keys()) {
      if (!states.has(lineId)) {
        anomalies.currentCandidateWithoutUniverseLineCount +=
          1;
      }
    }

    const frozenLines =
      Object.freeze(lines);
    const currentCandidateLineCount =
      groupedTracks.size;

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
                  currentCandidateLineCount,
                ),
            ),
          ),
        anomalies:
          freezeAnomalies(anomalies),
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
  const currentCandidateLineCount =
    symbolReports.reduce(
      (total, report) =>
        total
        + report.policies[0]!
          .currentCandidateLineCount,
      0,
    );

  return Object.freeze({
    version:
      CAUSAL_OBSERVATION_THRESHOLD_COUNTERFACTUAL_VALIDATION_VERSION,
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
        universeLineCount:
          lines.length,
        currentCandidateLineCount,
        nonCandidateUniverseLineCount:
          lines.length
          - currentCandidateLineCount,
        candidateTrackCount:
          source.totals
            .candidateTrackCount,
        policies:
          Object.freeze(
            POLICIES.map(
              (policy) =>
                policyTotals(
                  lines,
                  policy,
                  currentCandidateLineCount,
                ),
            ),
          ),
        anomalies:
          sumAnomalies(
            symbolReports.map(
              (value) =>
                value.anomalies,
            ),
          ),
      }),
    offlineOnly: true,
    reusesFetchedDatasets: true,
    buildsUniverseFromProductionLevelLines:
      true,
    comparesPoliciesOnly: true,
    changesTradingRules: false,
    createsLiveSetup: false,
    createsSignal: false,
    usesQualityScore: false,
    appliesTraining: false,
    usesFutureCandlesForEntry: false,
    usesFutureCandlesForOutcomeEvaluation:
      true,
    usesFutureRealtimeEvidence: false,
  });
}
