import {
  buildLevelV2ShadowConfirmationCandidateHistoryStore,
} from './level-v2-shadow-confirmation-candidate-history.js';
import {
  cloneLevelV2ShadowConfirmationCandidate,
} from './level-v2-shadow-confirmation-candidate.js';
import type {
  LevelV2ShadowConfirmationCandidateHistoryEntry,
} from './level-v2-shadow-confirmation-candidate-history.types.js';
import type {
  LevelV2ShadowConfirmationExpectedDirection,
} from './level-v2-shadow-confirmation-candidate.types.js';
import type {
  LevelV2ShadowMarketEvidenceHistoryEntry,
  LevelV2ShadowMarketEvidenceHistoryStatus,
} from './level-v2-shadow-market-evidence-history.types.js';
import type {
  LevelV2LifecycleState,
} from './level-v2-lifecycle.types.js';
import {
  buildLevelV2ShadowSetupOutcomeHistoryStore,
} from './level-v2-shadow-setup-outcome-history.js';
import type {
  LevelV2ShadowSetupOutcomeHistoryEntry,
} from './level-v2-shadow-setup-outcome-history.types.js';
import {
  cloneLevelV2ShadowSetupOutcomeObservation,
} from './level-v2-shadow-setup-outcome-observation.js';
import type {
  LevelV2ShadowSetupOutcomeStatus,
} from './level-v2-shadow-setup-outcome-observation.types.js';
import type {
  LevelV2ShadowSetupQualityDirectionCounts,
  LevelV2ShadowSetupQualityLabel,
  LevelV2ShadowSetupQualityLabelCounts,
  LevelV2ShadowSetupQualityMetrics,
  LevelV2ShadowSetupQualitySample,
  LevelV2ShadowSetupQualitySampleDiagnostics,
  LevelV2ShadowSetupQualitySampleFilters,
  LevelV2ShadowSetupQualitySampleSnapshot,
  LevelV2ShadowSetupQualitySampleStatus,
  LevelV2ShadowSetupQualityStartContext,
} from './level-v2-shadow-setup-quality-sample.types.js';

const MAX_PUBLIC_ITEMS =
  10_000;

function roundMetric(
  value: number,
): number {
  return Number(
    value.toFixed(8),
  );
}

function average(
  values:
    readonly number[],
): number | null {
  if (values.length === 0) {
    return null;
  }

  return roundMetric(
    values.reduce(
      (
        total,
        value,
      ) =>
        total + value,
      0,
    )
    / values.length,
  );
}

function cloneCandidateHistoryEntry(
  entry:
    LevelV2ShadowConfirmationCandidateHistoryEntry,
): LevelV2ShadowConfirmationCandidateHistoryEntry {
  return {
    ...entry,
    candidate:
      cloneLevelV2ShadowConfirmationCandidate(
        entry.candidate,
      ),
    changes: {
      ...entry.changes,
    },
  };
}

function cloneOutcomeHistoryEntry(
  entry:
    LevelV2ShadowSetupOutcomeHistoryEntry,
): LevelV2ShadowSetupOutcomeHistoryEntry {
  return {
    ...entry,
    observation:
      cloneLevelV2ShadowSetupOutcomeObservation(
        entry.observation,
      ),
    changes: {
      ...entry.changes,
    },
  };
}

function qualityLabel(
  status:
    LevelV2ShadowSetupOutcomeStatus,
): LevelV2ShadowSetupQualityLabel {
  switch (status) {
    case 'successful_continuation':
      return 'successful';
    case 'failed_reversal':
      return 'failed';
    case 'mixed':
      return 'mixed';
    case 'pending':
      return 'unresolved';
  }
}

