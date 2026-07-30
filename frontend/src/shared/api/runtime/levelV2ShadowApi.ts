export const LEVEL_V2_SHADOW_SNAPSHOTS_PATH =
  '/api/v1/setups/levels-v2/shadow/snapshots';

export type LevelV2ShadowKind =
  | 'support'
  | 'resistance';

export type LevelV2ShadowLifecycleStatus =
  | 'forming'
  | 'active'
  | 'testing'
  | 'broken'
  | 'retest_pending'
  | 'flipped'
  | 'expired';

export interface LevelV2ShadowScore {
  total: number;
  touches: number;
  reactions: number;
  cleanliness: number;
  spacing: number;
  freshness: number;
  precision: number;
  structureEdge: number;
}

export interface LevelV2ShadowZoneGeometry {
  referencePrice: number;
  coreLow: number;
  coreHigh: number;
  outerLow: number;
  outerHigh: number;
  liquidityLow: number;
  liquidityHigh: number;
  widthPct: number;
  widthAtr: number;
}

export interface LevelV2ShadowDetectedZone {
  id: string;
  version: 2;
  symbol: string;
  timeframe: string;
  kind: LevelV2ShadowKind;
  zone: LevelV2ShadowZoneGeometry;
  touchesCount: number;
  firstTouchAt: string;
  lastTouchAt: string;
  firstTouchCandleIndex: number;
  lastTouchCandleIndex: number;
  score: LevelV2ShadowScore;
}

export interface LevelV2ShadowLifecycleState {
  id: string;
  level: LevelV2ShadowDetectedZone;
  originalKind: LevelV2ShadowKind;
  currentKind: LevelV2ShadowKind;
  status: LevelV2ShadowLifecycleStatus;
  qualifiedTouchesCount: number;
  eligibleForSetups: boolean;
  registeredAt: string;
  testingStartedAt: string | null;
  brokenAt: string | null;
  breakConfirmedAt: string | null;
  retestStartedAt: string | null;
  flippedAt: string | null;
  expiredAt: string | null;
  lastProcessedCloseTime: string;
}

export interface LevelV2ShadowSnapshot {
  symbol: string;
  timeframe: '1m';
  generatedAt: string;
  sourceCandlesCount: number;
  closedCandlesCount: number;
  detectedZonesCount: number;
  rejectedZonesCount: number;
  levels: LevelV2ShadowLifecycleState[];
}

export interface LevelV2ShadowSnapshotFilters {
  symbol: string | null;
  kind: LevelV2ShadowKind | null;
  status: LevelV2ShadowLifecycleStatus | null;
  eligibleForSetups: boolean | null;
  minScore: number | null;
  limit: number;
}

export interface LevelV2ShadowSnapshotListResponse {
  items: LevelV2ShadowSnapshot[];
  count: number;
  totalSnapshots: number;
  filters: LevelV2ShadowSnapshotFilters;
}

export type LevelV2ShadowFetch =
  typeof globalThis.fetch;

export interface LevelV2ShadowFetchOptions {
  baseUrl?: string;
  signal?: AbortSignal;
  fetcher?: LevelV2ShadowFetch;
}

export interface FetchLevelV2ShadowSnapshotsOptions
  extends LevelV2ShadowFetchOptions {
  symbol?: string;
  kind?: LevelV2ShadowKind;
  status?: LevelV2ShadowLifecycleStatus;
  eligibleForSetups?: boolean;
  minScore?: number;
  limit?: number;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const LEVEL_KINDS:
readonly LevelV2ShadowKind[] = [
  'support',
  'resistance',
];

const LIFECYCLE_STATUSES:
readonly LevelV2ShadowLifecycleStatus[] = [
  'forming',
  'active',
  'testing',
  'broken',
  'retest_pending',
  'flipped',
  'expired',
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
      `Invalid Level v2 shadow response: ${field}`,
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
      `Invalid Level v2 shadow string: ${key}`,
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
      `Invalid Level v2 shadow nullable string: ${key}`,
    );
  }

  return value;
}

