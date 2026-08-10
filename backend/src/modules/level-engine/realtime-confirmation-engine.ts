import {
  APPROACH_ENGINE_CONTRACT_VERSION,
} from './approach-engine.types.js';
import type {
  ApproachEvaluationResult,
  LevelLineApproachEvaluation,
} from './approach-engine.types.js';
import {
  isLevelEngineTimeframe,
  normalizeLevelEngineSymbol,
} from './level-engine.contract.js';
import type {
  LevelEngineCandle,
} from './level-engine-touch-detector.types.js';
import {
  REALTIME_CONFIRMATION_ENGINE_CONTRACT_VERSION,
} from './realtime-confirmation-engine.types.js';
import type {
  LevelLineRealtimeConfirmation,
  RealtimeConfirmationDirection,
  RealtimeConfirmationEngineOptions,
  RealtimeConfirmationEvaluationInput,
  RealtimeConfirmationEvaluationResult,
  RealtimeConfirmationEvidenceAvailability,
  RealtimeConfirmationEvidenceCapture,
  RealtimeConfirmationEvidenceState,
  RealtimeConfirmationMarketEvidence,
  RealtimeConfirmationOrderBookEvidence,
  RealtimeConfirmationStatus,
  RealtimeConfirmationTapeEvidence,
} from './realtime-confirmation-engine.types.js';

export const DEFAULT_REALTIME_CONFIRMATION_ENGINE_OPTIONS:
RealtimeConfirmationEngineOptions =
  Object.freeze({
    interactionTolerancePercent:
      0.15,
    tapeWindowMs:
      15_000,
    tapeStaleAfterMs:
      5_000,
    minimumTapeTradesCount:
      3,
    directionalPressureThresholdPercent:
      8,
  });

function fail(
  message: string,
): never {
  throw new Error(
    `Realtime Confirmation Engine: ${message}`,
  );
}

function finite(
  value: number,
  field: string,
): number {
  if (!Number.isFinite(value)) {
    fail(
      `${field} must be a finite number`,
    );
  }

  return value;
}

function positiveFinite(
  value: number,
  field: string,
): number {
  const result =
    finite(
      value,
      field,
    );

  if (result <= 0) {
    fail(
      `${field} must be positive`,
    );
  }

  return result;
}

function nonNegativeFinite(
  value: number,
  field: string,
): number {
  const result =
    finite(
      value,
      field,
    );

  if (result < 0) {
    fail(
      `${field} must be non-negative`,
    );
  }

  return result;
}

function positiveInteger(
  value: number,
  field: string,
): number {
  if (
    !Number.isSafeInteger(value)
    || value <= 0
  ) {
    fail(
      `${field} must be a positive integer`,
    );
  }

  return value;
}

function nonNegativeInteger(
  value: number,
  field: string,
): number {
  if (
    !Number.isSafeInteger(value)
    || value < 0
  ) {
    fail(
      `${field} must be a non-negative integer`,
    );
  }

  return value;
}

function canonicalTimestamp(
  value: string,
  field: string,
): string {
  const timestamp =
    Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    fail(
      `${field} must be a valid timestamp`,
    );
  }

  return new Date(timestamp)
    .toISOString();
}

function roundMetric(
  value: number,
): number {
  return Number(
    value.toFixed(8),
  );
}

function validateOptions(
  value:
    RealtimeConfirmationEngineOptions,
): RealtimeConfirmationEngineOptions {
  const interactionTolerancePercent =
    positiveFinite(
      value.interactionTolerancePercent,
      'interactionTolerancePercent',
    );
  const tapeWindowMs =
    positiveInteger(
      value.tapeWindowMs,
      'tapeWindowMs',
    );
  const tapeStaleAfterMs =
    positiveInteger(
      value.tapeStaleAfterMs,
      'tapeStaleAfterMs',
    );
  const minimumTapeTradesCount =
    positiveInteger(
      value.minimumTapeTradesCount,
      'minimumTapeTradesCount',
    );
  const directionalPressureThresholdPercent =
    positiveFinite(
      value.directionalPressureThresholdPercent,
      'directionalPressureThresholdPercent',
    );

  if (interactionTolerancePercent > 100) {
    fail(
      'interactionTolerancePercent cannot exceed 100',
    );
  }
  if (tapeStaleAfterMs > tapeWindowMs) {
    fail(
      'tapeStaleAfterMs cannot exceed tapeWindowMs',
    );
  }
  if (directionalPressureThresholdPercent > 100) {
    fail(
      'directionalPressureThresholdPercent cannot exceed 100',
    );
  }

  return Object.freeze({
    interactionTolerancePercent,
    tapeWindowMs,
    tapeStaleAfterMs,
    minimumTapeTradesCount,
    directionalPressureThresholdPercent,
  });
}

