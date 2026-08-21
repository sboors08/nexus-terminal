import type {
  LevelEngineValidationDatasetSnapshot,
} from '../level-engine/level-engine-real-data-validation.types.js';
import {
  replayCausalSetupRealDataDataset,
} from './causal-setup-real-data-validation.js';
import type {
  CausalSetupCandidateTrack,
  CausalSetupDatasetValidationReport,
  CausalSetupRealDataValidationReport,
} from './causal-setup-real-data-validation.types.js';
import {
  SETUP_CANDIDATE_EPISODE_CONTRACT_VERSION,
} from './causal-setup-adapter.types.js';
import type {
  SetupEngineSetupType,
} from './setup-engine.types.js';
import {
  SETUP_CANDIDATE_EPISODE_REAL_DATA_VALIDATION_VERSION,
} from './setup-candidate-episode-real-data-validation.types.js';
import type {
  SetupCandidateEpisodeRealDataCandidateSnapshot,
  SetupCandidateEpisodeRealDataDatasetReport,
  SetupCandidateEpisodeRealDataPairReport,
  SetupCandidateEpisodeRealDataValidationReport,
  SetupCandidateEpisodeRealDataValidationStatus,
  SetupCandidateEpisodeRealDataViolation,
  SetupCandidateEpisodeRealDataViolationCode,
} from './setup-candidate-episode-real-data-validation.types.js';

export interface SetupCandidateEpisodeRealDataReplayProgress {
  readonly phase: 'baseline' | 'restart';
  readonly symbol: string;
  readonly completedStepCount: number;
  readonly totalStepCount: number;
}

export interface SetupCandidateEpisodeRealDataValidationOptions {
  readonly generatedAt?: string;
  readonly sourceDatasetHash?: string | null;
}

export interface SetupCandidateEpisodeRealDataValidationDependencies {
  readonly now?: () => Date;
  readonly onReplayProgress?: (
    progress:
      SetupCandidateEpisodeRealDataReplayProgress,
  ) => void;
}

export class SetupCandidateEpisodeRealDataValidationError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      'SetupCandidateEpisodeRealDataValidationError';
  }
}

interface PairAccumulator {
  readonly key: string;
  readonly symbol: string;
  readonly lineId: string;
  readonly setupType: SetupEngineSetupType;
  readonly tracks: CausalSetupCandidateTrack[];
}

function fail(message: string): never {
  throw new SetupCandidateEpisodeRealDataValidationError(
    message,
  );
}

function canonicalTimestamp(
  value: string,
  field: string,
): string {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    fail(`${field} must be a valid timestamp`);
  }

  return new Date(parsed).toISOString();
}

function finiteTimestamp(
  value: string,
): number {
  const parsed = Date.parse(value);

  return Number.isFinite(parsed)
    ? parsed
    : Number.NaN;
}

function sourceTrackCount(
  source: CausalSetupRealDataValidationReport,
  symbol: string,
): number {
  return source.symbolReports
    .filter(
      (report) => report.symbol === symbol,
    )
    .reduce(
      (total, report) =>
        total
        + report.dataset.candidateTracks.length,
      0,
    );
}

function cloneDataset(
  dataset: LevelEngineValidationDatasetSnapshot,
): LevelEngineValidationDatasetSnapshot {
  return Object.freeze({
    symbol: dataset.symbol,
    sourceTimeframe: dataset.sourceTimeframe,
    candles: Object.freeze(
      dataset.candles.map(
        (candle) => Object.freeze({
          ...candle,
        }),
      ),
    ),
  });
}

function violation(
  values: SetupCandidateEpisodeRealDataViolation[],
  code: SetupCandidateEpisodeRealDataViolationCode,
  symbol: string,
  track: CausalSetupCandidateTrack | null,
  message: string,
): void {
  values.push(
    Object.freeze({
      code,
      symbol,
      lineId: track?.lineId ?? null,
      setupType: track?.setupType ?? null,
      candidateId: track?.candidateId ?? null,
      episodeId:
        track?.candidate.episode?.id ?? null,
      message,
    }),
  );
}

