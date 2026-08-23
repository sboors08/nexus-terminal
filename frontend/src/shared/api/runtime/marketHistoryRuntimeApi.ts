export const MARKET_HISTORY_RUNTIME_PATH =
  '/api/v1/setups/history';

export const MARKET_HISTORY_RUNTIME_CONTRACT_VERSION =
  'market-history-runtime-v0.1' as const;

export type MarketHistoryRuntimeResult =
  | 'active'
  | 'breakout_confirmed'
  | 'rejection_confirmed'
  | 'expired';

export type MarketHistoryRuntimeStage =
  | 'LEVEL_CONFIRMED'
  | 'APPROACHING_THIRD_TOUCH'
  | 'THIRD_TOUCH_CONFIRMED'
  | 'BREAKOUT_CONFIRMED'
  | 'REJECTION_CONFIRMED'
  | 'SETUP_EXPIRED';

export type MarketHistoryRuntimeEventType =
  | 'candidate_created'
  | 'stage_transition'
  | 'breakout_confirmed'
  | 'rejection_confirmed'
  | 'setup_expired';

export interface MarketHistoryRuntimeLifecycleEntry {
  eventId: number;
  type: MarketHistoryRuntimeEventType;
  occurredAt: string;
  previousStage: MarketHistoryRuntimeStage | null;
  currentStage: MarketHistoryRuntimeStage;
  outcome: 'breakout' | 'rejection' | null;
}

export interface MarketHistoryRuntimeItem {
  id: string;
  setupId: string;
  symbol: string;
  timeframe: string;
  setupType: 'level_breakout' | 'level_bounce';
  direction: 'long' | 'short';
  detectedAt: string;
  latestEventAt: string;
  completedAt: string | null;
  expiresAt: string;
  result: MarketHistoryRuntimeResult;
  stageAtDetection: MarketHistoryRuntimeStage;
  currentStage: MarketHistoryRuntimeStage;
  outcome: 'breakout' | 'rejection' | null;
  detectedPrice: number;
  currentPrice: number;
  distanceToLevelPct: number;
  level: {
    kind: 'support' | 'resistance';
    centerPrice: number;
    zoneLow: number;
    zoneHigh: number;
    touches: number;
    confirmedAt: string;
  };
  firstEventId: number;
  lastEventId: number;
  lifecycleEventCount: number;
  historyComplete: boolean;
  episodeId: string | null;
  lineId: string | null;
  lifecycle: MarketHistoryRuntimeLifecycleEntry[];
}

export interface MarketHistoryRuntimePersistenceStatus {
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

export interface MarketHistoryRuntimeSourceStatus {
  state:
    | 'idle'
    | 'running'
    | 'stopped';
  eventsCount: number;
  droppedEventsCount: number;
  persistence: MarketHistoryRuntimePersistenceStatus | null;
}

export interface MarketHistoryRuntimeViewData {
  items: MarketHistoryRuntimeItem[];
  resultLabels: Record<MarketHistoryRuntimeResult, string>;
  source: MarketHistoryRuntimeSourceStatus;
}

export interface MarketHistoryRuntimeFetchOptions {
  baseUrl?: string;
  limit?: number;
  signal?: AbortSignal;
  fetcher?: typeof globalThis.fetch;
}

export const MARKET_HISTORY_RUNTIME_RESULT_LABELS:
Record<
  MarketHistoryRuntimeResult,
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
readonly MarketHistoryRuntimeStage[] = [
  'LEVEL_CONFIRMED',
  'APPROACHING_THIRD_TOUCH',
  'THIRD_TOUCH_CONFIRMED',
  'BREAKOUT_CONFIRMED',
  'REJECTION_CONFIRMED',
  'SETUP_EXPIRED',
];

const RESULTS:
readonly MarketHistoryRuntimeResult[] = [
  'active',
  'breakout_confirmed',
  'rejection_confirmed',
  'expired',
];

const EVENT_TYPES:
readonly MarketHistoryRuntimeEventType[] = [
  'candidate_created',
  'stage_transition',
  'breakout_confirmed',
  'rejection_confirmed',
  'setup_expired',
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

function readRecord(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(
      `Invalid Market History runtime payload: ${field}`,
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
      `Invalid Market History runtime string: ${key}`,
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
      `Invalid Market History runtime nullable string: ${key}`,
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
      Date.parse(value),
    )
  ) {
    throw new Error(
      `Invalid Market History runtime timestamp: ${key}`,
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
      Date.parse(value),
    )
  ) {
    throw new Error(
      `Invalid Market History runtime nullable timestamp: ${key}`,
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
    || !Number.isFinite(value)
  ) {
    throw new Error(
      `Invalid Market History runtime number: ${key}`,
    );
  }

  return value;
}

function readNonNegativeNumber(
  record: Record<string, unknown>,
  key: string,
): number {
  const value =
    readFiniteNumber(
      record,
      key,
    );

  if (value < 0) {
    throw new Error(
      `Invalid Market History runtime non-negative number: ${key}`,
    );
  }

  return value;
}

function readPositiveInteger(
  record: Record<string, unknown>,
  key: string,
): number {
  const value =
    readFiniteNumber(
      record,
      key,
    );

  if (
    !Number.isSafeInteger(value)
    || value <= 0
  ) {
    throw new Error(
      `Invalid Market History runtime integer: ${key}`,
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
    !Number.isSafeInteger(value)
    || value < 0
  ) {
    throw new Error(
      `Invalid Market History runtime integer: ${key}`,
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
      `Invalid Market History runtime boolean: ${key}`,
    );
  }

  return value;
}

function readEnum<
  Value extends string,
>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly Value[],
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
      `Invalid Market History runtime enum: ${key}`,
    );
  }

