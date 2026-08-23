export const SETUP_REPLAY_RUNTIME_PATH =
  '/api/v1/setups/candidates';

export const SETUP_REPLAY_RUNTIME_CONTRACT_VERSION =
  'real-setup-replay-v0.1' as const;

export type SetupReplayRuntimeResult =
  | 'active'
  | 'breakout_confirmed'
  | 'rejection_confirmed'
  | 'expired';

export type SetupReplayRuntimeStage =
  | 'LEVEL_CONFIRMED'
  | 'APPROACHING_THIRD_TOUCH'
  | 'THIRD_TOUCH_CONFIRMED'
  | 'BREAKOUT_CONFIRMED'
  | 'REJECTION_CONFIRMED'
  | 'SETUP_EXPIRED';

export type SetupReplayRuntimeEventType =
  | 'candidate_created'
  | 'stage_transition'
  | 'breakout_confirmed'
  | 'rejection_confirmed'
  | 'setup_expired';

export interface SetupReplayRuntimeLevel {
  kind:
    | 'support'
    | 'resistance';
  centerPrice: number;
  zoneLow: number;
  zoneHigh: number;
  touches: number;
  confirmedAt: string;
}

export interface SetupReplayRuntimeFrame {
  index: number;
  eventId: number;
  type: SetupReplayRuntimeEventType;
  occurredAt: string;
  previousStage: SetupReplayRuntimeStage | null;
  currentStage: SetupReplayRuntimeStage;
  outcome:
    | 'breakout'
    | 'rejection'
    | null;
  currentPrice: number;
  distanceToLevelPct: number;
  snapshotUpdatedAt: string;
  expiresAt: string;
  level: SetupReplayRuntimeLevel;
  episodeId: string | null;
  lineId: string | null;
}

export interface SetupReplayRuntimeCapabilities {
  lifecycleFrames: true;
  eventSnapshotPrices: true;
  candles: false;
  aggTrades: false;
  orderBook: false;
  pnl: false;
}

export interface SetupReplayRuntimeSession {
  id: string;
  setupId: string;
  candidateId: string;
  symbol: string;
  timeframe: string;
  setupType:
    | 'level_breakout'
    | 'level_bounce';
  direction:
    | 'long'
    | 'short';
  detectedAt: string;
  firstRetainedAt: string;
  latestEventAt: string;
  completedAt: string | null;
  result: SetupReplayRuntimeResult;
  historyComplete: boolean;
  firstEventId: number;
  lastEventId: number;
  frameCount: number;
  episodeId: string | null;
  lineId: string | null;
  frames: SetupReplayRuntimeFrame[];
}

export interface SetupReplayRuntimePersistenceStatus {
  state:
    | 'pending'
    | 'loading'
    | 'ready'
    | 'degraded';
  version: number | null;
  hydrated: boolean;
  writable: boolean;
  lastPersistedAt: string | null;
  lastErrorCode: string | null;
}

export interface SetupReplayRuntimeSourceStatus {
  state:
    | 'idle'
    | 'running'
    | 'stopped';
  eventsCount: number;
  droppedEventsCount: number;
  persistence:
    SetupReplayRuntimePersistenceStatus
    | null;
}

export interface SetupReplayRuntimeViewData {
  version:
    typeof SETUP_REPLAY_RUNTIME_CONTRACT_VERSION;
  source: SetupReplayRuntimeSourceStatus;
  capabilities: SetupReplayRuntimeCapabilities;
  session: SetupReplayRuntimeSession;
}

export interface SetupReplayRuntimeFetchOptions {
  baseUrl?: string;
  signal?: AbortSignal;
  fetcher?: typeof globalThis.fetch;
}

export const SETUP_REPLAY_RUNTIME_RESULT_LABELS:
Record<
  SetupReplayRuntimeResult,
  string
> = {
  active:
    'В процессе',

  breakout_confirmed:
    'Пробой подтверждён',

  rejection_confirmed:
    'Реакция подтверждена',

  expired:
    'Истёк',
};

const STAGES:
readonly SetupReplayRuntimeStage[] = [
  'LEVEL_CONFIRMED',
  'APPROACHING_THIRD_TOUCH',
  'THIRD_TOUCH_CONFIRMED',
  'BREAKOUT_CONFIRMED',
  'REJECTION_CONFIRMED',
  'SETUP_EXPIRED',
];

const EVENT_TYPES:
readonly SetupReplayRuntimeEventType[] = [
  'candidate_created',
  'stage_transition',
  'breakout_confirmed',
  'rejection_confirmed',
  'setup_expired',
];

