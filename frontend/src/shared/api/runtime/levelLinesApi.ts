import type {
  Candle,
} from '../../api/contracts.js';
import {
  normalizeMarketCandleSymbol,
  parseMarketCandle,
} from '../../charts/api/marketCandles.js';

export const LEVEL_LINES_PATH =
  '/api/v1/level-engine/lines';

export const LEVEL_LINES_VERSION =
  'level-lines-v0.1' as const;

export const LEVEL_LINES_TIMEFRAMES = [
  '1m',
  '5m',
  '15m',
  '1h',
  '4h',
] as const;

export type LevelLinesTimeframe =
  typeof LEVEL_LINES_TIMEFRAMES[number];

export type LevelLineKind =
  | 'support'
  | 'resistance';

export type LevelLineStatus =
  | 'candidate'
  | 'confirmed'
  | 'worked'
  | 'superseded'
  | 'broken';

export interface LevelLinesCandle
  extends Candle {
  readonly isClosed: boolean;
}

export interface LevelLineBreakEvidence {
  readonly mode:
    | 'decisive_body_break'
    | 'consecutive_closes';
  readonly fromKind:
    LevelLineKind;
  readonly candleIndex: number;
  readonly brokenAt: string;
  readonly boundary: number;
  readonly close: number;
  readonly distanceBeyondBoundary: number;
  readonly distanceBeyondBoundaryAtr:
    number | null;
}

export interface LevelLineSupersessionEvidence {
  readonly mode:
    'more_extreme_right_candle';
  readonly fromKind:
    LevelLineKind;
  readonly candleIndex: number;
  readonly supersededAt: string;
  readonly originPrice: number;
  readonly extremePrice: number;
}

export interface LevelLine {
  readonly id: string;
  readonly symbol: string;
  readonly timeframe:
    LevelLinesTimeframe;
  readonly price: number;
  readonly kind: LevelLineKind;
  readonly originCandleIndex: number;
  readonly originExtremumAt: string;
  readonly originExtremumPrice: number;
  readonly activeFrom: string;
  readonly touchCount: number;
  readonly status: LevelLineStatus;
  readonly workedAt: string | null;
  readonly supersededAt: string | null;
  readonly supersessionEvidence:
    LevelLineSupersessionEvidence | null;
  readonly brokenAt: string | null;
  readonly breakEvidence:
    LevelLineBreakEvidence | null;
}

export interface LevelLinesAppliedOptions {
  readonly atrPeriod: number;
  readonly pivotLeftBars: number;
  readonly pivotRightBars: number;
  readonly originDepartureAtr: number;
  readonly originDepartureMaxCandles: number;
  readonly candidateVisibilityMinDepartureAtr:
    number;
  readonly candidateVisibilityMaxAgeBars:
    number;
  readonly persistentCandidateMinDepartureAtr:
    number;
  readonly persistentCandidateLookbackBars:
    number;
  readonly originEpisodeMaxSpanCandles: number;
  readonly workedEpisodeMaxSpanCandles: number;
  readonly touchTolerancePercent: number;
  readonly minBarsBetweenTouchEpisodes: number;
  readonly decisiveBreakAtr: number;
  readonly consecutiveBreakCloses: number;
}

export interface LevelLinesSnapshot {
  readonly version:
    typeof LEVEL_LINES_VERSION;
  readonly symbol: string;
  readonly timeframe:
    LevelLinesTimeframe;
  readonly generatedAt: string;
  readonly closedCandlesCount: number;
  readonly ignoredOpenCandlesCount: number;
  readonly candles:
    readonly LevelLinesCandle[];
  readonly lines:
    readonly LevelLine[];
  readonly activeLevels:
    readonly LevelLine[];
  readonly appliedOptions:
    LevelLinesAppliedOptions;
  readonly observationalOnly: true;
  readonly createsSetup: false;
  readonly mergesNearbyExtrema: false;
  readonly usesFutureCandles: false;
}