function readNumber(
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
      `Invalid Level v2 shadow number: ${key}`,
    );
  }

  return value;
}

function readInteger(
  record: Record<string, unknown>,
  key: string,
): number {
  const value =
    readNumber(
      record,
      key,
    );

  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `Invalid Level v2 shadow integer: ${key}`,
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

  if (typeof value !== 'boolean') {
    throw new Error(
      `Invalid Level v2 shadow boolean: ${key}`,
    );
  }

  return value;
}

function parseKind(
  value: unknown,
  field: string,
): LevelV2ShadowKind {
  if (
    typeof value !== 'string'
    || !LEVEL_KINDS.includes(
      value as LevelV2ShadowKind,
    )
  ) {
    throw new Error(
      `Invalid Level v2 shadow kind: ${field}`,
    );
  }

  return value as LevelV2ShadowKind;
}

function parseStatus(
  value: unknown,
): LevelV2ShadowLifecycleStatus {
  if (
    typeof value !== 'string'
    || !LIFECYCLE_STATUSES.includes(
      value as LevelV2ShadowLifecycleStatus,
    )
  ) {
    throw new Error(
      'Invalid Level v2 shadow lifecycle status',
    );
  }

  return value as
    LevelV2ShadowLifecycleStatus;
}

function parseNullableKind(
  value: unknown,
): LevelV2ShadowKind | null {
  return value === null
    ? null
    : parseKind(
        value,
        'filters.kind',
      );
}

function parseNullableStatus(
  value: unknown,
): LevelV2ShadowLifecycleStatus | null {
  return value === null
    ? null
    : parseStatus(value);
}

function parseNullableBoolean(
  value: unknown,
  field: string,
): boolean | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'boolean') {
    throw new Error(
      `Invalid Level v2 shadow boolean: ${field}`,
    );
  }

  return value;
}

function parseNullableNumber(
  value: unknown,
  field: string,
): number | null {
  if (value === null) {
    return null;
  }

  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
  ) {
    throw new Error(
      `Invalid Level v2 shadow number: ${field}`,
    );
  }

  return value;
}

function parseScore(
  value: unknown,
): LevelV2ShadowScore {
  const score =
    readRecord(
      value,
      'level.score',
    );

  return {
    total:
      readNumber(score, 'total'),
    touches:
      readNumber(score, 'touches'),
    reactions:
      readNumber(score, 'reactions'),
    cleanliness:
      readNumber(score, 'cleanliness'),
    spacing:
      readNumber(score, 'spacing'),
    freshness:
      readNumber(score, 'freshness'),
    precision:
      readNumber(score, 'precision'),
    structureEdge:
      readNumber(score, 'structureEdge'),
  };
}

function parseZoneGeometry(
  value: unknown,
): LevelV2ShadowZoneGeometry {
  const zone =
    readRecord(
      value,
      'level.zone',
    );

  return {
    referencePrice:
      readNumber(zone, 'referencePrice'),
    coreLow:
      readNumber(zone, 'coreLow'),
    coreHigh:
      readNumber(zone, 'coreHigh'),
    outerLow:
      readNumber(zone, 'outerLow'),
    outerHigh:
      readNumber(zone, 'outerHigh'),
    liquidityLow:
      readNumber(zone, 'liquidityLow'),
    liquidityHigh:
      readNumber(zone, 'liquidityHigh'),
    widthPct:
      readNumber(zone, 'widthPct'),
    widthAtr:
      readNumber(zone, 'widthAtr'),
  };
}