function validateApproachContract(
  value:
    ApproachEvaluationResult,
  symbol: string,
  timeframe:
    RealtimeConfirmationEvaluationInput[
      'timeframe'
    ],
): void {
  if (
    value.version
      !== APPROACH_ENGINE_CONTRACT_VERSION
    || normalizeLevelEngineSymbol(
      value.symbol,
    ) !== symbol
    || value.timeframe !== timeframe
    || value.observationalOnly !== true
    || value.evaluatesApproach !== true
    || value.createsRealtimeConfirmation
      !== false
    || value.createsSetup !== false
    || value.createsSignal !== false
    || value.usesFutureCandles !== false
  ) {
    fail(
      'approach contract does not match the confirmation input',
    );
  }
}

function validateCurrentCandle(
  value: LevelEngineCandle | null,
  approach:
    ApproachEvaluationResult,
): LevelEngineCandle | null {
  const currentFields = [
    approach.currentPrice,
    approach.currentCandleIndex,
    approach.currentCandleOpenTime,
    approach.observedAt,
  ];
  const hasCurrent =
    currentFields.some(
      (field) =>
        field !== null,
    );

  if (
    hasCurrent
    !== currentFields.every(
      (field) =>
        field !== null,
    )
  ) {
    fail(
      'approach current fields must be all null or all populated',
    );
  }

  if (!hasCurrent) {
    if (value !== null) {
      fail(
        'currentClosedCandle must be null when the approach has no current candle',
      );
    }
    return null;
  }

  if (
    value === null
    || value.isClosed !== true
  ) {
    fail(
      'a populated approach requires a closed current candle',
    );
  }

  const openTime =
    canonicalTimestamp(
      value.openTime,
      'currentClosedCandle.openTime',
    );
  const closeTime =
    canonicalTimestamp(
      value.closeTime,
      'currentClosedCandle.closeTime',
    );
  const open =
    positiveFinite(
      value.open,
      'currentClosedCandle.open',
    );
  const high =
    positiveFinite(
      value.high,
      'currentClosedCandle.high',
    );
  const low =
    positiveFinite(
      value.low,
      'currentClosedCandle.low',
    );
  const close =
    positiveFinite(
      value.close,
      'currentClosedCandle.close',
    );

  if (
    high < Math.max(
      open,
      close,
    )
    || low > Math.min(
      open,
      close,
    )
    || high < low
  ) {
    fail(
      'currentClosedCandle OHLC values are inconsistent',
    );
  }

  if (
    openTime
      !== approach.currentCandleOpenTime
    || closeTime
      !== approach.observedAt
    || close
      !== approach.currentPrice
  ) {
    fail(
      'currentClosedCandle does not match the approach snapshot',
    );
  }

  return Object.freeze({
    ...value,
    openTime,
    closeTime,
    open,
    high,
    low,
    close,
    isClosed: true,
  });
}

function hasSourceError(
  errors: readonly string[],
  prefix: 'tape:' | 'order_book:',
): boolean {
  return errors.some(
    (error) =>
      error.startsWith(
        prefix,
      ),
  );
}