export interface FetchLevelLinesOptions {
  readonly baseUrl?: string;
  readonly symbol: string;
  readonly timeframe:
    LevelLinesTimeframe;
  readonly limit?: number;
  readonly signal?: AbortSignal;
  readonly fetcher?:
    typeof globalThis.fetch;
}

type JsonRecord =
  Record<string, unknown>;

function resolveBaseUrl(
  value: string | undefined,
): string {
  return value
    ?.trim()
    .replace(/\/+$/u, '')
    ?? '';
}

function normalizeTimeframe(
  value: string,
): LevelLinesTimeframe {
  if (
    !LEVEL_LINES_TIMEFRAMES.includes(
      value as LevelLinesTimeframe,
    )
  ) {
    throw new Error(
      `Unsupported Level Lines timeframe: ${value}`,
    );
  }

  return value as LevelLinesTimeframe;
}

export function buildLevelLinesUrl(
  options:
    Pick<
      FetchLevelLinesOptions,
      | 'baseUrl'
      | 'symbol'
      | 'timeframe'
      | 'limit'
    >,
): string {
  const params =
    new URLSearchParams({
      symbol:
        normalizeMarketCandleSymbol(
          options.symbol,
        ),
      timeframe:
        normalizeTimeframe(
          options.timeframe,
        ),
    });

  if (options.limit !== undefined) {
    if (
      !Number.isInteger(options.limit)
      || options.limit < 50
      || options.limit > 1000
    ) {
      throw new Error(
        'Level Lines limit must be between 50 and 1000',
      );
    }

    params.set(
      'limit',
      String(options.limit),
    );
  }

  return (
    resolveBaseUrl(
      options.baseUrl,
    )
    + LEVEL_LINES_PATH
    + `?${params.toString()}`
  );
}

function readRecord(
  value: unknown,
  field: string,
): JsonRecord {
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
  ) {
    throw new Error(
      `Invalid Level Lines object: ${field}`,
    );
  }

  return value as JsonRecord;
}

function readArray(
  record: JsonRecord,
  key: string,
): readonly unknown[] {
  const value =
    record[key];

  if (!Array.isArray(value)) {
    throw new Error(
      `Invalid Level Lines array: ${key}`,
    );
  }

  return value;
}

function readString(
  record: JsonRecord,
  key: string,
): string {
  const value =
    record[key];

  if (
    typeof value !== 'string'
    || value.length === 0
  ) {
    throw new Error(
      `Invalid Level Lines string: ${key}`,
    );
  }

  return value;
}

function readTimestamp(
  record: JsonRecord,
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
      `Invalid Level Lines timestamp: ${key}`,
    );
  }

  return value;
}

function readNumber(
  record: JsonRecord,
  key: string,
): number {
  const value =
    record[key];

  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
  ) {
    throw new Error(
      `Invalid Level Lines number: ${key}`,
    );
  }

  return value;
}

function readPositiveNumber(
  record: JsonRecord,
  key: string,
): number {
  const value =
    readNumber(
      record,
      key,
    );

  if (value <= 0) {
    throw new Error(
      `Invalid Level Lines positive number: ${key}`,
    );
  }

  return value;
}

function readInteger(
  record: JsonRecord,
  key: string,
): number {
  const value =
    readNumber(
      record,
      key,
    );

  if (
    !Number.isSafeInteger(value)
    || value < 0
  ) {
    throw new Error(
      `Invalid Level Lines integer: ${key}`,
    );
  }

  return value;
}

function readBoolean(
  record: JsonRecord,
  key: string,
): boolean {
  const value =
    record[key];

  if (typeof value !== 'boolean') {
    throw new Error(
      `Invalid Level Lines boolean: ${key}`,
    );
  }

  return value;
}