const RESULTS:
readonly SetupReplayRuntimeResult[] = [
  'active',
  'breakout_confirmed',
  'rejection_confirmed',
  'expired',
];

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(
      value,
    )
  );
}

function readRecord(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(
      `Invalid Setup Replay runtime payload: ${field}`,
    );
  }

  return value;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value =
    record[key];

  if (
    typeof value !== 'string'
    || value.trim().length === 0
  ) {
    throw new Error(
      `Invalid Setup Replay runtime string: ${key}`,
    );
  }

  return value;
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value =
    record[key];

  if (value === null) {
    return null;
  }

  if (
    typeof value !== 'string'
    || value.trim().length === 0
  ) {
    throw new Error(
      `Invalid Setup Replay runtime nullable string: ${key}`,
    );
  }

  return value;
}

function readTimestamp(
  record: Record<string, unknown>,
  key: string,
): string {
  const value =
    readString(
      record,
      key,
    );

  if (
    !Number.isFinite(
      Date.parse(
        value,
      ),
    )
  ) {
    throw new Error(
      `Invalid Setup Replay runtime timestamp: ${key}`,
    );
  }

  return value;
}

function readNullableTimestamp(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value =
    record[key];

  if (value === null) {
    return null;
  }

  if (
    typeof value !== 'string'
    || !Number.isFinite(
      Date.parse(
        value,
      ),
    )
  ) {
    throw new Error(
      `Invalid Setup Replay runtime nullable timestamp: ${key}`,
    );
  }

  return value;
}

function readFiniteNumber(
  record: Record<string, unknown>,
  key: string,
): number {
  const value =
    record[key];

  if (
    typeof value !== 'number'
    || !Number.isFinite(
      value,
    )
  ) {
    throw new Error(
      `Invalid Setup Replay runtime number: ${key}`,
    );
  }

  return value;
}

function readNonNegativeInteger(
  record: Record<string, unknown>,
  key: string,
): number {
  const value =
    readFiniteNumber(
      record,
      key,
    );

  if (
    !Number.isSafeInteger(
      value,
    )
    || value < 0
  ) {
    throw new Error(
      `Invalid Setup Replay runtime integer: ${key}`,
    );
  }

  return value;
}

function readPositiveInteger(
  record: Record<string, unknown>,
  key: string,
): number {
  const value =
    readNonNegativeInteger(
      record,
      key,
    );

  if (value <= 0) {
    throw new Error(
      `Invalid Setup Replay runtime positive integer: ${key}`,
    );
  }

  return value;
}

function readBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean {
  const value =
    record[key];

  if (
    typeof value !== 'boolean'
  ) {
    throw new Error(
      `Invalid Setup Replay runtime boolean: ${key}`,
    );
  }

  return value;
}

function readLiteralBoolean<
  Value extends boolean,
>(
  record: Record<string, unknown>,
  key: string,
  expected: Value,
): Value {
  const value =
    readBoolean(
      record,
      key,
    );

  if (value !== expected) {
    throw new Error(
      `Unexpected Setup Replay runtime capability: ${key}`,
    );
  }

  return expected;
}

function readEnum<
  Value extends string,
>(
  record: Record<string, unknown>,
  key: string,
  allowed:
    readonly Value[],
): Value {
  const value =
    readString(
      record,
      key,
    );

  if (
    !allowed.includes(
      value as Value,
    )
  ) {
    throw new Error(
      `Invalid Setup Replay runtime enum: ${key}`,
    );
  }

  return value as Value;
}

function parseOutcome(
  record: Record<string, unknown>,
): SetupReplayRuntimeFrame['outcome'] {
  const value =
    record.outcome;

  if (value === null) {
    return null;
  }

  if (
    value !== 'breakout'
    && value !== 'rejection'
  ) {
    throw new Error(
      'Invalid Setup Replay runtime outcome',
    );
  }

  return value;
}

function parseLevel(
  value: unknown,
): SetupReplayRuntimeLevel {
  const level =
    readRecord(
      value,
      'level',
    );

  const kind =
    readString(
      level,
      'kind',
    );

  if (
    kind !== 'support'
    && kind !== 'resistance'
  ) {
    throw new Error(
      'Invalid Setup Replay runtime level kind',
    );
  }

  return {
    kind,
    centerPrice:
      readFiniteNumber(
        level,
        'centerPrice',
      ),
    zoneLow:
      readFiniteNumber(
        level,
        'zoneLow',
      ),
    zoneHigh:
      readFiniteNumber(
        level,
        'zoneHigh',
      ),
    touches:
      readNonNegativeInteger(
        level,
        'touches',
      ),
    confirmedAt:
      readTimestamp(
        level,
        'confirmedAt',
      ),
  };
}

