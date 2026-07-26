import {
  parseSetupRuntimeCandidate,
  type SetupRuntimeCandidate,
} from './setupRuntimeApi.js';

export const SETUP_LIFECYCLE_STREAM_PATH =
  '/api/v1/setups/events/stream';

export type SetupLifecycleEventType =
  | 'candidate_created'
  | 'stage_transition'
  | 'breakout_confirmed'
  | 'rejection_confirmed'
  | 'setup_expired';

export interface SetupLifecycleStreamEvent {
  eventId: number;
  type: SetupLifecycleEventType;
  occurredAt: string;
  candidateId: string;
  symbol: string;

  setupType:
    | 'level_breakout'
    | 'level_bounce';

  direction:
    | 'long'
    | 'short';

  previousStage:
    SetupRuntimeCandidate['stage']
    | null;

  currentStage:
    SetupRuntimeCandidate['stage'];

  outcome:
    | 'breakout'
    | 'rejection'
    | null;

  candidate:
    SetupRuntimeCandidate;
}

export interface SetupLifecycleStreamReady {
  connectedAt: string;

  firstEventId:
    number
    | null;

  lastEventId:
    number
    | null;

  replayLimit: number;

  filters: {
    candidateId?: string;
    symbol?: string;
  };
}

export type SetupLifecycleStreamState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'closed'
  | 'error';

export interface SetupLifecycleClientSnapshot {
  state:
    SetupLifecycleStreamState;

  ready:
    SetupLifecycleStreamReady
    | null;

  lastEvent:
    SetupLifecycleStreamEvent
    | null;

  error:
    Error
    | null;
}

export type SetupLifecycleClientListener = (
  snapshot:
    SetupLifecycleClientSnapshot,
) => void;

export type SetupLifecycleEventSourceFactory = (
  url: string,
) => EventSource;

export interface SetupLifecycleStreamOptions {
  baseUrl?: string;
  candidateId?: string;
  symbol?: string;

  eventSourceFactory?:
    SetupLifecycleEventSourceFactory;
}

const CANDIDATE_ID_PATTERN =
  /^[A-Za-z0-9._:-]{1,300}$/;

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const EVENT_SOURCE_CONNECTING =
  0;

const EVENT_TYPES:
readonly SetupLifecycleEventType[] = [
  'candidate_created',
  'stage_transition',
  'breakout_confirmed',
  'rejection_confirmed',
  'setup_expired',
];

const STAGES:
readonly SetupRuntimeCandidate['stage'][] = [
  'LEVEL_CONFIRMED',
  'APPROACHING_THIRD_TOUCH',
  'THIRD_TOUCH_CONFIRMED',
  'BREAKOUT_CONFIRMED',
  'REJECTION_CONFIRMED',
  'SETUP_EXPIRED',
];

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

function readString(
  record:
    Record<string, unknown>,

  key:
    string,
): string {
  const value =
    record[key];

  if (
    typeof value !== 'string'
    || value.trim().length === 0
  ) {
    throw new Error(
      `Invalid setup lifecycle event: ${key}`,
    );
  }

  return value;
}

function readNullableString(
  record:
    Record<string, unknown>,

  key:
    string,
):
  string
  | null {
  const value =
    record[key];

  if (
    value === null
  ) {
    return null;
  }

  if (
    typeof value !== 'string'
    || value.trim().length === 0
  ) {
    throw new Error(
      `Invalid setup lifecycle event: ${key}`,
    );
  }

  return value;
}

function normalizeBaseUrl(
  value:
    string
    | undefined,
): string {
  return (
    value
      ?.trim()
      .replace(
        /\/+$/,
        '',
      )
    ?? ''
  );
}

function normalizeCandidateId(
  value:
    string
    | undefined,
):
  string
  | undefined {
  if (
    value === undefined
  ) {
    return undefined;
  }

  const candidateId =
    value.trim();

  if (
    !CANDIDATE_ID_PATTERN.test(
      candidateId,
    )
  ) {
    throw new Error(
      'Invalid setup lifecycle candidate id',
    );
  }

  return candidateId;
}