function startContext(
  anchor:
    LevelV2ShadowConfirmationCandidateHistoryEntry,
): LevelV2ShadowSetupQualityStartContext {
  const candidate =
    anchor.candidate;

  return {
    capturedAt:
      anchor.capturedAt,
    latestSequence:
      candidate.latestSequence,
    classificationStatus:
      candidate.latestClassificationStatus,
    expectedDirection:
      candidate.expectedDirection,
    priceAcceptance:
      candidate.priceAcceptance,
    behavior:
      candidate.behavior,
    behaviorConfidence:
      candidate.behaviorConfidence,
    aggressionSide:
      candidate.aggressionSide,
    priceDirection:
      candidate.priceDirection,
    postEventReaction:
      candidate.postEventReaction,
    verdict:
      candidate.verdict,
    confidence:
      candidate.confidence,
    reasons: [
      ...candidate.reasons,
    ],
    marketEvidenceEntriesCount:
      candidate.evidence
        .marketEvidenceEntriesCount,
    usableTapeEntriesCount:
      candidate.evidence
        .usableTapeEntriesCount,
    completeEntriesCount:
      candidate.evidence
        .completeEntriesCount,
    behaviorHistoryEntriesCount:
      candidate.evidence
        .behaviorHistoryEntriesCount,
    stableBehaviorEntriesCount:
      candidate.evidence
        .stableBehaviorEntriesCount,
    contradictoryBehaviorEntriesCount:
      candidate.evidence
        .contradictoryBehaviorEntriesCount,
    netPriceChangePct:
      candidate.evidence
        .netPriceChangePct,
    latestOrderBookImbalancePct:
      candidate.evidence
        .latestOrderBookImbalancePct,
    latestAvailability:
      candidate.evidence
        .latestAvailability,
    latestEvidenceCapturedAt:
      candidate.evidence
        .latestEvidenceCapturedAt,
  };
}

function metrics(
  finalEntry:
    LevelV2ShadowSetupOutcomeHistoryEntry,
): LevelV2ShadowSetupQualityMetrics {
  const observation =
    finalEntry.observation;

  return {
    entryPrice:
      observation.entryPrice,
    latestPrice:
      observation.latestPrice,
    latestPriceChangePct:
      finalEntry.latestPriceChangePct,
    maxFavorableExcursionPct:
      observation
        .maxFavorableExcursionPct,
    maxAdverseExcursionPct:
      observation
        .maxAdverseExcursionPct,
    observedPricesCount:
      observation.observedPricesCount,
    durationMs:
      observation.durationMs,
    continuationReached:
      observation.continuationReached,
    failureConditionReached:
      observation.failureConditionReached,
    returnedInsideLevel:
      observation.returnedInsideLevel,
    timeToOutcomeMs:
      observation.timeToOutcomeMs,
  };
}

export function cloneLevelV2ShadowSetupQualitySample(
  sample:
    LevelV2ShadowSetupQualitySample,
): LevelV2ShadowSetupQualitySample {
  return {
    ...sample,
    anchorCandidateHistoryEntry:
      cloneCandidateHistoryEntry(
        sample.anchorCandidateHistoryEntry,
      ),
    confirmationHistory:
      sample.confirmationHistory.map(
        cloneCandidateHistoryEntry,
      ),
    outcomeHistory:
      sample.outcomeHistory.map(
        cloneOutcomeHistoryEntry,
      ),
    finalOutcome:
      cloneLevelV2ShadowSetupOutcomeObservation(
        sample.finalOutcome,
      ),
    startContext: {
      ...sample.startContext,
      reasons: [
        ...sample.startContext.reasons,
      ],
    },
    metrics: {
      ...sample.metrics,
    },
  };
}