function buildTapeEvidence(
  capture:
    RealtimeConfirmationEvidenceCapture,
  evaluatedAtMs: number,
  options:
    RealtimeConfirmationEngineOptions,
): RealtimeConfirmationTapeEvidence {
  const tape =
    capture.tape;

  if (!tape) {
    return Object.freeze({
      state:
        hasSourceError(
          capture.sourceErrors,
          'tape:',
        )
          ? 'error'
          : 'collecting',
      snapshotUpdatedAt: null,
      lastTradeAt: null,
      ageMs: null,
      windowMs:
        options.tapeWindowMs,
      tradesCount: 0,
      ignoredFutureTradesCount: 0,
      ignoredOutsideWindowTradesCount: 0,
      executionsCount: 0,
      buyQuoteValue: 0,
      sellQuoteValue: 0,
      totalQuoteValue: 0,
      quoteDelta: 0,
      pressurePct: null,
    });
  }

  const snapshotUpdatedAt =
    tape.snapshotUpdatedAt === null
      ? null
      : canonicalTimestamp(
          tape.snapshotUpdatedAt,
          'evidence.tape.snapshotUpdatedAt',
        );
  const windowStartMs =
    evaluatedAtMs
    - options.tapeWindowMs;
  const eligible:
    Array<{
      readonly timestamp: string;
      readonly timestampMs: number;
      readonly side: 'buy' | 'sell';
      readonly quoteValue: number;
      readonly executionsCount: number;
    }> = [];
  let ignoredFutureTradesCount = 0;
  let ignoredOutsideWindowTradesCount = 0;

  tape.trades.forEach(
    (
      trade,
      index,
    ) => {
      if (
        normalizeLevelEngineSymbol(
          trade.symbol,
        ) !== normalizeLevelEngineSymbol(
          capture.symbol,
        )
      ) {
        fail(
          `evidence.tape.trades[${index}] belongs to another symbol`,
        );
      }
      const timestamp =
        canonicalTimestamp(
          trade.timestamp,
          `evidence.tape.trades[${index}].timestamp`,
        );
      const timestampMs =
        Date.parse(timestamp);
      const price =
        positiveFinite(
          trade.price,
          `evidence.tape.trades[${index}].price`,
        );
      const quantity =
        positiveFinite(
          trade.quantity,
          `evidence.tape.trades[${index}].quantity`,
        );
      const quoteValue =
        positiveFinite(
          trade.quoteValue,
          `evidence.tape.trades[${index}].quoteValue`,
        );

      if (
        Math.abs(
          price * quantity
          - quoteValue,
        ) > Math.max(
          0.00000001,
          quoteValue * 0.000001,
        )
      ) {
        fail(
          `evidence.tape.trades[${index}].quoteValue does not match price and quantity`,
        );
      }
      if (
        trade.side !== 'buy'
        && trade.side !== 'sell'
      ) {
        fail(
          `evidence.tape.trades[${index}].side is unsupported`,
        );
      }

      if (timestampMs > evaluatedAtMs) {
        ignoredFutureTradesCount += 1;
        return;
      }
      if (timestampMs < windowStartMs) {
        ignoredOutsideWindowTradesCount += 1;
        return;
      }

      eligible.push({
        timestamp,
        timestampMs,
        side:
          trade.side,
        quoteValue,
        executionsCount:
          trade.tradesCount
            === undefined
              ? 1
              : positiveInteger(
                  trade.tradesCount,
                  `evidence.tape.trades[${index}].tradesCount`,
                ),
      });
    },
  );

  eligible.sort(
    (left, right) =>
      left.timestampMs
      - right.timestampMs,
  );

  let executionsCount = 0;
  let buyQuoteValue = 0;
  let sellQuoteValue = 0;

  for (const trade of eligible) {
    executionsCount +=
      trade.executionsCount;

    if (trade.side === 'buy') {
      buyQuoteValue +=
        trade.quoteValue;
    } else {
      sellQuoteValue +=
        trade.quoteValue;
    }
  }

  const totalQuoteValue =
    buyQuoteValue
    + sellQuoteValue;
  const quoteDelta =
    buyQuoteValue
    - sellQuoteValue;
  const lastTrade =
    eligible.at(-1);
  const ageMs =
    lastTrade
      ? evaluatedAtMs
        - lastTrade.timestampMs
      : null;
  const state =
    hasSourceError(
      capture.sourceErrors,
      'tape:',
    )
      ? 'error'
      : ageMs !== null
        && ageMs
          > options.tapeStaleAfterMs
        ? 'stale'
        : eligible.length
          < options.minimumTapeTradesCount
          ? 'collecting'
          : 'live';

  return Object.freeze({
    state,
    snapshotUpdatedAt,
    lastTradeAt:
      lastTrade?.timestamp
      ?? null,
    ageMs,
    windowMs:
      options.tapeWindowMs,
    tradesCount:
      eligible.length,
    ignoredFutureTradesCount,
    ignoredOutsideWindowTradesCount,
    executionsCount,
    buyQuoteValue:
      roundMetric(
        buyQuoteValue,
      ),
    sellQuoteValue:
      roundMetric(
        sellQuoteValue,
      ),
    totalQuoteValue:
      roundMetric(
        totalQuoteValue,
      ),
    quoteDelta:
      roundMetric(
        quoteDelta,
      ),
    pressurePct:
      totalQuoteValue > 0
        ? roundMetric(
            quoteDelta
            / totalQuoteValue
            * 100,
          )
        : null,
  });
}

