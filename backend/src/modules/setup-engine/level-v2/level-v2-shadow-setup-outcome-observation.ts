import {
  buildLevelV2ShadowConfirmationCandidateHistoryStore,
} from './level-v2-shadow-confirmation-candidate-history.js';
import type {
  LevelV2ShadowConfirmationCandidateHistoryEntry,
} from './level-v2-shadow-confirmation-candidate-history.types.js';
import type {
  LevelV2ShadowMarketEvidenceHistoryEntry,
  LevelV2ShadowMarketEvidenceHistoryStatus,
} from './level-v2-shadow-market-evidence-history.types.js';
import type {
  LevelV2LifecycleState,
} from './level-v2-lifecycle.types.js';
import type {
  LevelV2ShadowSetupOutcomeDirectionCounts,
  LevelV2ShadowSetupOutcomeObservation,
  LevelV2ShadowSetupOutcomeObservationDiagnostics,
  LevelV2ShadowSetupOutcomeObservationOptions,
  LevelV2ShadowSetupOutcomeObservationStatus,
  LevelV2ShadowSetupOutcomeStatus,
  LevelV2ShadowSetupOutcomeStatusCounts,
} from './level-v2-shadow-setup-outcome-observation.types.js';

export const DEFAULT_LEVEL_V2_SHADOW_SETUP_OUTCOME_OBSERVATION_OPTIONS:
LevelV2ShadowSetupOutcomeObservationOptions = {
  successThresholdPct:
    0.3,
  failureThresholdPct:
    0.2,
  maxObservationMs:
    5 * 60 * 1_000,
};

const SOURCE_HISTORY_LIMIT =
  10_000;

interface PriceSample {
  sequence: number;
  capturedAt: string;
  timestamp: number;
  price: number;
}

function validatePositiveFinite(
  value: number,
  name: string,
): void {
  if (
    !Number.isFinite(value)
    || value <= 0
  ) {
    throw new Error(
      `Level v2 shadow setup outcome ${name} must be a positive finite number`,
    );
  }
}

function validateOptions(
  options:
    LevelV2ShadowSetupOutcomeObservationOptions,
): void {
  validatePositiveFinite(
    options.successThresholdPct,
    'successThresholdPct',
  );
  validatePositiveFinite(
    options.failureThresholdPct,
    'failureThresholdPct',
  );

  if (
    options.successThresholdPct > 100
    || options.failureThresholdPct > 100
  ) {
    throw new Error(
      'Level v2 shadow setup outcome thresholds cannot exceed one hundred percent',
    );
  }

  if (
    !Number.isInteger(
      options.maxObservationMs,
    )
    || options.maxObservationMs <= 0
  ) {
    throw new Error(
      'Level v2 shadow setup outcome maxObservationMs must be a positive integer',
    );
  }
}

function readTimestamp(
  value: string,
  name: string,
): number {
  const timestamp =
    Date.parse(
      value,
    );

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      `Level v2 shadow setup outcome ${name} must be a valid ISO date`,
    );
  }

  return timestamp;
}

function roundMetric(
  value: number,
): number {
  return Number(
    value.toFixed(8),
  );
}

function cloneOptions(
  options:
    LevelV2ShadowSetupOutcomeObservationOptions,
): LevelV2ShadowSetupOutcomeObservationOptions {
  return {
    ...options,
  };
}

export function cloneLevelV2ShadowSetupOutcomeObservation(
  observation:
    LevelV2ShadowSetupOutcomeObservation,
): LevelV2ShadowSetupOutcomeObservation {
  return {
    ...observation,
    reasons: [
      ...observation.reasons,
    ],
    options:
      cloneOptions(
        observation.options,
      ),
  };
}

function validTapePrice(
  value:
    number
    | null
    | undefined,
): value is number {
  return value !== null
    && value !== undefined
    && Number.isFinite(value)
    && value > 0;
}

function buildPriceSamples(
  sourceEntries:
    readonly LevelV2ShadowMarketEvidenceHistoryEntry[],
): PriceSample[] {
  return sourceEntries
    .flatMap(
      (entry) => {
        const price =
          entry.evidence.tape
            ?.lastTradePrice;

        if (!validTapePrice(price)) {
          return [];
        }

        return [{
          sequence:
            entry.sequence,
          capturedAt:
            entry.evidence.capturedAt,
          timestamp:
            readTimestamp(
              entry.evidence.capturedAt,
              'market evidence capturedAt',
            ),
          price,
        }];
      },
    )
    .sort(
      (
        left,
        right,
      ) =>
        left.sequence
        - right.sequence,
    );
}