function normalizeSymbol(
  value:
    string
    | undefined,
):
  string
  | undefined {
  if (
    value === undefined
  ) {
    return undefined;
  }

  const symbol =
    value
      .trim()
      .toUpperCase();

  if (
    !SYMBOL_PATTERN.test(
      symbol,
    )
  ) {
    throw new Error(
      'Invalid setup lifecycle symbol',
    );
  }

  return symbol;
}

function parseStage(
  value: string,
  field:
    string,
): SetupRuntimeCandidate['stage'] {
  const stage =
    value as
      SetupRuntimeCandidate['stage'];

  if (
    !STAGES.includes(
      stage,
    )
  ) {
    throw new Error(
      `Invalid setup lifecycle event: ${field}`,
    );
  }

  return stage;
}

export function buildSetupLifecycleStreamUrl(
  options:
    Pick<
      SetupLifecycleStreamOptions,
      | 'baseUrl'
      | 'candidateId'
      | 'symbol'
    > = {},
): string {
  const candidateId =
    normalizeCandidateId(
      options.candidateId,
    );

  const symbol =
    normalizeSymbol(
      options.symbol,
    );

  const search =
    new URLSearchParams();

  if (
    candidateId
  ) {
    search.set(
      'candidateId',
      candidateId,
    );
  }

  if (
    symbol
  ) {
    search.set(
      'symbol',
      symbol,
    );
  }

  const query =
    search.toString();

  return (
    normalizeBaseUrl(
      options.baseUrl,
    )
    + SETUP_LIFECYCLE_STREAM_PATH
    + (
      query
        ? `?${query}`
        : ''
    )
  );
}

export function parseSetupLifecycleEvent(
  value: unknown,
): SetupLifecycleStreamEvent {
  if (
    !isRecord(
      value,
    )
  ) {
    throw new Error(
      'Invalid setup lifecycle event payload',
    );
  }

  const eventId =
    value.eventId;

  if (
    typeof eventId !== 'number'
    || !Number.isSafeInteger(
      eventId,
    )
    || eventId <= 0
  ) {
    throw new Error(
      'Invalid setup lifecycle event: eventId',
    );
  }

  const type =
    readString(
      value,
      'type',
    ) as SetupLifecycleEventType;

  if (
    !EVENT_TYPES.includes(
      type,
    )
  ) {
    throw new Error(
      'Invalid setup lifecycle event: type',
    );
  }

  const occurredAt =
    readString(
      value,
      'occurredAt',
    );

  if (
    !Number.isFinite(
      Date.parse(
        occurredAt,
      ),
    )
  ) {
    throw new Error(
      'Invalid setup lifecycle event: occurredAt',
    );
  }

  const candidateId =
    normalizeCandidateId(
      readString(
        value,
        'candidateId',
      ),
    );

  const symbol =
    normalizeSymbol(
      readString(
        value,
        'symbol',
      ),
    );

  if (
    !candidateId
    || !symbol
  ) {
    throw new Error(
      'Invalid setup lifecycle event identity',
    );
  }

  const setupType =
    readString(
      value,
      'setupType',
    );

  if (
    setupType !== 'level_breakout'
    && setupType !== 'level_bounce'
  ) {
    throw new Error(
      'Invalid setup lifecycle event: setupType',
    );
  }

  const direction =
    readString(
      value,
      'direction',
    );

  if (
    direction !== 'long'
    && direction !== 'short'
  ) {
    throw new Error(
      'Invalid setup lifecycle event: direction',
    );
  }

  const previousStageValue =
    readNullableString(
      value,
      'previousStage',
    );

  const previousStage =
    previousStageValue === null
      ? null
      : parseStage(
          previousStageValue,
          'previousStage',
        );

  const currentStage =
    parseStage(
      readString(
        value,
        'currentStage',
      ),
      'currentStage',
    );

  const outcome =
    value.outcome;

  if (
    outcome !== null
    && outcome !== 'breakout'
    && outcome !== 'rejection'
  ) {
    throw new Error(
      'Invalid setup lifecycle event: outcome',
    );
  }

  const candidate =
    parseSetupRuntimeCandidate(
      value.candidate,
    );

  if (
    candidate.id !== candidateId
    || candidate.symbol !== symbol
    || candidate.stage !== currentStage
    || candidate.setupType !== setupType
    || candidate.direction !== direction
    || candidate.outcome !== outcome
  ) {
    throw new Error(
      'Setup lifecycle candidate does not match event',
    );
  }

  return {
    eventId,
    type,
    occurredAt,
    candidateId,
    symbol,
    setupType,
    direction,
    previousStage,
    currentStage,
    outcome,
    candidate,
  };
}

