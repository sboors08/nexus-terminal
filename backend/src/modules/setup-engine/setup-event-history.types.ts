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

export type SetupEventHistoryPersistenceState =
  | 'pending'
  | 'loading'
  | 'ready'
  | 'degraded';

export type SetupEventHistoryPersistenceErrorCode =
  | 'setup_event_history_persistence_corrupt'
  | 'setup_event_history_persistence_unsupported_version'
  | 'setup_event_history_persistence_read_failed'
  | 'setup_event_history_persistence_write_failed';

export interface SetupEventHistoryPersistenceStatus {
  adapter: string;

  state:
    SetupEventHistoryPersistenceState;

  version:
    number
    | null;

  hydrated: boolean;
  writable: boolean;

  loadAttempts: number;
  saveAttempts: number;
  savesCount: number;
  errorsCount: number;
  hydratedEventsCount: number;
  duplicateEventsCount: number;
  pendingWrites: number;

  lastPersistedAt:
    string
    | null;

  lastErrorCode:
    SetupEventHistoryPersistenceErrorCode
    | null;
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

  persistence?:
    SetupEventHistoryPersistenceStatus;
}

export interface SetupEventHistoryLifecycle {
  start():
    void
    | Promise<void>;

  stop():
    void
    | Promise<void>;
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