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

export const OBSERVATION_TRACKER_VERSION =
  'observation-tracker-v0.1' as const;

export const APPROACH_ENGINE_VERSION =
  'approach-engine-v0.1' as const;

export const REALTIME_CONFIRMATION_ENGINE_VERSION =
  'realtime-confirmation-engine-v0.1' as const;

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
  readonly confirmedAt: string | null;
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

export interface ObservationPathProgress {
  readonly lineId: string;
  readonly symbol: string;
  readonly timeframe: LevelLinesTimeframe;
  readonly kind: LevelLineKind;
  readonly levelPrice: number;
  readonly departureExtremumPrice: number;
  readonly departureExtremumObservedAt: string;
  readonly currentPrice: number;
  readonly currentCandleIndex: number;
  readonly currentCandleOpenTime: string;
  readonly observedAt: string;
  readonly progress: number;
  readonly observationPathProgressThreshold: number;
  readonly stage: 'OBSERVATION' | null;
}

export interface ObservationTrackingResult {
  readonly version: typeof OBSERVATION_TRACKER_VERSION;
  readonly symbol: string;
  readonly timeframe: LevelLinesTimeframe;
  readonly closedCandlesCount: number;
  readonly ignoredOpenCandlesCount: number;
  readonly currentPrice: number | null;
  readonly currentCandleIndex: number | null;
  readonly currentCandleOpenTime: string | null;
  readonly observedAt: string | null;
  readonly activeProgress: readonly ObservationPathProgress[];
  readonly appliedOptions: {
    readonly observationPathProgressThreshold: number;
  };
  readonly observationalOnly: true;
  readonly computesObservationProgress: true;
  readonly createsApproachEvaluation: false;
  readonly createsSetup: false;
  readonly createsSignal: false;
  readonly usesFutureCandles: false;
}

export interface LevelLineApproachEvaluation {
  readonly lineId: string;
  readonly symbol: string;
  readonly timeframe: LevelLinesTimeframe;
  readonly kind: LevelLineKind;
  readonly levelPrice: number;
  readonly currentPrice: number;
  readonly currentCandleIndex: number;
  readonly currentCandleOpenTime: string;
  readonly observedAt: string;
  readonly observationProgress: number;
  readonly observationStage: 'OBSERVATION' | null;
  readonly distanceToLevelPercent: number;
  readonly maxDistanceToLevelPercent: number;
  readonly stage: 'APPROACH' | null;
}

export interface ApproachEvaluationResult {
  readonly version: typeof APPROACH_ENGINE_VERSION;
  readonly symbol: string;
  readonly timeframe: LevelLinesTimeframe;
  readonly closedCandlesCount: number;
  readonly ignoredOpenCandlesCount: number;
  readonly currentPrice: number | null;
  readonly currentCandleIndex: number | null;
  readonly currentCandleOpenTime: string | null;
  readonly observedAt: string | null;
  readonly evaluations: readonly LevelLineApproachEvaluation[];
  readonly appliedOptions: {
    readonly maxDistanceToLevelPercent: number;
  };
  readonly observationalOnly: true;
  readonly evaluatesApproach: true;
  readonly createsRealtimeConfirmation: false;
  readonly createsSetup: false;
  readonly createsSignal: false;
  readonly usesFutureCandles: false;
}

export type RealtimeConfirmationSourceState =
  | 'collecting'
  | 'live'
  | 'stale'
  | 'error';

export type RealtimeConfirmationEvidenceState =
  | 'supports'
  | 'opposes'
  | 'neutral'
  | 'unavailable';

export type RealtimeConfirmationStatus =
  | 'not_applicable'
  | 'collecting'
  | 'not_ready'
  | 'partial'
  | 'confirmed';