function parseReadyPayload(
  value: unknown,
): SetupLifecycleStreamReady {
  if (
    !isRecord(
      value,
    )
  ) {
    throw new Error(
      'Invalid setup lifecycle ready payload',
    );
  }

  const connectedAt =
    readString(
      value,
      'connectedAt',
    );

  if (
    !Number.isFinite(
      Date.parse(
        connectedAt,
      ),
    )
  ) {
    throw new Error(
      'Invalid setup lifecycle ready timestamp',
    );
  }

  const replayLimit =
    value.replayLimit;

  if (
    typeof replayLimit !== 'number'
    || !Number.isSafeInteger(
      replayLimit,
    )
    || replayLimit <= 0
  ) {
    throw new Error(
      'Invalid setup lifecycle replay limit',
    );
  }

  const firstEventId =
    value.firstEventId;

  const lastEventId =
    value.lastEventId;

  if (
    (
      firstEventId !== null
      && (
        typeof firstEventId !== 'number'
        || !Number.isSafeInteger(
          firstEventId,
        )
        || firstEventId <= 0
      )
    )
    || (
      lastEventId !== null
      && (
        typeof lastEventId !== 'number'
        || !Number.isSafeInteger(
          lastEventId,
        )
        || lastEventId <= 0
      )
    )
  ) {
    throw new Error(
      'Invalid setup lifecycle ready event range',
    );
  }

  const filtersValue =
    value.filters;

  const filters =
    isRecord(
      filtersValue,
    )
      ? {
          ...(
            typeof filtersValue.candidateId
            === 'string'
              ? {
                  candidateId:
                    normalizeCandidateId(
                      filtersValue.candidateId,
                    ),
                }
              : {}
          ),

          ...(
            typeof filtersValue.symbol
            === 'string'
              ? {
                  symbol:
                    normalizeSymbol(
                      filtersValue.symbol,
                    ),
                }
              : {}
          ),
        }
      : {};

  return {
    connectedAt,
    firstEventId,
    lastEventId,
    replayLimit,
    filters,
  };
}

function defaultEventSourceFactory(
  url: string,
): EventSource {
  return new EventSource(
    url,
  );
}

function toError(
  value: unknown,
  fallback:
    string,
): Error {
  return value instanceof Error
    ? value
    : new Error(
        fallback,
      );
}

export class SetupLifecycleStreamClient {
  private readonly url:
    string;

  private readonly eventSourceFactory:
    SetupLifecycleEventSourceFactory;

  private readonly listeners =
    new Set<
      SetupLifecycleClientListener
    >();

  private source:
    EventSource
    | null = null;

  private detachSourceListeners:
    (() => void)
    | null = null;

  private state:
    SetupLifecycleStreamState =
      'idle';

  private ready:
    SetupLifecycleStreamReady
    | null = null;

  private lastEvent:
    SetupLifecycleStreamEvent
    | null = null;

  private error:
    Error
    | null = null;

  constructor(
    options:
      SetupLifecycleStreamOptions = {},
  ) {
    this.url =
      buildSetupLifecycleStreamUrl(
        options,
      );

    this.eventSourceFactory =
      options.eventSourceFactory
      ?? defaultEventSourceFactory;
  }