function expectedCandidateId(
  lineId: string,
  setupType: SetupEngineSetupType,
  startedAt: string,
): string {
  return `setup-${lineId}-${setupType}-episode-${finiteTimestamp(startedAt)}`;
}

function snapshot(
  track: CausalSetupCandidateTrack,
): SetupCandidateEpisodeRealDataCandidateSnapshot | null {
  const episode = track.candidate.episode;

  if (!episode) {
    return null;
  }

  return Object.freeze({
    candidateId: track.candidateId,
    episodeId: episode.id,
    symbol: track.symbol,
    lineId: track.lineId,
    setupType: track.setupType,
    direction: track.direction,
    startedAt: episode.startedAt,
    departureExtremumObservedAt:
      episode.departureExtremumObservedAt,
    createdAt: track.candidate.createdAt,
    expiresAt: track.candidate.expiresAt,
    firstSeenAt: track.firstSeenAt,
    lastSeenAt: track.lastSeenAt,
    scanObservationCount:
      track.scanObservationCount,
    disappearanceCount:
      track.disappearanceCount,
    reappearanceCount:
      track.reappearanceCount,
    approachReached:
      track.approach !== null,
    confirmationReached:
      track.confirmation !== null,
  });
}

function restartSignature(
  track: CausalSetupCandidateTrack,
): string {
  return JSON.stringify({
    candidateId: track.candidateId,
    lineId: track.lineId,
    setupType: track.setupType,
    direction: track.direction,
    candidate: track.candidate,
    firstSeenAt: track.firstSeenAt,
    firstSeenCandleIndex:
      track.firstSeenCandleIndex,
    lastSeenAt: track.lastSeenAt,
    lastSeenCandleIndex:
      track.lastSeenCandleIndex,
    observation: track.observation,
    approach: track.approach,
    confirmation: track.confirmation,
    latestContext: track.latestContext,
    scanObservationCount:
      track.scanObservationCount,
    disappearanceCount:
      track.disappearanceCount,
    reappearanceCount:
      track.reappearanceCount,
    presentAtEnd: track.presentAtEnd,
  });
}