function resolveAnchorSample(
  anchor:
    LevelV2ShadowConfirmationCandidateHistoryEntry,
  samples:
    readonly PriceSample[],
): PriceSample | null {
  const exact =
    samples.find(
      (sample) =>
        sample.sequence
          === anchor.candidate
            .latestSequence,
    );

  if (exact) {
    return exact;
  }

  return [
    ...samples,
  ]
    .filter(
      (sample) =>
        sample.sequence
          <= anchor.candidate
            .latestSequence,
    )
    .at(-1)
    ?? null;
}

function favorableExcursionPct(
  direction:
    LevelV2ShadowSetupOutcomeObservation['expectedDirection'],
  entryPrice: number,
  price: number,
): number {
  const move =
    direction === 'up'
      ? price - entryPrice
      : entryPrice - price;

  return Math.max(
    0,
    move / entryPrice * 100,
  );
}

function adverseExcursionPct(
  direction:
    LevelV2ShadowSetupOutcomeObservation['expectedDirection'],
  entryPrice: number,
  price: number,
): number {
  const move =
    direction === 'up'
      ? entryPrice - price
      : price - entryPrice;

  return Math.max(
    0,
    move / entryPrice * 100,
  );
}

function isReturnedInsideLevel(
  currentKind:
    LevelV2ShadowSetupOutcomeObservation['currentKind'],
  boundaryPrice: number,
  price: number,
): boolean {
  return currentKind === 'resistance'
    ? price <= boundaryPrice
    : price >= boundaryPrice;
}

function earliestIso(
  left:
    string
    | null,
  right:
    string
    | null,
): string | null {
  if (left === null) {
    return right;
  }

  if (right === null) {
    return left;
  }

  return Date.parse(left)
    <= Date.parse(right)
      ? left
      : right;
}

function laterIso(
  left: string,
  right: string,
): string {
  return Date.parse(left)
    >= Date.parse(right)
      ? left
      : right;
}

function resolveStatus(
  continuationReachedAt:
    string
    | null,
  failureConditionReachedAt:
    string
    | null,
  observationWindowElapsed: boolean,
  windowEndsAt: string,
): {
  status:
    LevelV2ShadowSetupOutcomeStatus;
  resolvedAt:
    string
    | null;
} {
  if (
    continuationReachedAt !== null
    && failureConditionReachedAt !== null
  ) {
    return {
      status:
        'mixed',
      resolvedAt:
        laterIso(
          continuationReachedAt,
          failureConditionReachedAt,
        ),
    };
  }

  if (continuationReachedAt !== null) {
    return {
      status:
        'successful_continuation',
      resolvedAt:
        continuationReachedAt,
    };
  }

  if (failureConditionReachedAt !== null) {
    return {
      status:
        'failed_reversal',
      resolvedAt:
        failureConditionReachedAt,
    };
  }

  if (observationWindowElapsed) {
    return {
      status:
        'mixed',
      resolvedAt:
        windowEndsAt,
    };
  }

  return {
    status:
      'pending',
    resolvedAt:
      null,
  };
}

function buildReasons(
  status:
    LevelV2ShadowSetupOutcomeStatus,
  anchorSampleExact: boolean,
  continuationReached: boolean,
  adverseThresholdReached: boolean,
  returnedInsideLevel:
    boolean
    | null,
  levelGeometryAvailable: boolean,
  observationWindowElapsed: boolean,
): string[] {
  const reasons = [
    'supported_confirmation_candidate_anchor',
    'tape_price_observation_only',
  ];

  if (!anchorSampleExact) {
    reasons.push(
      'anchor_price_from_previous_tape_sample',
    );
  }

  if (continuationReached) {
    reasons.push(
      'favorable_excursion_threshold_reached',
    );
  }

  if (adverseThresholdReached) {
    reasons.push(
      'adverse_excursion_threshold_reached',
    );
  }

  if (returnedInsideLevel === true) {
    reasons.push(
      'price_returned_inside_level_boundary',
    );
  }

  if (!levelGeometryAvailable) {
    reasons.push(
      'level_geometry_unavailable',
    );
  }

  if (
    observationWindowElapsed
    && status === 'mixed'
    && !continuationReached
    && !adverseThresholdReached
    && returnedInsideLevel !== true
  ) {
    reasons.push(
      'observation_window_elapsed_without_decisive_move',
    );
  }

  if (status === 'pending') {
    reasons.push(
      'outcome_observation_pending',
    );
  }

  return reasons;
}

