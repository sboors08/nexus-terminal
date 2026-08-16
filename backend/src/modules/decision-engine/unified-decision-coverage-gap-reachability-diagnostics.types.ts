import type {
  SetupEngineStage,
} from '../setup-engine/setup-engine.types.js';
import type {
  UnifiedDecisionCoverageGapKind,
} from './unified-decision-coverage-gap-observation.types.js';
import type {
  UnifiedDecisionMarketAlignment,
  UnifiedDecisionState,
} from './unified-decision.types.js';

export const UNIFIED_DECISION_COVERAGE_GAP_REACHABILITY_DIAGNOSTICS_VERSION =
  'unified-decision-coverage-gap-reachability-diagnostics-v0.1' as const;

export type UnifiedDecisionCoverageGapReachabilityStatus =
  | 'observed'
  | 'reachable_not_observed'
  | 'blocked_upstream'
  | 'contract_violation';

export type UnifiedDecisionCoverageGapReachabilityReportStatus =
  | 'diagnosed'
  | 'diagnosed_with_unreached_gaps'
  | 'insufficient_observations'
  | 'contract_violations_found';

export type UnifiedDecisionCoverageGapReachabilityNodeCode =
  | 'directional_realtime_precursor'
  | 'market_context_read_available'
  | 'btc_context_computable'
  | 'impulse_context_computable'
  | 'both_market_contexts_computable'
  | 'btc_opposed'
  | 'impulse_opposed'
  | 'single_conflict_condition'
  | 'double_conflict_condition'
  | 'setup_source_available'
  | 'setup_candidate_captured'
  | 'setup_approaching_third_touch'
  | 'setup_third_touch_confirmed'
  | 'setup_terminal_outcome_captured'
  | 'setup_terminal_outcome_current'
  | 'setup_confirmed_decision';

export interface UnifiedDecisionCoverageGapReachabilityNode {
  readonly code: UnifiedDecisionCoverageGapReachabilityNodeCode;
  readonly observationCount: number;
  readonly occurrenceCount: number;
  readonly uniqueEntityCount: number;
}

export type UnifiedDecisionCoverageGapReachabilityCutoffCode =
  | 'none'
  | 'directional_realtime_precursor_not_observed'
  | 'market_context_read_not_available'
  | 'btc_context_not_computable'
  | 'impulse_context_not_computable'
  | 'opposing_market_context_not_observed'
  | 'single_conflict_combination_not_observed'
  | 'double_conflict_combination_not_observed'
  | 'setup_source_not_available'
  | 'setup_candidate_not_captured'
  | 'setup_approach_not_observed'
  | 'setup_third_touch_not_observed'
  | 'setup_terminal_transition_not_observed'
  | 'setup_terminal_expired_before_decision'
  | 'contract_violation';

export interface UnifiedDecisionCoverageGapReachabilityAssessment {
  readonly kind: UnifiedDecisionCoverageGapKind;
  readonly status: UnifiedDecisionCoverageGapReachabilityStatus;
  readonly targetObservationCount: number;
  readonly cutoff: UnifiedDecisionCoverageGapReachabilityCutoffCode;
  readonly message: string;
  readonly path: readonly UnifiedDecisionCoverageGapReachabilityNode[];
}

export type UnifiedDecisionCoverageGapReachabilityViolationCode =
  | 'observation_identity_mismatch'
  | 'market_context_capture_mismatch'
  | 'btc_alignment_mismatch'
  | 'impulse_alignment_mismatch'
  | 'single_conflict_not_downgraded'
  | 'single_conflict_contract_mismatch'
  | 'double_conflict_not_skipped'
  | 'double_conflict_contract_mismatch'
  | 'setup_confirmed_without_current_terminal'
  | 'current_terminal_not_confirmed'
  | 'setup_confirmed_causal_line_mismatch'
  | 'safety_contract_changed';

export interface UnifiedDecisionCoverageGapReachabilityViolation {
  readonly code: UnifiedDecisionCoverageGapReachabilityViolationCode;
  readonly sequence: number;
  readonly symbol: string;
  readonly recordedAt: string;
  readonly message: string;
}

export interface UnifiedDecisionCoverageGapReachabilityOptions {
  readonly startSequence?: number;
  readonly endSequence?: number;
  readonly minimumObservationCount?: number;
}

export interface UnifiedDecisionCoverageGapReachabilityAppliedOptions {
  readonly startSequence: number | null;
  readonly endSequence: number | null;
  readonly minimumObservationCount: number;
}