function validateTrack(
  symbol: string,
  track: CausalSetupCandidateTrack,
  expiresAfterSec: number,
  seenEpisodeIds: Set<string>,
  violations:
    SetupCandidateEpisodeRealDataViolation[],
): void {
  const episode = track.candidate.episode;

  if (!episode) {
    violation(
      violations,
      'missing_episode_identity',
      symbol,
      track,
      `candidate ${track.candidateId} has no episode identity`,
    );
    return;
  }

  if (
    episode.version
      !== SETUP_CANDIDATE_EPISODE_CONTRACT_VERSION
  ) {
    violation(
      violations,
      'episode_contract_version_mismatch',
      symbol,
      track,
      `candidate ${track.candidateId} has episode contract ${episode.version}`,
    );
  }

  if (
    track.candidateId !== episode.id
    || track.candidate.id !== episode.id
  ) {
    violation(
      violations,
      'candidate_episode_id_mismatch',
      symbol,
      track,
      `candidate ${track.candidateId} does not match episode ${episode.id}`,
    );
  }

  if (track.lineId !== episode.lineId) {
    violation(
      violations,
      'candidate_episode_line_mismatch',
      symbol,
      track,
      `candidate line ${track.lineId} does not match episode line ${episode.lineId}`,
    );
  }

  if (track.setupType !== episode.setupType) {
    violation(
      violations,
      'candidate_episode_setup_type_mismatch',
      symbol,
      track,
      `candidate setup type ${track.setupType} does not match episode setup type ${episode.setupType}`,
    );
  }

  if (track.candidate.createdAt !== episode.startedAt) {
    violation(
      violations,
      'candidate_created_at_mismatch',
      symbol,
      track,
      `candidate createdAt ${track.candidate.createdAt} does not match episode startedAt ${episode.startedAt}`,
    );
  }

  const startedAtMs = finiteTimestamp(
    episode.startedAt,
  );
  const departureAtMs = finiteTimestamp(
    episode.departureExtremumObservedAt,
  );
  const expiresAtMs = finiteTimestamp(
    track.candidate.expiresAt,
  );
  const expectedExpiresAtMs =
    startedAtMs + expiresAfterSec * 1_000;

  if (
    !Number.isFinite(startedAtMs)
    || !Number.isFinite(expiresAtMs)
    || expiresAtMs !== expectedExpiresAtMs
  ) {
    violation(
      violations,
      'candidate_expiry_mismatch',
      symbol,
      track,
      `candidate ${track.candidateId} expiry is not derived from the episode boundary`,
    );
  }

  if (
    !Number.isFinite(departureAtMs)
    || departureAtMs > startedAtMs
  ) {
    violation(
      violations,
      'invalid_departure_boundary',
      symbol,
      track,
      `candidate ${track.candidateId} has an invalid departure boundary`,
    );
  }

  const expectedId = expectedCandidateId(
    episode.lineId,
    episode.setupType,
    episode.startedAt,
  );

  if (track.candidateId !== expectedId) {
    violation(
      violations,
      'candidate_id_formula_mismatch',
      symbol,
      track,
      `candidate ${track.candidateId} does not match deterministic ID ${expectedId}`,
    );
  }

  if (seenEpisodeIds.has(episode.id)) {
    violation(
      violations,
      'duplicate_episode_identity',
      symbol,
      track,
      `episode ${episode.id} was emitted more than once`,
    );
  }

  seenEpisodeIds.add(episode.id);
}

function pairKey(
  symbol: string,
  lineId: string,
  setupType: SetupEngineSetupType,
): string {
  return `${symbol}:${lineId}:${setupType}`;
}

function buildPairs(
  symbol: string,
  tracks: readonly CausalSetupCandidateTrack[],
  violations:
    SetupCandidateEpisodeRealDataViolation[],
): readonly SetupCandidateEpisodeRealDataPairReport[] {
  const groups = new Map<string, PairAccumulator>();

  for (const track of tracks) {
    if (!track.candidate.episode) {
      continue;
    }

    const key = pairKey(
      symbol,
      track.lineId,
      track.setupType,
    );
    const existing = groups.get(key);

    if (existing) {
      existing.tracks.push(track);
    } else {
      groups.set(key, {
        key,
        symbol,
        lineId: track.lineId,
        setupType: track.setupType,
        tracks: [track],
      });
    }
  }

  return Object.freeze(
    [...groups.values()]
      .sort(
        (left, right) =>
          left.key.localeCompare(right.key),
      )
      .map((group) => {
        const ordered = [...group.tracks]
          .sort((left, right) =>
            finiteTimestamp(
              left.candidate.episode?.startedAt
                ?? '',
            )
            - finiteTimestamp(
              right.candidate.episode?.startedAt
                ?? '',
            )
            || left.candidateId.localeCompare(
              right.candidateId,
            ),
          );
        const gaps: number[] = [];

        for (
          let index = 1;
          index < ordered.length;
          index += 1
        ) {
          const previous = ordered[index - 1];
          const current = ordered[index];

          if (!previous || !current) {
            continue;
          }

          const previousStartedAt =
            finiteTimestamp(
              previous.candidate.episode?.startedAt
                ?? '',
            );
          const currentStartedAt =
            finiteTimestamp(
              current.candidate.episode?.startedAt
                ?? '',
            );

          if (
            !Number.isFinite(previousStartedAt)
            || !Number.isFinite(currentStartedAt)
            || currentStartedAt <= previousStartedAt
          ) {
            violation(
              violations,
              'non_monotonic_episode_boundary',
              symbol,
              current,
              `pair ${group.key} has a non-monotonic episode boundary`,
            );
            continue;
          }

          gaps.push(
            (currentStartedAt - previousStartedAt)
              / 60_000,
          );
        }

        const first = ordered[0];
        const last = ordered.at(-1);

        if (!first?.candidate.episode || !last?.candidate.episode) {
          fail(`pair ${group.key} has no episode identity`);
        }

        return Object.freeze({
          key: group.key,
          symbol: group.symbol,
          lineId: group.lineId,
          setupType: group.setupType,
          episodeCount: ordered.length,
          rearmCount:
            Math.max(0, ordered.length - 1),
          firstEpisodeStartedAt:
            first.candidate.episode.startedAt,
          lastEpisodeStartedAt:
            last.candidate.episode.startedAt,
          minimumRearmGapBars:
            gaps.length > 0
              ? Math.min(...gaps)
              : null,
          maximumRearmGapBars:
            gaps.length > 0
              ? Math.max(...gaps)
              : null,
          candidateIds: Object.freeze(
            ordered.map(
              (track) => track.candidateId,
            ),
          ),
          episodeIds: Object.freeze(
            ordered.map(
              (track) =>
                track.candidate.episode?.id
                ?? '',
            ),
          ),
        });
      }),
  );
}

