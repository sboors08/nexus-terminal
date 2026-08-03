import type {
  LevelV2ShadowConfirmationCandidateConfidence,
  LevelV2ShadowConfirmationExpectedDirection,
} from './level-v2-shadow-confirmation-candidate.types.js';
import type {
  LevelV2ShadowSetupQualityDirectionCounts,
  LevelV2ShadowSetupQualityLabelCounts,
  LevelV2ShadowSetupQualitySampleStatus,
} from './level-v2-shadow-setup-quality-sample.types.js';
import type {
  LevelV2Kind,
} from './level-v2-zones-score.types.js';

export interface LevelV2ShadowSetupQualityDatasetOptions {
  minimumSamplesPerGroup: number;
  minimumResolvedSamplesPerGroup: number;
  maxGroups: number;
  maxSampleIdsPerGroup: number;
}

export interface LevelV2ShadowSetupQualityDatasetGroupKey {
  symbol: string;
  timeframe: string;
  currentKind: LevelV2Kind;
  expectedDirection:
    LevelV2ShadowConfirmationExpectedDirection;
  anchorConfidence:
    LevelV2ShadowConfirmationCandidateConfidence;
}

export interface LevelV2ShadowSetupQualityDatasetResolvedRates {
  successfulPct:
    number
    | null;
  failedPct:
    number
    | null;
  mixedPct:
    number
    | null;
}

export interface LevelV2ShadowSetupQualityDatasetMetrics {
  averageMaxFavorableExcursionPct:
    number
    | null;
  medianMaxFavorableExcursionPct:
    number
    | null;
  averageMaxAdverseExcursionPct:
    number
    | null;
  medianMaxAdverseExcursionPct:
    number
    | null;
  averageTimeToOutcomeMs:
    number
    | null;
  medianTimeToOutcomeMs:
    number
    | null;
  averageDurationMs:
    number
    | null;
  medianDurationMs:
    number
    | null;
  averageObservedPricesCount:
    number
    | null;
  medianObservedPricesCount:
    number
    | null;
}

export interface LevelV2ShadowSetupQualityDatasetSufficiency {
  minimumSamplesRequired: number;
  minimumResolvedSamplesRequired: number;
  samplesThresholdMet: boolean;
  resolvedSamplesThresholdMet: boolean;
  sufficient: boolean;
  reasons: readonly string[];
}

export interface LevelV2ShadowSetupQualityDatasetGroup {
  id: string;
  version: 'v0.1';
  key:
    LevelV2ShadowSetupQualityDatasetGroupKey;
  samplesCount: number;
  resolvedSamplesCount: number;
  unresolvedSamplesCount: number;
  resolvedRatePct: number;
  labelCounts:
    LevelV2ShadowSetupQualityLabelCounts;
  resolvedRates:
    LevelV2ShadowSetupQualityDatasetResolvedRates;
  metrics:
    LevelV2ShadowSetupQualityDatasetMetrics;
  sufficiency:
    LevelV2ShadowSetupQualityDatasetSufficiency;
  sampleIds: readonly string[];
  sampleIdsTruncated: boolean;
  oldestGeneratedAt: string;
  latestGeneratedAt: string;
  observationalOnly: true;
  changesBreakClassification: false;
  changesProductionSetup: false;
  tradeExecution: false;
  trainingApplied: false;
}

export interface LevelV2ShadowSetupQualityDatasetConfidenceCounts {
  low: number;
  medium: number;
  high: number;
}

export interface LevelV2ShadowSetupQualityDatasetKindCounts {
  resistance: number;
  support: number;
}

export interface LevelV2ShadowSetupQualityDatasetStatus {
  groupsCount: number;
  sufficientGroupsCount: number;
  insufficientGroupsCount: number;
  sourceSamplesCount: number;
  sourceResolvedSamplesCount: number;
  sourceUnresolvedSamplesCount: number;
  symbolsCount: number;
  maxGroups: number;
  maxSampleIdsPerGroup: number;
  droppedGroupsCount: number;
  latestGeneratedAt:
    string
    | null;
  sourceSampleStatus:
    LevelV2ShadowSetupQualitySampleStatus
    | null;
  options:
    LevelV2ShadowSetupQualityDatasetOptions;
  observationalOnly: true;
  changesBreakClassification: false;
  changesProductionSetup: false;
  tradeExecution: false;
  trainingApplied: false;
}

export interface LevelV2ShadowSetupQualityDatasetDiagnostics {
  groupsCount: number;
  sufficientGroupsCount: number;
  groupsWithoutResolvedSamplesCount: number;
  totalGroupedSamplesCount: number;
  medianSamplesPerGroup:
    number
    | null;
  labelCounts:
    LevelV2ShadowSetupQualityLabelCounts;
  expectedDirectionCounts:
    LevelV2ShadowSetupQualityDirectionCounts;
  anchorConfidenceCounts:
    LevelV2ShadowSetupQualityDatasetConfidenceCounts;
  currentKindCounts:
    LevelV2ShadowSetupQualityDatasetKindCounts;
  latestGeneratedAt:
    string
    | null;
  observationalOnly: true;
  changesBreakClassification: false;
  changesProductionSetup: false;
  tradeExecution: false;
  trainingApplied: false;
}

export interface LevelV2ShadowSetupQualityDatasetFilters {
  symbol: string | null;
  currentKind:
    LevelV2Kind
    | null;
  expectedDirection:
    LevelV2ShadowConfirmationExpectedDirection
    | null;
  anchorConfidence:
    LevelV2ShadowConfirmationCandidateConfidence
    | null;
  sufficient:
    boolean
    | null;
  minimumSamples:
    number
    | null;
  limit: number;
}

export interface LevelV2ShadowSetupQualityDatasetSnapshot {
  groups:
    readonly LevelV2ShadowSetupQualityDatasetGroup[];
  status:
    LevelV2ShadowSetupQualityDatasetStatus;
  diagnostics:
    LevelV2ShadowSetupQualityDatasetDiagnostics;
}

export interface LevelV2ShadowSetupQualityDatasetListResponse {
  items:
    readonly LevelV2ShadowSetupQualityDatasetGroup[];
  count: number;
  totalGroups: number;
  status:
    LevelV2ShadowSetupQualityDatasetStatus;
  diagnostics:
    LevelV2ShadowSetupQualityDatasetDiagnostics;
  filters:
    LevelV2ShadowSetupQualityDatasetFilters;
}