function parseDetectedZone(
  value: unknown,
): LevelV2ShadowDetectedZone {
  const level =
    readRecord(
      value,
      'level',
    );

  const version =
    readInteger(
      level,
      'version',
    );

  if (version !== 2) {
    throw new Error(
      'Invalid Level v2 shadow level version',
    );
  }

  return {
    id:
      readString(level, 'id'),
    version:
      2,
    symbol:
      readString(level, 'symbol'),
    timeframe:
      readString(level, 'timeframe'),
    kind:
      parseKind(
        level.kind,
        'level.kind',
      ),
    zone:
      parseZoneGeometry(
        level.zone,
      ),
    touchesCount:
      readInteger(
        level,
        'touchesCount',
      ),
    firstTouchAt:
      readString(
        level,
        'firstTouchAt',
      ),
    lastTouchAt:
      readString(
        level,
        'lastTouchAt',
      ),
    firstTouchCandleIndex:
      readInteger(
        level,
        'firstTouchCandleIndex',
      ),
    lastTouchCandleIndex:
      readInteger(
        level,
        'lastTouchCandleIndex',
      ),
    score:
      parseScore(
        level.score,
      ),
  };
}

function parseLifecycleState(
  value: unknown,
): LevelV2ShadowLifecycleState {
  const state =
    readRecord(
      value,
      'lifecycle state',
    );

  return {
    id:
      readString(state, 'id'),
    level:
      parseDetectedZone(
        state.level,
      ),
    originalKind:
      parseKind(
        state.originalKind,
        'originalKind',
      ),
    currentKind:
      parseKind(
        state.currentKind,
        'currentKind',
      ),
    status:
      parseStatus(
        state.status,
      ),
    qualifiedTouchesCount:
      readInteger(
        state,
        'qualifiedTouchesCount',
      ),
    eligibleForSetups:
      readBoolean(
        state,
        'eligibleForSetups',
      ),
    registeredAt:
      readString(
        state,
        'registeredAt',
      ),
    testingStartedAt:
      readNullableString(
        state,
        'testingStartedAt',
      ),
    brokenAt:
      readNullableString(
        state,
        'brokenAt',
      ),
    breakConfirmedAt:
      readNullableString(
        state,
        'breakConfirmedAt',
      ),
    retestStartedAt:
      readNullableString(
        state,
        'retestStartedAt',
      ),
    flippedAt:
      readNullableString(
        state,
        'flippedAt',
      ),
    expiredAt:
      readNullableString(
        state,
        'expiredAt',
      ),
    lastProcessedCloseTime:
      readString(
        state,
        'lastProcessedCloseTime',
      ),
  };
}

function parseSnapshot(
  value: unknown,
): LevelV2ShadowSnapshot {
  const snapshot =
    readRecord(
      value,
      'snapshot',
    );

  const timeframe =
    readString(
      snapshot,
      'timeframe',
    );

  if (timeframe !== '1m') {
    throw new Error(
      'Invalid Level v2 shadow timeframe',
    );
  }

  if (!Array.isArray(snapshot.levels)) {
    throw new Error(
      'Invalid Level v2 shadow levels',
    );
  }

  return {
    symbol:
      readString(
        snapshot,
        'symbol',
      ),
    timeframe,
    generatedAt:
      readString(
        snapshot,
        'generatedAt',
      ),
    sourceCandlesCount:
      readInteger(
        snapshot,
        'sourceCandlesCount',
      ),
    closedCandlesCount:
      readInteger(
        snapshot,
        'closedCandlesCount',
      ),
    detectedZonesCount:
      readInteger(
        snapshot,
        'detectedZonesCount',
      ),
    rejectedZonesCount:
      readInteger(
        snapshot,
        'rejectedZonesCount',
      ),
    levels:
      snapshot.levels.map(
        parseLifecycleState,
      ),
  };
}