export function evaluateLevelV2ShadowSetupOutcomeObservation(
  anchor:
    LevelV2ShadowConfirmationCandidateHistoryEntry,
  sourceEntries:
    readonly LevelV2ShadowMarketEvidenceHistoryEntry[],
  level:
    LevelV2LifecycleState
    | null,
  options:
    LevelV2ShadowSetupOutcomeObservationOptions =
      DEFAULT_LEVEL_V2_SHADOW_SETUP_OUTCOME_OBSERVATION_OPTIONS,
): LevelV2ShadowSetupOutcomeObservation | null {
  validateOptions(
    options,
  );

  if (
    anchor.candidate.verdict
      !== 'supported'
  ) {
    throw new Error(
      'Level v2 shadow setup outcome requires a supported confirmation candidate anchor',
    );
  }

  if (
    sourceEntries.some(
      (entry) =>
        entry.evidence.classifierId
          !== anchor.classifierId,
    )
  ) {
    throw new Error(
      'Level v2 shadow setup outcome requires one classifier market history',
    );
  }

  if (
    level !== null
    && level.id
      !== anchor.levelId
  ) {
    throw new Error(
      'Level v2 shadow setup outcome level must match the anchor level',
    );
  }

  const samples =
    buildPriceSamples(
      sourceEntries,
    );
  const anchorSample =
    resolveAnchorSample(
      anchor,
      samples,
    );

  if (!anchorSample) {
    return null;
  }

  const startedAt =
    anchor.capturedAt;
  const startedTimestamp =
    readTimestamp(
      startedAt,
      'anchor capturedAt',
    );
  const windowEndTimestamp =
    startedTimestamp
    + options.maxObservationMs;
  const windowEndsAt =
    new Date(
      windowEndTimestamp,
    ).toISOString();
  const orderedSource = [
    ...sourceEntries,
  ].sort(
    (
      left,
      right,
    ) =>
      left.sequence
      - right.sequence,
  );
  const sourceAfterAnchor =
    orderedSource.filter(
      (entry) =>
        entry.sequence
          >= anchorSample.sequence,
    );
  const latestSource =
    sourceAfterAnchor.at(-1)
    ?? null;
  const latestSourceTimestamp =
    latestSource === null
      ? startedTimestamp
      : readTimestamp(
          latestSource.evidence
            .capturedAt,
          'latest source capturedAt',
        );
  const observationWindowElapsed =
    latestSourceTimestamp
      >= windowEndTimestamp;
  const effectiveEndTimestamp =
    Math.min(
      Math.max(
        latestSourceTimestamp,
        startedTimestamp,
      ),
      windowEndTimestamp,
    );
  const priceSamples =
    samples.filter(
      (sample) =>
        sample.sequence
          >= anchorSample.sequence
        && sample.timestamp
          <= windowEndTimestamp,
    );
  const latestPriceSample =
    priceSamples.at(-1)
    ?? anchorSample;
  const levelReferencePrice =
    level?.level.zone
      .referencePrice
    ?? null;
  const levelBoundaryPrice =
    level === null
      ? null
      : anchor.candidate.currentKind
          === 'resistance'
        ? level.level.zone.outerHigh
        : level.level.zone.outerLow;
  let maxFavorableExcursionPct = 0;
  let maxAdverseExcursionPct = 0;
  let maxFavorablePrice =
    anchorSample.price;
  let maxAdversePrice =
    anchorSample.price;
  let continuationReachedAt:
    string
    | null = null;
  let adverseThresholdReachedAt:
    string
    | null = null;
  let returnedInsideLevelAt:
    string
    | null = null;

  for (
    const sample
    of priceSamples
  ) {
    const favorable =
      favorableExcursionPct(
        anchor.candidate
          .expectedDirection,
        anchorSample.price,
        sample.price,
      );
    const adverse =
      adverseExcursionPct(
        anchor.candidate
          .expectedDirection,
        anchorSample.price,
        sample.price,
      );

    if (
      favorable
      > maxFavorableExcursionPct
    ) {
      maxFavorableExcursionPct =
        favorable;
      maxFavorablePrice =
        sample.price;
    }

    if (
      adverse
      > maxAdverseExcursionPct
    ) {
      maxAdverseExcursionPct =
        adverse;
      maxAdversePrice =
        sample.price;
    }

    if (
      continuationReachedAt === null
      && favorable
        >= options
          .successThresholdPct
    ) {
      continuationReachedAt =
        sample.capturedAt;
    }

    if (
      adverseThresholdReachedAt === null
      && adverse
        >= options
          .failureThresholdPct
    ) {
      adverseThresholdReachedAt =
        sample.capturedAt;
    }

    if (
      returnedInsideLevelAt === null
      && levelBoundaryPrice !== null
      && sample.timestamp
        > startedTimestamp
      && isReturnedInsideLevel(
        anchor.candidate.currentKind,
        levelBoundaryPrice,
        sample.price,
      )
    ) {
      returnedInsideLevelAt =
        sample.capturedAt;
    }
  }

  const failureConditionReachedAt =
    earliestIso(
      adverseThresholdReachedAt,
      returnedInsideLevelAt,
    );
  const result =
    resolveStatus(
      continuationReachedAt,
      failureConditionReachedAt,
      observationWindowElapsed,
      windowEndsAt,
    );
  const resolvedTimestamp =
    result.resolvedAt === null
      ? null
      : readTimestamp(
          result.resolvedAt,
          'resolvedAt',
        );
  const returnedInsideLevel =
    levelBoundaryPrice === null
      ? null
      : returnedInsideLevelAt
          !== null;

  return {
    id:
      `${anchor.classifierId}:setup-outcome:${anchor.sequence}`,
    classifierId:
      anchor.classifierId,
    levelId:
      anchor.levelId,
    symbol:
      anchor.symbol,
    timeframe:
      anchor.timeframe,
    currentKind:
      anchor.candidate.currentKind,
    expectedDirection:
      anchor.candidate
        .expectedDirection,
    anchorCandidateHistoryEntryId:
      anchor.id,
    anchorCandidateId:
      anchor.candidate.id,
    anchorConfidence:
      anchor.candidate.confidence,
    startedAt,
    startedSequence:
      anchor.candidate
        .latestSequence,
    windowEndsAt,
    entryPrice:
      anchorSample.price,
    latestPrice:
      latestPriceSample.price,
    latestPriceAt:
      latestPriceSample.capturedAt,
    latestSourceObservedAt:
      latestSource?.evidence
        .capturedAt
      ?? startedAt,
    observedPricesCount:
      priceSamples.length,
    durationMs:
      Math.max(
        0,
        effectiveEndTimestamp
        - startedTimestamp,
      ),
    observationWindowElapsed,
    levelReferencePrice,
    levelBoundaryPrice,
    levelGeometryAvailable:
      levelBoundaryPrice !== null,
    maxFavorableExcursionPct:
      roundMetric(
        maxFavorableExcursionPct,
      ),
    maxAdverseExcursionPct:
      roundMetric(
        maxAdverseExcursionPct,
      ),
    maxFavorablePrice,
    maxAdversePrice,
    continuationReached:
      continuationReachedAt !== null,
    continuationReachedAt,
    adverseThresholdReached:
      adverseThresholdReachedAt !== null,
    adverseThresholdReachedAt,
    returnedInsideLevel,
    returnedInsideLevelAt,
    failureConditionReached:
      failureConditionReachedAt !== null,
    failureConditionReachedAt,
    status:
      result.status,
    resolvedAt:
      result.resolvedAt,
    timeToOutcomeMs:
      resolvedTimestamp === null
        ? null
        : Math.max(
            0,
            resolvedTimestamp
            - startedTimestamp,
          ),
    reasons:
      buildReasons(
        result.status,
        anchorSample.sequence
          === anchor.candidate
            .latestSequence,
        continuationReachedAt
          !== null,
        adverseThresholdReachedAt
          !== null,
        returnedInsideLevel,
        levelBoundaryPrice
          !== null,
        observationWindowElapsed,
      ),
    options:
      cloneOptions(
        options,
      ),
    observationalOnly:
      true,
    changesBreakClassification:
      false,
    changesProductionSetup:
      false,
    tradeExecution:
      false,
  };
}

