import type {
  SetupDetectionRuntimeEventSource,
} from './setup-detection-runtime.types.js';
import type {
  SetupEngineState,
} from './setup-engine.types.js';
import type {
  SetupEventHistoryFilters,
  SetupEventHistoryLifecycle,
  SetupEventHistoryOptions,
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

  private unsubscribe:
    (() => void)
    | null = null;

  private state:
    SetupEventHistoryStatus['state'] =
      'idle';

  private droppedEventsCount = 0;

  constructor(
    private readonly source:
      SetupDetectionRuntimeEventSource,

    private readonly options:
      SetupEventHistoryOptions =
        DEFAULT_SETUP_EVENT_HISTORY_OPTIONS,
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
  }

  start(): void {
    if (
      this.state
      === 'running'
    ) {
      return;
    }

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

  stop(): void {
    this.unsubscribe?.();

    this.unsubscribe =
      null;

    this.state =
      'stopped';
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

  private recordEvent(
    event:
      SetupLifecycleEvent,
  ): void {
    this.events.push(
      cloneEvent(
        event,
      ),
    );

    const overflow =
      this.events.length
      - this.options.maxEvents;

    if (
      overflow <= 0
    ) {
      return;
    }

    this.events.splice(
      0,
      overflow,
    );

    this.droppedEventsCount +=
      overflow;
  }
}
