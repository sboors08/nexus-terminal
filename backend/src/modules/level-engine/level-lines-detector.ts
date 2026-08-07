import {
  findConfirmedLevelEngineBreak,
} from './level-engine-break-evaluator.js';
import {
  detectTouchEpisodes,
} from './level-engine-touch-detector.js';
import {
  isLevelEngineTimeframe,
  normalizeLevelEngineSymbol,
} from './level-engine.contract.js';
import {
  LEVEL_LINES_CONTRACT_VERSION,
} from './level-lines.types.js';
import type {
  LevelLine,
  LevelLinesDetectionInput,
  LevelLinesDetectionOptions,
  LevelLinesDetectionResult,
} from './level-lines.types.js';
import type {
  LevelEngineKind,
  LevelEngineZone,
} from './level-engine.types.js';
import type {
  LevelEngineCandle,
} from './level-engine-touch-detector.types.js';

export const DEFAULT_LEVEL_LINES_DETECTION_OPTIONS:
LevelLinesDetectionOptions = Object.freeze({
  atrPeriod: 14,
  pivotLeftBars: 2,
  pivotRightBars: 1,
  originDepartureAtr: 0.8,
  originDepartureMaxCandles: 8,
  originEpisodeMaxSpanCandles: 6,
  workedEpisodeMaxSpanCandles: 24,
  touchTolerancePercent: 0.15,
  minBarsBetweenTouchEpisodes: 0,
  decisiveBreakAtr: 0.35,
  consecutiveBreakCloses: 2,
});

interface IndexedClosedCandle {
  readonly originalIndex: number;
  readonly candleIndex: number;
  readonly closedIndex: number;
  readonly candle: LevelEngineCandle;
  readonly atr: number | null;
}

interface OriginLineLifecycle {
  readonly activeFrom: string;
  readonly workedAt: string | null;
  readonly touchCount: number;
}

function fail(
  message: string,
): never {
  throw new Error(
    `Level Lines Detector: ${message}`,
  );
}

