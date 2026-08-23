import type {
  SetupDetectionRuntimeEventSource,
} from './setup-detection-runtime.types.js';
import type {
  SetupEngineState,
} from './setup-engine.types.js';
import {
  buildSetupEventHistorySemanticKey,
  normalizeSetupEventHistoryPersistenceSnapshot,
  SETUP_EVENT_HISTORY_PERSISTENCE_SCHEMA,
  SETUP_EVENT_HISTORY_PERSISTENCE_VERSION,
  SetupEventHistoryPersistenceError,
  type SetupEventHistoryPersistenceContract,
  type SetupEventHistoryPersistenceSnapshot,
} from './setup-event-history.persistence.js';
import type {
  SetupEventHistoryFilters,
  SetupEventHistoryLifecycle,
  SetupEventHistoryOptions,
  SetupEventHistoryPersistenceErrorCode,
  SetupEventHistoryPersistenceStatus,
  SetupEventHistoryReader,
  SetupEventHistoryStatus,
} from './setup-event-history.types.js';
import type {
  SetupLifecycleEvent,
} from './setup-lifecycle-events.types.js';

export const DEFAULT_SETUP_EVENT_HISTORY_OPTIONS:
SetupEventHistoryOptions = {
  maxEvents:
    50_000,
};

function cloneCandidate(
  candidate:
    SetupEngineState,
): SetupEngineState {
  return {
    ...candidate,

    level: {
      ...candidate.level,
    },
    ...(candidate.episode
      ? {
          episode: {
            ...candidate.episode,
          },
        }
      : {}),
    ...(candidate.causal
      ? {
          causal: {
            ...candidate.causal,
            realtimeConfirmationReasons: [
              ...candidate.causal
                .realtimeConfirmationReasons,
            ],
          },
        }
      : {}),
  };
}

function cloneEvent(
  event:
    SetupLifecycleEvent,
): SetupLifecycleEvent {
  return {
    ...event,

    candidate:
      cloneCandidate(
        event.candidate,
      ),
  };
}

function matchesFilters(
  event:
    SetupLifecycleEvent,

  filters:
    SetupEventHistoryFilters,
): boolean {
  if (
    filters.candidateId
    !== undefined
    && event.candidateId
      !== filters.candidateId
  ) {
    return false;
  }

  if (
    filters.symbol
    !== undefined
    && event.symbol
      !== filters.symbol
  ) {
    return false;
  }

  if (
    filters.type
    !== undefined
    && event.type
      !== filters.type
  ) {
    return false;
  }

  if (
    filters.direction
    !== undefined
    && event.direction
      !== filters.direction
  ) {
    return false;
  }

  if (
    filters.currentStage
    !== undefined
    && event.currentStage
      !== filters.currentStage
  ) {
    return false;
  }

  if (
    filters.outcome
    !== undefined
  ) {
    if (
      filters.outcome
      === 'pending'
    ) {
      return event.outcome
        === null;
    }

    if (
      event.outcome
      !== filters.outcome
    ) {
      return false;
    }
  }

  return true;
}

