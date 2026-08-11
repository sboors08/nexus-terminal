import type {
  LevelEngineKind,
} from '../level-engine/level-engine.types.js';
import type {
  CausalSetupRealDataLatencyStats,
  CausalSetupRealDataValidationVersion,
} from './causal-setup-real-data-validation.types.js';

export const CAUSAL_STAGE_BOUNDARY_ANALYSIS_VERSION =
  'causal-stage-boundary-analysis-v0.1' as const;

export type CausalStageBoundaryAnalysisVersion =
  typeof CAUSAL_STAGE_BOUNDARY_ANALYSIS_VERSION;

export type CausalStageBoundaryPolicy =
  | 'current_same_snapshot'
  | 'next_closed_candle'
  | 'outside_to_inside_crossing';

export type CausalStageBoundarySameBarReason =
  | 'entered_boundary_on_observation_candle'
  | 'already_inside_boundary_before_observation'
  | 'previous_closed_candle_unavailable';

export interface CausalStageBoundaryPoint {
  readonly observedAt: string;
  readonly observedCandleIndex: number;
  readonly distanceToLevelPercent: number;
  readonly maxDistanceToLevelPercent: number;
  readonly observationProgress: number | null;
  readonly lagFromObservationBars: number;
}

export interface CausalStageBoundaryPreviousCandle {
  readonly observedAt: string;
  readonly observedCandleIndex: number;
  readonly close: number;
  readonly distanceToLevelPercent: number;
  readonly insideApproachBoundary: boolean;
}

export interface CausalStageBoundaryLineChurn {
  readonly scanObservationCount: number;
  readonly disappearanceCount: number;
  readonly reappearanceCount: number;
  readonly presentAtEnd: boolean;
}

export interface CausalStageBoundaryLineAnalysis {
  readonly symbol: string;
  readonly lineId: string;
  readonly levelKind: LevelEngineKind;
  readonly levelPrice: number;
  readonly candidateCount: number;
  readonly setupTypes:
    readonly ('level_breakout' | 'level_bounce')[];
  readonly directions:
    readonly ('long' | 'short')[];
  readonly observation:
    CausalStageBoundaryPoint;
  readonly previousClosedCandle:
    CausalStageBoundaryPreviousCandle | null;
  readonly currentApproach:
    CausalStageBoundaryPoint | null;
  readonly nextClosedCandleApproach:
    CausalStageBoundaryPoint | null;
  readonly outsideToInsideCrossingApproach:
    CausalStageBoundaryPoint | null;
  readonly sameBarReason:
    CausalStageBoundarySameBarReason | null;
  readonly churn:
    CausalStageBoundaryLineChurn;
}

export interface CausalStageBoundaryPolicyTotals {
  readonly policy: CausalStageBoundaryPolicy;
  readonly approachCount: number;
  readonly sameBarApproachCount: number;
  readonly delayedApproachCount: number;
  readonly neverApproachCount: number;
  readonly retainedCurrentApproachCount: number;
  readonly delayedFromCurrentCount: number;
  readonly lostFromCurrentCount: number;
  readonly newComparedWithCurrentCount: number;
  readonly observationToApproachBars:
    CausalSetupRealDataLatencyStats;
}

export interface CausalStageBoundaryChurnTotals {
  readonly disappearanceCount: number;
  readonly reappearanceCount: number;
  readonly linesWithDisappearance: number;
  readonly linesWithReappearance: number;
  readonly linesWithMultipleReappearances: number;
  readonly linesPresentAtEnd: number;
  readonly linesAbsentAtEnd: number;
}

export interface CausalStageBoundarySameBarReasonTotals {
  readonly enteredBoundaryOnObservationCandle: number;
  readonly alreadyInsideBoundaryBeforeObservation: number;
  readonly previousClosedCandleUnavailable: number;
}

export interface CausalStageBoundaryTotals {
  readonly symbolCount: number;
  readonly uniqueLineCount: number;
  readonly candidateTrackCount: number;
  readonly candidatePairAnomalyCount: number;
  readonly current:
    CausalStageBoundaryPolicyTotals;
  readonly nextClosedCandle:
    CausalStageBoundaryPolicyTotals;
  readonly outsideToInsideCrossing:
    CausalStageBoundaryPolicyTotals;
  readonly sameBarReasons:
    CausalStageBoundarySameBarReasonTotals;
  readonly churn:
    CausalStageBoundaryChurnTotals;
}

export interface CausalStageBoundarySymbolAnalysis {
  readonly symbol: string;
  readonly lines:
    readonly CausalStageBoundaryLineAnalysis[];
  readonly current:
    CausalStageBoundaryPolicyTotals;
  readonly nextClosedCandle:
    CausalStageBoundaryPolicyTotals;
  readonly outsideToInsideCrossing:
    CausalStageBoundaryPolicyTotals;
  readonly sameBarReasons:
    CausalStageBoundarySameBarReasonTotals;
  readonly churn:
    CausalStageBoundaryChurnTotals;
}

export interface CausalStageBoundaryAnalysisReport {
  readonly version:
    CausalStageBoundaryAnalysisVersion;
  readonly sourceValidationVersion:
    CausalSetupRealDataValidationVersion;
  readonly generatedAt: string;
  readonly requestedSymbols: readonly string[];
  readonly symbolReports:
    readonly CausalStageBoundarySymbolAnalysis[];
  readonly totals:
    CausalStageBoundaryTotals;
  readonly offlineOnly: true;
  readonly reusesFetchedDatasets: true;
  readonly comparesPoliciesOnly: true;
  readonly changesTradingRules: false;
  readonly createsLiveSetup: false;
  readonly createsSignal: false;
  readonly usesQualityScore: false;
  readonly appliesTraining: false;
  readonly usesFutureCandles: false;
  readonly usesFutureRealtimeEvidence: false;
}
