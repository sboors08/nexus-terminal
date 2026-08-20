import {
  DEPARTURE_EXTREMUM_TRACKER_CONTRACT_VERSION,
} from './departure-extremum-tracker.types.js';
import type {
  DepartureExtremum,
} from './departure-extremum-tracker.types.js';
import {
  isLevelEngineTimeframe,
  normalizeLevelEngineSymbol,
} from './level-engine.contract.js';
import {
  OBSERVATION_TRACKER_CONTRACT_VERSION,
} from './observation-tracker.types.js';
import type {
  ObservationPathProgress,
  ObservationTrackingInput,
  ObservationTrackingOptions,
  ObservationTrackingResult,
} from './observation-tracker.types.js';
import type {
  LevelEngineCandle,
} from './level-engine-touch-detector.types.js';

interface IndexedClosedCandle {
  readonly originalIndex: number;
  readonly candle: LevelEngineCandle;
}

export const DEFAULT_OBSERVATION_TRACKING_OPTIONS:
ObservationTrackingOptions = Object.freeze({
  observationPathProgressThreshold:
    0.5,
});

function fail(
  message: string,
): never {
  throw new Error(
    `Observation Tracker: ${message}`,
  );
}

function positiveFinite(
  value: number,
  field: string,
): number {
  if (
    !Number.isFinite(value)
    || value <= 0
  ) {
    fail(
      `${field} must be a positive finite number`,
    );
  }

  return value;
}