function compareRestart(
  symbol: string,
  baseline: CausalSetupDatasetValidationReport,
  restart: CausalSetupDatasetValidationReport,
  violations:
    SetupCandidateEpisodeRealDataViolation[],
): number {
  const baselineById = new Map(
    baseline.candidateTracks.map(
      (track) => [track.candidateId, track],
    ),
  );
  const restartById = new Map(
    restart.candidateTracks.map(
      (track) => [track.candidateId, track],
    ),
  );
  let mismatchCount = 0;

  if (
    baselineById.size !== restartById.size
  ) {
    mismatchCount += Math.abs(
      baselineById.size - restartById.size,
    ) || 1;
    violation(
      violations,
      'restart_candidate_set_mismatch',
      symbol,
      null,
      `baseline emitted ${baselineById.size} candidates and restart emitted ${restartById.size}`,
    );
  }

  const candidateIds = new Set([
    ...baselineById.keys(),
    ...restartById.keys(),
  ]);

  for (const candidateId of candidateIds) {
    const baselineTrack = baselineById.get(
      candidateId,
    );
    const restartTrack = restartById.get(
      candidateId,
    );

    if (!baselineTrack || !restartTrack) {
      mismatchCount += 1;
      violation(
        violations,
        'restart_candidate_set_mismatch',
        symbol,
        baselineTrack ?? restartTrack ?? null,
        `candidate ${candidateId} is missing from one replay`,
      );
      continue;
    }

    if (
      restartSignature(baselineTrack)
        !== restartSignature(restartTrack)
    ) {
      mismatchCount += 1;
      violation(
        violations,
        'restart_candidate_snapshot_mismatch',
        symbol,
        baselineTrack,
        `candidate ${candidateId} changed after a fresh replay`,
      );
    }
  }

  return mismatchCount;
}

