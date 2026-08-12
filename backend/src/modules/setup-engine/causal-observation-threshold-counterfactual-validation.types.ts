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

export const CAUSAL_OBSERVATION_THRESHOLD_COUNTERFACTUAL_VALIDATION_VERSION =
  'causal-observation-threshold-counterfactual-validation-v0.1' as const;

export type CausalObservationThresholdCounterfactualValidationVersion =
  typeof CAUSAL_OBSERVATION_THRESHOLD_COUNTERFACTUAL_VALIDATION_VERSION;

export type CausalObservationThresholdPolicy =
  | 'progress_0_50'
  | 'progress_0_40'
  | 'progress_0_30'
  | 'progress_0_20'
  | 'progress_0_10';

export type CausalObservationThresholdEpisodeEndReason =
  | 'progress_regression'
  | 'geometry_unavailable'
  | 'dataset_end';

export interface CausalObservationThresholdGeometryPoint {
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
  readonly insideApproachBoundary: boolean;
}

export interface CausalObservationThresholdStagePoint {
  readonly observedAt: string;
  readonly observedCandleIndex: number;
  readonly distanceToLevelPercent: number;
  readonly progress: number | null;
}

export interface CausalObservationThresholdEpisodeExit {
  readonly observedAt: string;
  readonly observedCandleIndex: number;
  readonly reason:
    Exclude<
      CausalObservationThresholdEpisodeEndReason,
      'dataset_end'
    >;
}

export interface CausalObservationThresholdEpisode {
  readonly entry:
    CausalObservationThresholdGeometryPoint;
  readonly firstApproach:
    CausalObservationThresholdGeometryPoint | null;
  readonly exit:
    CausalObservationThresholdEpisodeExit | null;
  readonly endedBy:
    CausalObservationThresholdEpisodeEndReason;
  readonly continuousObservationBars: number;
  readonly barsToApproach: number | null;
  readonly sameBarApproach: boolean;
}

export interface CausalObservationThresholdPolicyChurn {
  readonly disappearanceCount: number;
  readonly reappearanceCount: number;
  readonly progressRegressionDisappearanceCount:
    number;
  readonly geometryUnavailableDisappearanceCount:
    number;
}

export interface CausalObservationThresholdLinePolicyResult {
  readonly policy:
    CausalObservationThresholdPolicy;
  readonly threshold: number;
  readonly entered: boolean;
  readonly currentCandidateEntry: boolean;
  readonly additionalCounterfactualEntry:
    boolean;
  readonly firstEntry:
    CausalObservationThresholdGeometryPoint | null;
  readonly firstApproach:
    CausalObservationThresholdGeometryPoint | null;
  readonly reachedApproach: boolean;
  readonly noSubsequentApproach: boolean;
  readonly sameBarApproach: boolean;
  readonly barsToApproach: number | null;
  readonly episodes:
    readonly CausalObservationThresholdEpisode[];
  readonly churn:
    CausalObservationThresholdPolicyChurn;
}

export interface CausalObservationThresholdLineAnalysis {
  readonly symbol: string;
  readonly lineId: string;
  readonly levelKind: LevelEngineKind;
  readonly levelPrice: number;
  readonly levelConfirmedAt: string;
  readonly firstGeometry:
    CausalObservationThresholdGeometryPoint;
  readonly lastGeometry:
    CausalObservationThresholdGeometryPoint;
  readonly geometryObservationCount: number;
  readonly currentCandidate: boolean;
  readonly currentCandidateCount: number;
  readonly currentObservation:
    CausalObservationThresholdStagePoint | null;
  readonly currentApproach:
    CausalObservationThresholdStagePoint | null;
  readonly policies:
    readonly CausalObservationThresholdLinePolicyResult[];
}

export interface CausalObservationThresholdPolicyTotals {
  readonly policy:
    CausalObservationThresholdPolicy;
  readonly threshold: number;
  readonly universeLineCount: number;
  readonly currentCandidateLineCount: number;
  readonly entryLineCount: number;
  readonly currentCandidateEntryLineCount: number;
  readonly currentCandidateMissedLineCount: number;
  readonly additionalCounterfactualEntryLineCount:
    number;
  readonly approachReachedLineCount: number;
  readonly noSubsequentApproachLineCount: number;
  readonly approachRate: number | null;
  readonly noSubsequentApproachRate: number | null;
  readonly currentCandidateApproachReachedLineCount:
    number;
  readonly currentCandidateNoApproachLineCount:
    number;
  readonly additionalApproachReachedLineCount:
    number;
  readonly additionalNoApproachLineCount: number;
  readonly additionalApproachRate: number | null;
  readonly sameBarApproachLineCount: number;
  readonly sameBarApproachRate: number | null;
  readonly entryEpisodeCount: number;
  readonly episodesWithApproachCount: number;
  readonly episodesWithoutApproachCount: number;
  readonly barsToApproach:
    CausalSetupRealDataLatencyStats;
  readonly continuousObservationBars:
    CausalSetupRealDataLatencyStats;
  readonly churn:
    CausalObservationThresholdPolicyChurn;
  readonly disappearancePerEntryLine: number | null;
  readonly reappearancePerEntryLine: number | null;
}

export interface CausalObservationThresholdReplayAnomalies {
  readonly duplicateActiveLineIdCount: number;
  readonly lineIdentityAnomalyCount: number;
  readonly departureContractAnomalyCount: number;
  readonly currentCandidatePairAnomalyCount:
    number;
  readonly currentCandidateWithoutUniverseLineCount:
    number;
  readonly currentPolicyEntryWithoutCandidateLineCount:
    number;
  readonly currentObservationReplayAnomalyCount:
    number;
  readonly currentApproachReplayAnomalyCount:
    number;
  readonly totalCount: number;
}

export interface CausalObservationThresholdSymbolAnalysis {
  readonly symbol: string;
  readonly lines:
    readonly CausalObservationThresholdLineAnalysis[];
  readonly policies:
    readonly CausalObservationThresholdPolicyTotals[];
  readonly anomalies:
    CausalObservationThresholdReplayAnomalies;
}

export interface CausalObservationThresholdCounterfactualTotals {
  readonly symbolCount: number;
  readonly universeLineCount: number;
  readonly currentCandidateLineCount: number;
  readonly nonCandidateUniverseLineCount: number;
  readonly candidateTrackCount: number;
  readonly policies:
    readonly CausalObservationThresholdPolicyTotals[];
  readonly anomalies:
    CausalObservationThresholdReplayAnomalies;
}

export interface CausalObservationThresholdCounterfactualValidationReport {
  readonly version:
    CausalObservationThresholdCounterfactualValidationVersion;
  readonly sourceValidationVersion:
    CausalSetupRealDataValidationVersion;
  readonly generatedAt: string;
  readonly requestedSymbols: readonly string[];
  readonly progressThresholds:
    readonly [0.5, 0.4, 0.3, 0.2, 0.1];
  readonly symbolReports:
    readonly CausalObservationThresholdSymbolAnalysis[];
  readonly totals:
    CausalObservationThresholdCounterfactualTotals;
  readonly offlineOnly: true;
  readonly reusesFetchedDatasets: true;
  readonly buildsUniverseFromProductionLevelLines:
    true;
  readonly comparesPoliciesOnly: true;
  readonly changesTradingRules: false;
  readonly createsLiveSetup: false;
  readonly createsSignal: false;
  readonly usesQualityScore: false;
  readonly appliesTraining: false;
  readonly usesFutureCandlesForEntry: false;
  readonly usesFutureCandlesForOutcomeEvaluation:
    true;
  readonly usesFutureRealtimeEvidence: false;
}