function parseFrame(
  value: unknown,
): SetupReplayRuntimeFrame {
  const frame =
    readRecord(
      value,
      'frame',
    );

  const previousStageValue =
    frame.previousStage;

  const previousStage =
    previousStageValue === null
      ? null
      : readEnum(
          frame,
          'previousStage',
          STAGES,
        );

  return {
    index:
      readNonNegativeInteger(
        frame,
        'index',
      ),
    eventId:
      readPositiveInteger(
        frame,
        'eventId',
      ),
    type:
      readEnum(
        frame,
        'type',
        EVENT_TYPES,
      ),
    occurredAt:
      readTimestamp(
        frame,
        'occurredAt',
      ),
    previousStage,
    currentStage:
      readEnum(
        frame,
        'currentStage',
        STAGES,
      ),
    outcome:
      parseOutcome(
        frame,
      ),
    currentPrice:
      readFiniteNumber(
        frame,
        'currentPrice',
      ),
    distanceToLevelPct:
      readFiniteNumber(
        frame,
        'distanceToLevelPct',
      ),
    snapshotUpdatedAt:
      readTimestamp(
        frame,
        'snapshotUpdatedAt',
      ),
    expiresAt:
      readTimestamp(
        frame,
        'expiresAt',
      ),
    level:
      parseLevel(
        frame.level,
      ),
    episodeId:
      readNullableString(
        frame,
        'episodeId',
      ),
    lineId:
      readNullableString(
        frame,
        'lineId',
      ),
  };
}

function parsePersistence(
  value: unknown,
): SetupReplayRuntimePersistenceStatus | null {
  if (value === null) {
    return null;
  }

  const persistence =
    readRecord(
      value,
      'persistence',
    );

  const state =
    readString(
      persistence,
      'state',
    );

  if (
    state !== 'pending'
    && state !== 'loading'
    && state !== 'ready'
    && state !== 'degraded'
  ) {
    throw new Error(
      'Invalid Setup Replay runtime persistence state',
    );
  }

  const version =
    persistence.version;

  if (
    version !== null
    && (
      typeof version !== 'number'
      || !Number.isSafeInteger(
        version,
      )
      || version <= 0
    )
  ) {
    throw new Error(
      'Invalid Setup Replay runtime persistence version',
    );
  }

  return {
    state,
    version:
      version as number | null,
    hydrated:
      readBoolean(
        persistence,
        'hydrated',
      ),
    writable:
      readBoolean(
        persistence,
        'writable',
      ),
    lastPersistedAt:
      readNullableTimestamp(
        persistence,
        'lastPersistedAt',
      ),
    lastErrorCode:
      readNullableString(
        persistence,
        'lastErrorCode',
      ),
  };
}

