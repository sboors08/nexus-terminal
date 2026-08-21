import type {
  CausalSetupRealDataValidationAppliedOptions,
  CausalSetupRealDataValidationReport,
} from './causal-setup-real-data-validation.types.js';
import type {
  SetupDirection,
  SetupEngineSetupType,
} from './setup-engine.types.js';

export const SETUP_CANDIDATE_EPISODE_REAL_DATA_VALIDATION_VERSION =
  'setup-candidate-episode-real-data-validation-v0.1' as const;

export type SetupCandidateEpisodeRealDataValidationVersion =
  typeof SETUP_CANDIDATE_EPISODE_REAL_DATA_VALIDATION_VERSION;

export type SetupCandidateEpisodeRealDataValidationStatus =
  | 'validated_with_observed_rearms'
  | 'validated_without_observed_rearms'
  | 'invalid';

export type SetupCandidateEpisodeRealDataViolationCode =
  | 'source_replay_violation'
  | 'restart_replay_violation'
  | 'missing_episode_identity'
  | 'episode_contract_version_mismatch'
  | 'candidate_episode_id_mismatch'
  | 'candidate_episode_line_mismatch'
  | 'candidate_episode_setup_type_mismatch'
  | 'candidate_created_at_mismatch'
  | 'candidate_expiry_mismatch'
  | 'candidate_id_formula_mismatch'
  | 'duplicate_episode_identity'
  | 'non_monotonic_episode_boundary'
  | 'invalid_departure_boundary'
  | 'restart_candidate_set_mismatch'
  | 'restart_candidate_snapshot_mismatch';

export interface SetupCandidateEpisodeRealDataViolation {
  readonly code:
    SetupCandidateEpisodeRealDataViolationCode;
  readonly symbol: string;
  readonly lineId: string | null;
  readonly setupType:
    SetupEngineSetupType | null;
  readonly candidateId: string | null;
  readonly episodeId: string | null;
  readonly message: string;
}

export interface SetupCandidateEpisodeRealDataCandidateSnapshot {
  readonly candidateId: string;
  readonly episodeId: string;
  readonly symbol: string;
  readonly lineId: string;
  readonly setupType:
    SetupEngineSetupType;
  readonly direction:
    SetupDirection;
  readonly startedAt: string;
  readonly departureExtremumObservedAt:
    string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly scanObservationCount: number;
  readonly disappearanceCount: number;
  readonly reappearanceCount: number;
  readonly approachReached: boolean;
  readonly confirmationReached: boolean;
}

export interface SetupCandidateEpisodeRealDataPairReport {
  readonly key: string;
  readonly symbol: string;
  readonly lineId: string;
  readonly setupType:
    SetupEngineSetupType;
  readonly episodeCount: number;
  readonly rearmCount: number;
  readonly firstEpisodeStartedAt: string;
  readonly lastEpisodeStartedAt: string;
  readonly minimumRearmGapBars:
    number | null;
  readonly maximumRearmGapBars:
    number | null;
  readonly candidateIds:
    readonly string[];
  readonly episodeIds:
    readonly string[];
}

export interface SetupCandidateEpisodeRealDataDatasetTotals {
  readonly closedCandlesCount: number;
  readonly replayStepCount: number;
  readonly sourceCandidateTrackCount: number;
  readonly candidateTrackCount: number;
  readonly uniqueLineSetupPairCount: number;
  readonly uniqueEpisodeCount: number;
  readonly singleEpisodePairCount: number;
  readonly rearmedPairCount: number;
  readonly rearmCount: number;
  readonly rearmAfterPreviousExpiryCount: number;
  readonly rearmBeforePreviousExpiryCount: number;
  readonly duplicateSuppressionObservationCount:
    number;
  readonly candidateDisappearanceCount: number;
  readonly candidateReappearanceCount: number;
  readonly restartCandidateCount: number;
  readonly restartMismatchCount: number;
  readonly violationCount: number;
}

export interface SetupCandidateEpisodeRealDataDatasetReport {
  readonly symbol: string;
  readonly sourceTimeframe: '1m';
  readonly firstClosedAt: string | null;
  readonly lastClosedAt: string | null;
  readonly candidates:
    readonly SetupCandidateEpisodeRealDataCandidateSnapshot[];
  readonly pairs:
    readonly SetupCandidateEpisodeRealDataPairReport[];
  readonly violations:
    readonly SetupCandidateEpisodeRealDataViolation[];
  readonly totals:
    SetupCandidateEpisodeRealDataDatasetTotals;
  readonly restartEquivalent: boolean;
  readonly sameEpisodeChurnDetected: boolean;
  readonly usesFutureCandles: false;
}

export interface SetupCandidateEpisodeRealDataValidationTotals
  extends SetupCandidateEpisodeRealDataDatasetTotals {
  readonly symbolCount: number;
  readonly datasetCount: number;
}

export interface SetupCandidateEpisodeRealDataValidationReport {
  readonly version:
    SetupCandidateEpisodeRealDataValidationVersion;
  readonly sourceVersion:
    CausalSetupRealDataValidationReport['version'];
  readonly sourceGeneratedAt: string;
  readonly generatedAt: string;
  readonly sourceDatasetHash: string | null;
  readonly requestedSymbols:
    readonly string[];
  readonly datasets:
    readonly SetupCandidateEpisodeRealDataDatasetReport[];
  readonly totals:
    SetupCandidateEpisodeRealDataValidationTotals;
  readonly appliedOptions:
    CausalSetupRealDataValidationAppliedOptions;
  readonly status:
    SetupCandidateEpisodeRealDataValidationStatus;
  readonly permanentDuplicateCutoffEliminated:
    boolean;
  readonly restartEquivalent: boolean;
  readonly sameEpisodeChurnDetected: boolean;
  readonly offlineOnly: true;
  readonly reusesSavedRealCandles: true;
  readonly syntheticObservationsCreated: false;
  readonly changesObservationThreshold: false;
  readonly changesApproachThreshold: false;
  readonly changesConfirmationThreshold: false;
  readonly changesTradingRules: false;
  readonly createsLiveSetup: false;
  readonly createsTradeOrder: false;
  readonly createsSignal: false;
  readonly usesFutureCandles: false;
}
