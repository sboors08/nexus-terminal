import type {
  SetupDirection,
  SetupEngineOutcome,
  SetupEngineStage,
} from './setup-engine.types.js';
import type {
  SetupLifecycleEvent,
  SetupLifecycleEventType,
} from './setup-lifecycle-events.types.js';

export type SetupEventHistoryState =
  | 'idle'
  | 'running'
  | 'stopped';

export type SetupEventHistoryOutcomeFilter =
  | Exclude<
      SetupEngineOutcome,
      null
    >
  | 'pending';

export interface SetupEventHistoryFilters {
  candidateId?: string;
  symbol?: string;

  type?:
    SetupLifecycleEventType;

  direction?:
    SetupDirection;

  currentStage?:
    SetupEngineStage;

  outcome?:
    SetupEventHistoryOutcomeFilter;
}

export interface SetupEventHistoryOptions {
  maxEvents: number;
}

export interface SetupEventHistoryStatus {
  state:
    SetupEventHistoryState;

  eventsCount: number;
  maxEvents: number;

  firstEventId:
    number
    | null;

  lastEventId:
    number
    | null;

  droppedEventsCount: number;
}

export interface SetupEventHistoryLifecycle {
  start(): void;
  stop(): void;
}

export interface SetupEventHistoryReader {
  getStatus():
    SetupEventHistoryStatus;

  getEvents(
    filters?:
      SetupEventHistoryFilters,
  ): SetupLifecycleEvent[];

  getEvent(
    eventId: number,
  ): SetupLifecycleEvent | null;

  getCandidateEvents(
    candidateId: string,
  ): SetupLifecycleEvent[];
}