export class SetupEventHistoryService
implements
  SetupEventHistoryLifecycle,
  SetupEventHistoryReader {
  private readonly events:
    SetupLifecycleEvent[] = [];

  private readonly semanticKeys =
    new Set<string>();

  private nextHistoryEventId =
    1;

  private unsubscribe:
    (() => void)
    | null = null;

  private startPromise:
    Promise<void>
    | null = null;

  private persistenceQueue:
    Promise<void> =
      Promise.resolve();

  private lifecycleRevision =
    0;

  private state:
    SetupEventHistoryStatus['state'] =
      'idle';

  private droppedEventsCount =
    0;

  private persistenceState:
    SetupEventHistoryPersistenceStatus['state']
    | null;

  private persistenceVersion:
    number
    | null = null;

  private persistenceHydrated =
    false;

  private persistenceWritable =
    true;

  private persistenceLoadAttempts =
    0;

  private persistenceSaveAttempts =
    0;

  private persistenceSavesCount =
    0;

  private persistenceErrorsCount =
    0;

  private hydratedEventsCount =
    0;

  private duplicateEventsCount =
    0;

  private pendingPersistenceWrites =
    0;

  private lastPersistedAt:
    string
    | null = null;

  private lastPersistenceErrorCode:
    SetupEventHistoryPersistenceErrorCode
    | null = null;

  constructor(
    private readonly source:
      SetupDetectionRuntimeEventSource,

    private readonly options:
      SetupEventHistoryOptions =
        DEFAULT_SETUP_EVENT_HISTORY_OPTIONS,

    private readonly persistence:
      SetupEventHistoryPersistenceContract
      | null = null,
  ) {
    if (
      !Number.isInteger(
        options.maxEvents,
      )
      || options.maxEvents <= 0
    ) {
      throw new Error(
        'Setup Event History maxEvents must be a positive integer',
      );
    }

    if (
      this.persistence
      && (
        typeof this.persistence.adapter
          !== 'string'
        || this.persistence.adapter.trim()
          .length === 0
      )
    ) {
      throw new Error(
        'Setup Event History persistence adapter is required',
      );
    }

    this.persistenceState =
      this.persistence
        ? 'pending'
        : null;
  }

  start():
  void | Promise<void> {
    if (
      this.state
      === 'running'
    ) {
      return;
    }

    if (!this.persistence) {
      this.subscribeSource();
      return;
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    const revision =
      ++this.lifecycleRevision;

    this.startPromise =
      this.startPersistentRuntime(
        revision,
      );

    return this.startPromise;
  }

  stop():
  void | Promise<void> {
    this.lifecycleRevision +=
      1;

    this.unsubscribe?.();

    this.unsubscribe =
      null;

    this.state =
      'stopped';

    if (this.persistence) {
      const pendingStart =
        this.startPromise;

      this.startPromise =
        null;

      return this.stopPersistentRuntime(
        pendingStart,
      );
    }
  }

  getStatus():
  SetupEventHistoryStatus {
    const firstEvent =
      this.events[0];

    const lastEvent =
      this.events[
        this.events.length - 1
      ];

    return {
      state:
        this.state,

      eventsCount:
        this.events.length,

      maxEvents:
        this.options.maxEvents,

      firstEventId:
        firstEvent?.eventId
        ?? null,

      lastEventId:
        lastEvent?.eventId
        ?? null,

      droppedEventsCount:
        this.droppedEventsCount,

      ...(
        this.persistence
        && this.persistenceState
          ? {
              persistence: {
                adapter:
                  this.persistence.adapter,

                state:
                  this.persistenceState,

                version:
                  this.persistenceVersion,

                hydrated:
                  this.persistenceHydrated,

                writable:
                  this.persistenceWritable,

                loadAttempts:
                  this.persistenceLoadAttempts,

                saveAttempts:
                  this.persistenceSaveAttempts,

                savesCount:
                  this.persistenceSavesCount,

                errorsCount:
                  this.persistenceErrorsCount,

                hydratedEventsCount:
                  this.hydratedEventsCount,

                duplicateEventsCount:
                  this.duplicateEventsCount,

                pendingWrites:
                  this.pendingPersistenceWrites,

                lastPersistedAt:
                  this.lastPersistedAt,

                lastErrorCode:
                  this.lastPersistenceErrorCode,
              },
            }
          : {}
      ),
    };
  }

  getEvents(
    filters:
      SetupEventHistoryFilters = {},
  ): SetupLifecycleEvent[] {
    return this.events
      .filter(
        (event) =>
          matchesFilters(
            event,
            filters,
          ),
      )
      .sort(
        (
          left,
          right,
        ) =>
          right.eventId
          - left.eventId,
      )
      .map(
        cloneEvent,
      );
  }

  getEvent(
    eventId: number,
  ): SetupLifecycleEvent | null {
    if (
      !Number.isSafeInteger(
        eventId,
      )
      || eventId <= 0
    ) {
      throw new Error(
        'Setup Event History eventId must be a positive safe integer',
      );
    }

    const event =
      this.events.find(
        (item) =>
          item.eventId
          === eventId,
      );

    return event
      ? cloneEvent(
          event,
        )
      : null;
  }

  getCandidateEvents(
    candidateIdValue: string,
  ): SetupLifecycleEvent[] {
    const candidateId =
      candidateIdValue.trim();

    if (
      candidateId.length === 0
    ) {
      throw new Error(
        'Setup Event History candidate id cannot be empty',
      );
    }

    return this.getEvents({
      candidateId,
    });
  }

  private subscribeSource():
  void {
    const unsubscribe =
      this.source
        .subscribeLifecycleEvents(
          (event) => {
            this.recordEvent(
              event,
            );
          },
        );

    this.unsubscribe =
      unsubscribe;

    this.state =
      'running';
  }

  private async startPersistentRuntime(
    revision: number,
  ):
  Promise<void> {
    if (!this.persistenceHydrated) {
      await this.hydratePersistence();
    }

    if (
      revision
      !== this.lifecycleRevision
    ) {
      return;
    }

    this.subscribeSource();
  }

  private async stopPersistentRuntime(
    pendingStart:
      Promise<void>
      | null,
  ):
  Promise<void> {
    if (pendingStart) {
      try {
        await pendingStart;
      } catch {
        // Startup failure must not prevent persistence queue cleanup.
      }
    }

    try {
      await this.persistenceQueue;
    } catch {
      // Persistence errors are converted to safe diagnostics.
    }
  }

  private recordEvent(
    sourceEvent:
      SetupLifecycleEvent,
  ): void {
    const semanticKey =
      buildSetupEventHistorySemanticKey(
        sourceEvent,
      );

    if (
      this.semanticKeys.has(
        semanticKey,
      )
    ) {
      this.duplicateEventsCount +=
        1;

      return;
    }

    if (
      !Number.isSafeInteger(
        this.nextHistoryEventId,
      )
      || this.nextHistoryEventId
        <= 0
    ) {
      return;
    }

    const event =
      cloneEvent({
        ...sourceEvent,

        eventId:
          this.nextHistoryEventId,
      });

    this.nextHistoryEventId +=
      1;

    this.events.push(
      event,
    );

    this.semanticKeys.add(
      semanticKey,
    );

    this.enforceBound();

    void this.queuePersistence();
  }

  private enforceBound():
  void {
    const overflow =
      this.events.length
      - this.options.maxEvents;

    if (
      overflow <= 0
    ) {
      return;
    }

    const removed =
      this.events.splice(
        0,
        overflow,
      );

    for (
      const event
      of removed
    ) {
      this.semanticKeys.delete(
        buildSetupEventHistorySemanticKey(
          event,
        ),
      );
    }

    this.droppedEventsCount +=
      overflow;
  }

  private async hydratePersistence():
  Promise<void> {
    if (!this.persistence) {
      return;
    }

    this.persistenceState =
      'loading';

    this.persistenceLoadAttempts +=
      1;

    try {
      const loaded =
        await this.persistence.load();

      if (loaded === null) {
        this.persistenceVersion =
          SETUP_EVENT_HISTORY_PERSISTENCE_VERSION;
      } else {
        const snapshot =
          normalizeSetupEventHistoryPersistenceSnapshot(
            loaded,
          );

        this.applyPersistenceSnapshot(
          snapshot,
        );
      }

      this.persistenceState =
        'ready';

      this.lastPersistenceErrorCode =
        null;
    } catch (error) {
      this.persistenceWritable =
        false;

      this.recordPersistenceError(
        error,
        'setup_event_history_persistence_read_failed',
      );
    } finally {
      this.persistenceHydrated =
        true;
    }
  }

  private applyPersistenceSnapshot(
    snapshot:
      SetupEventHistoryPersistenceSnapshot,
  ): void {
    const overflow =
      Math.max(
        0,
        snapshot.events.length
          - this.options.maxEvents,
      );

    const retained =
      snapshot.events.slice(
        -this.options.maxEvents,
      );

    this.events.splice(
      0,
      this.events.length,
      ...retained.map(
        cloneEvent,
      ),
    );

    this.semanticKeys.clear();

    for (
      const event
      of this.events
    ) {
      this.semanticKeys.add(
        buildSetupEventHistorySemanticKey(
          event,
        ),
      );
    }

    this.droppedEventsCount =
      snapshot.droppedEventsCount
      + overflow;

    this.hydratedEventsCount =
      this.events.length;

    this.persistenceVersion =
      snapshot.version;

    this.lastPersistedAt =
      snapshot.savedAt;

    const lastEvent =
      this.events[
        this.events.length - 1
      ];

    this.nextHistoryEventId =
      lastEvent
        ? lastEvent.eventId + 1
        : 1;

    if (
      !Number.isSafeInteger(
        this.nextHistoryEventId,
      )
      || this.nextHistoryEventId
        <= 0
    ) {
      throw new SetupEventHistoryPersistenceError(
        'setup_event_history_persistence_corrupt',
        'Persisted Setup Event History exhausted eventId range',
      );
    }
  }

  private buildPersistenceSnapshot():
  SetupEventHistoryPersistenceSnapshot {
    return {
      schema:
        SETUP_EVENT_HISTORY_PERSISTENCE_SCHEMA,

      version:
        SETUP_EVENT_HISTORY_PERSISTENCE_VERSION,

      savedAt:
        new Date()
          .toISOString(),

      droppedEventsCount:
        this.droppedEventsCount,

      events:
        this.events.map(
          cloneEvent,
        ),
    };
  }

  private queuePersistence():
  Promise<void> {
    if (
      !this.persistence
      || !this.persistenceHydrated
      || !this.persistenceWritable
    ) {
      return Promise.resolve();
    }

    const snapshot =
      this.buildPersistenceSnapshot();

    this.persistenceSaveAttempts +=
      1;

    this.pendingPersistenceWrites +=
      1;

    const write =
      async () => {
        try {
          await this.persistence?.save(
            snapshot,
          );

          this.persistenceSavesCount +=
            1;

          this.persistenceState =
            'ready';

          this.persistenceVersion =
            snapshot.version;

          this.lastPersistedAt =
            snapshot.savedAt;

          this.lastPersistenceErrorCode =
            null;
        } catch (error) {
          this.recordPersistenceError(
            error,
            'setup_event_history_persistence_write_failed',
          );
        } finally {
          this.pendingPersistenceWrites -=
            1;
        }
      };

    this.persistenceQueue =
      this.persistenceQueue
        .catch(
          () => undefined,
        )
        .then(
          write,
        );

    return this.persistenceQueue;
  }

  private recordPersistenceError(
    error: unknown,
    fallbackCode:
      SetupEventHistoryPersistenceErrorCode,
  ): void {
    this.persistenceState =
      'degraded';

    this.persistenceErrorsCount +=
      1;

    this.lastPersistenceErrorCode =
      error
        instanceof SetupEventHistoryPersistenceError
        ? error.code
        : fallbackCode;
  }
}