function positiveInteger(
  value: number,
  field: string,
): number {
  if (
    !Number.isInteger(value)
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
    !Number.isInteger(value)
    || value < 0
  ) {
    fail(
      `${field} must be a non-negative integer`,
    );
  }

  return value;
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

function validateOptions(
  value: LevelLinesDetectionOptions,
): LevelLinesDetectionOptions {
  return Object.freeze({
    atrPeriod:
      positiveInteger(
        value.atrPeriod,
        'atrPeriod',
      ),
    pivotLeftBars:
      positiveInteger(
        value.pivotLeftBars,
        'pivotLeftBars',
      ),
    pivotRightBars:
      positiveInteger(
        value.pivotRightBars,
        'pivotRightBars',
      ),
    originDepartureAtr:
      positiveFinite(
        value.originDepartureAtr,
        'originDepartureAtr',
      ),
    originDepartureMaxCandles:
      positiveInteger(
        value.originDepartureMaxCandles,
        'originDepartureMaxCandles',
      ),
    originEpisodeMaxSpanCandles:
      positiveInteger(
        value.originEpisodeMaxSpanCandles,
        'originEpisodeMaxSpanCandles',
      ),
    workedEpisodeMaxSpanCandles:
      positiveInteger(
        value.workedEpisodeMaxSpanCandles,
        'workedEpisodeMaxSpanCandles',
      ),
    touchTolerancePercent:
      positiveFinite(
        value.touchTolerancePercent,
        'touchTolerancePercent',
      ),
    minBarsBetweenTouchEpisodes:
      nonNegativeInteger(
        value.minBarsBetweenTouchEpisodes,
        'minBarsBetweenTouchEpisodes',
      ),
    decisiveBreakAtr:
      positiveFinite(
        value.decisiveBreakAtr,
        'decisiveBreakAtr',
      ),
    consecutiveBreakCloses:
      positiveInteger(
        value.consecutiveBreakCloses,
        'consecutiveBreakCloses',
      ),
  });
}

function validateCandles(
  values: readonly LevelEngineCandle[],
): readonly LevelEngineCandle[] {
  let previousOpenMs =
    Number.NEGATIVE_INFINITY;
  let openCandleSeen =
    false;

  return Object.freeze(
    values.map(
      (
        value,
        index,
      ) => {
        const openTime =
          canonicalTimestamp(
            value.openTime,
            `candles[${index}].openTime`,
          );
        const closeTime =
          canonicalTimestamp(
            value.closeTime,
            `candles[${index}].closeTime`,
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
            `candles[${index}].closeTime cannot precede openTime`,
          );
        }

        const open =
          positiveFinite(
            value.open,
            `candles[${index}].open`,
          );
        const high =
          positiveFinite(
            value.high,
            `candles[${index}].high`,
          );
        const low =
          positiveFinite(
            value.low,
            `candles[${index}].low`,
          );
        const close =
          positiveFinite(
            value.close,
            `candles[${index}].close`,
          );

        if (
          low > high
          || open < low
          || open > high
          || close < low
          || close > high
        ) {
          fail(
            `candles[${index}] contains invalid OHLC values`,
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

        return Object.freeze({
          openTime,
          closeTime,
          open,
          high,
          low,
          close,
          isClosed:
            value.isClosed,
        });
      },
    ),
  );
}

function indexClosedCandles(
  candles: readonly LevelEngineCandle[],
  atrPeriod: number,
): readonly IndexedClosedCandle[] {
  const closed:
  Array<{
    readonly originalIndex: number;
    readonly candle: LevelEngineCandle;
  }> = [];

  candles.forEach(
    (
      candle,
      originalIndex,
    ) => {
      if (candle.isClosed) {
        closed.push({
          originalIndex,
          candle,
        });
      }
    },
  );

  const trueRanges: number[] = [];

  return Object.freeze(
    closed.map(
      (
        item,
        closedIndex,
      ) => {
        const previous =
          closed[closedIndex - 1]
            ?.candle;
        const trueRange =
          previous
            ? Math.max(
                item.candle.high
                  - item.candle.low,
                Math.abs(
                  item.candle.high
                    - previous.close,
                ),
                Math.abs(
                  item.candle.low
                    - previous.close,
                ),
              )
            : item.candle.high
              - item.candle.low;

        trueRanges.push(
          trueRange,
        );

        const atr =
          trueRanges.length
            >= atrPeriod
            ? trueRanges
                .slice(
                  trueRanges.length
                    - atrPeriod,
                )
                .reduce(
                  (sum, range) =>
                    sum + range,
                  0,
                )
                / atrPeriod
            : null;

        return Object.freeze({
          originalIndex:
            item.originalIndex,
          candleIndex:
            item.originalIndex,
          closedIndex,
          candle:
            item.candle,
          atr:
            atr !== null
            && Number.isFinite(atr)
            && atr > 0
              ? atr
              : null,
        });
      },
    ),
  );
}

function isPivot(
  current: IndexedClosedCandle,
  neighbours:
    readonly IndexedClosedCandle[],
  kind: LevelEngineKind,
): boolean {
  return neighbours.every(
    (neighbour) =>
      kind === 'support'
        ? current.candle.low
          < neighbour.candle.low
        : current.candle.high
          > neighbour.candle.high,
  );
}

function stableLineId(
  symbol: string,
  timeframe: string,
  kind: LevelEngineKind,
  origin: IndexedClosedCandle,
): string {
  return `${symbol}-${timeframe}-line-${kind}-${Date.parse(
    origin.candle.openTime,
  )}`;
}

function interactionZone(
  price: number,
  _kind: LevelEngineKind,
  tolerancePercent: number,
): LevelEngineZone {
  const tolerance =
    price
    * tolerancePercent
    / 100;

  return Object.freeze({
    low:
      price - tolerance,
    reference:
      price,
    high:
      price + tolerance,
  });
}

function createLine(
  symbol: string,
  timeframe:
    LevelLinesDetectionInput['timeframe'],
  kind: LevelEngineKind,
  origin: IndexedClosedCandle,
  lifecycle: OriginLineLifecycle,
  closed: readonly IndexedClosedCandle[],
  options: LevelLinesDetectionOptions,
): LevelLine {
  const price =
    kind === 'support'
      ? origin.candle.low
      : origin.candle.high;
  const breakEvidence =
    findConfirmedLevelEngineBreak(
      closed,
      {
        kind,
        zone: {
          low: price,
          reference: price,
          high: price,
        },
      },
      {
        afterExclusiveMs:
          Date.parse(
            lifecycle.activeFrom,
          ),
        throughInclusiveMs:
          lifecycle.workedAt
            ? Date.parse(
                lifecycle.workedAt,
              )
            : Number.POSITIVE_INFINITY,
      },
      {
        decisiveBreakAtr:
          options.decisiveBreakAtr,
        consecutiveBreakCloses:
          options.consecutiveBreakCloses,
      },
    );

  return Object.freeze({
    id:
      stableLineId(
        symbol,
        timeframe,
        kind,
        origin,
      ),
    symbol,
    timeframe,
    price,
    kind,
    originCandleIndex:
      origin.originalIndex,
    originExtremumAt:
      origin.candle.openTime,
    originExtremumPrice:
      price,
    activeFrom:
      lifecycle.activeFrom,
    touchCount:
      breakEvidence
        ? 1
        : lifecycle.touchCount,
    status:
      breakEvidence
        ? 'broken'
        : lifecycle.workedAt
          ? 'worked'
          : lifecycle.touchCount >= 2
            ? 'confirmed'
            : 'candidate',
    workedAt:
      breakEvidence
        ? null
        : lifecycle.workedAt,
    brokenAt:
      breakEvidence?.brokenAt
      ?? null,
    breakEvidence,
  });
}

function originLifecycle(
  symbol: string,
  timeframe:
    LevelLinesDetectionInput['timeframe'],
  kind: LevelEngineKind,
  origin: IndexedClosedCandle,
  pivotConfirmation: IndexedClosedCandle,
  candles: readonly LevelEngineCandle[],
  options: LevelLinesDetectionOptions,
): OriginLineLifecycle | null {
  const price =
    kind === 'support'
      ? origin.candle.low
      : origin.candle.high;
  const originTouchResult =
    detectTouchEpisodes(
      {
        symbol,
        sourceTimeframe:
          timeframe,
        kind,
        zone: {
          low: price,
          reference: price,
          high: price,
        },
      },
      candles,
      {
        atrPeriod:
          options.atrPeriod,
        minDepartureAtr:
          options.originDepartureAtr,
        maxDepartureCandles:
          options.originDepartureMaxCandles,
        minBarsBetweenEpisodes: 0,
        maxEpisodeSpanCandles:
          options.originEpisodeMaxSpanCandles,
      },
    );
  const originEpisode =
    originTouchResult.episodes.find(
      (episode) =>
        episode.startCandleIndex
          <= origin.originalIndex
        && episode.endCandleIndex
          >= origin.originalIndex
        && episode.anchorCandleIndex
          === origin.originalIndex,
    );

  if (!originEpisode) {
    return null;
  }

  const pivotConfirmedMs =
    Date.parse(
      pivotConfirmation.candle.closeTime,
    );
  const departureConfirmedMs =
    Date.parse(
      originEpisode.confirmedAt,
    );

  const activeFrom =
    new Date(
      Math.max(
        pivotConfirmedMs,
        departureConfirmedMs,
      ),
    ).toISOString();
  const interactionStartCandleIndex =
    candles.findIndex(
      (candle) =>
        candle.isClosed
        && Date.parse(
          candle.closeTime,
        )
          > Date.parse(activeFrom),
    );

  if (interactionStartCandleIndex < 0) {
    return Object.freeze({
      activeFrom,
      workedAt: null,
      touchCount: 1,
    });
  }

  const interactionTouchResult =
    detectTouchEpisodes(
      {
        symbol,
        sourceTimeframe:
          timeframe,
        kind,
        zone:
          interactionZone(
            price,
            kind,
            options
              .touchTolerancePercent,
          ),
      },
      candles,
      {
        atrPeriod:
          options.atrPeriod,
        minDepartureAtr:
          options.originDepartureAtr,
        maxDepartureCandles:
          options.originDepartureMaxCandles,
        minBarsBetweenEpisodes:
          options
            .minBarsBetweenTouchEpisodes,
        maxEpisodeSpanCandles:
          options
            .workedEpisodeMaxSpanCandles,
        scanFromCandleIndex:
          interactionStartCandleIndex,
      },
    );

  const nextIndependentEpisode =
    interactionTouchResult.episodes.find(
      (episode) =>
        Date.parse(
          episode.startedAt,
        )
          > Date.parse(activeFrom),
    );

  return Object.freeze({
    activeFrom,
    workedAt:
      nextIndependentEpisode
        ?.confirmedAt
      ?? null,
    touchCount:
      nextIndependentEpisode
        ? 2
        : 1,
  });
}

export function detectLevelLines(
  input: LevelLinesDetectionInput,
  optionsValue:
    LevelLinesDetectionOptions =
      DEFAULT_LEVEL_LINES_DETECTION_OPTIONS,
): LevelLinesDetectionResult {
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
  const candles =
    validateCandles(
      input.candles,
    );
  const closed =
    indexClosedCandles(
      candles,
      options.atrPeriod,
    );
  const lines: LevelLine[] = [];
  const firstIndex =
    Math.max(
      options.pivotLeftBars,
      options.atrPeriod - 1,
    );
  const lastIndexExclusive =
    closed.length
    - options.pivotRightBars;

  for (
    let index = firstIndex;
    index < lastIndexExclusive;
    index += 1
  ) {
    const origin =
      closed[index];
    const confirmation =
      closed[
        index
        + options.pivotRightBars
      ];

    if (
      !origin
      || !confirmation
      || origin.atr === null
    ) {
      continue;
    }

    const neighbours = [
      ...closed.slice(
        index
          - options.pivotLeftBars,
        index,
      ),
      ...closed.slice(
        index + 1,
        index
          + options.pivotRightBars
          + 1,
      ),
    ];

    for (
      const kind
      of [
        'support',
        'resistance',
      ] as const
    ) {
      if (
        isPivot(
          origin,
          neighbours,
          kind,
        )
      ) {
        const lifecycle =
          originLifecycle(
            symbol,
            input.timeframe,
            kind,
            origin,
            confirmation,
            candles,
            options,
          );

        if (!lifecycle) {
          continue;
        }

        lines.push(
          createLine(
            symbol,
            input.timeframe,
            kind,
            origin,
            lifecycle,
            closed,
            options,
          ),
        );
      }
    }
  }

  lines.sort(
    (left, right) =>
      Date.parse(
        left.originExtremumAt,
      )
      - Date.parse(
        right.originExtremumAt,
      )
      || left.kind.localeCompare(
        right.kind,
      ),
  );

  return Object.freeze({
    version:
      LEVEL_LINES_CONTRACT_VERSION,
    symbol,
    timeframe:
      input.timeframe,
    closedCandlesCount:
      closed.length,
    ignoredOpenCandlesCount:
      candles.length
      - closed.length,
    lines:
      Object.freeze([
        ...lines,
      ]),
    activeLevels:
      Object.freeze(
        lines.filter(
          (line) =>
            line.status
            !== 'broken'
            && line.status
              !== 'worked',
        ),
      ),
    appliedOptions:
      options,
    observationalOnly: true,
    createsSetup: false,
    mergesNearbyExtrema: false,
    usesFutureCandles: false,
  });
}