  return value as Value;
}

function readNullableOutcome(
  record: Record<string, unknown>,
  key: string,
): 'breakout' | 'rejection' | null {
  const value =
    record[key];

  if (value === null) {
    return null;
  }

  if (
    value !== 'breakout'
    && value !== 'rejection'
  ) {
    throw new Error(
      `Invalid Market History runtime outcome: ${key}`,
    );
  }

  return value;
}

function parseLifecycleEntry(
  value: unknown,
): MarketHistoryRuntimeLifecycleEntry {
  const entry =
    readRecord(
      value,
      'lifecycle entry',
    );

  const previousStageValue =
    entry.previousStage;

  if (
    previousStageValue !== null
    && (
      typeof previousStageValue !== 'string'
      || !STAGES.includes(
        previousStageValue as MarketHistoryRuntimeStage,
      )
    )
  ) {
    throw new Error(
      'Invalid Market History runtime lifecycle previousStage',
    );
  }

  return {
    eventId:
      readPositiveInteger(
        entry,
        'eventId',
      ),

    type:
      readEnum(
        entry,
        'type',
        EVENT_TYPES,
      ),

    occurredAt:
      readTimestamp(
        entry,
        'occurredAt',
      ),

    previousStage:
      previousStageValue as MarketHistoryRuntimeStage | null,

    currentStage:
      readEnum(
        entry,
        'currentStage',
        STAGES,
      ),

    outcome:
      readNullableOutcome(
        entry,
        'outcome',
      ),
  };
}

function parseItem(
  value: unknown,
): MarketHistoryRuntimeItem {
  const item =
    readRecord(
      value,
      'item',
    );

  const level =
    readRecord(
      item.level,
      'level',
    );

  const lifecycleValue =
    item.lifecycle;

  if (
    !Array.isArray(
      lifecycleValue,
    )
  ) {
    throw new Error(
      'Invalid Market History runtime lifecycle',
    );
  }

  const setupType =
    readString(
      item,
      'setupType',
    );

  if (
    setupType !== 'level_breakout'
    && setupType !== 'level_bounce'
  ) {
    throw new Error(
      'Invalid Market History runtime setupType',
    );
  }

  const direction =
    readString(
      item,
      'direction',
    );

  if (
    direction !== 'long'
    && direction !== 'short'
  ) {
    throw new Error(
      'Invalid Market History runtime direction',
    );
  }

  const levelKind =
    readString(
      level,
      'kind',
    );

  if (
    levelKind !== 'support'
    && levelKind !== 'resistance'
  ) {
    throw new Error(
      'Invalid Market History runtime level kind',
    );
  }

  const firstEventId =
    readPositiveInteger(
      item,
      'firstEventId',
    );

  const lastEventId =
    readPositiveInteger(
      item,
      'lastEventId',
    );

  if (
    lastEventId < firstEventId
  ) {
    throw new Error(
      'Invalid Market History runtime event id range',
    );
  }

  const lifecycle =
    lifecycleValue.map(
      parseLifecycleEntry,
    );

  const lifecycleEventCount =
    readPositiveInteger(
      item,
      'lifecycleEventCount',
    );

  if (
    lifecycle.length
    !== lifecycleEventCount
  ) {
    throw new Error(
      'Invalid Market History runtime lifecycle count',
    );
  }

  return {
    id:
      readString(
        item,
        'id',
      ),

    setupId:
      readString(
        item,
        'setupId',
      ),

    symbol:
      readString(
        item,
        'symbol',
      ),

    timeframe:
      readString(
        item,
        'timeframe',
      ),

    setupType,
    direction,

    detectedAt:
      readTimestamp(
        item,
        'detectedAt',
      ),

    latestEventAt:
      readTimestamp(
        item,
        'latestEventAt',
      ),

    completedAt:
      readNullableTimestamp(
        item,
        'completedAt',
      ),

    expiresAt:
      readTimestamp(
        item,
        'expiresAt',
      ),

    result:
      readEnum(
        item,
        'result',
        RESULTS,
      ),

    stageAtDetection:
      readEnum(
        item,
        'stageAtDetection',
        STAGES,
      ),

    currentStage:
      readEnum(
        item,
        'currentStage',
        STAGES,
      ),

    outcome:
      readNullableOutcome(
        item,
        'outcome',
      ),

    detectedPrice:
      readFiniteNumber(
        item,
        'detectedPrice',
      ),

    currentPrice:
      readFiniteNumber(
        item,
        'currentPrice',
      ),

    distanceToLevelPct:
      readNonNegativeNumber(
        item,
        'distanceToLevelPct',
      ),

    level: {
      kind:
        levelKind,

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
        readPositiveInteger(
          level,
          'touches',
        ),

      confirmedAt:
        readTimestamp(
          level,
          'confirmedAt',
        ),
    },

    firstEventId,
    lastEventId,
    lifecycleEventCount,

    historyComplete:
      readBoolean(
        item,
        'historyComplete',
      ),

    episodeId:
      readNullableString(
        item,
        'episodeId',
      ),

    lineId:
      readNullableString(
        item,
        'lineId',
      ),

    lifecycle,
  };
}