function buildOrderBookEvidence(
  capture:
    RealtimeConfirmationEvidenceCapture,
  evaluatedAtMs: number,
): RealtimeConfirmationOrderBookEvidence {
  const orderBook =
    capture.orderBook;

  if (!orderBook) {
    return Object.freeze({
      state:
        hasSourceError(
          capture.sourceErrors,
          'order_book:',
        )
          ? 'error'
          : 'collecting',
      synchronized: false,
      updatedAt: null,
      updatedAfterCapture: false,
      ageMs: null,
      staleAfterMs: null,
      bestBid: null,
      bestAsk: null,
      spreadPct: null,
      bidDepthQuote: null,
      askDepthQuote: null,
      totalDepthQuote: null,
      imbalancePct: null,
    });
  }

  const updatedAt =
    orderBook.updatedAt === null
      ? null
      : canonicalTimestamp(
          orderBook.updatedAt,
          'evidence.orderBook.updatedAt',
        );
  const ageMs =
    orderBook.ageMs === null
      ? null
      : nonNegativeFinite(
          orderBook.ageMs,
          'evidence.orderBook.ageMs',
        );
  const updatedAfterCapture =
    updatedAt !== null
    && Date.parse(updatedAt)
      > evaluatedAtMs;
  const staleAfterMs =
    positiveFinite(
      orderBook.staleAfterMs,
      'evidence.orderBook.staleAfterMs',
    );
  const bidDepthQuote =
    nonNegativeFinite(
      orderBook.bidDepthQuote,
      'evidence.orderBook.bidDepthQuote',
    );
  const askDepthQuote =
    nonNegativeFinite(
      orderBook.askDepthQuote,
      'evidence.orderBook.askDepthQuote',
    );
  const totalDepthQuote =
    nonNegativeFinite(
      orderBook.totalDepthQuote,
      'evidence.orderBook.totalDepthQuote',
    );

  if (
    Math.abs(
      bidDepthQuote
      + askDepthQuote
      - totalDepthQuote,
    ) > Math.max(
      0.00000001,
      totalDepthQuote * 0.000001,
    )
  ) {
    fail(
      'evidence.orderBook.totalDepthQuote does not match both sides',
    );
  }

  const sourceFailed =
    hasSourceError(
      capture.sourceErrors,
      'order_book:',
    );
  const state =
    sourceFailed
    || orderBook.state === 'error'
      ? 'error'
      : orderBook.state === 'collecting'
        ? 'collecting'
        : orderBook.state === 'stale'
        || !orderBook.synchronized
        || updatedAfterCapture
        || ageMs === null
        || ageMs > staleAfterMs
          ? 'stale'
          : 'live';

  return Object.freeze({
    state,
    synchronized:
      orderBook.synchronized,
    updatedAt,
    updatedAfterCapture,
    ageMs,
    staleAfterMs,
    bestBid:
      orderBook.bestBid === null
        ? null
        : positiveFinite(
            orderBook.bestBid,
            'evidence.orderBook.bestBid',
          ),
    bestAsk:
      orderBook.bestAsk === null
        ? null
        : positiveFinite(
            orderBook.bestAsk,
            'evidence.orderBook.bestAsk',
          ),
    spreadPct:
      orderBook.spreadPct === null
        ? null
        : nonNegativeFinite(
            orderBook.spreadPct,
            'evidence.orderBook.spreadPct',
          ),
    bidDepthQuote,
    askDepthQuote,
    totalDepthQuote,
    imbalancePct: (() => {
      if (orderBook.imbalancePct === null) {
        return null;
      }

      const value =
        finite(
          orderBook.imbalancePct,
          'evidence.orderBook.imbalancePct',
        );

      if (
        value < -100
        || value > 100
      ) {
        fail(
          'evidence.orderBook.imbalancePct must be between -100 and 100',
        );
      }

      return value;
    })(),
  });
}

