import type {
  LevelEngineKind,
} from '../level-engine/level-engine.types.js';
import type {
  LevelEngineRealDataValidationReport,
  LevelEngineValidationDatasetSnapshot,
} from '../level-engine/level-engine-real-data-validation.types.js';
import type {
  LevelLinesDetectionOptions,
} from '../level-engine/level-lines.types.js';
import type {
  UnifiedDecisionCausalStage,
  UnifiedDecisionDirection,
  UnifiedDecisionInvalidation,
  UnifiedDecisionMissingConfirmation,
  UnifiedDecisionReason,
  UnifiedDecisionScenario,
  UnifiedDecisionState,
} from './unified-decision.types.js';

export const UNIFIED_DECISION_REAL_DATA_VALIDATION_VERSION =
  'unified-decision-real-data-validation-v0.1' as const;

export type UnifiedDecisionRealDataValidationVersion =
  typeof UNIFIED_DECISION_REAL_DATA_VALIDATION_VERSION;

export type UnifiedDecisionHistoricalSourceMode =
  'unavailable';

export interface UnifiedDecisionRealDataValidationOptions {
  readonly startAtClosedCandleCount?: number;
  readonly levelLinesOptions?:
    LevelLinesDetectionOptions;
}

export interface UnifiedDecisionRealDataValidationAppliedOptions {
  readonly startAtClosedCandleCount: number;
  readonly levelLinesOptions:
    LevelLinesDetectionOptions;
  readonly historicalRealtimeTapeMode:
    UnifiedDecisionHistoricalSourceMode;
  readonly historicalOrderBookMode:
    UnifiedDecisionHistoricalSourceMode;
  readonly historicalSetupLifecycleMode:
    UnifiedDecisionHistoricalSourceMode;
  readonly historicalBtcMarketMode:
    UnifiedDecisionHistoricalSourceMode;
  readonly historicalSymbolImpulseMode:
    UnifiedDecisionHistoricalSourceMode;
}

export interface UnifiedDecisionValidationSourceReference {
  readonly availability: 'unavailable';
  readonly observedAt: null;
}

export interface UnifiedDecisionValidationObservationSources {
  readonly candleCloseAt: string;
  readonly realtimeTape:
    UnifiedDecisionValidationSourceReference;
  readonly orderBook:
    UnifiedDecisionValidationSourceReference;
  readonly setupLifecycle:
    UnifiedDecisionValidationSourceReference;
  readonly btcMarketMode:
    UnifiedDecisionValidationSourceReference;
  readonly symbolImpulse:
    UnifiedDecisionValidationSourceReference;
}

export interface UnifiedDecisionValidationObservation {
  readonly observationIndex: number;
  readonly closedCandleCount: number;
  readonly observedCandleIndex: number;
  readonly observedAt: string;
  readonly currentPrice: number | null;
  readonly state: UnifiedDecisionState;
  readonly direction: UnifiedDecisionDirection;
  readonly scenario: UnifiedDecisionScenario;
  readonly causalStage: UnifiedDecisionCausalStage;
  readonly lineId: string | null;
  readonly levelKind: LevelEngineKind | null;
  readonly reasons:
    readonly UnifiedDecisionReason[];
  readonly missingConfirmations:
    readonly UnifiedDecisionMissingConfirmation[];
  readonly invalidations:
    readonly UnifiedDecisionInvalidation[];
  readonly sources:
    UnifiedDecisionValidationObservationSources;
}

export interface UnifiedDecisionValidationTransition {
  readonly transitionIndex: number;
  readonly observationIndex: number;
  readonly observedAt: string;
  readonly fromState: UnifiedDecisionState | null;
  readonly toState: UnifiedDecisionState;
  readonly fromLineId: string | null;
  readonly toLineId: string | null;
}

export type UnifiedDecisionValidationViolationCode =
  | 'non_deterministic_decision'
  | 'future_decision_timestamp'
  | 'future_source_timestamp'
  | 'level_line_not_in_prefix'
  | 'level_context_mismatch'
  | 'unsupported_offline_state'
  | 'scenario_without_historical_realtime_evidence'
  | 'setup_confirmed_without_terminal_outcome'
  | 'available_market_context_without_source'
  | 'safety_contract_changed';

export interface UnifiedDecisionValidationViolation {
  readonly code:
    UnifiedDecisionValidationViolationCode;
  readonly symbol: string;
  readonly observedCandleIndex: number;
  readonly observedAt: string;
  readonly message: string;
}

export type UnifiedDecisionStateCounts =
  Readonly<Record<UnifiedDecisionState, number>>;

export type UnifiedDecisionScenarioCounts =
  Readonly<Record<'none' | 'bounce' | 'breakout', number>>;

export type UnifiedDecisionDirectionCounts =
  Readonly<Record<'none' | 'long' | 'short', number>>;

export type UnifiedDecisionCausalStageCounts =
  Readonly<Record<
    'none' | Exclude<UnifiedDecisionCausalStage, null>,
    number
  >>;

export type UnifiedDecisionLevelKindCounts =
  Readonly<Record<'none' | LevelEngineKind, number>>;

