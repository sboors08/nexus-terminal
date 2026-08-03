import type {
  LevelV2ShadowConfirmationCandidateConfidence,
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
  buildLevelV2ShadowSetupQualitySampleSnapshot,
} from './level-v2-shadow-setup-quality-sample.js';
import type {
  LevelV2ShadowSetupQualityDirectionCounts,
  LevelV2ShadowSetupQualityLabelCounts,
  LevelV2ShadowSetupQualitySample,
  LevelV2ShadowSetupQualitySampleStatus,
} from './level-v2-shadow-setup-quality-sample.types.js';
import type {
  LevelV2ShadowSetupQualityDatasetConfidenceCounts,
  LevelV2ShadowSetupQualityDatasetDiagnostics,
  LevelV2ShadowSetupQualityDatasetFilters,
  LevelV2ShadowSetupQualityDatasetGroup,
  LevelV2ShadowSetupQualityDatasetGroupKey,
  LevelV2ShadowSetupQualityDatasetKindCounts,
  LevelV2ShadowSetupQualityDatasetListResponse,
  LevelV2ShadowSetupQualityDatasetMetrics,
  LevelV2ShadowSetupQualityDatasetOptions,
  LevelV2ShadowSetupQualityDatasetResolvedRates,
  LevelV2ShadowSetupQualityDatasetSnapshot,
  LevelV2ShadowSetupQualityDatasetStatus,
  LevelV2ShadowSetupQualityDatasetSufficiency,
} from './level-v2-shadow-setup-quality-dataset.types.js';
import type {
  LevelV2Kind,
} from './level-v2-zones-score.types.js';

const MAX_PUBLIC_ITEMS =
  10_000;

export const DEFAULT_LEVEL_V2_SHADOW_SETUP_QUALITY_DATASET_OPTIONS:
LevelV2ShadowSetupQualityDatasetOptions = {
  minimumSamplesPerGroup:
    20,
  minimumResolvedSamplesPerGroup:
    10,
  maxGroups:
    5_000,
  maxSampleIdsPerGroup:
    500,
};

function validatePositiveInteger(
  value: number,
  name: string,
): void {
  if (
    !Number.isInteger(value)
    || value <= 0
  ) {
    throw new Error(
      `Level v2 shadow setup quality dataset ${name} must be a positive integer`,
    );
  }
}

function validateOptions(
  options:
    LevelV2ShadowSetupQualityDatasetOptions,
): void {
  validatePositiveInteger(
    options.minimumSamplesPerGroup,
    'minimumSamplesPerGroup',
  );
  validatePositiveInteger(
    options.minimumResolvedSamplesPerGroup,
    'minimumResolvedSamplesPerGroup',
  );
  validatePositiveInteger(
    options.maxGroups,
    'maxGroups',
  );
  validatePositiveInteger(
    options.maxSampleIdsPerGroup,
    'maxSampleIdsPerGroup',
  );

  if (
    options.minimumResolvedSamplesPerGroup
    > options.minimumSamplesPerGroup
  ) {
    throw new Error(
      'Level v2 shadow setup quality dataset minimumResolvedSamplesPerGroup cannot exceed minimumSamplesPerGroup',
    );
  }
}

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

function median(
  values:
    readonly number[],
): number | null {
  if (values.length === 0) {
    return null;
  }

  const ordered = [
    ...values,
  ].sort(
    (
      left,
      right,
    ) =>
      left - right,
  );
  const middle =
    Math.floor(
      ordered.length / 2,
    );

  if (
    ordered.length % 2 === 1
  ) {
    return roundMetric(
      ordered[middle]!,
    );
  }

  return roundMetric(
    (
      ordered[middle - 1]!
      + ordered[middle]!
    )
    / 2,
  );
}

