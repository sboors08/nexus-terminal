import type {
  LevelEngineKind,
} from './level-engine.types.js';
import type {
  LevelLinesDetectionOptions,
} from './level-lines.types.js';
import type {
  LevelLinesExactPriceOriginResolutionAction,
} from './level-lines-exact-price-origin-resolution.types.js';

export const LEVEL_LINES_EXACT_PRICE_ORIGIN_RESOLUTION_REAL_DATA_VALIDATION_VERSION =
  'level-lines-exact-price-origin-resolution-real-data-validation-v0.1' as const;

export type LevelLinesExactPriceOriginResolutionRealDataValidationVersion =
  typeof LEVEL_LINES_EXACT_PRICE_ORIGIN_RESOLUTION_REAL_DATA_VALIDATION_VERSION;

export type LevelLinesExactPriceOriginResolutionRealDataValidationStatus =
  | 'validated_with_observed_resolution'
  | 'validated_without_observed_resolution'
  | 'invalid';

export type LevelLinesExactPriceOriginResolutionReplayPass =
  | 'primary'
  | 'restart';

export type LevelLinesExactPriceOriginResolutionRealDataViolationCode =
  | 'source_contract_mismatch'
  | 'resolution_contract_mismatch'
  | 'history_count_mismatch'
  | 'suppressed_line_missing_from_history'
  | 'decision_scope_mismatch'
  | 'decision_action_mismatch'
  | 'residual_current_collision'
  | 'future_line_origin'
  | 'future_line_activation'
  | 'restart_replay_mismatch';

export interface LevelLinesExactPriceOriginResolutionRealDataViolation {
  readonly code:
    LevelLinesExactPriceOriginResolutionRealDataViolationCode;
  readonly symbol: string;
  readonly replayPass:
    LevelLinesExactPriceOriginResolutionReplayPass;
  readonly observedAt: string | null;
  readonly closedCandleIndex: number | null;
  readonly groupKey: string | null;
  readonly decisionKey: string | null;
  readonly lineId: string | null;
  readonly message: string;
}

export interface LevelLinesExactPriceOriginResolutionDecisionObservation {
  readonly key: string;
  readonly groupKey: string;
  readonly symbol: string;
  readonly timeframe: '1m';
  readonly kind: LevelEngineKind;
  readonly price: number;
  readonly olderLineId: string;
  readonly newerLineId: string;
  readonly action:
    LevelLinesExactPriceOriginResolutionAction;
  readonly currentLineId: string;
  readonly suppressedCurrentLineId: string;
  readonly retainedHistoryLineId: string;
  readonly firstObservedAt: string;
  readonly lastObservedAt: string;
  readonly observationCount: number;
}

export interface LevelLinesExactPriceOriginResolutionDatasetTotals {
  readonly closedCandlesCount: number;
  readonly replayStepCount: number;
  readonly restartReplayStepCount: number;
  readonly historyLineObservationCount: number;
  readonly inputCurrentLineObservationCount: number;
  readonly resolvedCurrentLineObservationCount: number;
  readonly resolutionObservationCount: number;
  readonly decisionObservationCount: number;
  readonly uniqueDecisionCount: number;
  readonly activeIdentityReuseDecisionCount: number;
  readonly workedIdentityRearmDecisionCount: number;
  readonly suppressedCurrentLineObservationCount: number;
  readonly uniqueSuppressedCurrentLineCount: number;
  readonly retainedHistoryLineObservationCount: number;
  readonly residualCurrentCollisionObservationCount: number;
  readonly residualCurrentCollisionGroupCount: number;
  readonly restartReplayMismatchCount: number;
  readonly violationCount: number;
}

export interface LevelLinesExactPriceOriginResolutionDatasetValidationReport {
  readonly symbol: string;
  readonly sourceTimeframe: '1m';
  readonly firstClosedAt: string | null;
  readonly lastClosedAt: string | null;
  readonly decisions:
    readonly LevelLinesExactPriceOriginResolutionDecisionObservation[];
  readonly violations:
    readonly LevelLinesExactPriceOriginResolutionRealDataViolation[];
  readonly primaryReplayFingerprint: string;
  readonly restartReplayFingerprint: string;
  readonly restartReplayEquivalent: boolean;
  readonly fullHistoryPreserved: boolean;
  readonly residualCurrentCollisionsObserved: boolean;
  readonly totals:
    LevelLinesExactPriceOriginResolutionDatasetTotals;
  readonly usesFutureCandles: false;
}

export interface LevelLinesExactPriceOriginResolutionRealDataTotals
  extends LevelLinesExactPriceOriginResolutionDatasetTotals {
  readonly symbolCount: number;
  readonly datasetCount: number;
}

export interface LevelLinesExactPriceOriginResolutionRealDataValidationReport {
  readonly version:
    LevelLinesExactPriceOriginResolutionRealDataValidationVersion;
  readonly sourceVersion:
    'causal-setup-real-data-validation-v0.1';
  readonly resolutionVersion:
    'level-lines-exact-price-origin-resolution-v0.1';
  readonly sourceGeneratedAt: string;
  readonly generatedAt: string;
  readonly sourceDatasetHash: string | null;
  readonly requestedSymbols: readonly string[];
  readonly datasets:
    readonly LevelLinesExactPriceOriginResolutionDatasetValidationReport[];
  readonly totals:
    LevelLinesExactPriceOriginResolutionRealDataTotals;
  readonly appliedOptions:
    LevelLinesDetectionOptions;
  readonly status:
    LevelLinesExactPriceOriginResolutionRealDataValidationStatus;
  readonly activeIdentityReuseObserved: boolean;
  readonly workedIdentityRearmObserved: boolean;
  readonly fullHistoryPreserved: boolean;
  readonly residualCurrentCollisionsObserved: boolean;
  readonly restartReplayEquivalent: boolean;
  readonly offlineOnly: true;
  readonly reusesSavedRealCandles: true;
  readonly syntheticObservationsCreated: false;
  readonly usesExactPriceOnly: true;
  readonly mergesNearbyPrices: false;
  readonly changesLevelIdentityFormula: false;
  readonly changesTradingRules: false;
  readonly createsLiveSetup: false;
  readonly createsTradeOrder: false;
  readonly createsSignal: false;
  readonly appliesTraining: false;
  readonly usesFutureCandles: false;
}
