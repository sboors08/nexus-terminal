import type {
  LevelEngineKind,
  LevelEngineTimeframe,
} from './level-engine.types.js';
import type {
  LevelLineStatus,
  LevelLinesDetectionOptions,
} from './level-lines.types.js';

export const LEVEL_LINES_EXACT_PRICE_ORIGIN_COLLISION_DIAGNOSTICS_VERSION =
  'level-lines-exact-price-origin-collision-diagnostics-v0.1' as const;

export type LevelLinesExactPriceOriginCollisionDiagnosticsVersion =
  typeof LEVEL_LINES_EXACT_PRICE_ORIGIN_COLLISION_DIAGNOSTICS_VERSION;

export type LevelLinesExactPriceOriginCollisionDiagnosticsStatus =
  | 'diagnosed_with_collisions'
  | 'diagnosed_without_collisions'
  | 'invalid';

export type LevelLinesExactPriceOriginCollisionViolationCode =
  | 'source_contract_mismatch'
  | 'duplicate_line_id_in_snapshot'
  | 'line_id_formula_mismatch'
  | 'line_price_origin_mismatch'
  | 'future_line_origin'
  | 'future_line_activation'
  | 'collision_scope_mismatch'
  | 'duplicate_origin_identity';

export interface LevelLinesExactPriceOriginCollisionViolation {
  readonly code:
    LevelLinesExactPriceOriginCollisionViolationCode;
  readonly symbol: string;
  readonly observedAt: string | null;
  readonly groupKey: string | null;
  readonly lineId: string | null;
  readonly message: string;
}

export interface LevelLinesExactPriceOriginCollisionLineSnapshot {
  readonly lineId: string;
  readonly symbol: string;
  readonly timeframe:
    LevelEngineTimeframe;
  readonly kind: LevelEngineKind;
  readonly price: number;
  readonly originCandleIndex: number;
  readonly originExtremumAt: string;
  readonly activeFrom: string;
  readonly confirmedAt: string | null;
  readonly workedAt: string | null;
  readonly touchCount: number;
  readonly status: LevelLineStatus;
  readonly inheritedPriorExactOriginEvidence:
    boolean;
}

export interface LevelLinesExactPriceOriginCollisionEpisode {
  readonly startedAt: string;
  readonly lastObservedAt: string;
  readonly firstObservedCandleIndex: number;
  readonly lastObservedCandleIndex: number;
  readonly observationCount: number;
  readonly membershipSignature: string;
  readonly lineCount: number;
  readonly lineIds: readonly string[];
  readonly lines:
    readonly LevelLinesExactPriceOriginCollisionLineSnapshot[];
}

export interface LevelLinesExactPriceOriginCollisionPairReport {
  readonly key: string;
  readonly olderLineId: string;
  readonly newerLineId: string;
  readonly olderOriginExtremumAt: string;
  readonly newerOriginExtremumAt: string;
  readonly originGapBars: number;
  readonly firstCoactiveAt: string;
  readonly lastCoactiveAt: string;
  readonly coactiveObservationCount: number;
  readonly olderStatusAtFirstCoactive:
    LevelLineStatus;
  readonly newerStatusAtFirstCoactive:
    LevelLineStatus;
  readonly newerInheritedPriorExactOriginEvidence:
    boolean;
}

export interface LevelLinesExactPriceOriginCollisionGroupReport {
  readonly key: string;
  readonly symbol: string;
  readonly timeframe:
    LevelEngineTimeframe;
  readonly kind: LevelEngineKind;
  readonly price: number;
  readonly firstObservedAt: string;
  readonly lastObservedAt: string;
  readonly observationCount: number;
  readonly maximumConcurrentLineCount: number;
  readonly distinctLineCount: number;
  readonly distinctLineIds: readonly string[];
  readonly originCandleIndices:
    readonly number[];
  readonly originExtremumAts:
    readonly string[];
  readonly membershipTransitionCount: number;
  readonly inheritedPriorExactOriginLineCount:
    number;
  readonly episodes:
    readonly LevelLinesExactPriceOriginCollisionEpisode[];
  readonly pairs:
    readonly LevelLinesExactPriceOriginCollisionPairReport[];
}

export interface LevelLinesExactPriceOriginCollisionDatasetTotals {
  readonly closedCandlesCount: number;
  readonly replayStepCount: number;
  readonly activeLineObservationCount: number;
  readonly collisionObservationCount: number;
  readonly collisionGroupCount: number;
  readonly collisionEpisodeCount: number;
  readonly collisionPairCount: number;
  readonly uniqueCollidingLineCount: number;
  readonly inheritedPriorExactOriginLineCount:
    number;
  readonly maximumConcurrentLineCount: number;
  readonly violationCount: number;
}

export interface LevelLinesExactPriceOriginCollisionDatasetReport {
  readonly symbol: string;
  readonly sourceTimeframe: '1m';
  readonly firstClosedAt: string | null;
  readonly lastClosedAt: string | null;
  readonly groups:
    readonly LevelLinesExactPriceOriginCollisionGroupReport[];
  readonly violations:
    readonly LevelLinesExactPriceOriginCollisionViolation[];
  readonly totals:
    LevelLinesExactPriceOriginCollisionDatasetTotals;
  readonly usesFutureCandles: false;
}

export interface LevelLinesExactPriceOriginCollisionDiagnosticsTotals
  extends LevelLinesExactPriceOriginCollisionDatasetTotals {
  readonly symbolCount: number;
  readonly datasetCount: number;
}

export interface LevelLinesExactPriceOriginCollisionDiagnosticsReport {
  readonly version:
    LevelLinesExactPriceOriginCollisionDiagnosticsVersion;
  readonly sourceVersion:
    'causal-setup-real-data-validation-v0.1';
  readonly sourceGeneratedAt: string;
  readonly generatedAt: string;
  readonly sourceDatasetHash: string | null;
  readonly requestedSymbols: readonly string[];
  readonly datasets:
    readonly LevelLinesExactPriceOriginCollisionDatasetReport[];
  readonly totals:
    LevelLinesExactPriceOriginCollisionDiagnosticsTotals;
  readonly appliedOptions:
    LevelLinesDetectionOptions;
  readonly status:
    LevelLinesExactPriceOriginCollisionDiagnosticsStatus;
  readonly exactPriceCollisionsObserved: boolean;
  readonly repeatedOriginWhilePriorLineActiveObserved:
    boolean;
  readonly independentStructureConfirmed: false;
  readonly duplicateOriginConfirmed: false;
  readonly recommendsImmediatePriceMerge: false;
  readonly offlineOnly: true;
  readonly reusesSavedRealCandles: true;
  readonly syntheticObservationsCreated: false;
  readonly changesLevelIdentity: false;
  readonly changesTradingRules: false;
  readonly createsLiveSetup: false;
  readonly createsTradeOrder: false;
  readonly createsSignal: false;
  readonly usesFutureCandles: false;
}
