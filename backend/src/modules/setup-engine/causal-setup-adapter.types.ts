import type {
  LevelLineStatus,
  LevelLinesDetectionResult,
} from '../level-engine/level-lines.types.js';
import type {
  RealtimeConfirmationEvaluationResult,
  RealtimeConfirmationStatus,
} from '../level-engine/realtime-confirmation-engine.types.js';
import type {
  SetupEngineEvent,
  SetupEngineSetupType,
  SetupEngineState,
} from './setup-engine.types.js';

export const CAUSAL_SETUP_ADAPTER_CONTRACT_VERSION =
  'causal-setup-adapter-v0.1' as const;

export const SETUP_CANDIDATE_EPISODE_CONTRACT_VERSION =
  'setup-candidate-episode-v0.1' as const;

export interface SetupCandidateEpisodeIdentity {
  readonly version:
    typeof SETUP_CANDIDATE_EPISODE_CONTRACT_VERSION;
  readonly id: string;
  readonly lineId: string;
  readonly setupType:
    SetupEngineSetupType;
  readonly startedAt: string;
  readonly departureExtremumObservedAt:
    string;
  readonly boundary:
    'observation_threshold_reentry';
  readonly restartDeterministic: true;
  readonly usesFutureCandles: false;
}

export type SetupCausalStage =
  | 'LEVEL_CONFIRMED'
  | 'OBSERVATION'
  | 'APPROACH'
  | 'CONFIRMATION';

export type SetupCausalReason =
  | 'level_line_confirmed'
  | 'observation_progress_threshold_met'
  | 'approach_distance_threshold_met'
  | 'realtime_confirmation_confirmed';

export interface SetupCausalContext {
  readonly version:
    typeof CAUSAL_SETUP_ADAPTER_CONTRACT_VERSION;
  readonly source: 'level_lines';
  readonly lineId: string;
  readonly lineStatus: LevelLineStatus;
  readonly stage: SetupCausalStage;
  readonly reason: SetupCausalReason;
  readonly observedAt: string;
  readonly observationProgress: number | null;
  readonly observationProgressThreshold: number;
  readonly distanceToLevelPercent: number | null;
  readonly maxDistanceToLevelPercent: number;
  readonly realtimeConfirmationStatus:
    RealtimeConfirmationStatus;
  readonly realtimeConfirmationReasons:
    readonly string[];
  readonly sourceObservationalOnly: true;
  readonly sourceCreatesSetup: false;
  readonly sourceCreatesSignal: false;
  readonly evaluatesBreakout: false;
  readonly evaluatesBounce: false;
  readonly usesFutureCandles: false;
  readonly usesFutureRealtimeEvidence: false;
}

export interface SetupCausalUpdate {
  readonly candidateId: string;
  readonly episodeId: string;
  readonly context: SetupCausalContext;
  readonly transitionEvents:
    readonly SetupCausalTransition[];
}

export interface SetupCausalTransition {
  readonly event: SetupEngineEvent;
  readonly context: SetupCausalContext;
}

export interface AdaptCausalSetupCandidatesInput {
  readonly detection:
    LevelLinesDetectionResult;
  readonly realtimeConfirmation:
    RealtimeConfirmationEvaluationResult;
  readonly setupTypes:
    readonly SetupEngineSetupType[];
  readonly expiresAfterSec: number;
}

export interface AdaptCausalSetupCandidatesResult {
  readonly version:
    typeof CAUSAL_SETUP_ADAPTER_CONTRACT_VERSION;
  readonly symbol: string;
  readonly timeframe: '1m';
  readonly candidates:
    readonly SetupEngineState[];
  readonly updates:
    readonly SetupCausalUpdate[];
  readonly observationalSourceCreatesSetup:
    false;
  readonly createsSignal: false;
  readonly evaluatesBreakout: false;
  readonly evaluatesBounce: false;
}
