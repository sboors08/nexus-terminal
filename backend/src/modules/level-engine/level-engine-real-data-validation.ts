import {
  setTimeout as delay,
} from 'node:timers/promises';
import {
  detectMultiTimeframeLevelCandidates,
} from './level-engine-multi-timeframe-detector.js';
import {
  isLevelEngineTimeframe,
  normalizeLevelEngineSymbol,
} from './level-engine.contract.js';
import {
  LEVEL_ENGINE_TIMEFRAMES,
} from './level-engine.types.js';
import type {
  LevelCandidate,
  LevelEngineTimeframe,
} from './level-engine.types.js';
import type {
  LevelEngineCandle,
} from './level-engine-touch-detector.types.js';
import type {
  LevelClusterRejectionReason,
  LevelEngineTimeframeDataset,
  MultiTimeframeLevelDetectionResult,
} from './level-engine-multi-timeframe-detector.types.js';
import type {
  BinanceLevelEngineCandleRequest,
  LevelEngineRealDataValidationConfig,
  LevelEngineRealDataValidationReport,
  LevelEngineSymbolValidationReport,
  LevelEngineValidationDatasetSnapshot,
  LevelEngineValidationReviewDiagnostic,
  LevelEngineValidationReviewItem,
  LevelEngineValidationReviewPolicy,
  LevelEngineValidationReviewState,
  LevelEngineValidationTimeframeSummary,
} from './level-engine-real-data-validation.types.js';

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type FetchCandles = (
  request: BinanceLevelEngineCandleRequest,
) => Promise<readonly LevelEngineCandle[]>;

type DetectCandidates = (
  datasets: readonly LevelEngineTimeframeDataset[],
) => MultiTimeframeLevelDetectionResult;

export interface FetchBinanceLevelEngineCandlesDependencies {
  readonly fetchImpl?: FetchLike;
  readonly now?: () => Date;
}

export interface ValidateLevelEngineRealDataDependencies {
  readonly fetchImpl?: FetchLike;
  readonly now?: () => Date;
  readonly fetchCandles?: FetchCandles;
  readonly detectCandidates?: DetectCandidates;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

export class LevelEngineRealDataValidationError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LevelEngineRealDataValidationError';
  }
}

type BinanceKlineRow = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  ...unknown[],
];

const MAX_BINANCE_KLINES_PER_REQUEST = 1_500;

const REJECTION_REASONS:
readonly LevelClusterRejectionReason[] = Object.freeze([
  'insufficient_history',
  'no_pivot_seed',
  'no_confirmed_touch_episode',
  'no_causal_touch_episode',
  'duplicate_episode_set',
]);

export const DEFAULT_LEVEL_ENGINE_VALIDATION_REVIEW_POLICY:
LevelEngineValidationReviewPolicy = Object.freeze({
  atrPeriod: 14,
  decisiveBreakAtr: 0.35,
  consecutiveBreakCloses: 2,
  staleAfterBars: 120,
  staleDistanceAtr: 3,
  minimumFutureBars: 2,
});

function fail(message: string): never {
  throw new LevelEngineRealDataValidationError(message);
}

function positiveInteger(
  value: number,
  field: string,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (
    !Number.isInteger(value)
    || value <= 0
    || value > maximum
  ) {
    fail(`${field} must be a positive integer not greater than ${maximum}`);
  }
  return value;
}

function nonNegativeInteger(
  value: number,
  field: string,
): number {
  if (!Number.isInteger(value) || value < 0) {
    fail(`${field} must be a non-negative integer`);
  }
  return value;
}

function positiveFinite(
  value: number,
  field: string,
): number {
  if (!Number.isFinite(value) || value <= 0) {
    fail(`${field} must be a positive finite number`);
  }
  return value;
}

function canonicalTimestamp(
  value: string,
  field: string,
): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    fail(`${field} must be a valid timestamp`);
  }
  return new Date(timestamp).toISOString();
}

function validateBaseUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    fail('binanceBaseUrl must be a valid HTTP URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    fail('binanceBaseUrl must use http or https');
  }
  return parsed.toString().replace(/\/$/, '');
}

function readNumber(
  value: unknown,
  field: string,
  minimum: number,
): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < minimum) {
    fail(`invalid Binance kline field: ${field}`);
  }
  return parsed;
}

function readInteger(
  value: unknown,
  field: string,
  minimum: number,
): number {
  const parsed = readNumber(value, field, minimum);
  if (!Number.isInteger(parsed)) {
    fail(`invalid Binance kline integer: ${field}`);
  }
  return parsed;
}

function parseKline(
  payload: unknown,
  nowMs: number,
): LevelEngineCandle {
  if (!Array.isArray(payload) || payload.length < 7) {
    fail('Binance returned an invalid kline row');
  }

  const row = payload as BinanceKlineRow;
  const openTimeMs = readInteger(row[0], 'openTime', 0);
  const closeTimeMs = readInteger(row[6], 'closeTime', openTimeMs);
  const open = readNumber(row[1], 'open', Number.MIN_VALUE);
  const high = readNumber(row[2], 'high', Number.MIN_VALUE);
  const low = readNumber(row[3], 'low', Number.MIN_VALUE);
  const close = readNumber(row[4], 'close', Number.MIN_VALUE);

  if (
    high < low
    || open < low
    || open > high
    || close < low
    || close > high
  ) {
    fail('Binance returned invalid kline OHLC values');
  }

  return Object.freeze({
    openTime: new Date(openTimeMs).toISOString(),
    closeTime: new Date(closeTimeMs).toISOString(),
    open,
    high,
    low,
    close,
    isClosed: closeTimeMs < nowMs,
  });
}

function validateCandleRequest(
  request: BinanceLevelEngineCandleRequest,
): {
  readonly baseUrl: string;
  readonly requestTimeoutMs: number;
  readonly symbol: string;
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly limit: number;
  readonly endTime?: number;
} {
  if (!isLevelEngineTimeframe(request.sourceTimeframe)) {
    fail(`unsupported timeframe: ${request.sourceTimeframe}`);
  }

  const base = {
    baseUrl: validateBaseUrl(request.baseUrl),
    requestTimeoutMs: positiveInteger(
      request.requestTimeoutMs,
      'requestTimeoutMs',
      30_000,
    ),
    symbol: normalizeLevelEngineSymbol(request.symbol),
    sourceTimeframe: request.sourceTimeframe,
    limit: positiveInteger(
      request.limit,
      'limit',
      MAX_BINANCE_KLINES_PER_REQUEST,
    ),
  };

  if (request.endTime === undefined) {
    return Object.freeze(base);
  }

  return Object.freeze({
    ...base,
    endTime: nonNegativeInteger(request.endTime, 'endTime'),
  });
}