function resolveAvailability(
  tape:
    RealtimeConfirmationTapeEvidence,
  orderBook:
    RealtimeConfirmationOrderBookEvidence,
): RealtimeConfirmationEvidenceAvailability {
  const tapeLive =
    tape.state === 'live'
    && tape.pressurePct !== null;
  const orderBookLive =
    orderBook.state === 'live'
    && orderBook.imbalancePct
      !== null
    && orderBook.totalDepthQuote
      !== null
    && orderBook.totalDepthQuote > 0;

  if (
    tapeLive
    && orderBookLive
  ) {
    return 'complete';
  }
  if (tapeLive) {
    return 'tape_only';
  }
  if (orderBookLive) {
    return 'order_book_only';
  }

  return 'unavailable';
}

function buildMarketEvidence(
  capture:
    RealtimeConfirmationEvidenceCapture,
  symbol: string,
  evaluatedAt: string,
  options:
    RealtimeConfirmationEngineOptions,
): RealtimeConfirmationMarketEvidence {
  if (
    normalizeLevelEngineSymbol(
      capture.symbol,
    ) !== symbol
  ) {
    fail(
      'evidence belongs to another symbol',
    );
  }

  const capturedAt =
    canonicalTimestamp(
      capture.capturedAt,
      'evidence.capturedAt',
    );

  if (capturedAt !== evaluatedAt) {
    fail(
      'evidence capturedAt must equal evaluatedAt',
    );
  }

  const tape =
    buildTapeEvidence(
      capture,
      Date.parse(evaluatedAt),
      options,
    );
  const orderBook =
    buildOrderBookEvidence(
      capture,
      Date.parse(evaluatedAt),
    );

  return Object.freeze({
    symbol,
    capturedAt,
    availability:
      resolveAvailability(
        tape,
        orderBook,
      ),
    tape,
    orderBook,
    sourceErrors:
      Object.freeze([
        ...capture.sourceErrors,
      ]),
  });
}

function validateApproachEvaluation(
  value:
    LevelLineApproachEvaluation,
  index: number,
  approach:
    ApproachEvaluationResult,
  symbol: string,
  timeframe:
    RealtimeConfirmationEvaluationInput[
      'timeframe'
    ],
): void {
  if (!value.lineId.trim()) {
    fail(
      `approach.evaluations[${index}].lineId cannot be empty`,
    );
  }
  if (
    normalizeLevelEngineSymbol(
      value.symbol,
    ) !== symbol
    || value.timeframe !== timeframe
    || value.currentPrice
      !== approach.currentPrice
    || value.currentCandleIndex
      !== approach.currentCandleIndex
    || value.currentCandleOpenTime
      !== approach.currentCandleOpenTime
    || value.observedAt
      !== approach.observedAt
  ) {
    fail(
      `approach.evaluations[${index}] does not match the root snapshot`,
    );
  }
  positiveFinite(
    value.levelPrice,
    `approach.evaluations[${index}].levelPrice`,
  );
  positiveFinite(
    value.currentPrice,
    `approach.evaluations[${index}].currentPrice`,
  );
  nonNegativeInteger(
    value.currentCandleIndex,
    `approach.evaluations[${index}].currentCandleIndex`,
  );
  canonicalTimestamp(
    value.currentCandleOpenTime,
    `approach.evaluations[${index}].currentCandleOpenTime`,
  );
  canonicalTimestamp(
    value.observedAt,
    `approach.evaluations[${index}].observedAt`,
  );

  if (
    value.kind !== 'support'
    && value.kind !== 'resistance'
  ) {
    fail(
      `approach.evaluations[${index}].kind is unsupported`,
    );
  }
  if (
    value.stage !== null
    && value.stage !== 'APPROACH'
  ) {
    fail(
      `approach.evaluations[${index}].stage is unsupported`,
    );
  }
}

function evidenceState(
  value: number | null,
  threshold: number,
): RealtimeConfirmationEvidenceState {
  if (value === null) {
    return 'unavailable';
  }
  if (value >= threshold) {
    return 'supports';
  }
  if (value <= -threshold) {
    return 'opposes';
  }

  return 'neutral';
}

function interactionDirection(
  value:
    LevelLineApproachEvaluation,
): RealtimeConfirmationDirection {
  return value.kind === 'resistance'
    ? 'up'
    : 'down';
}

function approachSideValid(
  value:
    LevelLineApproachEvaluation,
): boolean {
  return value.kind === 'resistance'
    ? value.currentPrice
      <= value.levelPrice
    : value.currentPrice
      >= value.levelPrice;
}