export interface UnifiedDecisionValidationTotals {
  readonly replayStepCount: number;
  readonly uniqueDecisionLineCount: number;
  readonly stateCounts:
    UnifiedDecisionStateCounts;
  readonly scenarioCounts:
    UnifiedDecisionScenarioCounts;
  readonly directionCounts:
    UnifiedDecisionDirectionCounts;
  readonly causalStageCounts:
    UnifiedDecisionCausalStageCounts;
  readonly levelKindCounts:
    UnifiedDecisionLevelKindCounts;
  readonly reasonCounts:
    Readonly<Record<UnifiedDecisionReason, number>>;
  readonly missingConfirmationCounts:
    Readonly<Record<UnifiedDecisionMissingConfirmation, number>>;
  readonly invalidationCounts:
    Readonly<Record<UnifiedDecisionInvalidation, number>>;
  readonly marketContextConflictObservationCount: number;
  readonly transitionCount: number;
  readonly lineTransitionCount: number;
  readonly deterministicMismatchCount: number;
  readonly futureLeakageCount: number;
  readonly unsupportedOfflineStateCount: number;
  readonly violationCount: number;
}

export interface UnifiedDecisionEmpiricalCoverage {
  readonly realtimeEvidenceObservationCount: number;
  readonly setupOutcomeObservationCount: number;
  readonly btcContextObservationCount: number;
  readonly impulseContextObservationCount: number;
  readonly possibleDirectionObservationCount: number;
  readonly setupConfirmedObservationCount: number;
  readonly staleContextObservationCount: number;
  readonly scenarioSymmetryValidatedFromRealObservations: boolean;
  readonly staleDowngradeValidatedFromRealObservations: boolean;
  readonly setupOutcomeValidatedFromRealObservations: boolean;
  readonly requiresLiveObservationDataset: boolean;
}

export interface UnifiedDecisionScenarioSymmetryCoverage {
  readonly levelKind: LevelEngineKind;
  readonly scenario: Exclude<UnifiedDecisionScenario, null>;
  readonly expectedDirection:
    Exclude<UnifiedDecisionDirection, null>;
  readonly realObservationCount: number;
}

export interface UnifiedDecisionDatasetValidationReport {
  readonly symbol: string;
  readonly sourceTimeframe: '1m';
  readonly closedCandlesCount: number;
  readonly ignoredOpenCandlesCount: number;
  readonly firstClosedAt: string | null;
  readonly lastClosedAt: string | null;
  readonly observations:
    readonly UnifiedDecisionValidationObservation[];
  readonly transitions:
    readonly UnifiedDecisionValidationTransition[];
  readonly violations:
    readonly UnifiedDecisionValidationViolation[];
  readonly totals:
    UnifiedDecisionValidationTotals;
  readonly empiricalCoverage:
    UnifiedDecisionEmpiricalCoverage;
  readonly scenarioSymmetry:
    readonly UnifiedDecisionScenarioSymmetryCoverage[];
  readonly appliedOptions:
    UnifiedDecisionRealDataValidationAppliedOptions;
  readonly historicalRealtimeEvidenceAvailable: false;
  readonly historicalSetupLifecycleAvailable: false;
  readonly historicalMarketContextAvailable: false;
  readonly validatesOfflineFallback: true;
  readonly validatesPossibleDirectionScenarios: false;
  readonly validatesSetupOutcomes: false;
  readonly usesFutureCandles: false;
  readonly usesFutureSourceEvidence: false;
}

export interface UnifiedDecisionSymbolValidationReport {
  readonly symbol: string;
  readonly dataset:
    UnifiedDecisionDatasetValidationReport;
}

export interface UnifiedDecisionRealDataValidationTotals
  extends UnifiedDecisionValidationTotals {
  readonly symbolCount: number;
  readonly datasetCount: number;
  readonly closedCandlesCount: number;
  readonly ignoredOpenCandlesCount: number;
}

export interface UnifiedDecisionRealDataValidationReport {
  readonly version:
    UnifiedDecisionRealDataValidationVersion;
  readonly sourceValidationVersion:
    LevelEngineRealDataValidationReport['version'];
  readonly generatedAt: string;
  readonly requestedSymbols: readonly string[];
  readonly sourceDatasets:
    readonly LevelEngineValidationDatasetSnapshot[];
  readonly symbolReports:
    readonly UnifiedDecisionSymbolValidationReport[];
  readonly totals:
    UnifiedDecisionRealDataValidationTotals;
  readonly empiricalCoverage:
    UnifiedDecisionEmpiricalCoverage;
  readonly scenarioSymmetry:
    readonly UnifiedDecisionScenarioSymmetryCoverage[];
  readonly appliedOptions:
    UnifiedDecisionRealDataValidationAppliedOptions;
  readonly offlineOnly: true;
  readonly reusesFetchedDatasets: true;
  readonly historicalRealtimeEvidenceAvailable: false;
  readonly historicalSetupLifecycleAvailable: false;
  readonly historicalMarketContextAvailable: false;
  readonly validatesOfflineFallback: true;
  readonly validatesPossibleDirectionScenarios: false;
  readonly validatesSetupOutcomes: false;
  readonly changesTradingRules: false;
  readonly createsLiveDecision: false;
  readonly createsTradeOrder: false;
  readonly createsSetup: false;
  readonly createsSignal: false;
  readonly createsScore: false;
  readonly estimatesProfitability: false;
  readonly appliesTraining: false;
  readonly usesFutureCandles: false;
  readonly usesFutureSourceEvidence: false;
}