function nonNegativeInteger(
  value: number,
  field: string,
): number {
  if (
    !Number.isInteger(value)
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

function validateOptions(
  value: ObservationTrackingOptions,
): ObservationTrackingOptions {
  const threshold =
    positiveFinite(
      value
        .observationPathProgressThreshold,
      'observationPathProgressThreshold',
    );

  if (threshold > 1) {
    fail(
      'observationPathProgressThreshold cannot exceed 1',
    );
  }

  return Object.freeze({
    observationPathProgressThreshold:
      threshold,
  });
}

function indexClosedCandles(
  values: readonly LevelEngineCandle[],
): readonly IndexedClosedCandle[] {
  let previousOpenMs =
    Number.NEGATIVE_INFINITY;
  let openCandleSeen =
    false;
  const closed:
  IndexedClosedCandle[] = [];

  values.forEach(
    (
      value,
      originalIndex,
    ) => {
      const openTime =
        canonicalTimestamp(
          value.openTime,
          `candles[${originalIndex}].openTime`,
        );
      const closeTime =
        canonicalTimestamp(
          value.closeTime,
          `candles[${originalIndex}].closeTime`,
        );
      const openMs =
        Date.parse(openTime);
      const closeMs =
        Date.parse(closeTime);

      if (openMs <= previousOpenMs) {
        fail(
          'candles must be strictly ordered and unique',
        );
      }
      if (closeMs < openMs) {
        fail(
          `candles[${originalIndex}].closeTime cannot precede openTime`,
        );
      }

      const open =
        positiveFinite(
          value.open,
          `candles[${originalIndex}].open`,
        );
      const high =
        positiveFinite(
          value.high,
          `candles[${originalIndex}].high`,
        );
      const low =
        positiveFinite(
          value.low,
          `candles[${originalIndex}].low`,
        );
      const close =
        positiveFinite(
          value.close,
          `candles[${originalIndex}].close`,
        );

      if (
        low > high
        || open < low
        || open > high
        || close < low
        || close > high
      ) {
        fail(
          `candles[${originalIndex}] contains invalid OHLC values`,
        );
      }

      if (!value.isClosed) {
        openCandleSeen =
          true;
      } else if (openCandleSeen) {
        fail(
          'closed candles cannot appear after an open candle',
        );
      }

      previousOpenMs =
        openMs;

      if (!value.isClosed) {
        return;
      }

      closed.push(
        Object.freeze({
          originalIndex,
          candle:
            Object.freeze({
              openTime,
              closeTime,
              open,
              high,
              low,
              close,
              isClosed: true,
            }),
        }),
      );
    },
  );

  return Object.freeze(closed);
}

function validateDepartureExtremum(
  value: DepartureExtremum,
  index: number,
  symbol: string,
  timeframe:
    ObservationTrackingInput['timeframe'],
  closed:
    readonly IndexedClosedCandle[],
): DepartureExtremum {
  if (!value.lineId.trim()) {
    fail(
      `activeExtrema[${index}].lineId cannot be empty`,
    );
  }
  if (
    normalizeLevelEngineSymbol(
      value.symbol,
    ) !== symbol
    || value.timeframe !== timeframe
  ) {
    fail(
      `activeExtrema[${index}] does not belong to ${symbol} ${timeframe}`,
    );
  }
  if (
    value.kind !== 'support'
    && value.kind !== 'resistance'
  ) {
    fail(
      `activeExtrema[${index}].kind is unsupported`,
    );
  }

  const levelPrice =
    positiveFinite(
      value.levelPrice,
      `activeExtrema[${index}].levelPrice`,
    );
  const extremumPrice =
    positiveFinite(
      value.price,
      `activeExtrema[${index}].price`,
    );

  if (
    (
      value.kind === 'support'
      && extremumPrice <= levelPrice
    )
    || (
      value.kind === 'resistance'
      && extremumPrice >= levelPrice
    )
  ) {
    fail(
      `activeExtrema[${index}] must be strictly away from its level`,
    );
  }

  const trackingStartedAt =
    canonicalTimestamp(
      value.trackingStartedAt,
      `activeExtrema[${index}].trackingStartedAt`,
    );
  const candleIndex =
    nonNegativeInteger(
      value.candleIndex,
      `activeExtrema[${index}].candleIndex`,
    );
  const candleOpenTime =
    canonicalTimestamp(
      value.candleOpenTime,
      `activeExtrema[${index}].candleOpenTime`,
    );
  const observedAt =
    canonicalTimestamp(
      value.observedAt,
      `activeExtrema[${index}].observedAt`,
    );

  if (
    Date.parse(observedAt)
    < Date.parse(trackingStartedAt)
  ) {
    fail(
      `activeExtrema[${index}].observedAt cannot precede trackingStartedAt`,
    );
  }

  const source =
    closed.find(
      (item) =>
        item.originalIndex
        === candleIndex,
    );

  if (
    !source
    || source.candle.openTime
      !== candleOpenTime
    || source.candle.closeTime
      !== observedAt
  ) {
    fail(
      `activeExtrema[${index}] is not backed by its closed source candle`,
    );
  }

  const sourceExtremumPrice =
    value.kind === 'support'
      ? source.candle.high
      : source.candle.low;

  if (sourceExtremumPrice !== extremumPrice) {
    fail(
      `activeExtrema[${index}].price does not match its source candle`,
    );
  }

  return value;
}

function pathProgress(
  extremum: DepartureExtremum,
  current:
    IndexedClosedCandle,
  closed:
    readonly IndexedClosedCandle[],
  threshold: number,
): ObservationPathProgress {
  if (
    Date.parse(
      current.candle.closeTime,
    ) < Date.parse(
      extremum.observedAt,
    )
  ) {
    fail(
      `line ${extremum.lineId} has future departure data`,
    );
  }

  const denominator =
    Math.abs(
      extremum.levelPrice
      - extremum.price,
    );

  if (
    !Number.isFinite(denominator)
    || denominator <= 0
  ) {
    fail(
      `line ${extremum.lineId} has an invalid departure path`,
    );
  }

  const progress =
    Math.abs(
      current.candle.close
      - extremum.price,
    )
    / denominator;

  if (
    !Number.isFinite(progress)
    || progress < 0
  ) {
    fail(
      `line ${extremum.lineId} produced invalid progress`,
    );
  }

  let episodeStartedAt:
    string | null = null;

  for (const item of closed) {
    if (
      Date.parse(
        item.candle.closeTime,
      ) < Date.parse(
        extremum.observedAt,
      )
    ) {
      continue;
    }

    const itemProgress =
      Math.abs(
        item.candle.close
        - extremum.price,
      )
      / denominator;

    if (itemProgress >= threshold) {
      episodeStartedAt ??=
        item.candle.closeTime;
    } else {
      episodeStartedAt = null;
    }
  }

  return Object.freeze({
    lineId:
      extremum.lineId,
    symbol:
      extremum.symbol,
    timeframe:
      extremum.timeframe,
    kind:
      extremum.kind,
    levelPrice:
      extremum.levelPrice,
    departureExtremumPrice:
      extremum.price,
    departureExtremumObservedAt:
      extremum.observedAt,
    currentPrice:
      current.candle.close,
    currentCandleIndex:
      current.originalIndex,
    currentCandleOpenTime:
      current.candle.openTime,
    observedAt:
      current.candle.closeTime,
    episodeStartedAt,
    progress,
    observationPathProgressThreshold:
      threshold,
    stage:
      progress >= threshold
        ? 'OBSERVATION'
        : null,
  });
}

export function trackObservationProgress(
  input: ObservationTrackingInput,
  optionsValue:
    ObservationTrackingOptions =
      DEFAULT_OBSERVATION_TRACKING_OPTIONS,
): ObservationTrackingResult {
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
  const closed =
    indexClosedCandles(
      input.candles,
    );
  const departure =
    input.departureExtremumTracking;

  if (
    departure.version
      !== DEPARTURE_EXTREMUM_TRACKER_CONTRACT_VERSION
    || normalizeLevelEngineSymbol(
      departure.symbol,
    ) !== symbol
    || departure.timeframe
      !== input.timeframe
    || departure.usesFutureCandles
      !== false
  ) {
    fail(
      'departure tracker contract does not match the observation input',
    );
  }
  if (
    departure.closedCandlesCount
      !== closed.length
    || departure.ignoredOpenCandlesCount
      !== input.candles.length
        - closed.length
  ) {
    fail(
      'departure tracker candle counts do not match the observation input',
    );
  }

  const current =
    closed.at(-1)
    ?? null;
  const activeProgress:
  ObservationPathProgress[] = [];
  const lineIds =
    new Set<string>();

  input.departureExtremumTracking
    .activeExtrema
    .forEach(
      (
        value,
        index,
      ) => {
        const extremum =
          validateDepartureExtremum(
            value,
            index,
            symbol,
            input.timeframe,
            closed,
          );

        if (lineIds.has(extremum.lineId)) {
          fail(
            `duplicate line id: ${extremum.lineId}`,
          );
        }
        lineIds.add(
          extremum.lineId,
        );

        if (!current) {
          fail(
            `line ${extremum.lineId} has no current closed candle`,
          );
        }

        activeProgress.push(
          pathProgress(
            extremum,
            current,
            closed,
            options
              .observationPathProgressThreshold,
          ),
        );
      },
    );

  return Object.freeze({
    version:
      OBSERVATION_TRACKER_CONTRACT_VERSION,
    symbol,
    timeframe:
      input.timeframe,
    closedCandlesCount:
      closed.length,
    ignoredOpenCandlesCount:
      input.candles.length
      - closed.length,
    currentPrice:
      current?.candle.close
      ?? null,
    currentCandleIndex:
      current?.originalIndex
      ?? null,
    currentCandleOpenTime:
      current?.candle.openTime
      ?? null,
    observedAt:
      current?.candle.closeTime
      ?? null,
    activeProgress:
      Object.freeze([
        ...activeProgress,
      ]),
    appliedOptions:
      options,
    observationalOnly: true,
    computesObservationProgress: true,
    createsApproachEvaluation: false,
    createsSetup: false,
    createsSignal: false,
    usesFutureCandles: false,
  });
}