function candleIntersectsLevelZone(
  value:
    LevelLineApproachEvaluation,
  candle: LevelEngineCandle,
  tolerancePercent: number,
): boolean {
  const tolerance =
    value.levelPrice
    * tolerancePercent
    / 100;
  const zoneLow =
    value.levelPrice
    - tolerance;
  const zoneHigh =
    value.levelPrice
    + tolerance;

  return candle.high >= zoneLow
    && candle.low <= zoneHigh;
}

function resolveStatus(
  approachStage:
    'APPROACH' | null,
  sideValid: boolean,
  intersects: boolean,
  evidence:
    RealtimeConfirmationMarketEvidence,
  tapeState:
    RealtimeConfirmationEvidenceState,
  orderBookState:
    RealtimeConfirmationEvidenceState,
): RealtimeConfirmationStatus {
  if (approachStage !== 'APPROACH') {
    return 'not_applicable';
  }
  if (
    !sideValid
    || !intersects
  ) {
    return 'not_ready';
  }
  if (evidence.availability !== 'complete') {
    return 'collecting';
  }
  if (
    tapeState === 'opposes'
    || orderBookState === 'opposes'
  ) {
    return 'not_ready';
  }
  if (
    tapeState === 'supports'
    && orderBookState === 'supports'
  ) {
    return 'confirmed';
  }
  if (
    tapeState === 'supports'
    || orderBookState === 'supports'
  ) {
    return 'partial';
  }

  return 'not_ready';
}

function reasons(
  approachStage:
    'APPROACH' | null,
  sideValid: boolean,
  intersects: boolean,
  evidence:
    RealtimeConfirmationMarketEvidence,
  tapeState:
    RealtimeConfirmationEvidenceState,
  orderBookState:
    RealtimeConfirmationEvidenceState,
  status:
    RealtimeConfirmationStatus,
): readonly string[] {
  const values:
    string[] = [];

  if (approachStage !== 'APPROACH') {
    values.push(
      'line_not_in_approach',
    );
  }
  if (!sideValid) {
    values.push(
      'approach_from_wrong_side',
    );
  }
  if (!intersects) {
    values.push(
      'closed_candle_did_not_intersect_level_zone',
    );
  }
  if (evidence.tape.state !== 'live') {
    values.push(
      `tape_${evidence.tape.state}`,
    );
  }
  if (evidence.orderBook.state !== 'live') {
    values.push(
      `order_book_${evidence.orderBook.state}`,
    );
  }
  if (tapeState === 'opposes') {
    values.push(
      'trade_flow_opposes_interaction',
    );
  }
  if (orderBookState === 'opposes') {
    values.push(
      'order_book_opposes_interaction',
    );
  }
  if (status === 'confirmed') {
    values.push(
      'trade_flow_and_order_book_support_interaction',
    );
  } else if (status === 'partial') {
    values.push(
      'one_live_source_supports_interaction',
    );
  } else if (
    status === 'not_ready'
    && tapeState !== 'opposes'
    && orderBookState !== 'opposes'
    && sideValid
    && intersects
  ) {
    values.push(
      'directional_pressure_not_sufficient',
    );
  }

  return Object.freeze(values);
}