export async function fetchBinanceLevelEngineCandles(
  requestValue: BinanceLevelEngineCandleRequest,
  dependencies: FetchBinanceLevelEngineCandlesDependencies = {},
): Promise<readonly LevelEngineCandle[]> {
  const request = validateCandleRequest(requestValue);
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;
  const now = dependencies.now ?? (() => new Date());
  const query = new URLSearchParams({
    symbol: request.symbol,
    interval: request.sourceTimeframe,
    limit: String(request.limit),
  });

  if (request.endTime !== undefined) {
    query.set('endTime', String(request.endTime));
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    request.requestTimeoutMs,
  );

  try {
    const response = await fetchImpl(
      `${request.baseUrl}/fapi/v1/klines?${query.toString()}`,
      {
        headers: {
          accept: 'application/json',
        },
        signal: controller.signal,
      },
    );

    const text = await response.text();
    let payload: unknown = null;

    if (text.length > 0) {
      try {
        payload = JSON.parse(text);
      } catch {
        fail('Binance returned invalid kline JSON');
      }
    }

    if (!response.ok) {
      const apiError = payload as {
        code?: number;
        msg?: string;
      } | null;

      if (
        response.status === 400
        && apiError?.code === -1121
      ) {
        fail(`Binance symbol not found: ${request.symbol}`);
      }

      fail(`Binance kline request failed with status ${response.status}`);
    }

    if (!Array.isArray(payload)) {
      fail('Binance returned an unexpected kline response');
    }

    const nowMs = now().getTime();
    if (!Number.isFinite(nowMs)) {
      fail('now dependency returned an invalid date');
    }

    return Object.freeze(
      payload
        .map((row) => parseKline(row, nowMs))
        .sort(
          (left, right) =>
            Date.parse(left.openTime) - Date.parse(right.openTime),
        ),
    );
  } catch (error) {
    if (error instanceof LevelEngineRealDataValidationError) {
      throw error;
    }

    const message = error instanceof Error
      && error.name === 'AbortError'
      ? 'Binance kline request timed out'
      : 'Binance kline request failed';

    throw new LevelEngineRealDataValidationError(message);
  } finally {
    clearTimeout(timeout);
  }
}

function timeframeRank(
  timeframe: LevelEngineTimeframe,
): number {
  return LEVEL_ENGINE_TIMEFRAMES.indexOf(timeframe);
}

function maturityRank(candidate: LevelCandidate): number {
  if (candidate.maturity === 'confirmed') {
    return 2;
  }
  if (candidate.maturity === 'developing') {
    return 1;
  }
  return 0;
}

function compareReviewCandidates(
  left: LevelCandidate,
  right: LevelCandidate,
): number {
  const maturityDifference =
    maturityRank(right) - maturityRank(left);
  if (maturityDifference !== 0) {
    return maturityDifference;
  }

  const touchDifference =
    right.touchEpisodes.length - left.touchEpisodes.length;
  if (touchDifference !== 0) {
    return touchDifference;
  }

  const timeframeDifference =
    timeframeRank(right.sourceTimeframe)
    - timeframeRank(left.sourceTimeframe);
  if (timeframeDifference !== 0) {
    return timeframeDifference;
  }

  const detectedDifference =
    Date.parse(right.detectedAt) - Date.parse(left.detectedAt);
  if (detectedDifference !== 0) {
    return detectedDifference;
  }

  return left.id.localeCompare(right.id);
}

function rejectionCounts(
  reasons: readonly LevelClusterRejectionReason[],
): Readonly<Record<LevelClusterRejectionReason, number>> {
  const counts: Record<LevelClusterRejectionReason, number> = {
    insufficient_history: 0,
    no_pivot_seed: 0,
    no_confirmed_touch_episode: 0,
    no_causal_touch_episode: 0,
    duplicate_episode_set: 0,
  };

  for (const reason of reasons) {
    counts[reason] += 1;
  }

  return Object.freeze(counts);
}


function validateReviewPolicy(
  value: LevelEngineValidationReviewPolicy,
): LevelEngineValidationReviewPolicy {
  return Object.freeze({
    atrPeriod: positiveInteger(
      value.atrPeriod,
      'reviewPolicy.atrPeriod',
    ),
    decisiveBreakAtr: positiveFinite(
      value.decisiveBreakAtr,
      'reviewPolicy.decisiveBreakAtr',
    ),
    consecutiveBreakCloses: positiveInteger(
      value.consecutiveBreakCloses,
      'reviewPolicy.consecutiveBreakCloses',
    ),
    staleAfterBars: positiveInteger(
      value.staleAfterBars,
      'reviewPolicy.staleAfterBars',
    ),
    staleDistanceAtr: positiveFinite(
      value.staleDistanceAtr,
      'reviewPolicy.staleDistanceAtr',
    ),
    minimumFutureBars: positiveInteger(
      value.minimumFutureBars,
      'reviewPolicy.minimumFutureBars',
    ),
  });
}