function resolveLevel(
  levelId: string,
  levels:
    readonly LevelV2LifecycleState[],
): LevelV2LifecycleState | null {
  return levels.find(
    (level) =>
      level.id === levelId,
  )
    ?? null;
}

export function buildLevelV2ShadowSetupOutcomeObservationSnapshot(
  sourceEntries:
    readonly LevelV2ShadowMarketEvidenceHistoryEntry[],
  levels:
    readonly LevelV2LifecycleState[],
  options:
    LevelV2ShadowSetupOutcomeObservationOptions =
      DEFAULT_LEVEL_V2_SHADOW_SETUP_OUTCOME_OBSERVATION_OPTIONS,
): {
  observations:
    LevelV2ShadowSetupOutcomeObservation[];
  sourceCandidateHistoryEntriesCount: number;
} {
  validateOptions(
    options,
  );

  const candidateHistoryStore =
    buildLevelV2ShadowConfirmationCandidateHistoryStore(
      sourceEntries,
      {
        maxEntriesPerClassifier:
          SOURCE_HISTORY_LIMIT,
        maxTotalEntries:
          100_000,
      },
    );
  const candidateHistory =
    candidateHistoryStore.getHistory(
      undefined,
      undefined,
      SOURCE_HISTORY_LIMIT,
    );
  const anchorsByClassifier =
    new Map<
      string,
      LevelV2ShadowConfirmationCandidateHistoryEntry
    >();

  for (
    const entry
    of [
      ...candidateHistory,
    ].sort(
      (
        left,
        right,
      ) =>
        left.sequence
        - right.sequence,
    )
  ) {
    if (
      entry.candidate.verdict
        === 'supported'
      && !anchorsByClassifier.has(
        entry.classifierId,
      )
    ) {
      anchorsByClassifier.set(
        entry.classifierId,
        entry,
      );
    }
  }

  const observations:
  LevelV2ShadowSetupOutcomeObservation[] = [];

  for (
    const anchor
    of anchorsByClassifier.values()
  ) {
    const classifierEntries =
      sourceEntries.filter(
        (entry) =>
          entry.evidence.classifierId
            === anchor.classifierId,
      );
    const observation =
      evaluateLevelV2ShadowSetupOutcomeObservation(
        anchor,
        classifierEntries,
        resolveLevel(
          anchor.levelId,
          levels,
        ),
        options,
      );

    if (observation) {
      observations.push(
        observation,
      );
    }
  }

  return {
    observations:
      observations
        .sort(
          (
            left,
            right,
          ) =>
            right.startedSequence
            - left.startedSequence,
        )
        .map(
          cloneLevelV2ShadowSetupOutcomeObservation,
        ),
    sourceCandidateHistoryEntriesCount:
      candidateHistory.length,
  };
}