function percentage(
  value: number,
  total: number,
): number | null {
  if (total === 0) {
    return null;
  }

  return roundMetric(
    value / total * 100,
  );
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

function emptyConfidenceCounts():
LevelV2ShadowSetupQualityDatasetConfidenceCounts {
  return {
    low: 0,
    medium: 0,
    high: 0,
  };
}

function emptyKindCounts():
LevelV2ShadowSetupQualityDatasetKindCounts {
  return {
    resistance: 0,
    support: 0,
  };
}

function cloneSampleStatus(
  status:
    LevelV2ShadowSetupQualitySampleStatus
    | null,
): LevelV2ShadowSetupQualitySampleStatus | null {
  if (status === null) {
    return null;
  }

  return {
    ...status,
    sourceHistoryStatus:
      status.sourceHistoryStatus === null
        ? null
        : {
            ...status.sourceHistoryStatus,
          },
  };
}

export function cloneLevelV2ShadowSetupQualityDatasetGroup(
  group:
    LevelV2ShadowSetupQualityDatasetGroup,
): LevelV2ShadowSetupQualityDatasetGroup {
  return {
    ...group,
    key: {
      ...group.key,
    },
    labelCounts: {
      ...group.labelCounts,
    },
    resolvedRates: {
      ...group.resolvedRates,
    },
    metrics: {
      ...group.metrics,
    },
    sufficiency: {
      ...group.sufficiency,
      reasons: [
        ...group.sufficiency.reasons,
      ],
    },
    sampleIds: [
      ...group.sampleIds,
    ],
  };
}

function groupKey(
  sample:
    LevelV2ShadowSetupQualitySample,
): LevelV2ShadowSetupQualityDatasetGroupKey {
  return {
    symbol:
      sample.symbol,
    timeframe:
      sample.timeframe,
    currentKind:
      sample.currentKind,
    expectedDirection:
      sample.expectedDirection,
    anchorConfidence:
      sample.startContext.confidence,
  };
}

function groupId(
  key:
    LevelV2ShadowSetupQualityDatasetGroupKey,
): string {
  return [
    'setup-quality-dataset',
    key.symbol,
    key.timeframe,
    key.currentKind,
    key.expectedDirection,
    key.anchorConfidence,
  ].join(':');
}

function buildMetrics(
  samples:
    readonly LevelV2ShadowSetupQualitySample[],
): LevelV2ShadowSetupQualityDatasetMetrics {
  const favorable =
    samples.map(
      (sample) =>
        sample.metrics
          .maxFavorableExcursionPct,
    );
  const adverse =
    samples.map(
      (sample) =>
        sample.metrics
          .maxAdverseExcursionPct,
    );
  const times =
    samples.flatMap(
      (sample) =>
        sample.metrics.timeToOutcomeMs
          === null
          ? []
          : [
              sample.metrics
                .timeToOutcomeMs,
            ],
    );
  const durations =
    samples.map(
      (sample) =>
        sample.metrics.durationMs,
    );
  const observedPrices =
    samples.map(
      (sample) =>
        sample.metrics
          .observedPricesCount,
    );

  return {
    averageMaxFavorableExcursionPct:
      average(
        favorable,
      ),
    medianMaxFavorableExcursionPct:
      median(
        favorable,
      ),
    averageMaxAdverseExcursionPct:
      average(
        adverse,
      ),
    medianMaxAdverseExcursionPct:
      median(
        adverse,
      ),
    averageTimeToOutcomeMs:
      average(
        times,
      ),
    medianTimeToOutcomeMs:
      median(
        times,
      ),
    averageDurationMs:
      average(
        durations,
      ),
    medianDurationMs:
      median(
        durations,
      ),
    averageObservedPricesCount:
      average(
        observedPrices,
      ),
    medianObservedPricesCount:
      median(
        observedPrices,
      ),
  };
}

function buildSufficiency(
  samplesCount: number,
  resolvedSamplesCount: number,
  options:
    LevelV2ShadowSetupQualityDatasetOptions,
): LevelV2ShadowSetupQualityDatasetSufficiency {
  const samplesThresholdMet =
    samplesCount
    >= options.minimumSamplesPerGroup;
  const resolvedSamplesThresholdMet =
    resolvedSamplesCount
    >= options.minimumResolvedSamplesPerGroup;
  const reasons:
  string[] = [];

  if (!samplesThresholdMet) {
    reasons.push(
      'insufficient_total_samples',
    );
  }

  if (!resolvedSamplesThresholdMet) {
    reasons.push(
      'insufficient_resolved_samples',
    );
  }

  return {
    minimumSamplesRequired:
      options.minimumSamplesPerGroup,
    minimumResolvedSamplesRequired:
      options.minimumResolvedSamplesPerGroup,
    samplesThresholdMet,
    resolvedSamplesThresholdMet,
    sufficient:
      samplesThresholdMet
      && resolvedSamplesThresholdMet,
    reasons,
  };
}

function buildGroup(
  samplesValue:
    readonly LevelV2ShadowSetupQualitySample[],
  options:
    LevelV2ShadowSetupQualityDatasetOptions,
): LevelV2ShadowSetupQualityDatasetGroup {
  const samples = [
    ...samplesValue,
  ].sort(
    (
      left,
      right,
    ) =>
      right.generatedAt.localeCompare(
        left.generatedAt,
      ),
  );
  const first =
    samples[0]!;
  const key =
    groupKey(
      first,
    );
  const labelCounts =
    emptyLabelCounts();

  for (
    const sample
    of samples
  ) {
    labelCounts[
      sample.qualityLabel
    ] += 1;
  }

  const resolvedSamplesCount =
    labelCounts.successful
    + labelCounts.failed
    + labelCounts.mixed;
  const retainedSampleIds =
    samples
      .slice(
        0,
        options.maxSampleIdsPerGroup,
      )
      .map(
        (sample) =>
          sample.id,
      );
  const resolvedRates:
  LevelV2ShadowSetupQualityDatasetResolvedRates = {
    successfulPct:
      percentage(
        labelCounts.successful,
        resolvedSamplesCount,
      ),
    failedPct:
      percentage(
        labelCounts.failed,
        resolvedSamplesCount,
      ),
    mixedPct:
      percentage(
        labelCounts.mixed,
        resolvedSamplesCount,
      ),
  };

  return {
    id:
      groupId(
        key,
      ),
    version:
      'v0.1',
    key,
    samplesCount:
      samples.length,
    resolvedSamplesCount,
    unresolvedSamplesCount:
      samples.length
      - resolvedSamplesCount,
    resolvedRatePct:
      percentage(
        resolvedSamplesCount,
        samples.length,
      )
      ?? 0,
    labelCounts,
    resolvedRates,
    metrics:
      buildMetrics(
        samples,
      ),
    sufficiency:
      buildSufficiency(
        samples.length,
        resolvedSamplesCount,
        options,
      ),
    sampleIds:
      retainedSampleIds,
    sampleIdsTruncated:
      retainedSampleIds.length
      < samples.length,
    oldestGeneratedAt:
      samples.at(-1)!
        .generatedAt,
    latestGeneratedAt:
      first.generatedAt,
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

function buildGroups(
  samples:
    readonly LevelV2ShadowSetupQualitySample[],
  options:
    LevelV2ShadowSetupQualityDatasetOptions,
): {
  groups:
    LevelV2ShadowSetupQualityDatasetGroup[];
  droppedGroupsCount: number;
} {
  const samplesByGroup =
    new Map<
      string,
      LevelV2ShadowSetupQualitySample[]
    >();

  for (
    const sample
    of samples
  ) {
    const id =
      groupId(
        groupKey(
          sample,
        ),
      );
    const values =
      samplesByGroup.get(
        id,
      )
      ?? [];

    values.push(
      sample,
    );
    samplesByGroup.set(
      id,
      values,
    );
  }

  const allGroups = [
    ...samplesByGroup.values(),
  ]
    .map(
      (values) =>
        buildGroup(
          values,
          options,
        ),
    )
    .sort(
      (
        left,
        right,
      ) =>
        right.samplesCount
          - left.samplesCount
        || right.latestGeneratedAt
          .localeCompare(
            left.latestGeneratedAt,
          )
        || left.id.localeCompare(
          right.id,
        ),
    );

  return {
    groups:
      allGroups
        .slice(
          0,
          options.maxGroups,
        )
        .map(
          cloneLevelV2ShadowSetupQualityDatasetGroup,
        ),
    droppedGroupsCount:
      Math.max(
        0,
        allGroups.length
        - options.maxGroups,
      ),
  };
}

function buildDiagnostics(
  groups:
    readonly LevelV2ShadowSetupQualityDatasetGroup[],
): LevelV2ShadowSetupQualityDatasetDiagnostics {
  const labelCounts =
    emptyLabelCounts();
  const expectedDirectionCounts =
    emptyDirectionCounts();
  const anchorConfidenceCounts =
    emptyConfidenceCounts();
  const currentKindCounts =
    emptyKindCounts();
  let sufficientGroupsCount = 0;
  let groupsWithoutResolvedSamplesCount = 0;
  let totalGroupedSamplesCount = 0;

  for (
    const group
    of groups
  ) {
    labelCounts.successful +=
      group.labelCounts.successful;
    labelCounts.failed +=
      group.labelCounts.failed;
    labelCounts.mixed +=
      group.labelCounts.mixed;
    labelCounts.unresolved +=
      group.labelCounts.unresolved;
    expectedDirectionCounts[
      group.key.expectedDirection
    ] += 1;
    anchorConfidenceCounts[
      group.key.anchorConfidence
    ] += 1;
    currentKindCounts[
      group.key.currentKind
    ] += 1;
    sufficientGroupsCount +=
      group.sufficiency.sufficient
        ? 1
        : 0;
    groupsWithoutResolvedSamplesCount +=
      group.resolvedSamplesCount === 0
        ? 1
        : 0;
    totalGroupedSamplesCount +=
      group.samplesCount;
  }

  return {
    groupsCount:
      groups.length,
    sufficientGroupsCount,
    groupsWithoutResolvedSamplesCount,
    totalGroupedSamplesCount,
    medianSamplesPerGroup:
      median(
        groups.map(
          (group) =>
            group.samplesCount,
        ),
      ),
    labelCounts,
    expectedDirectionCounts,
    anchorConfidenceCounts,
    currentKindCounts,
    latestGeneratedAt:
      groups
        .map(
          (group) =>
            group.latestGeneratedAt,
        )
        .sort()
        .at(-1)
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

function buildStatus(
  groups:
    readonly LevelV2ShadowSetupQualityDatasetGroup[],
  sourceSamples:
    readonly LevelV2ShadowSetupQualitySample[],
  sourceSampleStatus:
    LevelV2ShadowSetupQualitySampleStatus
    | null,
  droppedGroupsCount: number,
  options:
    LevelV2ShadowSetupQualityDatasetOptions,
): LevelV2ShadowSetupQualityDatasetStatus {
  const sourceResolvedSamplesCount =
    sourceSamples.filter(
      (sample) =>
        sample.resolved,
    ).length;
  const sufficientGroupsCount =
    groups.filter(
      (group) =>
        group.sufficiency.sufficient,
    ).length;

  return {
    groupsCount:
      groups.length,
    sufficientGroupsCount,
    insufficientGroupsCount:
      groups.length
      - sufficientGroupsCount,
    sourceSamplesCount:
      sourceSamples.length,
    sourceResolvedSamplesCount,
    sourceUnresolvedSamplesCount:
      sourceSamples.length
      - sourceResolvedSamplesCount,
    symbolsCount:
      new Set(
        groups.map(
          (group) =>
            group.key.symbol,
        ),
      ).size,
    maxGroups:
      options.maxGroups,
    maxSampleIdsPerGroup:
      options.maxSampleIdsPerGroup,
    droppedGroupsCount,
    latestGeneratedAt:
      groups
        .map(
          (group) =>
            group.latestGeneratedAt,
        )
        .sort()
        .at(-1)
      ?? null,
    sourceSampleStatus:
      cloneSampleStatus(
        sourceSampleStatus,
      ),
    options: {
      ...options,
    },
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

export function buildLevelV2ShadowSetupQualityDatasetSnapshotFromSamples(
  samples:
    readonly LevelV2ShadowSetupQualitySample[],
  sourceSampleStatus:
    LevelV2ShadowSetupQualitySampleStatus
    | null = null,
  options:
    LevelV2ShadowSetupQualityDatasetOptions =
      DEFAULT_LEVEL_V2_SHADOW_SETUP_QUALITY_DATASET_OPTIONS,
): LevelV2ShadowSetupQualityDatasetSnapshot {
  validateOptions(
    options,
  );

  const built =
    buildGroups(
      samples,
      options,
    );
  const groups =
    built.groups.map(
      cloneLevelV2ShadowSetupQualityDatasetGroup,
    );

  return {
    groups,
    status:
      buildStatus(
        groups,
        samples,
        sourceSampleStatus,
        built.droppedGroupsCount,
        options,
      ),
    diagnostics:
      buildDiagnostics(
        groups,
      ),
  };
}

export function buildLevelV2ShadowSetupQualityDatasetSnapshot(
  sourceEntries:
    readonly LevelV2ShadowMarketEvidenceHistoryEntry[],
  levels:
    readonly LevelV2LifecycleState[],
  sourceHistoryStatus:
    LevelV2ShadowMarketEvidenceHistoryStatus
    | null = null,
  sourceLimit = MAX_PUBLIC_ITEMS,
  options:
    LevelV2ShadowSetupQualityDatasetOptions =
      DEFAULT_LEVEL_V2_SHADOW_SETUP_QUALITY_DATASET_OPTIONS,
): LevelV2ShadowSetupQualityDatasetSnapshot {
  const sampleSnapshot =
    buildLevelV2ShadowSetupQualitySampleSnapshot(
      sourceEntries,
      levels,
      sourceHistoryStatus,
      sourceLimit,
    );

  return buildLevelV2ShadowSetupQualityDatasetSnapshotFromSamples(
    sampleSnapshot.samples,
    sampleSnapshot.status,
    options,
  );
}

export function filterLevelV2ShadowSetupQualityDatasetGroups(
  groups:
    readonly LevelV2ShadowSetupQualityDatasetGroup[],
  filters:
    LevelV2ShadowSetupQualityDatasetFilters,
): LevelV2ShadowSetupQualityDatasetGroup[] {
  if (
    !Number.isInteger(filters.limit)
    || filters.limit <= 0
    || filters.limit > MAX_PUBLIC_ITEMS
  ) {
    throw new Error(
      'Level v2 shadow setup quality dataset limit must be an integer from one to ten thousand',
    );
  }

  if (
    filters.minimumSamples !== null
    && (
      !Number.isInteger(
        filters.minimumSamples,
      )
      || filters.minimumSamples < 1
      || filters.minimumSamples
        > MAX_PUBLIC_ITEMS
    )
  ) {
    throw new Error(
      'Level v2 shadow setup quality dataset minimumSamples must be an integer from one to ten thousand',
    );
  }

  return groups
    .filter(
      (group) =>
        (
          filters.symbol === null
          || group.key.symbol
            === filters.symbol
        )
        && (
          filters.currentKind === null
          || group.key.currentKind
            === filters.currentKind
        )
        && (
          filters.expectedDirection === null
          || group.key.expectedDirection
            === filters.expectedDirection
        )
        && (
          filters.anchorConfidence === null
          || group.key.anchorConfidence
            === filters.anchorConfidence
        )
        && (
          filters.sufficient === null
          || group.sufficiency.sufficient
            === filters.sufficient
        )
        && (
          filters.minimumSamples === null
          || group.samplesCount
            >= filters.minimumSamples
        ),
    )
    .sort(
      (
        left,
        right,
      ) =>
        right.samplesCount
          - left.samplesCount
        || right.latestGeneratedAt
          .localeCompare(
            left.latestGeneratedAt,
          )
        || left.id.localeCompare(
          right.id,
        ),
    )
    .slice(
      0,
      filters.limit,
    )
    .map(
      cloneLevelV2ShadowSetupQualityDatasetGroup,
    );
}

export function buildLevelV2ShadowSetupQualityDatasetListResponse(
  snapshot:
    LevelV2ShadowSetupQualityDatasetSnapshot,
  filters:
    LevelV2ShadowSetupQualityDatasetFilters,
): LevelV2ShadowSetupQualityDatasetListResponse {
  const allMatching =
    filterLevelV2ShadowSetupQualityDatasetGroups(
      snapshot.groups,
      {
        ...filters,
        limit:
          MAX_PUBLIC_ITEMS,
      },
    );
  const items =
    allMatching.slice(
      0,
      filters.limit,
    );

  return {
    items,
    count:
      items.length,
    totalGroups:
      allMatching.length,
    status: {
      ...snapshot.status,
      sourceSampleStatus:
        cloneSampleStatus(
          snapshot.status
            .sourceSampleStatus,
        ),
      options: {
        ...snapshot.status.options,
      },
    },
    diagnostics: {
      ...snapshot.diagnostics,
      labelCounts: {
        ...snapshot.diagnostics
          .labelCounts,
      },
      expectedDirectionCounts: {
        ...snapshot.diagnostics
          .expectedDirectionCounts,
      },
      anchorConfidenceCounts: {
        ...snapshot.diagnostics
          .anchorConfidenceCounts,
      },
      currentKindCounts: {
        ...snapshot.diagnostics
          .currentKindCounts,
      },
    },
    filters: {
      ...filters,
    },
  };
}

export function isLevelV2ShadowSetupQualityDatasetDirection(
  value: string,
): value is
LevelV2ShadowConfirmationExpectedDirection {
  return value === 'up'
    || value === 'down';
}

export function isLevelV2ShadowSetupQualityDatasetConfidence(
  value: string,
): value is
LevelV2ShadowConfirmationCandidateConfidence {
  return value === 'low'
    || value === 'medium'
    || value === 'high';
}

export function isLevelV2ShadowSetupQualityDatasetKind(
  value: string,
): value is
LevelV2Kind {
  return value === 'resistance'
    || value === 'support';
}