function calculateAtrSeries(
  candles: readonly LevelEngineCandle[],
  period: number,
): readonly (number | null)[] {
  const trueRanges: number[] = [];

  return Object.freeze(candles.map((candle, index) => {
    const previousClose = candles[index - 1]?.close;
    const trueRange = previousClose === undefined
      ? candle.high - candle.low
      : Math.max(
          candle.high - candle.low,
          Math.abs(candle.high - previousClose),
          Math.abs(candle.low - previousClose),
        );

    trueRanges.push(trueRange);
    if (trueRanges.length < period) {
      return null;
    }

    const start = trueRanges.length - period;
    const average = trueRanges
      .slice(start)
      .reduce((sum, value) => sum + value, 0)
      / period;

    return Number.isFinite(average)
      ? average
      : null;
  }));
}

function candleIntersectsZone(
  candle: LevelEngineCandle,
  candidate: LevelCandidate,
): boolean {
  return (
    candle.high >= candidate.zone.low
    && candle.low <= candidate.zone.high
  );
}

function closeBeyondZone(
  candle: LevelEngineCandle,
  candidate: LevelCandidate,
): boolean {
  return candidate.kind === 'support'
    ? candle.close < candidate.zone.low
    : candle.close > candidate.zone.high;
}

function bodyEntirelyBeyondZone(
  candle: LevelEngineCandle,
  candidate: LevelCandidate,
): boolean {
  return candidate.kind === 'support'
    ? Math.max(candle.open, candle.close) < candidate.zone.low
    : Math.min(candle.open, candle.close) > candidate.zone.high;
}

function breakBoundary(
  candidate: LevelCandidate,
): number {
  return candidate.kind === 'support'
    ? candidate.zone.low
    : candidate.zone.high;
}

function distanceBeyondBoundary(
  candle: LevelEngineCandle,
  candidate: LevelCandidate,
): number {
  return candidate.kind === 'support'
    ? candidate.zone.low - candle.close
    : candle.close - candidate.zone.high;
}

function distanceFromZone(
  price: number,
  candidate: LevelCandidate,
): number {
  if (price < candidate.zone.low) {
    return candidate.zone.low - price;
  }
  if (price > candidate.zone.high) {
    return price - candidate.zone.high;
  }
  return 0;
}

