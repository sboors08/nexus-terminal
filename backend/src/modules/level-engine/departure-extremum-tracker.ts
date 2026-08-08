import {
  isLevelEngineTimeframe,
  normalizeLevelEngineSymbol,
} from './level-engine.contract.js';
import {
  DEPARTURE_EXTREMUM_TRACKER_CONTRACT_VERSION,
} from './departure-extremum-tracker.types.js';
import type {
  DepartureExtremum,
  DepartureExtremumTrackingInput,
  DepartureExtremumTrackingResult,
} from './departure-extremum-tracker.types.js';
import type {
  LevelEngineKind,
} from './level-engine.types.js';
import type {
  LevelEngineCandle,
} from './level-engine-touch-detector.types.js';
import type {
  LevelLine,
} from './level-lines.types.js';

interface IndexedClosedCandle {
  readonly originalIndex: number;
  readonly candle: LevelEngineCandle;
}

function fail(
  message: string,
): never {
  throw new Error(
    `Departure Extremum Tracker: ${message}`,
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

function trackingStart(
  line: LevelLine,
): {
  readonly at: string;
  readonly touchCount: 2 | 3;
} | null {
  if (
    line.status !== 'confirmed'
    && line.status !== 'worked'
  ) {
    return null;
  }

  const value =
    line.status === 'worked'
      ? line.workedAt
      : line.confirmedAt;

  if (!value) {
    fail(
      `line ${line.id} is missing its tracking start`,
    );
  }

  return Object.freeze({
    at:
      canonicalTimestamp(
        value,
        `line ${line.id} tracking start`,
      ),
    touchCount:
      line.status === 'worked'
        ? 3
        : 2,
  });
}

function departurePrice(
  candle: LevelEngineCandle,
  kind: LevelEngineKind,
): number {
  return kind === 'support'
    ? candle.high
    : candle.low;
}

function isAwayFromLevel(
  price: number,
  levelPrice: number,
  kind: LevelEngineKind,
): boolean {
  return kind === 'support'
    ? price > levelPrice
    : price < levelPrice;
}

function isMoreDistant(
  nextPrice: number,
  currentPrice: number,
  kind: LevelEngineKind,
): boolean {
  return kind === 'support'
    ? nextPrice > currentPrice
    : nextPrice < currentPrice;
}

function trackLine(
  line: LevelLine,
  symbol: string,
  timeframe:
    DepartureExtremumTrackingInput['timeframe'],
  closed:
    readonly IndexedClosedCandle[],
): DepartureExtremum | null {
  if (
    line.symbol !== symbol
    || line.timeframe !== timeframe
  ) {
    fail(
      `line ${line.id} does not belong to ${symbol} ${timeframe}`,
    );
  }

  const start =
    trackingStart(line);

  if (!start) {
    return null;
  }

  let extremum:
    IndexedClosedCandle | null = null;
  let extremumPrice:
    number | null = null;

  for (const current of closed) {
    if (
      Date.parse(
        current.candle.closeTime,
      ) < Date.parse(start.at)
    ) {
      continue;
    }

    const price =
      departurePrice(
        current.candle,
        line.kind,
      );

    if (
      !isAwayFromLevel(
        price,
        line.price,
        line.kind,
      )
    ) {
      continue;
    }

    if (
      extremumPrice === null
      || isMoreDistant(
        price,
        extremumPrice,
        line.kind,
      )
    ) {
      extremum =
        current;
      extremumPrice =
        price;
    }
  }

  if (
    !extremum
    || extremumPrice === null
  ) {
    fail(
      `line ${line.id} has no closed departure extremum`,
    );
  }

  return Object.freeze({
    lineId:
      line.id,
    symbol,
    timeframe,
    kind:
      line.kind,
    levelPrice:
      line.price,
    trackingStartedAt:
      start.at,
    qualifyingTouchCount:
      start.touchCount,
    price:
      extremumPrice,
    candleIndex:
      extremum.originalIndex,
    candleOpenTime:
      extremum.candle.openTime,
    observedAt:
      extremum.candle.closeTime,
  });
}

export function trackDepartureExtrema(
  input: DepartureExtremumTrackingInput,
): DepartureExtremumTrackingResult {
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
  const closed =
    indexClosedCandles(
      input.candles,
    );
  const activeExtrema:
  DepartureExtremum[] = [];

  for (const line of input.lines) {
    const extremum =
      trackLine(
        line,
        symbol,
        input.timeframe,
        closed,
      );

    if (extremum) {
      activeExtrema.push(
        extremum,
      );
    }
  }

  return Object.freeze({
    version:
      DEPARTURE_EXTREMUM_TRACKER_CONTRACT_VERSION,
    symbol,
    timeframe:
      input.timeframe,
    closedCandlesCount:
      closed.length,
    ignoredOpenCandlesCount:
      input.candles.length
      - closed.length,
    activeExtrema:
      Object.freeze([
        ...activeExtrema,
      ]),
    observationalOnly: true,
    createsSetup: false,
    computesObservationProgress: false,
    createsSignal: false,
    usesFutureCandles: false,
  });
}