function datasetReport(
  source: CausalSetupRealDataValidationReport,
  dataset: LevelEngineValidationDatasetSnapshot,
  dependencies:
    SetupCandidateEpisodeRealDataValidationDependencies,
): SetupCandidateEpisodeRealDataDatasetReport {
  const replayOptions = {
    startAtClosedCandleCount:
      source.appliedOptions
        .startAtClosedCandleCount,
    pipelineOptions:
      source.appliedOptions
        .pipelineOptions,
  };
  const baseline = replayCausalSetupRealDataDataset(
    cloneDataset(dataset),
    replayOptions,
    {
      onReplayProgress: (progress) => {
        dependencies.onReplayProgress?.(
          Object.freeze({
            phase: 'baseline',
            symbol: progress.symbol,
            completedStepCount:
              progress.completedStepCount,
            totalStepCount:
              progress.totalStepCount,
          }),
        );
      },
    },
  );
  const restart = replayCausalSetupRealDataDataset(
    cloneDataset(dataset),
    replayOptions,
    {
      onReplayProgress: (progress) => {
        dependencies.onReplayProgress?.(
          Object.freeze({
            phase: 'restart',
            symbol: progress.symbol,
            completedStepCount:
              progress.completedStepCount,
            totalStepCount:
              progress.totalStepCount,
          }),
        );
      },
    },
  );
  const violations:
    SetupCandidateEpisodeRealDataViolation[] = [];

  for (const sourceViolation of baseline.violations) {
    violation(
      violations,
      'source_replay_violation',
      baseline.symbol,
      baseline.candidateTracks.find(
        (track) =>
          track.candidateId
            === sourceViolation.candidateId,
      ) ?? null,
      `${sourceViolation.code}: ${sourceViolation.message}`,
    );
  }

  for (const sourceViolation of restart.violations) {
    violation(
      violations,
      'restart_replay_violation',
      restart.symbol,
      restart.candidateTracks.find(
        (track) =>
          track.candidateId
            === sourceViolation.candidateId,
      ) ?? null,
      `${sourceViolation.code}: ${sourceViolation.message}`,
    );
  }

  const seenEpisodeIds = new Set<string>();
  const expiresAfterSec =
    source.appliedOptions.pipelineOptions
      .candidateOptions.expiresAfterSec;

  for (const track of baseline.candidateTracks) {
    validateTrack(
      baseline.symbol,
      track,
      expiresAfterSec,
      seenEpisodeIds,
      violations,
    );
  }

  const pairs = buildPairs(
    baseline.symbol,
    baseline.candidateTracks,
    violations,
  );
  const restartMismatchCount = compareRestart(
    baseline.symbol,
    baseline,
    restart,
    violations,
  );
  const candidates = Object.freeze(
    baseline.candidateTracks
      .map(snapshot)
      .filter(
        (
          value,
        ): value is SetupCandidateEpisodeRealDataCandidateSnapshot =>
          value !== null,
      ),
  );
  const rearmCount = pairs.reduce(
    (total, pair) => total + pair.rearmCount,
    0,
  );
  let rearmAfterPreviousExpiryCount = 0;
  let rearmBeforePreviousExpiryCount = 0;

  for (const pair of pairs) {
    const pairCandidates = pair.candidateIds
      .map((candidateId) =>
        candidates.find(
          (candidate) =>
            candidate.candidateId === candidateId,
        ),
      )
      .filter(
        (
          value,
        ): value is SetupCandidateEpisodeRealDataCandidateSnapshot =>
          value !== undefined,
      );

    for (
      let index = 1;
      index < pairCandidates.length;
      index += 1
    ) {
      const previous = pairCandidates[index - 1];
      const current = pairCandidates[index];

      if (!previous || !current) {
        continue;
      }

      if (
        finiteTimestamp(current.startedAt)
          >= finiteTimestamp(previous.expiresAt)
      ) {
        rearmAfterPreviousExpiryCount += 1;
      } else {
        rearmBeforePreviousExpiryCount += 1;
      }
    }
  }

  const sameEpisodeChurnDetected =
    violations.some(
      (item) =>
        item.code === 'duplicate_episode_identity'
        || item.code === 'non_monotonic_episode_boundary',
    );

  return Object.freeze({
    symbol: baseline.symbol,
    sourceTimeframe: '1m',
    firstClosedAt: baseline.firstClosedAt,
    lastClosedAt: baseline.lastClosedAt,
    candidates,
    pairs,
    violations: Object.freeze([
      ...violations,
    ]),
    totals: Object.freeze({
      closedCandlesCount:
        baseline.closedCandlesCount,
      replayStepCount:
        baseline.totals.replayStepCount,
      sourceCandidateTrackCount:
        sourceTrackCount(source, baseline.symbol),
      candidateTrackCount:
        baseline.totals.candidateTrackCount,
      uniqueLineSetupPairCount: pairs.length,
      uniqueEpisodeCount: seenEpisodeIds.size,
      singleEpisodePairCount:
        pairs.filter(
          (pair) => pair.episodeCount === 1,
        ).length,
      rearmedPairCount:
        pairs.filter(
          (pair) => pair.rearmCount > 0,
        ).length,
      rearmCount,
      rearmAfterPreviousExpiryCount,
      rearmBeforePreviousExpiryCount,
      duplicateSuppressionObservationCount:
        baseline.totals
          .duplicateCandidateObservationCount,
      candidateDisappearanceCount:
        baseline.totals
          .candidateDisappearanceCount,
      candidateReappearanceCount:
        baseline.totals
          .candidateReappearanceCount,
      restartCandidateCount:
        restart.totals.candidateTrackCount,
      restartMismatchCount,
      violationCount: violations.length,
    }),
    restartEquivalent:
      restartMismatchCount === 0,
    sameEpisodeChurnDetected,
    usesFutureCandles: false,
  });
}