export type RealtimeConfirmationReason =
  | 'line_not_in_approach'
  | 'approach_from_wrong_side'
  | 'closed_candle_did_not_intersect_level_zone'
  | 'tape_collecting'
  | 'tape_stale'
  | 'tape_error'
  | 'order_book_collecting'
  | 'order_book_stale'
  | 'order_book_error'
  | 'trade_flow_opposes_interaction'
  | 'order_book_opposes_interaction'
  | 'trade_flow_and_order_book_support_interaction'
  | 'one_live_source_supports_interaction'
  | 'directional_pressure_not_sufficient';

export interface RealtimeConfirmationTapeEvidence {
  readonly state: RealtimeConfirmationSourceState;
  readonly snapshotUpdatedAt: string | null;
  readonly lastTradeAt: string | null;
  readonly ageMs: number | null;
  readonly windowMs: number;
  readonly tradesCount: number;
  readonly ignoredFutureTradesCount: number;
  readonly ignoredOutsideWindowTradesCount: number;
  readonly executionsCount: number;
  readonly buyQuoteValue: number;
  readonly sellQuoteValue: number;
  readonly totalQuoteValue: number;
  readonly quoteDelta: number;
  readonly pressurePct: number | null;
}

export interface RealtimeConfirmationOrderBookEvidence {
  readonly state: RealtimeConfirmationSourceState;
  readonly synchronized: boolean;
  readonly updatedAt: string | null;
  readonly updatedAfterCapture: boolean;
  readonly ageMs: number | null;
  readonly staleAfterMs: number | null;
  readonly bestBid: number | null;
  readonly bestAsk: number | null;
  readonly spreadPct: number | null;
  readonly bidDepthQuote: number | null;
  readonly askDepthQuote: number | null;
  readonly totalDepthQuote: number | null;
  readonly imbalancePct: number | null;
}

export interface RealtimeConfirmationMarketEvidence {
  readonly symbol: string;
  readonly capturedAt: string;
  readonly availability:
    | 'complete'
    | 'tape_only'
    | 'order_book_only'
    | 'unavailable';
  readonly tape: RealtimeConfirmationTapeEvidence;
  readonly orderBook: RealtimeConfirmationOrderBookEvidence;
  readonly sourceErrors: readonly string[];
}

export interface LevelLineRealtimeConfirmation {
  readonly lineId: string;
  readonly symbol: string;
  readonly timeframe: LevelLinesTimeframe;
  readonly kind: LevelLineKind;
  readonly levelPrice: number;
  readonly currentPrice: number;
  readonly currentCandleIndex: number;
  readonly currentCandleOpenTime: string;
  readonly observedAt: string;
  readonly approachStage: 'APPROACH' | null;
  readonly interactionDirection: 'up' | 'down';
  readonly approachSideValid: boolean;
  readonly candleIntersectsLevelZone: boolean;
  readonly tapePressurePercent: number | null;
  readonly directionalTapePressurePercent: number | null;
  readonly tapeState: RealtimeConfirmationEvidenceState;
  readonly orderBookImbalancePercent: number | null;
  readonly directionalOrderBookPressurePercent: number | null;
  readonly orderBookState: RealtimeConfirmationEvidenceState;
  readonly status: RealtimeConfirmationStatus;
  readonly stage: 'CONFIRMATION' | null;
  readonly reasons: readonly RealtimeConfirmationReason[];
}

