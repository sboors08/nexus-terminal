import type {
  UnifiedDecisionState,
} from './unified-decision.types.js';

export const UNIFIED_DECISION_LIVE_COHORT_VALIDATION_VERSION =
  'unified-decision-live-cohort-validation-v0.1' as const;

export type UnifiedDecisionLiveCohortCoverageStatus =
  | 'validated'
  | 'not_observed'
  | 'insufficient';

export type UnifiedDecisionLiveCohortReportStatus =
  | 'validated'
  | 'validated_with_coverage_gaps'
  | 'insufficient_coverage'
  | 'violations_found';

export interface UnifiedDecisionLiveCohortValidationOptions {
  readonly startSequence?: number;
  readonly endSequence?: number;
  readonly minimumObservationCount?: number;
  readonly minimumSymmetryCellCount?: number;
  readonly minimumRealtimeLossCount?: number;
  readonly minimumDisagreementCount?: number;
}

export interface UnifiedDecisionLiveCohortAppliedOptions {
  readonly startSequence: number | null;
  readonly endSequence: number | null;
  readonly minimumObservationCount: number;
  readonly minimumSymmetryCellCount: number;
  readonly minimumRealtimeLossCount: number;
  readonly minimumDisagreementCount: number;
}

export type UnifiedDecisionLiveCohortViolationCode =
  | 'duplicate_observation_id'
  | 'duplicate_sequence'
  | 'non_monotonic_sequence'
  | 'non_monotonic_recorded_at'
  | 'decision_timestamp_after_recording'
  | 'observation_identity_mismatch'
  | 'possible_state_direction_mismatch'
  | 'possible_without_level_or_scenario'
  | 'possible_wrong_causal_stage'
  | 'possible_level_scenario_direction_mismatch'
  | 'possible_without_matching_reason'
  | 'possible_without_complete_live_realtime'
  | 'possible_without_evidence_consensus'
  | 'realtime_disagreement_not_downgraded'
  | 'realtime_disagreement_missing_marker'
  | 'non_live_tape_not_downgraded'
  | 'non_live_tape_missing_marker'
  | 'non_live_order_book_not_downgraded'
  | 'non_live_order_book_missing_marker'
  | 'market_context_conflict_not_downgraded'
  | 'market_context_conflict_missing_contract'
  | 'unavailable_market_context_missing_marker'
  | 'setup_confirmed_without_terminal_outcome'
  | 'setup_confirmed_without_captured_candidate'
  | 'setup_confirmed_causal_line_mismatch'
  | 'current_terminal_outcome_not_confirmed'
  | 'safety_contract_changed';

export interface UnifiedDecisionLiveCohortViolation {
  readonly code: UnifiedDecisionLiveCohortViolationCode;
  readonly sequence: number;
  readonly symbol: string;
  readonly recordedAt: string;
  readonly message: string;
}

export interface UnifiedDecisionLiveCohortTransition {
  readonly symbol: string;
  readonly fromSequence: number;
  readonly toSequence: number;
  readonly observedAt: string;
  readonly fromState: UnifiedDecisionState;
  readonly toState: UnifiedDecisionState;
  readonly fromLineId: string | null;
  readonly toLineId: string | null;
}