function evaluateLine(
  value:
    LevelLineApproachEvaluation,
  candle: LevelEngineCandle,
  evidence:
    RealtimeConfirmationMarketEvidence,
  options:
    RealtimeConfirmationEngineOptions,
): LevelLineRealtimeConfirmation {
  const direction =
    interactionDirection(
      value,
    );
  const directionSign =
    direction === 'up'
      ? 1
      : -1;
  const sideValid =
    approachSideValid(
      value,
    );
  const intersects =
    candleIntersectsLevelZone(
      value,
      candle,
      options
        .interactionTolerancePercent,
    );
  const directionalTapePressurePercent =
    evidence.tape.pressurePct === null
      ? null
      : roundMetric(
          evidence.tape.pressurePct
          * directionSign,
        );
  const directionalOrderBookPressurePercent =
    evidence.orderBook
      .imbalancePct === null
      ? null
      : roundMetric(
          evidence.orderBook
            .imbalancePct
          * directionSign,
        );
  const tapeState =
    evidence.tape.state === 'live'
      ? evidenceState(
          directionalTapePressurePercent,
          options
            .directionalPressureThresholdPercent,
        )
      : 'unavailable';
  const orderBookState =
    evidence.orderBook.state === 'live'
      ? evidenceState(
          directionalOrderBookPressurePercent,
          options
            .directionalPressureThresholdPercent,
        )
      : 'unavailable';
  const status =
    resolveStatus(
      value.stage,
      sideValid,
      intersects,
      evidence,
      tapeState,
      orderBookState,
    );

  return Object.freeze({
    lineId:
      value.lineId,
    symbol:
      value.symbol,
    timeframe:
      value.timeframe,
    kind:
      value.kind,
    levelPrice:
      value.levelPrice,
    currentPrice:
      value.currentPrice,
    currentCandleIndex:
      value.currentCandleIndex,
    currentCandleOpenTime:
      value.currentCandleOpenTime,
    observedAt:
      value.observedAt,
    approachStage:
      value.stage,
    interactionDirection:
      direction,
    approachSideValid:
      sideValid,
    candleIntersectsLevelZone:
      intersects,
    tapePressurePercent:
      evidence.tape.pressurePct,
    directionalTapePressurePercent,
    tapeState,
    orderBookImbalancePercent:
      evidence.orderBook
        .imbalancePct,
    directionalOrderBookPressurePercent,
    orderBookState,
    status,
    stage:
      status === 'confirmed'
        ? 'CONFIRMATION'
        : null,
    reasons:
      reasons(
        value.stage,
        sideValid,
        intersects,
        evidence,
        tapeState,
        orderBookState,
        status,
      ),
  });
}

export function evaluateRealtimeConfirmations(
  input:
    RealtimeConfirmationEvaluationInput,
  optionsValue:
    RealtimeConfirmationEngineOptions =
      DEFAULT_REALTIME_CONFIRMATION_ENGINE_OPTIONS,
): RealtimeConfirmationEvaluationResult {
  if (
    !isLevelEngineTimeframe(
      input.timeframe,
    )
  ) {
    fail(
      `unsupported timeframe: ${input.timeframe}`,
    );
  }

  const symbol =
    normalizeLevelEngineSymbol(
      input.symbol,
    );
  const options =
    validateOptions(
      optionsValue,
    );
  const approach =
    input.approachEvaluation;

  validateApproachContract(
    approach,
    symbol,
    input.timeframe,
  );

  const currentClosedCandle =
    validateCurrentCandle(
      input.currentClosedCandle,
      approach,
    );
  const evaluatedAt =
    canonicalTimestamp(
      input.evidence.capturedAt,
      'evidence.capturedAt',
    );

  if (
    approach.observedAt !== null
    && Date.parse(evaluatedAt)
      < Date.parse(
        approach.observedAt,
      )
  ) {
    fail(
      'realtime evidence cannot precede the current closed candle',
    );
  }

  const evidence =
    buildMarketEvidence(
      input.evidence,
      symbol,
      evaluatedAt,
      options,
    );
  const lineIds =
    new Set<string>();
  const evaluations:
    LevelLineRealtimeConfirmation[] = [];

  approach.evaluations.forEach(
    (
      value,
      index,
    ) => {
      validateApproachEvaluation(
        value,
        index,
        approach,
        symbol,
        input.timeframe,
      );

      if (lineIds.has(value.lineId)) {
        fail(
          `duplicate line id: ${value.lineId}`,
        );
      }
      lineIds.add(
        value.lineId,
      );

      if (currentClosedCandle) {
        evaluations.push(
          evaluateLine(
            value,
            currentClosedCandle,
            evidence,
            options,
          ),
        );
      }
    },
  );

  return Object.freeze({
    version:
      REALTIME_CONFIRMATION_ENGINE_CONTRACT_VERSION,
    symbol,
    timeframe:
      input.timeframe,
    evaluatedAt,
    evaluations:
      Object.freeze([
        ...evaluations,
      ]),
    evidence,
    appliedOptions:
      options,
    observationalOnly: true,
    evaluatesRealtimeConfirmation:
      true,
    evaluatesBreakout: false,
    evaluatesBounce: false,
    createsSetup: false,
    createsSignal: false,
    createsScore: false,
    learnsFromOutcome: false,
    usesFutureCandles: false,
    usesFutureRealtimeEvidence:
      false,
  });
}