export interface RealtimeConfirmationEvaluationResult {
  readonly version:
    typeof REALTIME_CONFIRMATION_ENGINE_VERSION;
  readonly symbol: string;
  readonly timeframe: LevelLinesTimeframe;
  readonly evaluatedAt: string;
  readonly evaluations:
    readonly LevelLineRealtimeConfirmation[];
  readonly evidence: RealtimeConfirmationMarketEvidence;
  readonly appliedOptions: {
    readonly interactionTolerancePercent: number;
    readonly tapeWindowMs: number;
    readonly tapeStaleAfterMs: number;
    readonly minimumTapeTradesCount: number;
    readonly directionalPressureThresholdPercent: number;
  };
  readonly observationalOnly: true;
  readonly evaluatesRealtimeConfirmation: true;
  readonly evaluatesBreakout: false;
  readonly evaluatesBounce: false;
  readonly createsSetup: false;
  readonly createsSignal: false;
  readonly createsScore: false;
  readonly learnsFromOutcome: false;
  readonly usesFutureCandles: false;
  readonly usesFutureRealtimeEvidence: false;
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
  readonly observationTracking: ObservationTrackingResult;
  readonly approachEvaluation: ApproachEvaluationResult;
  readonly realtimeConfirmation:
    RealtimeConfirmationEvaluationResult;
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

function readPositiveInteger(
  record: JsonRecord,
  key: string,
): number {
  const value =
    readInteger(
      record,
      key,
    );

  if (value === 0) {
    throw new Error(
      `Invalid Level Lines positive integer: ${key}`,
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

function readNonNegativeNumber(
  record: JsonRecord,
  key: string,
): number {
  const value =
    readNumber(
      record,
      key,
    );

  if (value < 0) {
    throw new Error(
      `Invalid Level Lines non-negative number: ${key}`,
    );
  }

  return value;
}

function readStringArray(
  record: JsonRecord,
  key: string,
): readonly string[] {
  return readArray(
    record,
    key,
  ).map(
    (value) => {
      if (
        typeof value !== 'string'
        || value.length === 0
      ) {
        throw new Error(
          `Invalid Level Lines string array: ${key}`,
        );
      }

      return value;
    },
  );
}

function readNullableNumber(
  record: JsonRecord,
  key: string,
): number | null {
  if (record[key] === null) {
    return null;
  }

  return readNumber(
    record,
    key,
  );
}

function readNullableInteger(
  record: JsonRecord,
  key: string,
): number | null {
  if (record[key] === null) {
    return null;
  }

  return readInteger(
    record,
    key,
  );
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

function readNullableStage<T extends string>(
  record: JsonRecord,
  key: string,
  expected: T,
): T | null {
  if (record[key] === null) {
    return null;
  }

  const value =
    readString(
      record,
      key,
    );

  if (value !== expected) {
    throw new Error(
      `Invalid Level Lines stage: ${key}`,
    );
  }

  return expected;
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
  const confirmedAt =
    readNullableTimestamp(
      record,
      'confirmedAt',
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
    confirmedAt,
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

function parseObservationProgress(
  value: unknown,
): ObservationPathProgress {
  const record =
    readRecord(
      value,
      'observationProgress',
    );
  const progress =
    readNumber(
      record,
      'progress',
    );

  if (
    progress < 0
  ) {
    throw new Error(
      'Invalid Observation progress',
    );
  }

  return {
    lineId:
      readString(
        record,
        'lineId',
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
    kind:
      readKind(
        record,
        'kind',
      ),
    levelPrice:
      readPositiveNumber(
        record,
        'levelPrice',
      ),
    departureExtremumPrice:
      readPositiveNumber(
        record,
        'departureExtremumPrice',
      ),
    departureExtremumObservedAt:
      readTimestamp(
        record,
        'departureExtremumObservedAt',
      ),
    currentPrice:
      readPositiveNumber(
        record,
        'currentPrice',
      ),
    currentCandleIndex:
      readInteger(
        record,
        'currentCandleIndex',
      ),
    currentCandleOpenTime:
      readTimestamp(
        record,
        'currentCandleOpenTime',
      ),
    observedAt:
      readTimestamp(
        record,
        'observedAt',
      ),
    progress,
    observationPathProgressThreshold:
      readPositiveNumber(
        record,
        'observationPathProgressThreshold',
      ),
    stage:
      readNullableStage(
        record,
        'stage',
        'OBSERVATION',
      ),
  };
}

function parseObservationTracking(
  value: unknown,
): ObservationTrackingResult {
  const record =
    readRecord(
      value,
      'observationTracking',
    );
  const options =
    readRecord(
      record.appliedOptions,
      'observationTracking.appliedOptions',
    );

  if (
    readString(
      record,
      'version',
    ) !== OBSERVATION_TRACKER_VERSION
    || readBoolean(record, 'observationalOnly') !== true
    || readBoolean(record, 'computesObservationProgress') !== true
    || readBoolean(record, 'createsApproachEvaluation') !== false
    || readBoolean(record, 'createsSetup') !== false
    || readBoolean(record, 'createsSignal') !== false
    || readBoolean(record, 'usesFutureCandles') !== false
  ) {
    throw new Error(
      'Invalid Observation Tracker contract',
    );
  }

  return {
    version:
      OBSERVATION_TRACKER_VERSION,
    symbol:
      normalizeMarketCandleSymbol(
        readString(record, 'symbol'),
      ),
    timeframe:
      normalizeTimeframe(
        readString(record, 'timeframe'),
      ),
    closedCandlesCount:
      readInteger(record, 'closedCandlesCount'),
    ignoredOpenCandlesCount:
      readInteger(record, 'ignoredOpenCandlesCount'),
    currentPrice:
      readNullableNumber(record, 'currentPrice'),
    currentCandleIndex:
      readNullableInteger(record, 'currentCandleIndex'),
    currentCandleOpenTime:
      readNullableTimestamp(record, 'currentCandleOpenTime'),
    observedAt:
      readNullableTimestamp(record, 'observedAt'),
    activeProgress:
      readArray(record, 'activeProgress').map(
        parseObservationProgress,
      ),
    appliedOptions: {
      observationPathProgressThreshold:
        readPositiveNumber(
          options,
          'observationPathProgressThreshold',
        ),
    },
    observationalOnly: true,
    computesObservationProgress: true,
    createsApproachEvaluation: false,
    createsSetup: false,
    createsSignal: false,
    usesFutureCandles: false,
  };
}

function parseApproachEvaluation(
  value: unknown,
): LevelLineApproachEvaluation {
  const record =
    readRecord(
      value,
      'approachEvaluation',
    );
  const observationProgress =
    readNumber(
      record,
      'observationProgress',
    );
  const distanceToLevelPercent =
    readNumber(
      record,
      'distanceToLevelPercent',
    );

  if (
    observationProgress < 0
    || distanceToLevelPercent < 0
  ) {
    throw new Error(
      'Invalid Approach evaluation values',
    );
  }

  return {
    lineId:
      readString(record, 'lineId'),
    symbol:
      normalizeMarketCandleSymbol(
        readString(record, 'symbol'),
      ),
    timeframe:
      normalizeTimeframe(
        readString(record, 'timeframe'),
      ),
    kind:
      readKind(record, 'kind'),
    levelPrice:
      readPositiveNumber(record, 'levelPrice'),
    currentPrice:
      readPositiveNumber(record, 'currentPrice'),
    currentCandleIndex:
      readInteger(record, 'currentCandleIndex'),
    currentCandleOpenTime:
      readTimestamp(record, 'currentCandleOpenTime'),
    observedAt:
      readTimestamp(record, 'observedAt'),
    observationProgress,
    observationStage:
      readNullableStage(
        record,
        'observationStage',
        'OBSERVATION',
      ),
    distanceToLevelPercent,
    maxDistanceToLevelPercent:
      readPositiveNumber(
        record,
        'maxDistanceToLevelPercent',
      ),
    stage:
      readNullableStage(
        record,
        'stage',
        'APPROACH',
      ),
  };
}

function parseApproachEvaluationResult(
  value: unknown,
): ApproachEvaluationResult {
  const record =
    readRecord(
      value,
      'approachEvaluationResult',
    );
  const options =
    readRecord(
      record.appliedOptions,
      'approachEvaluation.appliedOptions',
    );

  if (
    readString(record, 'version') !== APPROACH_ENGINE_VERSION
    || readBoolean(record, 'observationalOnly') !== true
    || readBoolean(record, 'evaluatesApproach') !== true
    || readBoolean(record, 'createsRealtimeConfirmation') !== false
    || readBoolean(record, 'createsSetup') !== false
    || readBoolean(record, 'createsSignal') !== false
    || readBoolean(record, 'usesFutureCandles') !== false
  ) {
    throw new Error(
      'Invalid Approach Engine contract',
    );
  }

  return {
    version:
      APPROACH_ENGINE_VERSION,
    symbol:
      normalizeMarketCandleSymbol(
        readString(record, 'symbol'),
      ),
    timeframe:
      normalizeTimeframe(
        readString(record, 'timeframe'),
      ),
    closedCandlesCount:
      readInteger(record, 'closedCandlesCount'),
    ignoredOpenCandlesCount:
      readInteger(record, 'ignoredOpenCandlesCount'),
    currentPrice:
      readNullableNumber(record, 'currentPrice'),
    currentCandleIndex:
      readNullableInteger(record, 'currentCandleIndex'),
    currentCandleOpenTime:
      readNullableTimestamp(record, 'currentCandleOpenTime'),
    observedAt:
      readNullableTimestamp(record, 'observedAt'),
    evaluations:
      readArray(record, 'evaluations').map(
        parseApproachEvaluation,
      ),
    appliedOptions: {
      maxDistanceToLevelPercent:
        readPositiveNumber(
          options,
          'maxDistanceToLevelPercent',
        ),
    },
    observationalOnly: true,
    evaluatesApproach: true,
    createsRealtimeConfirmation: false,
    createsSetup: false,
    createsSignal: false,
    usesFutureCandles: false,
  };
}

function readRealtimeSourceState(
  record: JsonRecord,
  key: string,
): RealtimeConfirmationSourceState {
  const value =
    readString(
      record,
      key,
    );

  if (
    value !== 'collecting'
    && value !== 'live'
    && value !== 'stale'
    && value !== 'error'
  ) {
    throw new Error(
      `Invalid Realtime Confirmation source state: ${key}`,
    );
  }

  return value;
}

function readRealtimeEvidenceState(
  record: JsonRecord,
  key: string,
): RealtimeConfirmationEvidenceState {
  const value =
    readString(
      record,
      key,
    );

  if (
    value !== 'supports'
    && value !== 'opposes'
    && value !== 'neutral'
    && value !== 'unavailable'
  ) {
    throw new Error(
      `Invalid Realtime Confirmation evidence state: ${key}`,
    );
  }

  return value;
}

function readRealtimeStatus(
  record: JsonRecord,
  key: string,
): RealtimeConfirmationStatus {
  const value =
    readString(
      record,
      key,
    );

  if (
    value !== 'not_applicable'
    && value !== 'collecting'
    && value !== 'not_ready'
    && value !== 'partial'
    && value !== 'confirmed'
  ) {
    throw new Error(
      `Invalid Realtime Confirmation status: ${key}`,
    );
  }

  return value;
}

function readRealtimeReason(
  value: string,
): RealtimeConfirmationReason {
  const reasons:
    readonly RealtimeConfirmationReason[] = [
      'line_not_in_approach',
      'approach_from_wrong_side',
      'closed_candle_did_not_intersect_level_zone',
      'tape_collecting',
      'tape_stale',
      'tape_error',
      'order_book_collecting',
      'order_book_stale',
      'order_book_error',
      'trade_flow_opposes_interaction',
      'order_book_opposes_interaction',
      'trade_flow_and_order_book_support_interaction',
      'one_live_source_supports_interaction',
      'directional_pressure_not_sufficient',
    ];

  if (
    !reasons.includes(
      value as RealtimeConfirmationReason,
    )
  ) {
    throw new Error(
      `Invalid Realtime Confirmation reason: ${value}`,
    );
  }

  return value as RealtimeConfirmationReason;
}

function parseRealtimeTapeEvidence(
  value: unknown,
): RealtimeConfirmationTapeEvidence {
  const record =
    readRecord(
      value,
      'realtimeConfirmation.evidence.tape',
    );

  return {
    state:
      readRealtimeSourceState(
        record,
        'state',
      ),
    snapshotUpdatedAt:
      readNullableTimestamp(
        record,
        'snapshotUpdatedAt',
      ),
    lastTradeAt:
      readNullableTimestamp(
        record,
        'lastTradeAt',
      ),
    ageMs:
      readNullableNumber(
        record,
        'ageMs',
      ),
    windowMs:
      readPositiveNumber(
        record,
        'windowMs',
      ),
    tradesCount:
      readInteger(
        record,
        'tradesCount',
      ),
    ignoredFutureTradesCount:
      readInteger(
        record,
        'ignoredFutureTradesCount',
      ),
    ignoredOutsideWindowTradesCount:
      readInteger(
        record,
        'ignoredOutsideWindowTradesCount',
      ),
    executionsCount:
      readInteger(
        record,
        'executionsCount',
      ),
    buyQuoteValue:
      readNonNegativeNumber(
        record,
        'buyQuoteValue',
      ),
    sellQuoteValue:
      readNonNegativeNumber(
        record,
        'sellQuoteValue',
      ),
    totalQuoteValue:
      readNonNegativeNumber(
        record,
        'totalQuoteValue',
      ),
    quoteDelta:
      readNumber(
        record,
        'quoteDelta',
      ),
    pressurePct:
      readNullableNumber(
        record,
        'pressurePct',
      ),
  };
}

function parseRealtimeOrderBookEvidence(
  value: unknown,
): RealtimeConfirmationOrderBookEvidence {
  const record =
    readRecord(
      value,
      'realtimeConfirmation.evidence.orderBook',
    );

  return {
    state:
      readRealtimeSourceState(
        record,
        'state',
      ),
    synchronized:
      readBoolean(
        record,
        'synchronized',
      ),
    updatedAt:
      readNullableTimestamp(
        record,
        'updatedAt',
      ),
    updatedAfterCapture:
      readBoolean(
        record,
        'updatedAfterCapture',
      ),
    ageMs:
      readNullableNumber(
        record,
        'ageMs',
      ),
    staleAfterMs:
      readNullableNumber(
        record,
        'staleAfterMs',
      ),
    bestBid:
      readNullableNumber(
        record,
        'bestBid',
      ),
    bestAsk:
      readNullableNumber(
        record,
        'bestAsk',
      ),
    spreadPct:
      readNullableNumber(
        record,
        'spreadPct',
      ),
    bidDepthQuote:
      readNullableNumber(
        record,
        'bidDepthQuote',
      ),
    askDepthQuote:
      readNullableNumber(
        record,
        'askDepthQuote',
      ),
    totalDepthQuote:
      readNullableNumber(
        record,
        'totalDepthQuote',
      ),
    imbalancePct:
      readNullableNumber(
        record,
        'imbalancePct',
      ),
  };
}

function parseRealtimeMarketEvidence(
  value: unknown,
): RealtimeConfirmationMarketEvidence {
  const record =
    readRecord(
      value,
      'realtimeConfirmation.evidence',
    );
  const availability =
    readString(
      record,
      'availability',
    );

  if (
    availability !== 'complete'
    && availability !== 'tape_only'
    && availability !== 'order_book_only'
    && availability !== 'unavailable'
  ) {
    throw new Error(
      'Invalid Realtime Confirmation evidence availability',
    );
  }

  return {
    symbol:
      normalizeMarketCandleSymbol(
        readString(
          record,
          'symbol',
        ),
      ),
    capturedAt:
      readTimestamp(
        record,
        'capturedAt',
      ),
    availability,
    tape:
      parseRealtimeTapeEvidence(
        record.tape,
      ),
    orderBook:
      parseRealtimeOrderBookEvidence(
        record.orderBook,
      ),
    sourceErrors:
      readStringArray(
        record,
        'sourceErrors',
      ),
  };
}

function parseRealtimeLineEvaluation(
  value: unknown,
): LevelLineRealtimeConfirmation {
  const record =
    readRecord(
      value,
      'realtimeConfirmation.evaluation',
    );
  const interactionDirection =
    readString(
      record,
      'interactionDirection',
    );

  if (
    interactionDirection !== 'up'
    && interactionDirection !== 'down'
  ) {
    throw new Error(
      'Invalid Realtime Confirmation interaction direction',
    );
  }

  const status =
    readRealtimeStatus(
      record,
      'status',
    );
  const stage =
    readNullableStage(
      record,
      'stage',
      'CONFIRMATION',
    );

  if (
    (status === 'confirmed')
    !== (stage === 'CONFIRMATION')
  ) {
    throw new Error(
      'Invalid Realtime Confirmation stage linkage',
    );
  }

  return {
    lineId:
      readString(record, 'lineId'),
    symbol:
      normalizeMarketCandleSymbol(
        readString(record, 'symbol'),
      ),
    timeframe:
      normalizeTimeframe(
        readString(record, 'timeframe'),
      ),
    kind:
      readKind(record, 'kind'),
    levelPrice:
      readPositiveNumber(record, 'levelPrice'),
    currentPrice:
      readPositiveNumber(record, 'currentPrice'),
    currentCandleIndex:
      readInteger(record, 'currentCandleIndex'),
    currentCandleOpenTime:
      readTimestamp(record, 'currentCandleOpenTime'),
    observedAt:
      readTimestamp(record, 'observedAt'),
    approachStage:
      readNullableStage(
        record,
        'approachStage',
        'APPROACH',
      ),
    interactionDirection,
    approachSideValid:
      readBoolean(record, 'approachSideValid'),
    candleIntersectsLevelZone:
      readBoolean(record, 'candleIntersectsLevelZone'),
    tapePressurePercent:
      readNullableNumber(record, 'tapePressurePercent'),
    directionalTapePressurePercent:
      readNullableNumber(
        record,
        'directionalTapePressurePercent',
      ),
    tapeState:
      readRealtimeEvidenceState(record, 'tapeState'),
    orderBookImbalancePercent:
      readNullableNumber(
        record,
        'orderBookImbalancePercent',
      ),
    directionalOrderBookPressurePercent:
      readNullableNumber(
        record,
        'directionalOrderBookPressurePercent',
      ),
    orderBookState:
      readRealtimeEvidenceState(record, 'orderBookState'),
    status,
    stage,
    reasons:
      readStringArray(
        record,
        'reasons',
      ).map(
        readRealtimeReason,
      ),
  };
}

function parseRealtimeConfirmation(
  value: unknown,
): RealtimeConfirmationEvaluationResult {
  const record =
    readRecord(
      value,
      'realtimeConfirmation',
    );
  const options =
    readRecord(
      record.appliedOptions,
      'realtimeConfirmation.appliedOptions',
    );

  if (
    readString(record, 'version')
      !== REALTIME_CONFIRMATION_ENGINE_VERSION
    || readBoolean(record, 'observationalOnly') !== true
    || readBoolean(record, 'evaluatesRealtimeConfirmation') !== true
    || readBoolean(record, 'evaluatesBreakout') !== false
    || readBoolean(record, 'evaluatesBounce') !== false
    || readBoolean(record, 'createsSetup') !== false
    || readBoolean(record, 'createsSignal') !== false
    || readBoolean(record, 'createsScore') !== false
    || readBoolean(record, 'learnsFromOutcome') !== false
    || readBoolean(record, 'usesFutureCandles') !== false
    || readBoolean(record, 'usesFutureRealtimeEvidence') !== false
  ) {
    throw new Error(
      'Invalid Realtime Confirmation Engine contract',
    );
  }

  return {
    version:
      REALTIME_CONFIRMATION_ENGINE_VERSION,
    symbol:
      normalizeMarketCandleSymbol(
        readString(record, 'symbol'),
      ),
    timeframe:
      normalizeTimeframe(
        readString(record, 'timeframe'),
      ),
    evaluatedAt:
      readTimestamp(record, 'evaluatedAt'),
    evaluations:
      readArray(record, 'evaluations').map(
        parseRealtimeLineEvaluation,
      ),
    evidence:
      parseRealtimeMarketEvidence(
        record.evidence,
      ),
    appliedOptions: {
      interactionTolerancePercent:
        readPositiveNumber(
          options,
          'interactionTolerancePercent',
        ),
      tapeWindowMs:
        readPositiveInteger(options, 'tapeWindowMs'),
      tapeStaleAfterMs:
        readPositiveInteger(options, 'tapeStaleAfterMs'),
      minimumTapeTradesCount:
        readPositiveInteger(
          options,
          'minimumTapeTradesCount',
        ),
      directionalPressureThresholdPercent:
        readPositiveNumber(
          options,
          'directionalPressureThresholdPercent',
        ),
    },
    observationalOnly: true,
    evaluatesRealtimeConfirmation: true,
    evaluatesBreakout: false,
    evaluatesBounce: false,
    createsSetup: false,
    createsSignal: false,
    createsScore: false,
    learnsFromOutcome: false,
    usesFutureCandles: false,
    usesFutureRealtimeEvidence: false,
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
  const observationTracking =
    parseObservationTracking(
      record.observationTracking,
    );
  const approachEvaluation =
    parseApproachEvaluationResult(
      record.approachEvaluation,
    );
  const realtimeConfirmation =
    parseRealtimeConfirmation(
      record.realtimeConfirmation,
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

  const symbol =
    normalizeMarketCandleSymbol(
      readString(
        record,
        'symbol',
      ),
    );
  const timeframe =
    normalizeTimeframe(
      readString(
        record,
        'timeframe',
      ),
    );
  const activeLineIds =
    new Set(
      activeLevels.map(
        (line) => line.id,
      ),
    );
  const linkedLineIds = [
    ...observationTracking.activeProgress.map(
      (item) => item.lineId,
    ),
    ...approachEvaluation.evaluations.map(
      (item) => item.lineId,
    ),
    ...realtimeConfirmation.evaluations.map(
      (item) => item.lineId,
    ),
  ];
  const approachesByLineId =
    new Map(
      approachEvaluation.evaluations.map(
        (item) => [
          item.lineId,
          item,
        ],
      ),
    );
  const realtimeLineIds =
    new Set(
      realtimeConfirmation.evaluations.map(
        (item) => item.lineId,
      ),
    );
  const realtimeLinkageValid =
    realtimeConfirmation.evaluations.every(
      (item) => {
        const approach =
          approachesByLineId.get(
            item.lineId,
          );

        return approach !== undefined
          && item.symbol === approach.symbol
          && item.timeframe === approach.timeframe
          && item.kind === approach.kind
          && item.levelPrice === approach.levelPrice
          && item.currentPrice === approach.currentPrice
          && item.currentCandleIndex
            === approach.currentCandleIndex
          && item.currentCandleOpenTime
            === approach.currentCandleOpenTime
          && item.observedAt === approach.observedAt
          && item.approachStage === approach.stage
          && item.interactionDirection
            === (
              item.kind === 'resistance'
                ? 'up'
                : 'down'
            );
      },
    );

  if (
    observationTracking.symbol !== symbol
    || observationTracking.timeframe !== timeframe
    || approachEvaluation.symbol !== symbol
    || approachEvaluation.timeframe !== timeframe
    || realtimeConfirmation.symbol !== symbol
    || realtimeConfirmation.timeframe !== timeframe
    || realtimeConfirmation.evidence.symbol !== symbol
    || realtimeConfirmation.evidence.capturedAt
      !== realtimeConfirmation.evaluatedAt
    || realtimeLineIds.size
      !== realtimeConfirmation.evaluations.length
    || !realtimeLinkageValid
    || linkedLineIds.some(
      (lineId) => !activeLineIds.has(lineId),
    )
  ) {
    throw new Error(
      'Invalid Level Lines causal linkage',
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
    symbol,
    timeframe,
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
    observationTracking,
    approachEvaluation,
    realtimeConfirmation,
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