export function parseLevelV2ShadowSnapshotListResponse(
  value: unknown,
): LevelV2ShadowSnapshotListResponse {
  const response =
    readRecord(
      value,
      'snapshot list',
    );

  if (!Array.isArray(response.items)) {
    throw new Error(
      'Invalid Level v2 shadow snapshot items',
    );
  }

  const filters =
    readRecord(
      response.filters,
      'snapshot filters',
    );

  const symbol =
    filters.symbol;

  if (
    symbol !== null
    && (
      typeof symbol !== 'string'
      || symbol.trim().length === 0
    )
  ) {
    throw new Error(
      'Invalid Level v2 shadow filter symbol',
    );
  }

  return {
    items:
      response.items.map(
        parseSnapshot,
      ),
    count:
      readInteger(
        response,
        'count',
      ),
    totalSnapshots:
      readInteger(
        response,
        'totalSnapshots',
      ),
    filters: {
      symbol,
      kind:
        parseNullableKind(
          filters.kind,
        ),
      status:
        parseNullableStatus(
          filters.status,
        ),
      eligibleForSetups:
        parseNullableBoolean(
          filters.eligibleForSetups,
          'filters.eligibleForSetups',
        ),
      minScore:
        parseNullableNumber(
          filters.minScore,
          'filters.minScore',
        ),
      limit:
        readInteger(
          filters,
          'limit',
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
      .replace(/\/+$/, '')
    ?? ''
  );
}

function normalizeSymbol(
  value: string,
): string {
  const symbol =
    value
      .trim()
      .replace(
        /\//gu,
        '',
      )
      .toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new Error(
      'Invalid Level v2 shadow symbol',
    );
  }

  return symbol;
}

export function buildLevelV2ShadowSnapshotsUrl(
  options:
    Pick<
      FetchLevelV2ShadowSnapshotsOptions,
      | 'baseUrl'
      | 'symbol'
      | 'kind'
      | 'status'
      | 'eligibleForSetups'
      | 'minScore'
      | 'limit'
    > = {},
): string {
  const limit =
    options.limit ?? 100;

  if (
    !Number.isInteger(limit)
    || limit < 1
    || limit > 500
  ) {
    throw new Error(
      'Level v2 shadow limit must be between 1 and 500',
    );
  }

  if (
    options.minScore !== undefined
    && (
      !Number.isFinite(
        options.minScore,
      )
      || options.minScore < 0
      || options.minScore > 100
    )
  ) {
    throw new Error(
      'Level v2 shadow minScore must be between 0 and 100',
    );
  }

  const query =
    new URLSearchParams({
      limit:
        String(limit),
    });

  if (options.symbol !== undefined) {
    query.set(
      'symbol',
      normalizeSymbol(
        options.symbol,
      ),
    );
  }

  if (options.kind !== undefined) {
    query.set(
      'kind',
      options.kind,
    );
  }

  if (options.status !== undefined) {
    query.set(
      'status',
      options.status,
    );
  }

  if (
    options.eligibleForSetups
    !== undefined
  ) {
    query.set(
      'eligibleForSetups',
      String(
        options.eligibleForSetups,
      ),
    );
  }

  if (options.minScore !== undefined) {
    query.set(
      'minScore',
      String(
        options.minScore,
      ),
    );
  }

  return (
    resolveBaseUrl(
      options.baseUrl,
    )
    + LEVEL_V2_SHADOW_SNAPSHOTS_PATH
    + '?'
    + query.toString()
  );
}

const defaultFetch:
LevelV2ShadowFetch = (
  input,
  init,
) =>
  globalThis.fetch(
    input,
    init,
  );

export async function fetchLevelV2ShadowSnapshots(
  options:
    FetchLevelV2ShadowSnapshotsOptions = {},
): Promise<LevelV2ShadowSnapshotListResponse> {
  const response =
    await (
      options.fetcher
      ?? defaultFetch
    )(
      buildLevelV2ShadowSnapshotsUrl(
        options,
      ),
      {
        method:
          'GET',
        headers: {
          accept:
            'application/json',
        },
        signal:
          options.signal,
      },
    );

  let payload:
    unknown = null;

  try {
    payload =
      await response.json();
  } catch {
    payload = null;
  }

  if (
    response.status < 200
    || response.status >= 300
  ) {
    throw new Error(
      `Level v2 shadow request failed: ${response.status}`,
    );
  }

  return parseLevelV2ShadowSnapshotListResponse(
    payload,
  );
}