export interface UnifiedDecisionLiveCohortCoverage {
  readonly observationCount: number;
  readonly firstSequence: number;
  readonly lastSequence: number;
  readonly firstRecordedAt: string;
  readonly lastRecordedAt: string;
  readonly symbolCounts: Readonly<Record<string, number>>;
  readonly stateCounts: Readonly<Record<UnifiedDecisionState, number>>;
  readonly uniqueDecisionLineCount: number;
  readonly transitionCount: number;
  readonly lineTransitionCount: number;
  readonly directPossibleFlipCount: number;
  readonly symmetry: {
    readonly status: UnifiedDecisionLiveCohortCoverageStatus;
    readonly possibleObservationCount: number;
    readonly possibleLongCount: number;
    readonly possibleShortCount: number;
    readonly resistanceBreakoutLongCount: number;
    readonly resistanceBounceShortCount: number;
    readonly supportBreakoutShortCount: number;
    readonly supportBounceLongCount: number;
    readonly uniquePossibleLineCount: number;
    readonly mappingViolationCount: number;
  };
  readonly realtime: {
    readonly status: UnifiedDecisionLiveCohortCoverageStatus;
    readonly availabilityCounts: Readonly<Record<string, number>>;
    readonly tapeSourceStateCounts: Readonly<Record<string, number>>;
    readonly orderBookSourceStateCounts: Readonly<Record<string, number>>;
    readonly nonLiveTapeObservationCount: number;
    readonly nonLiveOrderBookObservationCount: number;
    readonly disagreementObservationCount: number;
    readonly partialObservationCount: number;
    readonly possibleWithSourceLossCount: number;
    readonly downgradeViolationCount: number;
  };
  readonly marketContext: {
    readonly freshnessStatus: UnifiedDecisionLiveCohortCoverageStatus;
    readonly conflictStatus: UnifiedDecisionLiveCohortCoverageStatus;
    readonly btcAvailabilityCounts: Readonly<Record<string, number>>;
    readonly impulseAvailabilityCounts: Readonly<Record<string, number>>;
    readonly btcAlignmentCounts: Readonly<Record<string, number>>;
    readonly impulseAlignmentCounts: Readonly<Record<string, number>>;
    readonly staleOrUnavailableBtcObservationCount: number;
    readonly staleOrUnavailableImpulseObservationCount: number;
    readonly directionalUnavailableMarketCount: number;
    readonly singleConflictObservationCount: number;
    readonly doubleConflictObservationCount: number;
    readonly freshnessViolationCount: number;
    readonly conflictViolationCount: number;
  };
  readonly setup: {
    readonly terminalOutcomeStatus: UnifiedDecisionLiveCohortCoverageStatus;
    readonly setupCandidateSnapshotCount: number;
    readonly uniqueSetupCandidateCount: number;
    readonly activeDecisionSetupCount: number;
    readonly terminalCandidateObservationCount: number;
    readonly setupConfirmedObservationCount: number;
    readonly causalLinkValidatedObservationCount: number;
    readonly stageCounts: Readonly<Record<string, number>>;
    readonly outcomeCounts: Readonly<Record<string, number>>;
    readonly violationCount: number;
  };
}

export interface UnifiedDecisionLiveCohortCoverageGap {
  readonly code:
    | 'market_context_conflict_not_observed'
    | 'terminal_setup_outcome_not_observed';
  readonly message: string;
}

export interface UnifiedDecisionLiveCohortValidationReport {
  readonly version: typeof UNIFIED_DECISION_LIVE_COHORT_VALIDATION_VERSION;
  readonly generatedAt: string;
  readonly status: UnifiedDecisionLiveCohortReportStatus;
  readonly source: {
    readonly datasetVersion: string;
    readonly persistenceSchema: string | null;
    readonly persistenceVersion: number | null;
    readonly sourceSavedAt: string | null;
  };
  readonly appliedOptions: UnifiedDecisionLiveCohortAppliedOptions;
  readonly coverage: UnifiedDecisionLiveCohortCoverage;
  readonly transitions: readonly UnifiedDecisionLiveCohortTransition[];
  readonly coverageGaps: readonly UnifiedDecisionLiveCohortCoverageGap[];
  readonly violationCounts: Readonly<Record<UnifiedDecisionLiveCohortViolationCode, number>>;
  readonly violations: readonly UnifiedDecisionLiveCohortViolation[];
  readonly decisionRulesChangeRecommended: false;
  readonly thresholdsChanged: false;
  readonly rankingChanged: false;
  readonly setupLifecycleChanged: false;
  readonly createsTradeOrder: false;
  readonly createsSignal: false;
  readonly createsScore: false;
  readonly appliesLearning: false;
  readonly estimatesProfitability: false;
}