export function buildLevelV2ShadowSetupOutcomeObservations(
  sourceEntries:
    readonly LevelV2ShadowMarketEvidenceHistoryEntry[],
  levels:
    readonly LevelV2LifecycleState[],
  options:
    LevelV2ShadowSetupOutcomeObservationOptions =
      DEFAULT_LEVEL_V2_SHADOW_SETUP_OUTCOME_OBSERVATION_OPTIONS,
): LevelV2ShadowSetupOutcomeObservation[] {
  return buildLevelV2ShadowSetupOutcomeObservationSnapshot(
    sourceEntries,
    levels,
    options,
  ).observations;
}

function emptyStatusCounts():
LevelV2ShadowSetupOutcomeStatusCounts {
  return {
    pending: 0,
    successful_continuation: 0,
    failed_reversal: 0,
    mixed: 0,
  };
}

function emptyDirectionCounts():
LevelV2ShadowSetupOutcomeDirectionCounts {
  return {
    up: 0,
    down: 0,
  };
}

export function buildLevelV2ShadowSetupOutcomeObservationDiagnostics(
  observations:
    readonly LevelV2ShadowSetupOutcomeObservation[],
): LevelV2ShadowSetupOutcomeObservationDiagnostics {
  const statusCounts =
    emptyStatusCounts();
  const expectedDirectionCounts =
    emptyDirectionCounts();
  let continuationReachedCount = 0;
  let adverseThresholdReachedCount = 0;
  let returnedInsideLevelCount = 0;
  let failureConditionReachedCount = 0;
  let totalMfe = 0;
  let totalMae = 0;

  for (
    const observation
    of observations
  ) {
    statusCounts[
      observation.status
    ] += 1;
    expectedDirectionCounts[
      observation.expectedDirection
    ] += 1;
    continuationReachedCount +=
      observation.continuationReached
        ? 1
        : 0;
    adverseThresholdReachedCount +=
      observation.adverseThresholdReached
        ? 1
        : 0;
    returnedInsideLevelCount +=
      observation.returnedInsideLevel
        === true
        ? 1
        : 0;
    failureConditionReachedCount +=
      observation.failureConditionReached
        ? 1
        : 0;
    totalMfe +=
      observation
        .maxFavorableExcursionPct;
    totalMae +=
      observation
        .maxAdverseExcursionPct;
  }

  return {
    observationsCount:
      observations.length,
    statusCounts,
    expectedDirectionCounts,
    continuationReachedCount,
    adverseThresholdReachedCount,
    returnedInsideLevelCount,
    failureConditionReachedCount,
    averageMaxFavorableExcursionPct:
      observations.length === 0
        ? null
        : roundMetric(
            totalMfe
            / observations.length,
          ),
    averageMaxAdverseExcursionPct:
      observations.length === 0
        ? null
        : roundMetric(
            totalMae
            / observations.length,
          ),
    latestObservedAt:
      [...observations]
        .sort(
          (
            left,
            right,
          ) =>
            Date.parse(
              right.latestSourceObservedAt,
            )
            - Date.parse(
                left.latestSourceObservedAt,
              ),
        )[0]
        ?.latestSourceObservedAt
      ?? null,
    observationalOnly:
      true,
    changesBreakClassification:
      false,
    changesProductionSetup:
      false,
    tradeExecution:
      false,
  };
}