export function diagnoseLevelCandidateForReview(
  dataset: LevelEngineTimeframeDataset,
  candidate: LevelCandidate,
  policyValue: LevelEngineValidationReviewPolicy =
    DEFAULT_LEVEL_ENGINE_VALIDATION_REVIEW_POLICY,
): LevelEngineValidationReviewDiagnostic {
  const policy = validateReviewPolicy(policyValue);
  const datasetSymbol = normalizeLevelEngineSymbol(dataset.symbol);
  const candidateSymbol = normalizeLevelEngineSymbol(candidate.symbol);

  if (datasetSymbol !== candidateSymbol) {
    fail('review dataset symbol must match candidate symbol');
  }
  if (dataset.sourceTimeframe !== candidate.sourceTimeframe) {
    fail('review dataset timeframe must match candidate timeframe');
  }

  const closedCandles = Object.freeze(
    dataset.candles.filter((candle) => candle.isClosed),
  );
  const atrSeries = calculateAtrSeries(
    closedCandles,
    policy.atrPeriod,
  );
  const detectedAtMs = Date.parse(
    canonicalTimestamp(candidate.detectedAt, 'candidate.detectedAt'),
  );
  const activeFromMs = Date.parse(
    canonicalTimestamp(candidate.activeFrom, 'candidate.activeFrom'),
  );
  const firstFutureIndexValue = closedCandles.findIndex(
    (candle) => Date.parse(candle.closeTime) > detectedAtMs,
  );
  const firstFutureIndex = firstFutureIndexValue === -1
    ? closedCandles.length
    : firstFutureIndexValue;
  const futureClosedCandlesCount =
    closedCandles.length - firstFutureIndex;

  let consecutiveBeyondCloses = 0;
  let breakEvidence:
    LevelEngineValidationReviewDiagnostic['breakEvidence'] = null;

  for (
    let candleIndex = firstFutureIndex;
    candleIndex < closedCandles.length;
    candleIndex += 1
  ) {
    const candle = closedCandles[candleIndex];
    if (!candle) {
      continue;
    }

    if (!closeBeyondZone(candle, candidate)) {
      consecutiveBeyondCloses = 0;
      continue;
    }

    consecutiveBeyondCloses += 1;
    const atr = atrSeries[candleIndex] ?? null;
    const distance = distanceBeyondBoundary(candle, candidate);
    const distanceAtr = atr !== null && atr > 0
      ? distance / atr
      : null;
    const decisiveBodyBreak = (
      bodyEntirelyBeyondZone(candle, candidate)
      && distanceAtr !== null
      && distanceAtr >= policy.decisiveBreakAtr
    );
    const consecutiveBreak = (
      consecutiveBeyondCloses
      >= policy.consecutiveBreakCloses
    );

    if (!decisiveBodyBreak && !consecutiveBreak) {
      continue;
    }

    breakEvidence = Object.freeze({
      mode: decisiveBodyBreak
        ? 'decisive_body_break'
        : 'consecutive_closes',
      candleIndex,
      brokenAt: canonicalTimestamp(
        candle.closeTime,
        'breakEvidence.brokenAt',
      ),
      boundary: breakBoundary(candidate),
      close: candle.close,
      distanceBeyondBoundary: distance,
      distanceBeyondBoundaryAtr: distanceAtr,
    });
    break;
  }

  let lastInteractionCandleIndex: number | null = null;
  for (
    let candleIndex = 0;
    candleIndex < closedCandles.length;
    candleIndex += 1
  ) {
    const candle = closedCandles[candleIndex];
    if (
      candle
      && Date.parse(candle.closeTime) >= activeFromMs
      && candleIntersectsZone(candle, candidate)
    ) {
      lastInteractionCandleIndex = candleIndex;
    }
  }

  const lastClosedCandleIndex = closedCandles.length > 0
    ? closedCandles.length - 1
    : null;
  const lastClosedCandle = lastClosedCandleIndex === null
    ? null
    : closedCandles[lastClosedCandleIndex] ?? null;
  const currentAtr = lastClosedCandleIndex === null
    ? null
    : atrSeries[lastClosedCandleIndex] ?? null;
  const currentPrice = lastClosedCandle?.close ?? null;
  const currentDistance = currentPrice === null
    ? null
    : distanceFromZone(currentPrice, candidate);
  const currentDistanceAtr = (
    currentDistance !== null
    && currentAtr !== null
    && currentAtr > 0
  )
    ? currentDistance / currentAtr
    : null;
  const barsSinceLastInteraction = (
    lastClosedCandleIndex !== null
    && lastInteractionCandleIndex !== null
  )
    ? lastClosedCandleIndex - lastInteractionCandleIndex
    : null;

  let state: LevelEngineValidationReviewState;
  if (breakEvidence !== null) {
    state = 'broken';
  } else if (
    futureClosedCandlesCount < policy.minimumFutureBars
  ) {
    state = 'pending';
  } else if (
    barsSinceLastInteraction !== null
    && barsSinceLastInteraction >= policy.staleAfterBars
    && currentDistanceAtr !== null
    && currentDistanceAtr >= policy.staleDistanceAtr
  ) {
    state = 'stale';
  } else {
    state = 'active';
  }

  const lastInteractionCandle = lastInteractionCandleIndex === null
    ? null
    : closedCandles[lastInteractionCandleIndex] ?? null;

  return Object.freeze({
    state,
    futureClosedCandlesCount,
    firstFutureCandleIndex:
      firstFutureIndex < closedCandles.length
        ? firstFutureIndex
        : null,
    lastClosedCandleIndex,
    lastClosedAt: lastClosedCandle === null
      ? null
      : canonicalTimestamp(
          lastClosedCandle.closeTime,
          'lastClosedAt',
        ),
    currentPrice,
    currentAtr,
    distanceFromZone: currentDistance,
    distanceFromZoneAtr: currentDistanceAtr,
    lastInteractionCandleIndex,
    lastInteractionAt: lastInteractionCandle === null
      ? null
      : canonicalTimestamp(
          lastInteractionCandle.closeTime,
          'lastInteractionAt',
        ),
    barsSinceLastInteraction,
    breakEvidence,
  });
}

