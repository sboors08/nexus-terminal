import type {
  LevelEngineKind,
} from '../level-engine/level-engine.types.js';
import type {
  LevelEngineRealDataValidationReport,
  LevelEngineValidationDatasetSnapshot,
} from '../level-engine/level-engine-real-data-validation.types.js';
import type {
  SetupCausalContext,
  SetupCausalStage,
} from './causal-setup-adapter.types.js';
import type {
  SetupDetectionPipelineOptions,
} from './setup-detection-pipeline.types.js';
import type {
  SetupDirection,
  SetupEngineSetupType,
  SetupEngineState,
} from './setup-engine.types.js';

export const CAUSAL_SETUP_REAL_DATA_VALIDATION_VERSION =
  'causal-setup-real-data-validation-v0.1' as const;

export type CausalSetupRealDataValidationVersion =
  typeof CAUSAL_SETUP_REAL_DATA_VALIDATION_VERSION;

export type CausalSetupHistoricalRealtimeEvidenceMode =
  'unavailable';

export interface CausalSetupRealDataValidationOptions {
  readonly startAtClosedCandleCount?: number;
  readonly pipelineOptions?:
    SetupDetectionPipelineOptions;
}

export interface CausalSetupRealDataValidationAppliedOptions {
  readonly startAtClosedCandleCount: number;
  readonly pipelineOptions:
    SetupDetectionPipelineOptions;
  readonly historicalRealtimeEvidenceMode:
    CausalSetupHistoricalRealtimeEvidenceMode;
}

export interface CausalSetupRealDataLatencyStats {
  readonly sampleCount: number;
  readonly minimumBars: number | null;
  readonly medianBars: number | null;
  readonly averageBars: number | null;
  readonly maximumBars: number | null;
}

export interface CausalSetupStageObservation {
  readonly stage: SetupCausalStage;
  readonly observedAt: string;
  readonly observedCandleIndex: number;
  readonly context: SetupCausalContext;
}

export interface CausalSetupCandidateTrack {
  readonly candidateId: string;
  readonly lineId: string;
  readonly symbol: string;
  readonly timeframe: '1m';
  readonly setupType: SetupEngineSetupType;
  readonly direction: SetupDirection;
  readonly levelKind: LevelEngineKind;
  readonly levelPrice: number;
  readonly levelConfirmedAt: string;
  readonly candidate: SetupEngineState;
  readonly firstSeenAt: string;
  readonly firstSeenCandleIndex: number;
  readonly lastSeenAt: string;
  readonly lastSeenCandleIndex: number;
  readonly observation:
    CausalSetupStageObservation;
  readonly approach:
    CausalSetupStageObservation | null;
  readonly confirmation:
    CausalSetupStageObservation | null;
  readonly latestContext: SetupCausalContext;
  readonly scanObservationCount: number;
  readonly disappearanceCount: number;
  readonly reappearanceCount: number;
  readonly presentAtEnd: boolean;
  readonly levelConfirmedToObservationBars:
    number | null;
  readonly observationToApproachBars:
    number | null;
  readonly approachToConfirmationBars:
    number | null;
}

export type CausalSetupValidationViolationCode =
  | 'candidate_without_update'
  | 'update_without_candidate'
  | 'candidate_identity_changed'
  | 'future_observation'
  | 'observation_below_threshold'
  | 'approach_outside_threshold'
  | 'confirmation_without_realtime_evidence'
  | 'missing_level_confirmation_candle';

export interface CausalSetupValidationViolation {
  readonly code:
    CausalSetupValidationViolationCode;
  readonly symbol: string;
  readonly observedCandleIndex: number;
  readonly observedAt: string;
  readonly candidateId: string | null;
  readonly lineId: string | null;
  readonly message: string;
}

export interface CausalSetupDatasetValidationTotals {
  readonly replayStepCount: number;
  readonly activeLevelObservationCount: number;
  readonly uniqueLevelCount: number;
  readonly emittedCandidateCount: number;
  readonly candidateTrackCount: number;
  readonly breakoutCandidateCount: number;
  readonly bounceCandidateCount: number;
  readonly longCandidateCount: number;
  readonly shortCandidateCount: number;
  readonly observationReachedCount: number;
  readonly approachReachedCount: number;
  readonly confirmationReachedCount: number;
  readonly duplicateCandidateObservationCount:
    number;
  readonly candidateDisappearanceCount: number;
  readonly candidateReappearanceCount: number;
  readonly violationCount: number;
  readonly levelConfirmedToObservationBars:
    CausalSetupRealDataLatencyStats;
  readonly observationToApproachBars:
    CausalSetupRealDataLatencyStats;
  readonly approachToConfirmationBars:
    CausalSetupRealDataLatencyStats;
}

export interface CausalSetupDatasetValidationReport {
  readonly symbol: string;
  readonly sourceTimeframe: '1m';
  readonly closedCandlesCount: number;
  readonly ignoredOpenCandlesCount: number;
  readonly firstClosedAt: string | null;
  readonly lastClosedAt: string | null;
  readonly candidateTracks:
    readonly CausalSetupCandidateTrack[];
  readonly violations:
    readonly CausalSetupValidationViolation[];
  readonly totals:
    CausalSetupDatasetValidationTotals;
  readonly appliedOptions:
    CausalSetupRealDataValidationAppliedOptions;
  readonly historicalRealtimeEvidenceAvailable:
    false;
  readonly realtimeConfirmationValidated: false;
  readonly outcomeClassificationValidated: false;
  readonly usesFutureCandles: false;
  readonly usesFutureRealtimeEvidence: false;
}

export interface CausalSetupSymbolValidationReport {
  readonly symbol: string;
  readonly dataset:
    CausalSetupDatasetValidationReport;
}

export interface CausalSetupRealDataValidationTotals
  extends CausalSetupDatasetValidationTotals {
  readonly symbolCount: number;
  readonly datasetCount: number;
  readonly closedCandlesCount: number;
  readonly ignoredOpenCandlesCount: number;
}

export interface CausalSetupRealDataValidationReport {
  readonly version:
    CausalSetupRealDataValidationVersion;
  readonly sourceValidationVersion:
    LevelEngineRealDataValidationReport['version'];
  readonly generatedAt: string;
  readonly requestedSymbols: readonly string[];
  readonly sourceDatasets:
    readonly LevelEngineValidationDatasetSnapshot[];
  readonly symbolReports:
    readonly CausalSetupSymbolValidationReport[];
  readonly totals:
    CausalSetupRealDataValidationTotals;
  readonly appliedOptions:
    CausalSetupRealDataValidationAppliedOptions;
  readonly offlineOnly: true;
  readonly reusesFetchedDatasets: true;
  readonly historicalRealtimeEvidenceAvailable:
    false;
  readonly realtimeConfirmationValidated: false;
  readonly outcomeClassificationValidated: false;
  readonly changesTradingRules: false;
  readonly createsLiveSetup: false;
  readonly createsSignal: false;
  readonly usesQualityScore: false;
  readonly appliesTraining: false;
  readonly usesFutureCandles: false;
  readonly usesFutureRealtimeEvidence: false;
}