function readNullableTimestamp(
  record: JsonRecord,
  key: string,
): string | null {
  if (record[key] === null) {
    return null;
  }

  return readTimestamp(
    record,
    key,
  );
}

function readKind(
  record: JsonRecord,
  key: string,
): LevelLineKind {
  const value =
    readString(
      record,
      key,
    );

  if (
    value !== 'support'
    && value !== 'resistance'
  ) {
    throw new Error(
      `Invalid Level Lines kind: ${key}`,
    );
  }

  return value;
}

function readStatus(
  record: JsonRecord,
  key: string,
): LevelLineStatus {
  const value =
    readString(
      record,
      key,
    );

  if (
    value !== 'candidate'
    && value !== 'confirmed'
    && value !== 'worked'
    && value !== 'superseded'
    && value !== 'broken'
  ) {
    throw new Error(
      `Invalid Level Lines status: ${key}`,
    );
  }

  return value;
}

function parseBreakEvidence(
  value: unknown,
): LevelLineBreakEvidence | null {
  if (value === null) {
    return null;
  }

  const record =
    readRecord(
      value,
      'breakEvidence',
    );
  const mode =
    readString(
      record,
      'mode',
    );

  if (
    mode !== 'decisive_body_break'
    && mode !== 'consecutive_closes'
  ) {
    throw new Error(
      'Invalid Level Lines break mode',
    );
  }

  const distanceAtr =
    record.distanceBeyondBoundaryAtr;

  if (
    distanceAtr !== null
    && (
      typeof distanceAtr !== 'number'
      || !Number.isFinite(distanceAtr)
    )
  ) {
    throw new Error(
      'Invalid Level Lines break ATR distance',
    );
  }

  return {
    mode,
    fromKind:
      readKind(
        record,
        'fromKind',
      ),
    candleIndex:
      readInteger(
        record,
        'candleIndex',
      ),
    brokenAt:
      readTimestamp(
        record,
        'brokenAt',
      ),
    boundary:
      readPositiveNumber(
        record,
        'boundary',
      ),
    close:
      readPositiveNumber(
        record,
        'close',
      ),
    distanceBeyondBoundary:
      readNumber(
        record,
        'distanceBeyondBoundary',
      ),
    distanceBeyondBoundaryAtr:
      distanceAtr,
  };
}

function parseSupersessionEvidence(
  value: unknown,
): LevelLineSupersessionEvidence | null {
  if (value === null) {
    return null;
  }

  const record =
    readRecord(
      value,
      'supersessionEvidence',
    );
  const mode =
    readString(
      record,
      'mode',
    );

  if (
    mode
    !== 'more_extreme_right_candle'
  ) {
    throw new Error(
      'Invalid Level Lines supersession mode',
    );
  }

  return {
    mode,
    fromKind:
      readKind(
        record,
        'fromKind',
      ),
    candleIndex:
      readInteger(
        record,
        'candleIndex',
      ),
    supersededAt:
      readTimestamp(
        record,
        'supersededAt',
      ),
    originPrice:
      readPositiveNumber(
        record,
        'originPrice',
      ),
    extremePrice:
      readPositiveNumber(
        record,
        'extremePrice',
      ),
  };
}