function summarizeTimeframe(
  result: MultiTimeframeLevelDetectionResult['timeframes'][number],
): LevelEngineValidationTimeframeSummary {
  const confirmedCount = result.candidates.filter(
    (candidate) => candidate.maturity === 'confirmed',
  ).length;
  const developingCount = result.candidates.filter(
    (candidate) => candidate.maturity === 'developing',
  ).length;
  const oneTouchCandidateCount = result.candidates.filter(
    (candidate) => candidate.touchEpisodes.length === 1,
  ).length;
  const maxTouchEpisodeCount = result.candidates.reduce(
    (maximum, candidate) =>
      Math.max(maximum, candidate.touchEpisodes.length),
    0,
  );
  const candidatesPer100ClosedCandles =
    result.closedCandlesCount === 0
      ? 0
      : Number(
          (
            result.candidates.length
            / result.closedCandlesCount
            * 100
          ).toFixed(4),
        );

  return Object.freeze({
    sourceTimeframe: result.sourceTimeframe,
    closedCandlesCount: result.closedCandlesCount,
    ignoredOpenCandlesCount: result.ignoredOpenCandlesCount,
    pivotSeedCount: result.pivotSeeds.length,
    candidateCount: result.candidates.length,
    confirmedCount,
    developingCount,
    oneTouchCandidateCount,
    maxTouchEpisodeCount,
    candidatesPer100ClosedCandles,
    rejectedClusterCount: result.rejectedClusters.length,
    rejectedClustersByReason: rejectionCounts(
      result.rejectedClusters.map((cluster) => cluster.reason),
    ),
  });
}

function freezeDataset(
  dataset: LevelEngineTimeframeDataset,
): LevelEngineValidationDatasetSnapshot {
  return Object.freeze({
    symbol: dataset.symbol,
    sourceTimeframe: dataset.sourceTimeframe,
    candles: Object.freeze(
      dataset.candles.map((candle) => Object.freeze({ ...candle })),
    ),
  });
}

export function buildLevelEngineSymbolValidationReport(
  datasetsValue: readonly LevelEngineTimeframeDataset[],
  detection: MultiTimeframeLevelDetectionResult,
  reviewLimitValue: number,
): LevelEngineSymbolValidationReport {
  const reviewLimit = positiveInteger(
    reviewLimitValue,
    'reviewLimitPerSymbol',
    500,
  );

  if (datasetsValue.length === 0) {
    fail('symbol validation report requires at least one dataset');
  }

  const symbol = normalizeLevelEngineSymbol(detection.symbol);
  const datasets = Object.freeze(
    datasetsValue.map((dataset) => {
      const datasetSymbol = normalizeLevelEngineSymbol(dataset.symbol);
      if (datasetSymbol !== symbol) {
        fail('dataset symbol must match detection symbol');
      }
      return freezeDataset({
        symbol: datasetSymbol,
        sourceTimeframe: dataset.sourceTimeframe,
        candles: dataset.candles,
      });
    }),
  );

  const reviewQueue: readonly LevelEngineValidationReviewItem[] =
    Object.freeze(
      [...detection.candidates]
        .sort(compareReviewCandidates)
        .slice(0, reviewLimit)
        .map((candidate, index) => {
          const dataset = datasetsValue.find(
            (value) =>
              value.sourceTimeframe === candidate.sourceTimeframe,
          );
          if (!dataset) {
            fail(
              `review dataset is unavailable for ${candidate.sourceTimeframe}`,
            );
          }

          return Object.freeze({
            reviewOrder: index + 1,
            candidate,
            diagnostic: diagnoseLevelCandidateForReview(
              dataset,
              candidate,
            ),
            manualLabel: null,
            manualNote: null,
          });
        }),
    );

  return Object.freeze({
    symbol,
    datasets,
    detection,
    timeframeSummaries: Object.freeze(
      detection.timeframes.map(summarizeTimeframe),
    ),
    reviewQueue,
  });
}