  connect(): void {
    if (
      this.source
      !== null
    ) {
      return;
    }

    this.setState(
      'connecting',
      null,
    );

    let source:
      EventSource;

    try {
      source =
        this.eventSourceFactory(
          this.url,
        );
    } catch (
      error:
        unknown
    ) {
      this.setState(
        'error',
        toError(
          error,
          'Failed to create setup lifecycle stream',
        ),
      );

      return;
    }

    this.source =
      source;

    const handleOpen =
      () => {
        if (
          this.source
          !== source
        ) {
          return;
        }

        this.setState(
          'open',
          null,
        );
      };

    const handleError =
      () => {
        if (
          this.source
          !== source
        ) {
          return;
        }

        this.setState(
          source.readyState
          === EVENT_SOURCE_CONNECTING
            ? 'reconnecting'
            : 'error',
          new Error(
            'Setup lifecycle stream interrupted',
          ),
        );
      };

    const handleReady =
      (
        event:
          Event,
      ) => {
        try {
          const data =
            (
              event as
                MessageEvent<string>
            ).data;

          if (
            typeof data !== 'string'
          ) {
            throw new Error(
              'Setup lifecycle ready event has no data',
            );
          }

          this.ready =
            parseReadyPayload(
              JSON.parse(
                data,
              ) as unknown,
            );

          this.error =
            null;

          this.notify();
        } catch (
          error:
            unknown
        ) {
          this.setState(
            this.state,
            toError(
              error,
              'Failed to parse setup lifecycle ready event',
            ),
          );
        }
      };

    const handleSetupEvent =
      (
        event:
          Event,
      ) => {
        try {
          const data =
            (
              event as
                MessageEvent<string>
            ).data;

          if (
            typeof data !== 'string'
          ) {
            throw new Error(
              'Setup lifecycle event has no data',
            );
          }

          this.lastEvent =
            parseSetupLifecycleEvent(
              JSON.parse(
                data,
              ) as unknown,
            );

          this.error =
            null;

          this.notify();
        } catch (
          error:
            unknown
        ) {
          this.setState(
            this.state,
            toError(
              error,
              'Failed to parse setup lifecycle event',
            ),
          );
        }
      };

    source.addEventListener(
      'open',
      handleOpen,
    );

    source.addEventListener(
      'error',
      handleError,
    );

    source.addEventListener(
      'ready',
      handleReady,
    );

    source.addEventListener(
      'setup_event',
      handleSetupEvent,
    );

    this.detachSourceListeners =
      () => {
        source.removeEventListener(
          'open',
          handleOpen,
        );

        source.removeEventListener(
          'error',
          handleError,
        );

        source.removeEventListener(
          'ready',
          handleReady,
        );

        source.removeEventListener(
          'setup_event',
          handleSetupEvent,
        );
      };
  }

  close(): void {
    this.detachSourceListeners?.();

    this.detachSourceListeners =
      null;

    this.source?.close();

    this.source =
      null;

    this.setState(
      'closed',
      null,
    );
  }

  subscribe(
    listener:
      SetupLifecycleClientListener,
  ): () => void {
    this.listeners.add(
      listener,
    );

    listener(
      this.getSnapshot(),
    );

    return () => {
      this.listeners.delete(
        listener,
      );
    };
  }

  getSnapshot():
  SetupLifecycleClientSnapshot {
    return {
      state:
        this.state,

      ready:
        this.ready,

      lastEvent:
        this.lastEvent,

      error:
        this.error,
    };
  }

  private setState(
    state:
      SetupLifecycleStreamState,

    error:
      Error
      | null,
  ): void {
    this.state =
      state;

    this.error =
      error;

    this.notify();
  }

  private notify(): void {
    const snapshot =
      this.getSnapshot();

    for (
      const listener
      of this.listeners
    ) {
      listener(
        snapshot,
      );
    }
  }
}