function parsePersistence(
  value: unknown,
): MarketHistoryRuntimePersistenceStatus | null {
  if (value === null) {
    return null;
  }

  const persistence =
    readRecord(
      value,
      'source.persistence',
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
      'Invalid Market History runtime persistence state',
    );
  }

  const versionValue =
    persistence.version;

  if (
    versionValue !== null
    && (
      typeof versionValue !== 'number'
      || !Number.isSafeInteger(
        versionValue,
      )
      || versionValue <= 0
    )
  ) {
    throw new Error(
      'Invalid Market History runtime persistence version',
    );
  }

  return {
    state,

    version:
      versionValue as number | null,

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

export function parseMarketHistoryRuntimeResponse(
  value: unknown,
): MarketHistoryRuntimeViewData {
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
    !== MARKET_HISTORY_RUNTIME_CONTRACT_VERSION
  ) {
    throw new Error(
      'Unsupported Market History runtime contract version',
    );
  }

  const source =
    readRecord(
      response.source,
      'source',
    );

  const state =
    readString(
      source,
      'state',
    );

  if (
    state !== 'idle'
    && state !== 'running'
    && state !== 'stopped'
  ) {
    throw new Error(
      'Invalid Market History runtime source state',
    );
  }

  const items =
    response.items;

  if (
    !Array.isArray(
      items,
    )
  ) {
    throw new Error(
      'Invalid Market History runtime items',
    );
  }

  return {
    items:
      items.map(
        parseItem,
      ),

    resultLabels: {
      ...MARKET_HISTORY_RUNTIME_RESULT_LABELS,
    },

    source: {
      state,

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

export function buildMarketHistoryRuntimeUrl(
  options:
    Pick<
      MarketHistoryRuntimeFetchOptions,
      | 'baseUrl'
      | 'limit'
    > = {},
): string {
  const limit =
    options.limit
    ?? 500;

  if (
    !Number.isInteger(
      limit,
    )
    || limit < 1
    || limit > 500
  ) {
    throw new Error(
      'Market History runtime limit must be between 1 and 500',
    );
  }

  const query =
    new URLSearchParams({
      limit:
        String(
          limit,
        ),
    });

  return (
    resolveBaseUrl(
      options.baseUrl,
    )
    + MARKET_HISTORY_RUNTIME_PATH
    + '?'
    + query.toString()
  );
}

export function getMarketHistoryRuntimeSetupLabel(
  item: Pick<
    MarketHistoryRuntimeItem,
    | 'setupType'
    | 'level'
  >,
): string {
  if (
    item.setupType
    === 'level_bounce'
  ) {
    return item.level.kind
      === 'support'
        ? 'Отскок от поддержки'
        : 'Отскок от сопротивления';
  }

  return item.level.kind
    === 'support'
      ? 'Пробой поддержки'
      : 'Пробой сопротивления';
}

export async function fetchMarketHistoryRuntimeView(
  options:
    MarketHistoryRuntimeFetchOptions = {},
): Promise<MarketHistoryRuntimeViewData> {
  const fetcher =
    options.fetcher
    ?? globalThis.fetch;

  const response =
    await fetcher(
      buildMarketHistoryRuntimeUrl(
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
      `Market History runtime request failed with status ${response.status}`,
    );
  }

  const payload:
  unknown =
    await response.json();

  return parseMarketHistoryRuntimeResponse(
    payload,
  );
}