function validateConfig(
  value: LevelEngineRealDataValidationConfig,
): {
  readonly binanceBaseUrl: string;
  readonly requestTimeoutMs: number;
  readonly requestDelayMs: number;
  readonly symbols: readonly string[];
  readonly timeframes: readonly LevelEngineTimeframe[];
  readonly candlesPerTimeframe: number;
  readonly reviewLimitPerSymbol: number;
  readonly endTime?: number;
} {
  const symbols = Object.freeze(
    [...new Set(
      value.symbols.map((symbol) => normalizeLevelEngineSymbol(symbol)),
    )],
  );
  if (symbols.length === 0) {
    fail('at least one validation symbol is required');
  }

  const timeframes: LevelEngineTimeframe[] = [];
  for (const timeframe of value.timeframes) {
    if (!isLevelEngineTimeframe(timeframe)) {
      fail(`unsupported timeframe: ${timeframe}`);
    }
    if (!timeframes.includes(timeframe)) {
      timeframes.push(timeframe);
    }
  }
  if (timeframes.length === 0) {
    fail('at least one validation timeframe is required');
  }

  timeframes.sort(
    (left, right) => timeframeRank(left) - timeframeRank(right),
  );

  const base = {
    binanceBaseUrl: validateBaseUrl(value.binanceBaseUrl),
    requestTimeoutMs: positiveInteger(
      value.requestTimeoutMs,
      'requestTimeoutMs',
      30_000,
    ),
    requestDelayMs: nonNegativeInteger(
      value.requestDelayMs,
      'requestDelayMs',
    ),
    symbols,
    timeframes: Object.freeze(timeframes),
    candlesPerTimeframe: positiveInteger(
      value.candlesPerTimeframe,
      'candlesPerTimeframe',
      MAX_BINANCE_KLINES_PER_REQUEST,
    ),
    reviewLimitPerSymbol: positiveInteger(
      value.reviewLimitPerSymbol,
      'reviewLimitPerSymbol',
      500,
    ),
  };

  if (value.endTime === undefined) {
    return Object.freeze(base);
  }

  return Object.freeze({
    ...base,
    endTime: nonNegativeInteger(value.endTime, 'endTime'),
  });
}