export interface UnifiedDecisionCoverageGapReachabilityMarketSummary {
  readonly directionalRealtimePrecursorCount: number;
  readonly marketContextReadAvailableCount: number;
  readonly btcContextComputableCount: number;
  readonly impulseContextComputableCount: number;
  readonly bothContextsComputableCount: number;
  readonly btcOpposedCount: number;
  readonly impulseOpposedCount: number;
  readonly singleConflictConditionCount: number;
  readonly doubleConflictConditionCount: number;
  readonly singleConflictDecisionCount: number;
  readonly doubleConflictDecisionCount: number;
  readonly alignmentMismatchCount: number;
  readonly sourceReadStateCounts: Readonly<Record<string, number>>;
  readonly decisionDirectionCounts: Readonly<Record<string, number>>;
  readonly btcAvailabilityCounts: Readonly<Record<string, number>>;
  readonly impulseAvailabilityCounts: Readonly<Record<string, number>>;
  readonly btcModeCounts: Readonly<Record<string, number>>;
  readonly impulseDirectionCounts: Readonly<Record<string, number>>;
  readonly btcDerivedAlignmentCounts: Readonly<Record<UnifiedDecisionMarketAlignment, number>>;
  readonly impulseDerivedAlignmentCounts: Readonly<Record<UnifiedDecisionMarketAlignment, number>>;
}

export interface UnifiedDecisionCoverageGapReachabilitySetupSummary {
  readonly sourceReadAvailableObservationCount: number;
  readonly candidateObservationCount: number;
  readonly candidateOccurrenceCount: number;
  readonly uniqueCandidateCount: number;
  readonly approachingObservationCount: number;
  readonly thirdTouchObservationCount: number;
  readonly capturedTerminalObservationCount: number;
  readonly currentTerminalObservationCount: number;
  readonly expiredTerminalObservationCount: number;
  readonly setupConfirmedObservationCount: number;
  readonly sourceReadStateCounts: Readonly<Record<string, number>>;
  readonly stageCounts: Readonly<Record<SetupEngineStage, number>>;
  readonly uniqueCandidateStageCounts: Readonly<Record<SetupEngineStage, number>>;
  readonly outcomeCounts: Readonly<Record<string, number>>;
}

export type UnifiedDecisionCoverageGapReachabilityNextAction =
  | 'none'
  | 'inspect_contract_wiring'
  | 'inspect_market_context_variation'
  | 'inspect_setup_lifecycle_reachability'
  | 'run_targeted_collection_after_diagnostics';

export interface UnifiedDecisionCoverageGapReachabilityReport {
  readonly version: typeof UNIFIED_DECISION_COVERAGE_GAP_REACHABILITY_DIAGNOSTICS_VERSION;
  readonly generatedAt: string;
  readonly status: UnifiedDecisionCoverageGapReachabilityReportStatus;
  readonly source: {
    readonly datasetVersion: string;
    readonly persistenceSchema: string | null;
    readonly persistenceVersion: number | null;
    readonly sourceSavedAt: string | null;
  };
  readonly appliedOptions: UnifiedDecisionCoverageGapReachabilityAppliedOptions;
  readonly observationCount: number;
  readonly firstSequence: number | null;
  readonly lastSequence: number | null;
  readonly firstRecordedAt: string | null;
  readonly lastRecordedAt: string | null;
  readonly symbolCounts: Readonly<Record<string, number>>;
  readonly stateCounts: Readonly<Record<UnifiedDecisionState, number>>;
  readonly market: UnifiedDecisionCoverageGapReachabilityMarketSummary;
  readonly setup: UnifiedDecisionCoverageGapReachabilitySetupSummary;
  readonly assessments: readonly UnifiedDecisionCoverageGapReachabilityAssessment[];
  readonly violationCounts: Readonly<Record<UnifiedDecisionCoverageGapReachabilityViolationCode, number>>;
  readonly violations: readonly UnifiedDecisionCoverageGapReachabilityViolation[];
  readonly nextAction: UnifiedDecisionCoverageGapReachabilityNextAction;
  readonly diagnosticOnly: true;
  readonly decisionRulesChangeRecommended: false;
  readonly thresholdsChanged: false;
  readonly rankingChanged: false;
  readonly setupLifecycleChanged: false;
  readonly createsTradeOrder: false;
  readonly createsSignal: false;
  readonly createsScore: false;
  readonly appliesLearning: false;
  readonly estimatesProfitability: false;
  readonly usesFutureData: false;
}