export function buildLevelV2ShadowSetupQualitySampleFromHistories(
  candidateEntriesValue:
    readonly LevelV2ShadowConfirmationCandidateHistoryEntry[],
  outcomeEntriesValue:
    readonly LevelV2ShadowSetupOutcomeHistoryEntry[],
): {
  samples:
    LevelV2ShadowSetupQualitySample[];
  missingAnchorCandidatesCount: number;
} {
  const candidateEntries =
    candidateEntriesValue.map(
      cloneCandidateHistoryEntry,
    );
  const outcomeEntries =
    outcomeEntriesValue.map(
      cloneOutcomeHistoryEntry,
    );
  const candidateById =
    new Map(
      candidateEntries.map(
        (entry) => [
          entry.id,
          entry,
        ] as const,
      ),
    );
  const outcomesByClassifier =
    new Map<
      string,
      LevelV2ShadowSetupOutcomeHistoryEntry[]
    >();

  for (
    const entry
    of outcomeEntries
  ) {
    const values =
      outcomesByClassifier.get(
        entry.classifierId,
      )
      ?? [];

    values.push(
      entry,
    );
    outcomesByClassifier.set(
      entry.classifierId,
      values,
    );
  }

  const samples:
  LevelV2ShadowSetupQualitySample[] = [];
  let missingAnchorCandidatesCount = 0;

  for (
    const [
      classifierId,
      classifierOutcomes,
    ]
    of outcomesByClassifier
  ) {
    const orderedOutcomes = [
      ...classifierOutcomes,
    ].sort(
      (
        left,
        right,
      ) =>
        left.sequence
        - right.sequence,
    );
    const finalEntry =
      orderedOutcomes.at(-1);

    if (!finalEntry) {
      continue;
    }

    const anchorId =
      finalEntry.observation
        .anchorCandidateHistoryEntryId;
    const anchor =
      candidateById.get(
        anchorId,
      );

    if (!anchor) {
      missingAnchorCandidatesCount += 1;
      continue;
    }

    const confirmationHistory =
      candidateEntries
        .filter(
          (entry) =>
            entry.classifierId
              === classifierId
            && entry.candidate
              .latestSequence
              <= finalEntry.observation
                .startedSequence,
        )
        .sort(
          (
            left,
            right,
          ) =>
            left.sequence
            - right.sequence,
        );
    const anchoredOutcomeHistory =
      orderedOutcomes.filter(
        (entry) =>
          entry.observation
            .anchorCandidateHistoryEntryId
            === anchorId,
      );
    const label =
      qualityLabel(
        finalEntry.observation.status,
      );

    samples.push({
      id:
        `${classifierId}:setup-quality-sample:${anchorId}`,
      version:
        'v0.1',
      classifierId,
      levelId:
        finalEntry.levelId,
      symbol:
        finalEntry.symbol,
      timeframe:
        finalEntry.timeframe,
      currentKind:
        finalEntry.observation.currentKind,
      expectedDirection:
        finalEntry.observation
          .expectedDirection,
      generatedAt:
        finalEntry.capturedAt,
      contextCutoffSequence:
        finalEntry.observation
          .startedSequence,
      qualityLabel:
        label,
      resolved:
        label !== 'unresolved',
      outcomeStatus:
        finalEntry.observation.status,
      anchorCandidateHistoryEntryId:
        anchorId,
      anchorCandidateId:
        finalEntry.observation
          .anchorCandidateId,
      anchorCandidateHistoryEntry:
        cloneCandidateHistoryEntry(
          anchor,
        ),
      confirmationHistory:
        confirmationHistory.map(
          cloneCandidateHistoryEntry,
        ),
      outcomeHistory:
        anchoredOutcomeHistory.map(
          cloneOutcomeHistoryEntry,
        ),
      finalOutcome:
        cloneLevelV2ShadowSetupOutcomeObservation(
          finalEntry.observation,
        ),
      startContext:
        startContext(
          anchor,
        ),
      metrics:
        metrics(
          finalEntry,
        ),
      preOutcomeContextOnly:
        true,
      observationalOnly:
        true,
      changesBreakClassification:
        false,
      changesProductionSetup:
        false,
      tradeExecution:
        false,
      trainingApplied:
        false,
    });
  }

  return {
    samples:
      samples
        .sort(
          (
            left,
            right,
          ) =>
            right.generatedAt.localeCompare(
              left.generatedAt,
            ),
        )
        .map(
          cloneLevelV2ShadowSetupQualitySample,
        ),
    missingAnchorCandidatesCount,
  };
}

function emptyLabelCounts():
LevelV2ShadowSetupQualityLabelCounts {
  return {
    successful: 0,
    failed: 0,
    mixed: 0,
    unresolved: 0,
  };
}