export function parseSetupReplayRuntimeResponse(
  value: unknown,
): SetupReplayRuntimeViewData {
  const response =
    readRecord(
      value,
      'response',
    );

  if (
    readString(
      response,
      'version',
    )
    !== SETUP_REPLAY_RUNTIME_CONTRACT_VERSION
  ) {
    throw new Error(
      'Unsupported Setup Replay runtime contract version',
    );
  }

  const source =
    readRecord(
      response.source,
      'source',
    );

  const sourceState =
    readString(
      source,
      'state',
    );

  if (
    sourceState !== 'idle'
    && sourceState !== 'running'
    && sourceState !== 'stopped'
  ) {
    throw new Error(
      'Invalid Setup Replay runtime source state',
    );
  }

  const capabilities =
    readRecord(
      response.capabilities,
      'capabilities',
    );

  const session =
    readRecord(
      response.session,
      'session',
    );

  const setupType =
    readString(
      session,
      'setupType',
    );

  if (
    setupType !== 'level_breakout'
    && setupType !== 'level_bounce'
  ) {
    throw new Error(
      'Invalid Setup Replay runtime setup type',
    );
  }

  const direction =
    readString(
      session,
      'direction',
    );

  if (
    direction !== 'long'
    && direction !== 'short'
  ) {
    throw new Error(
      'Invalid Setup Replay runtime direction',
    );
  }

  const framesValue =
    session.frames;

  if (
    !Array.isArray(
      framesValue,
    )
    || framesValue.length === 0
  ) {
    throw new Error(
      'Invalid Setup Replay runtime frames',
    );
  }

  const frames =
    framesValue.map(
      parseFrame,
    );

  const frameCount =
    readPositiveInteger(
      session,
      'frameCount',
    );

  if (
    frameCount
    !== frames.length
  ) {
    throw new Error(
      'Setup Replay runtime frameCount mismatch',
    );
  }

  return {
    version:
      SETUP_REPLAY_RUNTIME_CONTRACT_VERSION,

    source: {
      state:
        sourceState,
      eventsCount:
        readNonNegativeInteger(
          source,
          'eventsCount',
        ),
      droppedEventsCount:
        readNonNegativeInteger(
          source,
          'droppedEventsCount',
        ),
      persistence:
        parsePersistence(
          source.persistence,
        ),
    },

    capabilities: {
      lifecycleFrames:
        readLiteralBoolean(
          capabilities,
          'lifecycleFrames',
          true,
        ),
      eventSnapshotPrices:
        readLiteralBoolean(
          capabilities,
          'eventSnapshotPrices',
          true,
        ),
      candles:
        readLiteralBoolean(
          capabilities,
          'candles',
          false,
        ),
      aggTrades:
        readLiteralBoolean(
          capabilities,
          'aggTrades',
          false,
        ),
      orderBook:
        readLiteralBoolean(
          capabilities,
          'orderBook',
          false,
        ),
      pnl:
        readLiteralBoolean(
          capabilities,
          'pnl',
          false,
        ),
    },

    session: {
      id:
        readString(
          session,
          'id',
        ),
      setupId:
        readString(
          session,
          'setupId',
        ),
      candidateId:
        readString(
          session,
          'candidateId',
        ),
      symbol:
        readString(
          session,
          'symbol',
        ),
      timeframe:
        readString(
          session,
          'timeframe',
        ),
      setupType,
      direction,
      detectedAt:
        readTimestamp(
          session,
          'detectedAt',
        ),
      firstRetainedAt:
        readTimestamp(
          session,
          'firstRetainedAt',
        ),
      latestEventAt:
        readTimestamp(
          session,
          'latestEventAt',
        ),
      completedAt:
        readNullableTimestamp(
          session,
          'completedAt',
        ),
      result:
        readEnum(
          session,
          'result',
          RESULTS,
        ),
      historyComplete:
        readBoolean(
          session,
          'historyComplete',
        ),
      firstEventId:
        readPositiveInteger(
          session,
          'firstEventId',
        ),
      lastEventId:
        readPositiveInteger(
          session,
          'lastEventId',
        ),
      frameCount,
      episodeId:
        readNullableString(
          session,
          'episodeId',
        ),
      lineId:
        readNullableString(
          session,
          'lineId',
        ),
      frames,
    },
  };
}

function resolveBaseUrl(
  value: string | undefined,
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

export function buildSetupReplayRuntimeUrl(
  candidateId: string,
  options:
    Pick<
      SetupReplayRuntimeFetchOptions,
      'baseUrl'
    > = {},
): string {
  const normalizedCandidateId =
    candidateId.trim();

  if (!normalizedCandidateId) {
    throw new Error(
      'Setup Replay candidate id is required',
    );
  }

  return (
    resolveBaseUrl(
      options.baseUrl,
    )
    + SETUP_REPLAY_RUNTIME_PATH
    + '/'
    + encodeURIComponent(
      normalizedCandidateId,
    )
    + '/replay'
  );
}

export function getSetupReplayRuntimeSetupLabel(
  session: Pick<
    SetupReplayRuntimeSession,
    'setupType'
  >,
  frame: Pick<
    SetupReplayRuntimeFrame,
    'level'
  >,
): string {
  if (
    session.setupType
    === 'level_bounce'
  ) {
    return frame.level.kind
      === 'support'
        ? 'Отскок от поддержки'
        : 'Отскок от сопротивления';
  }

  return frame.level.kind
    === 'support'
      ? 'Пробой поддержки'
      : 'Пробой сопротивления';
}

export async function fetchSetupReplayRuntimeView(
  candidateId: string,
  options:
    SetupReplayRuntimeFetchOptions = {},
): Promise<SetupReplayRuntimeViewData> {
  const fetcher =
    options.fetcher
    ?? globalThis.fetch;

  const response =
    await fetcher(
      buildSetupReplayRuntimeUrl(
        candidateId,
        options,
      ),
      {
        method:
          'GET',

        headers: {
          accept:
            'application/json',
        },

        ...(
          options.signal
            ? {
                signal:
                  options.signal,
              }
            : {}
        ),
      },
    );

  if (!response.ok) {
    throw new Error(
      `Setup Replay runtime request failed with status ${response.status}`,
    );
  }

  const payload:
  unknown =
    await response.json();

  return parseSetupReplayRuntimeResponse(
    payload,
  );
}
