import type {
  LevelEngineKind,
  LevelEngineTimeframe,
} from './level-engine.types.js';
import type {
  LevelLineStatus,
} from './level-lines.types.js';

export const LEVEL_LINES_EXACT_PRICE_ORIGIN_COLLISION_CLASSIFICATION_VERSION =
  'level-lines-exact-price-origin-collision-classification-v0.1' as const;

export type LevelLinesExactPriceOriginCollisionClassificationVersion =
  typeof LEVEL_LINES_EXACT_PRICE_ORIGIN_COLLISION_CLASSIFICATION_VERSION;

export type LevelLinesExactPriceOriginCollisionClassificationStatus =
  | 'classified_with_split_resolution'
  | 'classified_with_single_resolution_path'
  | 'classified_without_pairs'
  | 'invalid';

export type LevelLinesExactPriceOriginPairClass =
  | 'active_origin_reconfirmation'
  | 'worked_origin_retention_rearm'
  | 'post_work_independent_origin_candidate'
  | 'unresolved_coactive_origin';

export type LevelLinesExactPriceOriginResolutionDirection =
  | 'reuse_active_exact_price_identity'
  | 'retire_worked_identity_before_rearm'
  | 'validate_new_episode_identity'
  | 'collect_additional_origin_evidence';

export type LevelLinesExactPriceOriginClassificationConfidence =
  | 'strong'
  | 'insufficient';

export type LevelLinesExactPriceOriginGapBucket =
  | 'bars_1_9'
  | 'bars_10_29'
  | 'bars_30_59'
  | 'bars_60_plus';

export type LevelLinesExactPriceOriginCoactivityBucket =
  | 'one_observation'
  | 'observations_2_10'
  | 'observations_11_59'
  | 'observations_60_plus';

export type LevelLinesExactPriceOriginCollisionClassificationViolationCode =
  | 'unsupported_source_version'
  | 'invalid_source_status'
  | 'source_violation_present'
  | 'source_totals_mismatch'
  | 'duplicate_pair_key'
  | 'pair_line_membership_mismatch'
  | 'invalid_pair_order'
  | 'invalid_pair_measurement';

export interface LevelLinesExactPriceOriginCollisionClassificationViolation {
  readonly code:
    LevelLinesExactPriceOriginCollisionClassificationViolationCode;
  readonly message: string;
  readonly symbol: string | null;
  readonly groupKey: string | null;
  readonly pairKey: string | null;
}

export interface LevelLinesExactPriceOriginPairClassification {
  readonly pairKey: string;
  readonly groupKey: string;
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly kind: LevelEngineKind;
  readonly price: number;
  readonly olderLineId: string;
  readonly newerLineId: string;
  readonly olderOriginExtremumAt: string;
  readonly newerOriginExtremumAt: string;
  readonly originGapBars: number;
  readonly gapBucket:
    LevelLinesExactPriceOriginGapBucket;
  readonly firstCoactiveAt: string;
  readonly lastCoactiveAt: string;
  readonly coactiveObservationCount: number;
  readonly coactivityBucket:
    LevelLinesExactPriceOriginCoactivityBucket;
  readonly olderStatusAtFirstCoactive:
    LevelLineStatus;
  readonly newerStatusAtFirstCoactive:
    LevelLineStatus;
  readonly newerInheritedPriorExactOriginEvidence:
    boolean;
  readonly classification:
    LevelLinesExactPriceOriginPairClass;
  readonly confidence:
    LevelLinesExactPriceOriginClassificationConfidence;
  readonly resolutionDirection:
    LevelLinesExactPriceOriginResolutionDirection;
  readonly rationale: readonly string[];
}

export interface LevelLinesExactPriceOriginGroupClassificationTotals {
  readonly pairCount: number;
  readonly activeOriginReconfirmationCount: number;
  readonly workedOriginRetentionRearmCount: number;
  readonly postWorkIndependentOriginCandidateCount: number;
  readonly unresolvedCoactiveOriginCount: number;
}

export interface LevelLinesExactPriceOriginGroupClassification {
  readonly groupKey: string;
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly kind: LevelEngineKind;
  readonly price: number;
  readonly distinctLineCount: number;
  readonly maximumConcurrentLineCount: number;
  readonly observationCount: number;
  readonly classifications:
    readonly LevelLinesExactPriceOriginPairClassification[];
  readonly totals:
    LevelLinesExactPriceOriginGroupClassificationTotals;
}

export interface LevelLinesExactPriceOriginDatasetClassification {
  readonly symbol: string;
  readonly groupCount: number;
  readonly pairCount: number;
  readonly activeOriginReconfirmationCount: number;
  readonly workedOriginRetentionRearmCount: number;
  readonly postWorkIndependentOriginCandidateCount: number;
  readonly unresolvedCoactiveOriginCount: number;
  readonly classifications:
    readonly LevelLinesExactPriceOriginGroupClassification[];
}

export interface LevelLinesExactPriceOriginCollisionClassificationTotals {
  readonly symbolCount: number;
  readonly datasetCount: number;
  readonly groupCount: number;
  readonly pairCount: number;
  readonly activeOriginReconfirmationCount: number;
  readonly workedOriginRetentionRearmCount: number;
  readonly postWorkIndependentOriginCandidateCount: number;
  readonly unresolvedCoactiveOriginCount: number;
  readonly inheritedEvidencePairCount: number;
  readonly nonInheritedEvidencePairCount: number;
  readonly gapBuckets: Readonly<{
    bars1To9: number;
    bars10To29: number;
    bars30To59: number;
    bars60Plus: number;
  }>;
  readonly coactivityBuckets: Readonly<{
    oneObservation: number;
    observations2To10: number;
    observations11To59: number;
    observations60Plus: number;
  }>;
  readonly minimumOriginGapBars: number | null;
  readonly medianOriginGapBars: number | null;
  readonly maximumOriginGapBars: number | null;
  readonly minimumCoactiveObservationCount: number | null;
  readonly medianCoactiveObservationCount: number | null;
  readonly maximumCoactiveObservationCount: number | null;
  readonly violationCount: number;
}

export interface LevelLinesExactPriceOriginCollisionClassificationReport {
  readonly version:
    LevelLinesExactPriceOriginCollisionClassificationVersion;
  readonly sourceVersion:
    'level-lines-exact-price-origin-collision-diagnostics-v0.1';
  readonly sourceGeneratedAt: string;
  readonly generatedAt: string;
  readonly sourceReportHash: string | null;
  readonly datasets:
    readonly LevelLinesExactPriceOriginDatasetClassification[];
  readonly violations:
    readonly LevelLinesExactPriceOriginCollisionClassificationViolation[];
  readonly totals:
    LevelLinesExactPriceOriginCollisionClassificationTotals;
  readonly status:
    LevelLinesExactPriceOriginCollisionClassificationStatus;
  readonly allObservedPairsInheritedPriorOriginEvidence:
    boolean;
  readonly activeIdentityReuseEvidenceObserved: boolean;
  readonly workedIdentityRetentionEvidenceObserved: boolean;
  readonly requiresSplitResolutionContract: boolean;
  readonly independentOriginConfirmed: false;
  readonly recommendsSingleGlobalPriceMerge: false;
  readonly classificationOnly: true;
  readonly offlineOnly: true;
  readonly changesLevelIdentity: false;
  readonly changesTradingRules: false;
  readonly createsLiveSetup: false;
  readonly createsSignal: false;
  readonly createsTradeOrder: false;
  readonly usesFutureCandles: false;
}