function emptyDirectionCounts():
LevelV2ShadowSetupQualityDirectionCounts {
  return {
    up: 0,
    down: 0,
  };
}

function diagnostics(
  samples:
    readonly LevelV2ShadowSetupQualitySample[],
): LevelV2ShadowSetupQualitySampleDiagnostics {
  const labelCounts =
    emptyLabelCounts();
  const expectedDirectionCounts =
    emptyDirectionCounts();
  const favorable:
    number[] = [];
  const adverse:
    number[] = [];
  const timeToOutcome:
    number[] = [];
  let highConfidenceAnchorCount = 0;
  let priceAcceptedAnchorCount = 0;

  for (
    const sample
    of samples
  ) {
    labelCounts[
      sample.qualityLabel
    ] += 1;
    expectedDirectionCounts[
      sample.expectedDirection
    ] += 1;
    highConfidenceAnchorCount +=
      sample.startContext.confidence
        === 'high'
        ? 1
        : 0;
    priceAcceptedAnchorCount +=
      sample.startContext.priceAcceptance
        ? 1
        : 0;
    favorable.push(
      sample.metrics
        .maxFavorableExcursionPct,
    );
    adverse.push(
      sample.metrics
        .maxAdverseExcursionPct,
    );

    if (
      sample.metrics.timeToOutcomeMs
      !== null
    ) {
      timeToOutcome.push(
        sample.metrics.timeToOutcomeMs,
      );
    }
  }

  return {
    samplesCount:
      samples.length,
    labelCounts,
    expectedDirectionCounts,
    highConfidenceAnchorCount,
    priceAcceptedAnchorCount,
    averageMaxFavorableExcursionPct:
      average(
        favorable,
      ),
    averageMaxAdverseExcursionPct:
      average(
        adverse,
      ),
    averageTimeToOutcomeMs:
      average(
        timeToOutcome,
      ),
    latestGeneratedAt:
      samples[0]
        ?.generatedAt
      ?? null,
    observationalOnly:
      true,
    changesBreakClassification:
      false,
    changesProductionSetup:
      false,
    tradeExecution:
      false,
    trainingApplied:
      false,
  };
}

function status(
  samples:
    readonly LevelV2ShadowSetupQualitySample[],
  sourceEntriesCount: number,
  sourceCandidateHistoryEntriesCount: number,
  sourceOutcomeHistoryEntriesCount: number,
  sourceLevelsCount: number,
  missingAnchorCandidatesCount: number,
  sourceHistoryStatus:
    LevelV2ShadowMarketEvidenceHistoryStatus
    | null,
  sourceLimit: number,
): LevelV2ShadowSetupQualitySampleStatus {
  const resolvedSamplesCount =
    samples.filter(
      (sample) =>
        sample.resolved,
    ).length;

  return {
    samplesCount:
      samples.length,
    resolvedSamplesCount,
    unresolvedSamplesCount:
      samples.length
      - resolvedSamplesCount,
    classifiersCount:
      new Set(
        samples.map(
          (sample) =>
            sample.classifierId,
        ),
      ).size,
    symbolsCount:
      new Set(
        samples.map(
          (sample) =>
            sample.symbol,
        ),
      ).size,
    sourceEntriesCount,
    sourceCandidateHistoryEntriesCount,
    sourceOutcomeHistoryEntriesCount,
    sourceLevelsCount,
    missingAnchorCandidatesCount,
    truncatedSourceHistory:
      sourceEntriesCount >= sourceLimit
      && sourceHistoryStatus !== null
      && sourceHistoryStatus.entriesCount
        > sourceEntriesCount,
    sourceHistoryStatus,
    latestGeneratedAt:
      samples[0]
        ?.generatedAt
      ?? null,
    observationalOnly:
      true,
    changesBreakClassification:
      false,
    changesProductionSetup:
      false,
    tradeExecution:
      false,
    trainingApplied:
      false,
  };
}