export function buildLevelV2ShadowSetupOutcomeObservationStatus(
  observations:
    readonly LevelV2ShadowSetupOutcomeObservation[],
  sourceEntriesCount: number,
  sourceCandidateHistoryEntriesCount: number,
  sourceLevelsCount: number,
  sourceHistoryStatus:
    LevelV2ShadowMarketEvidenceHistoryStatus
    | null,
  options:
    LevelV2ShadowSetupOutcomeObservationOptions =
      DEFAULT_LEVEL_V2_SHADOW_SETUP_OUTCOME_OBSERVATION_OPTIONS,
  sourceLimit = SOURCE_HISTORY_LIMIT,
): LevelV2ShadowSetupOutcomeObservationStatus {
  validateOptions(
    options,
  );

  return {
    observationsCount:
      observations.length,
    classifiersCount:
      new Set(
        observations.map(
          (observation) =>
            observation.classifierId,
        ),
      ).size,
    symbolsCount:
      new Set(
        observations.map(
          (observation) =>
            observation.symbol,
        ),
      ).size,
    observationsWithLevelGeometryCount:
      observations.filter(
        (observation) =>
          observation
            .levelGeometryAvailable,
      ).length,
    sourceEntriesCount,
    sourceCandidateHistoryEntriesCount,
    sourceLevelsCount,
    truncatedSourceHistory:
      sourceEntriesCount >= sourceLimit
      && sourceHistoryStatus !== null
      && sourceHistoryStatus.entriesCount
        > sourceEntriesCount,
    sourceHistoryStatus,
    latestObservedAt:
      buildLevelV2ShadowSetupOutcomeObservationDiagnostics(
        observations,
      ).latestObservedAt,
    options:
      cloneOptions(
        options,
      ),
    observationalOnly:
      true,
    changesBreakClassification:
      false,
    changesProductionSetup:
      false,
    tradeExecution:
      false,
  };
}