function parseLine(
  value: unknown,
): LevelLine {
  const record =
    readRecord(
      value,
      'line',
    );
  const price =
    readPositiveNumber(
      record,
      'price',
    );
  const originPrice =
    readPositiveNumber(
      record,
      'originExtremumPrice',
    );
  const kind =
    readKind(
      record,
      'kind',
    );
  const status =
    readStatus(
      record,
      'status',
    );
  const workedAt =
    readNullableTimestamp(
      record,
      'workedAt',
    );
  const supersededAt =
    readNullableTimestamp(
      record,
      'supersededAt',
    );
  const supersessionEvidence =
    parseSupersessionEvidence(
      record.supersessionEvidence,
    );
  const brokenAt =
    readNullableTimestamp(
      record,
      'brokenAt',
    );
  const breakEvidence =
    parseBreakEvidence(
      record.breakEvidence,
    );

  if (price !== originPrice) {
    throw new Error(
      'Level Lines price must equal origin extremum price',
    );
  }

  const validSupersessionEvidence =
    supersessionEvidence === null
    || (
      supersessionEvidence
        .fromKind === kind
      && supersessionEvidence
        .supersededAt
        === supersededAt
      && supersessionEvidence
        .originPrice === price
      && (
        kind === 'resistance'
          ? supersessionEvidence
            .extremePrice > price
          : supersessionEvidence
            .extremePrice < price
      )
    );

  if (!validSupersessionEvidence) {
    throw new Error(
      'Invalid Level Lines supersession evidence',
    );
  }

  const validLifecycle =
    status === 'broken'
      ? brokenAt !== null
        && breakEvidence !== null
        && supersededAt === null
        && supersessionEvidence === null
        && (
          workedAt === null
          || Date.parse(workedAt)
            <= Date.parse(brokenAt)
        )
      : status === 'superseded'
        ? supersededAt !== null
          && supersessionEvidence !== null
          && brokenAt === null
          && breakEvidence === null
          && (
            workedAt === null
            || Date.parse(workedAt)
              <= Date.parse(
                supersededAt,
              )
          )
        : status === 'worked'
          ? workedAt !== null
            && supersededAt === null
            && supersessionEvidence === null
            && brokenAt === null
            && breakEvidence === null
          : workedAt === null
            && supersededAt === null
            && supersessionEvidence === null
            && brokenAt === null
            && breakEvidence === null;

  if (!validLifecycle) {
    throw new Error(
      'Invalid Level Lines break lifecycle',
    );
  }

  return {
    id:
      readString(
        record,
        'id',
      ),
    symbol:
      normalizeMarketCandleSymbol(
        readString(
          record,
          'symbol',
        ),
      ),
    timeframe:
      normalizeTimeframe(
        readString(
          record,
          'timeframe',
        ),
      ),
    price,
    kind,
    originCandleIndex:
      readInteger(
        record,
        'originCandleIndex',
      ),
    originExtremumAt:
      readTimestamp(
        record,
        'originExtremumAt',
      ),
    originExtremumPrice:
      originPrice,
    activeFrom:
      readTimestamp(
        record,
        'activeFrom',
      ),
    touchCount:
      readInteger(
        record,
        'touchCount',
      ),
    status,
    workedAt,
    supersededAt,
    supersessionEvidence,
    brokenAt,
    breakEvidence,
  };
}

function parseCandle(
  value: unknown,
): LevelLinesCandle {
  const record =
    readRecord(
      value,
      'candle',
    );

  return {
    ...parseMarketCandle(
      record,
    ),
    isClosed:
      readBoolean(
        record,
        'isClosed',
      ),
  };
}

function parseAppliedOptions(
  value: unknown,
): LevelLinesAppliedOptions {
  const record =
    readRecord(
      value,
      'appliedOptions',
    );

  return {
    atrPeriod:
      readInteger(
        record,
        'atrPeriod',
      ),
    pivotLeftBars:
      readInteger(
        record,
        'pivotLeftBars',
      ),
    pivotRightBars:
      readInteger(
        record,
        'pivotRightBars',
      ),
    originDepartureAtr:
      readPositiveNumber(
        record,
        'originDepartureAtr',
      ),
    originDepartureMaxCandles:
      readInteger(
        record,
        'originDepartureMaxCandles',
      ),
    candidateVisibilityMinDepartureAtr:
      readPositiveNumber(
        record,
        'candidateVisibilityMinDepartureAtr',
      ),
    candidateVisibilityMaxAgeBars:
      readInteger(
        record,
        'candidateVisibilityMaxAgeBars',
      ),
    persistentCandidateMinDepartureAtr:
      readPositiveNumber(
        record,
        'persistentCandidateMinDepartureAtr',
      ),
    persistentCandidateLookbackBars:
      readInteger(
        record,
        'persistentCandidateLookbackBars',
      ),
    originEpisodeMaxSpanCandles:
      readInteger(
        record,
        'originEpisodeMaxSpanCandles',
      ),
    workedEpisodeMaxSpanCandles:
      readInteger(
        record,
        'workedEpisodeMaxSpanCandles',
      ),
    touchTolerancePercent:
      readPositiveNumber(
        record,
        'touchTolerancePercent',
      ),
    minBarsBetweenTouchEpisodes:
      readInteger(
        record,
        'minBarsBetweenTouchEpisodes',
      ),
    decisiveBreakAtr:
      readPositiveNumber(
        record,
        'decisiveBreakAtr',
      ),
    consecutiveBreakCloses:
      readInteger(
        record,
        'consecutiveBreakCloses',
      ),
  };
}