export function buildLevelV2ShadowSetupQualitySampleSnapshotFromHistories(
  candidateEntries:
    readonly LevelV2ShadowConfirmationCandidateHistoryEntry[],
  outcomeEntries:
    readonly LevelV2ShadowSetupOutcomeHistoryEntry[],
  sourceEntriesCount = 0,
  sourceLevelsCount = 0,
  sourceHistoryStatus:
    LevelV2ShadowMarketEvidenceHistoryStatus
    | null = null,
  sourceLimit = MAX_PUBLIC_ITEMS,
): LevelV2ShadowSetupQualitySampleSnapshot {
  const built =
    buildLevelV2ShadowSetupQualitySampleFromHistories(
      candidateEntries,
      outcomeEntries,
    );
  const samples =
    built.samples.map(
      cloneLevelV2ShadowSetupQualitySample,
    );

  return {
    samples,
    status:
      status(
        samples,
        sourceEntriesCount,
        candidateEntries.length,
        outcomeEntries.length,
        sourceLevelsCount,
        built.missingAnchorCandidatesCount,
        sourceHistoryStatus,
        sourceLimit,
      ),
    diagnostics:
      diagnostics(
        samples,
      ),
  };
}

export function buildLevelV2ShadowSetupQualitySampleSnapshot(
  sourceEntries:
    readonly LevelV2ShadowMarketEvidenceHistoryEntry[],
  levels:
    readonly LevelV2LifecycleState[],
  sourceHistoryStatus:
    LevelV2ShadowMarketEvidenceHistoryStatus
    | null = null,
  sourceLimit = MAX_PUBLIC_ITEMS,
): LevelV2ShadowSetupQualitySampleSnapshot {
  const candidateStore =
    buildLevelV2ShadowConfirmationCandidateHistoryStore(
      sourceEntries,
    );
  const outcomeStore =
    buildLevelV2ShadowSetupOutcomeHistoryStore(
      sourceEntries,
      levels,
    );
  const candidateEntries =
    candidateStore.getHistory(
      undefined,
      undefined,
      MAX_PUBLIC_ITEMS,
    );
  const outcomeEntries =
    outcomeStore.getHistory(
      undefined,
      undefined,
      MAX_PUBLIC_ITEMS,
    );

  return buildLevelV2ShadowSetupQualitySampleSnapshotFromHistories(
    candidateEntries,
    outcomeEntries,
    sourceEntries.length,
    levels.length,
    sourceHistoryStatus,
    sourceLimit,
  );
}

export function filterLevelV2ShadowSetupQualitySamples(
  samples:
    readonly LevelV2ShadowSetupQualitySample[],
  filters:
    LevelV2ShadowSetupQualitySampleFilters,
): LevelV2ShadowSetupQualitySample[] {
  if (
    !Number.isInteger(filters.limit)
    || filters.limit <= 0
    || filters.limit > MAX_PUBLIC_ITEMS
  ) {
    throw new Error(
      'Level v2 shadow setup quality sample limit must be an integer from one to ten thousand',
    );
  }

  return samples
    .filter(
      (sample) =>
        (
          filters.symbol === null
          || sample.symbol
            === filters.symbol
        )
        && (
          filters.classifierId === null
          || sample.classifierId
            === filters.classifierId
        )
        && (
          filters.qualityLabel === null
          || sample.qualityLabel
            === filters.qualityLabel
        )
        && (
          filters.expectedDirection === null
          || sample.expectedDirection
            === filters.expectedDirection
        )
        && (
          filters.outcomeStatus === null
          || sample.outcomeStatus
            === filters.outcomeStatus
        ),
    )
    .sort(
      (
        left,
        right,
      ) =>
        right.generatedAt.localeCompare(
          left.generatedAt,
        ),
    )
    .slice(
      0,
      filters.limit,
    )
    .map(
      cloneLevelV2ShadowSetupQualitySample,
    );
}

export function isLevelV2ShadowSetupQualityDirection(
  value: string,
): value is
LevelV2ShadowConfirmationExpectedDirection {
  return value === 'up'
    || value === 'down';
}
