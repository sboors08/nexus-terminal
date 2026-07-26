import type {
  SetupDirection,
  SetupEngineOutcome,
  SetupEngineSetupType,
  SetupEngineStage,
  SetupEngineState,
} from './setup-engine.types.js';

export type SetupLifecycleEventType =
  | 'candidate_created'
  | 'stage_transition'
  | 'breakout_confirmed'
  | 'rejection_confirmed'
  | 'setup_expired';

export interface SetupLifecycleEvent {
  eventId: number;

  type:
    SetupLifecycleEventType;

  occurredAt: string;

  candidateId: string;
  symbol: string;

  setupType:
    SetupEngineSetupType;

  direction:
    SetupDirection;

  previousStage:
    SetupEngineStage
    | null;

  currentStage:
    SetupEngineStage;

  outcome:
    SetupEngineOutcome;

  candidate:
    SetupEngineState;
}

export type SetupLifecycleEventListener =
  (
    event:
      SetupLifecycleEvent,
  ) => void;