function sum(
  values: readonly number[],
): number {
  return values.reduce(
    (total, value) => total + value,
    0,
  );
}

function validateSource(
  source: CausalSetupRealDataValidationReport,
): void {
  if (
    source.version
      !== 'causal-setup-real-data-validation-v0.1'
    || source.offlineOnly !== true
    || source.reusesFetchedDatasets !== true
    || source.changesTradingRules !== false
    || source.createsLiveSetup !== false
    || source.createsSignal !== false
    || source.usesFutureCandles !== false
  ) {
    fail('source validation contract is incompatible');
  }

  if (source.sourceDatasets.length === 0) {
    fail('source validation contains no datasets');
  }

  if (
    source.sourceDatasets.some(
      (dataset) =>
        dataset.sourceTimeframe !== '1m'
        || dataset.candles.length === 0,
    )
  ) {
    fail('source validation must contain non-empty 1m datasets');
  }
}

export function validateSetupCandidateEpisodeRealData(
  source: CausalSetupRealDataValidationReport,
  options:
    SetupCandidateEpisodeRealDataValidationOptions = {},
  dependencies:
    SetupCandidateEpisodeRealDataValidationDependencies = {},
): SetupCandidateEpisodeRealDataValidationReport {
  validateSource(source);

  const now = dependencies.now ?? (() => new Date());
  const generatedAt = canonicalTimestamp(
    options.generatedAt
      ?? now().toISOString(),
    'generatedAt',
  );
  const datasets = Object.freeze(
    source.sourceDatasets
      .map((dataset) =>
        datasetReport(
          source,
          dataset,
          dependencies,
        ),
      )
      .sort(
        (left, right) =>
          left.symbol.localeCompare(right.symbol),
      ),
  );
  const rearmCount = sum(
    datasets.map(
      (dataset) => dataset.totals.rearmCount,
    ),
  );
  const restartMismatchCount = sum(
    datasets.map(
      (dataset) =>
        dataset.totals.restartMismatchCount,
    ),
  );
  const violationCount = sum(
    datasets.map(
      (dataset) => dataset.totals.violationCount,
    ),
  );
  const sameEpisodeChurnDetected =
    datasets.some(
      (dataset) =>
        dataset.sameEpisodeChurnDetected,
    );
  const status:
    SetupCandidateEpisodeRealDataValidationStatus =
    violationCount > 0
      ? 'invalid'
      : rearmCount > 0
        ? 'validated_with_observed_rearms'
        : 'validated_without_observed_rearms';

  return Object.freeze({
    version:
      SETUP_CANDIDATE_EPISODE_REAL_DATA_VALIDATION_VERSION,
    sourceVersion: source.version,
    sourceGeneratedAt:
      canonicalTimestamp(
        source.generatedAt,
        'source.generatedAt',
      ),
    generatedAt,
    sourceDatasetHash:
      options.sourceDatasetHash ?? null,
    requestedSymbols: Object.freeze([
      ...source.requestedSymbols,
    ]),
    datasets,
    totals: Object.freeze({
      symbolCount:
        new Set(
          datasets.map(
            (dataset) => dataset.symbol,
          ),
        ).size,
      datasetCount: datasets.length,
      closedCandlesCount: sum(
        datasets.map(
          (dataset) =>
            dataset.totals.closedCandlesCount,
        ),
      ),
      replayStepCount: sum(
        datasets.map(
          (dataset) =>
            dataset.totals.replayStepCount,
        ),
      ),
      sourceCandidateTrackCount: sum(
        datasets.map(
          (dataset) =>
            dataset.totals.sourceCandidateTrackCount,
        ),
      ),
      candidateTrackCount: sum(
        datasets.map(
          (dataset) =>
            dataset.totals.candidateTrackCount,
        ),
      ),
      uniqueLineSetupPairCount: sum(
        datasets.map(
          (dataset) =>
            dataset.totals.uniqueLineSetupPairCount,
        ),
      ),
      uniqueEpisodeCount: sum(
        datasets.map(
          (dataset) =>
            dataset.totals.uniqueEpisodeCount,
        ),
      ),
      singleEpisodePairCount: sum(
        datasets.map(
          (dataset) =>
            dataset.totals.singleEpisodePairCount,
        ),
      ),
      rearmedPairCount: sum(
        datasets.map(
          (dataset) =>
            dataset.totals.rearmedPairCount,
        ),
      ),
      rearmCount,
      rearmAfterPreviousExpiryCount: sum(
        datasets.map(
          (dataset) =>
            dataset.totals.rearmAfterPreviousExpiryCount,
        ),
      ),
      rearmBeforePreviousExpiryCount: sum(
        datasets.map(
          (dataset) =>
            dataset.totals.rearmBeforePreviousExpiryCount,
        ),
      ),
      duplicateSuppressionObservationCount: sum(
        datasets.map(
          (dataset) =>
            dataset.totals
              .duplicateSuppressionObservationCount,
        ),
      ),
      candidateDisappearanceCount: sum(
        datasets.map(
          (dataset) =>
            dataset.totals.candidateDisappearanceCount,
        ),
      ),
      candidateReappearanceCount: sum(
        datasets.map(
          (dataset) =>
            dataset.totals.candidateReappearanceCount,
        ),
      ),
      restartCandidateCount: sum(
        datasets.map(
          (dataset) =>
            dataset.totals.restartCandidateCount,
        ),
      ),
      restartMismatchCount,
      violationCount,
    }),
    appliedOptions: Object.freeze({
      ...source.appliedOptions,
      pipelineOptions: Object.freeze({
        ...source.appliedOptions.pipelineOptions,
        levelLinesOptions: Object.freeze({
          ...source.appliedOptions.pipelineOptions
            .levelLinesOptions,
        }),
        candidateOptions: Object.freeze({
          ...source.appliedOptions.pipelineOptions
            .candidateOptions,
        }),
        setupTypes: Object.freeze([
          ...source.appliedOptions.pipelineOptions
            .setupTypes,
        ]),
      }),
    }),
    status,
    permanentDuplicateCutoffEliminated:
      rearmCount > 0,
    restartEquivalent:
      restartMismatchCount === 0,
    sameEpisodeChurnDetected,
    offlineOnly: true,
    reusesSavedRealCandles: true,
    syntheticObservationsCreated: false,
    changesObservationThreshold: false,
    changesApproachThreshold: false,
    changesConfirmationThreshold: false,
    changesTradingRules: false,
    createsLiveSetup: false,
    createsTradeOrder: false,
    createsSignal: false,
    usesFutureCandles: false,
  });
}