export function parseLevelLinesSnapshot(
  value: unknown,
): LevelLinesSnapshot {
  const record =
    readRecord(
      value,
      'snapshot',
    );

  if (
    readString(
      record,
      'version',
    ) !== LEVEL_LINES_VERSION
  ) {
    throw new Error(
      'Unsupported Level Lines version',
    );
  }

  const lines =
    readArray(
      record,
      'lines',
    ).map(
      parseLine,
    );
  const activeLevels =
    readArray(
      record,
      'activeLevels',
    ).map(
      parseLine,
    );
  const lineIds =
    new Set(
      lines.map(
        (line) => line.id,
      ),
    );

  if (
    activeLevels.some(
      (line) =>
        (
          line.status !== 'candidate'
          && line.status !== 'confirmed'
          && line.status !== 'worked'
        )
        || !lineIds.has(line.id),
    )
  ) {
    throw new Error(
      'Invalid Level Lines active registry',
    );
  }

  if (
    readBoolean(
      record,
      'observationalOnly',
    ) !== true
    || readBoolean(
      record,
      'createsSetup',
    ) !== false
    || readBoolean(
      record,
      'mergesNearbyExtrema',
    ) !== false
    || readBoolean(
      record,
      'usesFutureCandles',
    ) !== false
  ) {
    throw new Error(
      'Invalid Level Lines safety flags',
    );
  }

  return {
    version:
      LEVEL_LINES_VERSION,
    symbol:
      normalizeMarketCandleSymbol(
        readString(
          record,
          'symbol',
        ),
      ),
    timeframe:
      normalizeTimeframe(
        readString(
          record,
          'timeframe',
        ),
      ),
    generatedAt:
      readTimestamp(
        record,
        'generatedAt',
      ),
    closedCandlesCount:
      readInteger(
        record,
        'closedCandlesCount',
      ),
    ignoredOpenCandlesCount:
      readInteger(
        record,
        'ignoredOpenCandlesCount',
      ),
    candles:
      readArray(
        record,
        'candles',
      ).map(
        parseCandle,
      ),
    lines,
    activeLevels,
    appliedOptions:
      parseAppliedOptions(
        record.appliedOptions,
      ),
    observationalOnly: true,
    createsSetup: false,
    mergesNearbyExtrema: false,
    usesFutureCandles: false,
  };
}

export async function fetchLevelLines(
  options: FetchLevelLinesOptions,
): Promise<LevelLinesSnapshot> {
  const response =
    await (
      options.fetcher
      ?? globalThis.fetch
    )(
      buildLevelLinesUrl(
        options,
      ),
      {
        method: 'GET',
        headers: {
          accept:
            'application/json',
        },
        signal:
          options.signal,
      },
    );

  if (!response.ok) {
    throw new Error(
      `Level Lines request failed: ${response.status}`,
    );
  }

  return parseLevelLinesSnapshot(
    await response.json(),
  );
}