export async function validateLevelEngineRealData(
  configValue: LevelEngineRealDataValidationConfig,
  dependencies: ValidateLevelEngineRealDataDependencies = {},
): Promise<LevelEngineRealDataValidationReport> {
  const config = validateConfig(configValue);
  const now = dependencies.now ?? (() => new Date());
  const generatedAt = canonicalTimestamp(
    now().toISOString(),
    'generatedAt',
  );
  const detectCandidates =
    dependencies.detectCandidates
    ?? detectMultiTimeframeLevelCandidates;
  const sleep = dependencies.sleep
    ?? ((milliseconds: number) => delay(milliseconds));

  const defaultFetchCandles: FetchCandles = async (request) => {
    const fetchDependencies =
      dependencies.fetchImpl === undefined
        ? { now }
        : {
            fetchImpl: dependencies.fetchImpl,
            now,
          };

    return fetchBinanceLevelEngineCandles(
      request,
      fetchDependencies,
    );
  };

  const fetchCandles =
    dependencies.fetchCandles
    ?? defaultFetchCandles;

  const symbolReports: LevelEngineSymbolValidationReport[] = [];
  const requestCount =
    config.symbols.length * config.timeframes.length;
  let completedRequests = 0;

  for (const symbol of config.symbols) {
    const datasets: LevelEngineTimeframeDataset[] = [];

    for (const sourceTimeframe of config.timeframes) {
      const requestBase = {
        baseUrl: config.binanceBaseUrl,
        requestTimeoutMs: config.requestTimeoutMs,
        symbol,
        sourceTimeframe,
        limit: config.candlesPerTimeframe,
      };
      const request: BinanceLevelEngineCandleRequest =
        config.endTime === undefined
          ? requestBase
          : {
              ...requestBase,
              endTime: config.endTime,
            };

      const candles = await fetchCandles(request);
      datasets.push(Object.freeze({
        symbol,
        sourceTimeframe,
        candles: Object.freeze([...candles]),
      }));

      completedRequests += 1;
      if (
        config.requestDelayMs > 0
        && completedRequests < requestCount
      ) {
        await sleep(config.requestDelayMs);
      }
    }

    const detection = detectCandidates(datasets);
    symbolReports.push(
      buildLevelEngineSymbolValidationReport(
        datasets,
        detection,
        config.reviewLimitPerSymbol,
      ),
    );
  }

  const frozenReports = Object.freeze([...symbolReports]);
  const totals = Object.freeze({
    symbolCount: frozenReports.length,
    timeframeDatasetCount: frozenReports.reduce(
      (sum, report) => sum + report.datasets.length,
      0,
    ),
    candleCount: frozenReports.reduce(
      (sum, report) =>
        sum + report.datasets.reduce(
          (datasetSum, dataset) =>
            datasetSum + dataset.candles.length,
          0,
        ),
      0,
    ),
    candidateCount: frozenReports.reduce(
      (sum, report) =>
        sum + report.detection.candidates.length,
      0,
    ),
    confirmedCount: frozenReports.reduce(
      (sum, report) =>
        sum + report.detection.candidates.filter(
          (candidate) => candidate.maturity === 'confirmed',
        ).length,
      0,
    ),
    reviewItemCount: frozenReports.reduce(
      (sum, report) => sum + report.reviewQueue.length,
      0,
    ),
    reviewStateCounts: Object.freeze(
      frozenReports.reduce(
        (
          counts: Record<LevelEngineValidationReviewState, number>,
          report,
        ) => {
          for (const item of report.reviewQueue) {
            counts[item.diagnostic.state] += 1;
          }
          return counts;
        },
        {
          active: 0,
          broken: 0,
          stale: 0,
          pending: 0,
        },
      ),
    ),
  });

  return Object.freeze({
    version: 'level-engine-real-data-validation-v0.1',
    reviewDiagnosticsVersion:
      'level-engine-review-diagnostics-v0.1',
    generatedAt,
    binanceBaseUrl: config.binanceBaseUrl,
    requestedSymbols: config.symbols,
    requestedTimeframes: config.timeframes,
    candlesPerTimeframe: config.candlesPerTimeframe,
    reviewLimitPerSymbol: config.reviewLimitPerSymbol,
    reviewPolicy:
      DEFAULT_LEVEL_ENGINE_VALIDATION_REVIEW_POLICY,
    symbolReports: frozenReports,
    totals,
    observationalOnly: true,
    createsSetup: false,
    mergesAcrossTimeframes: false,
    usesQualityScore: false,
  });
}

export const LEVEL_ENGINE_REAL_DATA_VALIDATION_REJECTION_REASONS =
  REJECTION_REASONS;
