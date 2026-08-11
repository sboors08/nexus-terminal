import type {
  LevelEngineKind,
} from '../level-engine/level-engine.types.js';
import type {
  LevelLineStatus,
} from '../level-engine/level-lines.types.js';
import type {
  CausalSetupRealDataLatencyStats,
  CausalSetupRealDataValidationVersion,
} from './causal-setup-real-data-validation.types.js';

export const CAUSAL_OBSERVATION_ENTRY_GEOMETRY_ANALYSIS_VERSION =
  'causal-observation-entry-geometry-analysis-v0.1' as const;

export type CausalObservationEntryGeometryAnalysisVersion =
  typeof CAUSAL_OBSERVATION_ENTRY_GEOMETRY_ANALYSIS_VERSION;

export type CausalObservationEntryPolicy =
  | 'current_progress_0_50'
  | 'progress_0_40'
  | 'progress_0_30'
  | 'progress_0_20'
  | 'progress_0_10'
  | 'geometry_before_approach';

export interface CausalObservationGeometryPoint {
  readonly observedAt: string;
  readonly observedCandleIndex: number;
  readonly lineStatus: LevelLineStatus;
  readonly lineConfirmedAt: string;
  readonly departureTrackingStartedAt: string;
  readonly levelPrice: number;
  readonly departureExtremumPrice: number;
  readonly departureExtremumObservedAt: string;
  readonly departureDistanceToLevelPercent:
    number;
  readonly currentPrice: number;
  readonly distanceToLevelPercent: number;
  readonly maxDistanceToLevelPercent: number;
  readonly progress: number;
  readonly currentObservationEligible: boolean;
  readonly insideApproachBoundary: boolean;
  readonly geometryBeforeApproachEligible:
    boolean;
}

export interface CausalObservationCurrentStagePoint {
  readonly observedAt: string;
  readonly observedCandleIndex: number;
  readonly distanceToLevelPercent: number;
  readonly progress: number | null;
}

export interface CausalObservationEntryPolicyResult {
  readonly policy: CausalObservationEntryPolicy;
  readonly entry:
    CausalObservationGeometryPoint | null;
  readonly enteredBeforeCurrentObservation:
    boolean;
  readonly leadBarsBeforeCurrentObservation:
    number | null;
  readonly retainedCurrentApproach: boolean;
  readonly lostCurrentApproach: boolean;
  readonly sameBarAsCurrentApproach: boolean;
  readonly leadBarsToCurrentApproach:
    number | null;
  readonly falseEarlyObservationWithoutApproach:
    boolean;
}

export interface CausalObservationEligibilityChurn {
  readonly sourceDisappearanceCount: number;
  readonly sourceReappearanceCount: number;
  readonly replayDisappearanceCount: number;
  readonly replayReappearanceCount: number;
  readonly progressRegressionDisappearanceCount:
    number;
  readonly geometryUnavailableDisappearanceCount:
    number;
  readonly sourceCountsMatchReplay: boolean;
}

export interface CausalObservationEntryLineAnalysis {
  readonly symbol: string;
  readonly lineId: string;
  readonly levelKind: LevelEngineKind;
  readonly levelPrice: number;
  readonly candidateCount: number;
  readonly currentObservation:
    CausalObservationCurrentStagePoint;
  readonly currentApproach:
    CausalObservationCurrentStagePoint | null;
  readonly earliestGeometry:
    CausalObservationGeometryPoint | null;
  readonly geometryTrace:
    readonly CausalObservationGeometryPoint[];
  readonly policies:
    readonly CausalObservationEntryPolicyResult[];
  readonly churn:
    CausalObservationEligibilityChurn;
}

export interface CausalObservationEntryPolicyTotals {
  readonly policy: CausalObservationEntryPolicy;
  readonly entryCount: number;
  readonly entryBeforeCurrentObservationCount:
    number;
  readonly retainedCurrentApproachCount: number;
  readonly lostCurrentApproachCount: number;
  readonly sameBarAsCurrentApproachCount: number;
  readonly falseEarlyObservationWithoutApproachCount:
    number;
  readonly leadBarsBeforeCurrentObservation:
    CausalSetupRealDataLatencyStats;
  readonly leadBarsToCurrentApproach:
    CausalSetupRealDataLatencyStats;
}

export interface CausalObservationChurnTotals {
  readonly sourceDisappearanceCount: number;
  readonly sourceReappearanceCount: number;
  readonly replayDisappearanceCount: number;
  readonly replayReappearanceCount: number;
  readonly progressRegressionDisappearanceCount:
    number;
  readonly geometryUnavailableDisappearanceCount:
    number;
  readonly linesWithSourceReplayMismatch: number;
  readonly progressRegressionShareOfReplayDisappearance:
    number | null;
}

export interface CausalObservationEntrySymbolAnalysis {
  readonly symbol: string;
  readonly lines:
    readonly CausalObservationEntryLineAnalysis[];
  readonly policies:
    readonly CausalObservationEntryPolicyTotals[];
  readonly churn: CausalObservationChurnTotals;
}

export interface CausalObservationEntryGeometryTotals {
  readonly symbolCount: number;
  readonly uniqueLineCount: number;
  readonly candidateTrackCount: number;
  readonly candidatePairAnomalyCount: number;
  readonly currentObservationReplayAnomalyCount:
    number;
  readonly policies:
    readonly CausalObservationEntryPolicyTotals[];
  readonly churn: CausalObservationChurnTotals;
}

export interface CausalObservationEntryGeometryAnalysisReport {
  readonly version:
    CausalObservationEntryGeometryAnalysisVersion;
  readonly sourceValidationVersion:
    CausalSetupRealDataValidationVersion;
  readonly generatedAt: string;
  readonly requestedSymbols: readonly string[];
  readonly progressThresholds:
    readonly [0.5, 0.4, 0.3, 0.2, 0.1];
  readonly symbolReports:
    readonly CausalObservationEntrySymbolAnalysis[];
  readonly totals:
    CausalObservationEntryGeometryTotals;
  readonly offlineOnly: true;
  readonly reusesFetchedDatasets: true;
  readonly comparesPoliciesOnly: true;
  readonly changesTradingRules: false;
  readonly createsLiveSetup: false;
  readonly createsSignal: false;
  readonly usesQualityScore: false;
  readonly appliesTraining: false;
  readonly usesFutureCandles: false;
  readonly usesFutureCandlesForEntry: false;
  readonly usesFutureRealtimeEvidence: false;
}
