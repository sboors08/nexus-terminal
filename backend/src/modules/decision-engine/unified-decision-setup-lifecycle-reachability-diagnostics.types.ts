import type {
  SetupCausalStage,
} from '../setup-engine/causal-setup-adapter.types.js';
import type {
  SetupEngineStage,
} from '../setup-engine/setup-engine.types.js';

export const UNIFIED_DECISION_SETUP_LIFECYCLE_REACHABILITY_DIAGNOSTICS_VERSION =
  'unified-decision-setup-lifecycle-reachability-diagnostics-v0.1' as const;

export type UnifiedDecisionSetupLifecycleReachabilityReportStatus =
  | 'diagnosed'
  | 'diagnosed_with_unreached_stages'
  | 'insufficient_observations'
  | 'contract_violations_found';

export type UnifiedDecisionSetupLifecycleReachabilityCutoffCode =
  | 'none'
  | 'setup_source_not_available'
  | 'setup_candidate_not_captured'
  | 'candidate_first_seen_after_expiry'
  | 'causal_observation_not_captured'
  | 'causal_approach_not_observed'
  | 'runtime_approach_stage_not_captured'
  | 'causal_confirmation_not_observed'
  | 'runtime_third_touch_stage_not_captured'
  | 'terminal_outcome_not_observed'
  | 'contract_violation';

export type UnifiedDecisionSetupLifecycleReachabilityDiagnosis =
  | 'fully_reached'
  | 'source_unavailable'
  | 'candidate_generation_not_observed'
  | 'retention_currentness_mismatch'
  | 'market_approach_not_observed'
  | 'runtime_transition_wiring_mismatch'
  | 'realtime_confirmation_not_observed'
  | 'terminal_outcome_not_observed'
  | 'contract_violation';

export type UnifiedDecisionSetupLifecycleReachabilityNextAction =
  | 'none'
  | 'inspect_setup_source_wiring'
  | 'inspect_candidate_creation_timing'
  | 'inspect_causal_approach_reachability'
  | 'inspect_runtime_transition_wiring'
  | 'run_short_targeted_live_check'
  | 'inspect_contract_invariants';

export type UnifiedDecisionSetupLifecycleReachabilityViolationCode =
  | 'invalid_candidate_timestamp'
  | 'candidate_timestamp_after_observation'
  | 'candidate_identity_changed'
  | 'candidate_stage_regressed'
  | 'causal_timestamp_after_observation'
  | 'causal_line_identity_changed'
  | 'causal_stage_regressed'
  | 'causal_stage_ahead_of_runtime_stage'
  | 'runtime_stage_without_causal_evidence'
  | 'safety_contract_changed';

export interface UnifiedDecisionSetupLifecycleReachabilityViolation {
  readonly code: UnifiedDecisionSetupLifecycleReachabilityViolationCode;
  readonly sequence: number;
  readonly symbol: string;
  readonly candidateId: string | null;
  readonly recordedAt: string;
  readonly message: string;
}

export interface UnifiedDecisionSetupLifecycleReachabilityOptions {
  readonly startSequence?: number;
  readonly endSequence?: number;
  readonly minimumObservationCount?: number;
}

export interface UnifiedDecisionSetupLifecycleReachabilityAppliedOptions {
  readonly startSequence: number | null;
  readonly endSequence: number | null;
  readonly minimumObservationCount: number;
}

export interface UnifiedDecisionSetupLifecycleReachabilityStageTransition {
  readonly from: SetupEngineStage;
  readonly to: SetupEngineStage;
  readonly candidateCount: number;
}

export interface UnifiedDecisionSetupLifecycleReachabilityCausalTransition {
  readonly from: SetupCausalStage;
  readonly to: SetupCausalStage;
  readonly candidateCount: number;
}

export interface UnifiedDecisionSetupLifecycleReachabilityCandidateSummary {
  readonly candidateObservationCount: number;
  readonly candidateOccurrenceCount: number;
  readonly uniqueCandidateCount: number;
  readonly firstSeenBeforeExpiryCount: number;
  readonly firstSeenAtOrAfterExpiryCount: number;
  readonly createdBeforeSelectedWindowCount: number;
  readonly createdWithinSelectedWindowCount: number;
  readonly currentOccurrenceCount: number;
  readonly expiredOccurrenceCount: number;
  readonly retainedExpiredOccurrenceCount: number;
  readonly uniqueRetainedExpiredCandidateCount: number;
  readonly maximumRetentionAfterExpirySeconds: number;
  readonly setupStageOccurrenceCounts: Readonly<Record<SetupEngineStage, number>>;
  readonly uniqueCandidateStageCounts: Readonly<Record<SetupEngineStage, number>>;
  readonly causalStageOccurrenceCounts: Readonly<Record<SetupCausalStage, number>>;
  readonly uniqueCandidateCausalStageCounts: Readonly<Record<SetupCausalStage, number>>;
  readonly setupStageTransitions: readonly UnifiedDecisionSetupLifecycleReachabilityStageTransition[];
  readonly causalStageTransitions: readonly UnifiedDecisionSetupLifecycleReachabilityCausalTransition[];
}

export interface UnifiedDecisionSetupLifecycleReachabilityPathNode {
  readonly code:
    | 'setup_source_available'
    | 'candidate_snapshot_captured'
    | 'candidate_first_seen_current'
    | 'causal_observation_captured'
    | 'causal_approach_captured'
    | 'setup_approaching_captured'
    | 'causal_confirmation_captured'
    | 'setup_third_touch_captured'
    | 'setup_terminal_outcome_captured';
  readonly observationCount: number;
  readonly occurrenceCount: number;
  readonly uniqueCandidateCount: number;
}

export interface UnifiedDecisionSetupLifecycleReachabilityAssessment {
  readonly diagnosis: UnifiedDecisionSetupLifecycleReachabilityDiagnosis;
  readonly cutoff: UnifiedDecisionSetupLifecycleReachabilityCutoffCode;
  readonly message: string;
  readonly path: readonly UnifiedDecisionSetupLifecycleReachabilityPathNode[];
}

export interface UnifiedDecisionSetupLifecycleReachabilityReport {
  readonly version: typeof UNIFIED_DECISION_SETUP_LIFECYCLE_REACHABILITY_DIAGNOSTICS_VERSION;
  readonly generatedAt: string;
  readonly status: UnifiedDecisionSetupLifecycleReachabilityReportStatus;
  readonly source: {
    readonly datasetVersion: string;
    readonly persistenceSchema: string | null;
    readonly persistenceVersion: number | null;
    readonly sourceSavedAt: string | null;
  };
  readonly appliedOptions: UnifiedDecisionSetupLifecycleReachabilityAppliedOptions;
  readonly observationCount: number;
  readonly firstSequence: number | null;
  readonly lastSequence: number | null;
  readonly firstRecordedAt: string | null;
  readonly lastRecordedAt: string | null;
  readonly symbolCounts: Readonly<Record<string, number>>;
  readonly setupSourceReadStateCounts: Readonly<Record<string, number>>;
  readonly setupSourceAvailableObservationCount: number;
  readonly candidates: UnifiedDecisionSetupLifecycleReachabilityCandidateSummary;
  readonly assessment: UnifiedDecisionSetupLifecycleReachabilityAssessment;
  readonly violationCounts: Readonly<Record<UnifiedDecisionSetupLifecycleReachabilityViolationCode, number>>;
  readonly violations: readonly UnifiedDecisionSetupLifecycleReachabilityViolation[];
  readonly nextAction: UnifiedDecisionSetupLifecycleReachabilityNextAction;
  readonly targetedLiveCheckRecommended: boolean;
  readonly diagnosticOnly: true;
  readonly decisionRulesChangeRecommended: false;
  readonly thresholdsChanged: false;
  readonly rankingChanged: false;
  readonly setupLifecycleChanged: false;
  readonly createsTradeOrder: false;
  readonly createsSignal: false;
  readonly createsScore: false;
  readonly usesFutureData: false;
}
