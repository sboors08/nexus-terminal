import {
  findConfirmedLevelEngineBreak,
} from './level-engine-break-evaluator.js';
import {
  detectTouchEpisodes,
} from './level-engine-touch-detector.js';
import {
  trackDepartureExtrema,
} from './departure-extremum-tracker.js';
import {
  trackObservationProgress,
} from './observation-tracker.js';
import {
  evaluateApproaches,
} from './approach-engine.js';
import {
  resolveLevelLinesExactPriceOrigins,
} from './level-lines-exact-price-origin-resolution.js';
import {
  isLevelEngineTimeframe,
  normalizeLevelEngineSymbol,
} from './level-engine.contract.js';
import {
  LEVEL_LINES_CONTRACT_VERSION,
} from './level-lines.types.js';
import type {
  LevelLine,
  LevelLineSupersessionEvidence,
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
  pivotLeftBars: 3,
  pivotRightBars: 2,
  originDepartureAtr: 0.8,
  originDepartureMaxCandles: 8,
  candidateVisibilityMinDepartureAtr: 3,
  candidateVisibilityMaxAgeBars: 48,
  persistentCandidateMinDepartureAtr: 2.5,
  persistentCandidateLookbackBars: 48,
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
  readonly candidateQualifiedAt:
    string | null;
  readonly persistentCandidateQualifiedAt:
    string | null;
  readonly confirmedAt: string | null;
  readonly workedAt: string | null;
  readonly touchCount: number;
}

function lifecycleTouchCountThrough(
  lifecycle: OriginLineLifecycle,
  throughAt: string,
): number {
  const throughMs =
    Date.parse(throughAt);

  return 1
    + (
      lifecycle.confirmedAt
      && Date.parse(
        lifecycle.confirmedAt,
      ) <= throughMs
        ? 1
        : 0
    )
    + (
      lifecycle.workedAt
      && Date.parse(
        lifecycle.workedAt,
      ) <= throughMs
        ? 1
        : 0
    );
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
  const validated = Object.freeze({
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
    candidateVisibilityMinDepartureAtr:
      positiveFinite(
        value.candidateVisibilityMinDepartureAtr,
        'candidateVisibilityMinDepartureAtr',
      ),
    candidateVisibilityMaxAgeBars:
      positiveInteger(
        value.candidateVisibilityMaxAgeBars,
        'candidateVisibilityMaxAgeBars',
      ),
    persistentCandidateMinDepartureAtr:
      positiveFinite(
        value.persistentCandidateMinDepartureAtr,
        'persistentCandidateMinDepartureAtr',
      ),
    persistentCandidateLookbackBars:
      positiveInteger(
        value.persistentCandidateLookbackBars,
        'persistentCandidateLookbackBars',
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

  if (
    validated
      .candidateVisibilityMinDepartureAtr
    < validated.originDepartureAtr
  ) {
    fail(
      'candidateVisibilityMinDepartureAtr must be greater than or equal to originDepartureAtr',
    );
  }

  if (
    validated
      .persistentCandidateMinDepartureAtr
    < validated.originDepartureAtr
  ) {
    fail(
      'persistentCandidateMinDepartureAtr must be greater than or equal to originDepartureAtr',
    );
  }

  return validated;
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

interface PivotMatch {
  readonly origin: IndexedClosedCandle;
  readonly confirmation:
    IndexedClosedCandle;
}

function extremumPrice(
  value: IndexedClosedCandle,
  kind: LevelEngineKind,
): number {
  return kind === 'support'
    ? value.candle.low
    : value.candle.high;
}

function findStructuralSupersession(
  closed:
    readonly IndexedClosedCandle[],
  kind: LevelEngineKind,
  originPrice: number,
  afterClosedIndex: number,
  throughClosedIndexExclusive:
    number = closed.length,
): LevelLineSupersessionEvidence | null {
  for (
    let index = afterClosedIndex + 1;
    index < throughClosedIndexExclusive;
    index += 1
  ) {
    const current =
      closed[index];

    if (!current) {
      break;
    }

    const currentExtreme =
      extremumPrice(
        current,
        kind,
      );
    const isMoreExtreme =
      kind === 'resistance'
        ? currentExtreme
          > originPrice
        : currentExtreme
          < originPrice;

    if (!isMoreExtreme) {
      continue;
    }

    return Object.freeze({
      mode:
        'more_extreme_right_candle',
      fromKind:
        kind,
      candleIndex:
        current.originalIndex,
      supersededAt:
        current.candle.closeTime,
      originPrice,
      extremePrice:
        currentExtreme,
    });
  }

  return null;
}

function findPivot(
  closed:
    readonly IndexedClosedCandle[],
  index: number,
  kind: LevelEngineKind,
  leftBars: number,
  rightBars: number,
): PivotMatch | null {
  const origin =
    closed[index];

  if (!origin) {
    return null;
  }

  const price =
    extremumPrice(
      origin,
      kind,
    );
  const previous =
    closed[index - 1];

  if (
    previous
    && extremumPrice(
      previous,
      kind,
    ) === price
  ) {
    return null;
  }

  let plateauEndIndex =
    index;

  while (true) {
    const next =
      closed[
        plateauEndIndex + 1
      ];

    if (
      !next
      || extremumPrice(
        next,
        kind,
      ) !== price
    ) {
      break;
    }

    plateauEndIndex += 1;
  }

  const confirmation =
    closed[
      plateauEndIndex
      + rightBars
    ];

  if (
    index - leftBars < 0
    || !confirmation
  ) {
    return null;
  }

  const neighbours = [
    ...closed.slice(
      index - leftBars,
      index,
    ),
    ...closed.slice(
      plateauEndIndex + 1,
      plateauEndIndex
        + rightBars
        + 1,
    ),
  ];
  const isStructuralExtremum =
    neighbours.every(
      (neighbour) =>
        kind === 'support'
          ? price
            < neighbour.candle.low
          : price
            > neighbour.candle.high,
    );

  return isStructuralExtremum
    ? Object.freeze({
        origin,
        confirmation,
      })
    : null;
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

function candidateQualificationAt(
  origin: IndexedClosedCandle,
  pivotConfirmation:
    IndexedClosedCandle,
  closed:
    readonly IndexedClosedCandle[],
  kind: LevelEngineKind,
  price: number,
  minimumDepartureAtr: number,
  options: LevelLinesDetectionOptions,
): string | null {
  if (origin.atr === null) {
    return null;
  }

  let lastContactClosedIndex =
    origin.closedIndex;

  for (
    let index = origin.closedIndex + 1;
    index < closed.length;
    index += 1
  ) {
    const current =
      closed[index];

    if (!current) {
      break;
    }

    const wrongSideBreak =
      kind === 'support'
        ? current.candle.close < price
        : current.candle.close > price;

    if (wrongSideBreak) {
      return null;
    }

    const contact =
      current.candle.high >= price
      && current.candle.low <= price;

    if (contact) {
      const changedOrigin =
        kind === 'support'
          ? current.candle.low < price
          : current.candle.high > price;

      if (changedOrigin) {
        return null;
      }

      lastContactClosedIndex =
        current.closedIndex;

      if (
        current.closedIndex
        - origin.closedIndex
        + 1
        > options
          .originEpisodeMaxSpanCandles
      ) {
        return null;
      }

      continue;
    }

    const departureDistance =
      kind === 'support'
        ? Math.max(
            0,
            current.candle.high
              - price,
          )
        : Math.max(
            0,
            price
              - current.candle.low,
          );
    const departureAtr =
      departureDistance
      / origin.atr;

    if (
      departureAtr
      >= minimumDepartureAtr
    ) {
      return new Date(
        Math.max(
          Date.parse(
            pivotConfirmation
              .candle.closeTime,
          ),
          Date.parse(
            current.candle.closeTime,
          ),
        ),
      ).toISOString();
    }

    if (
      current.closedIndex
      - lastContactClosedIndex
      >= options.originDepartureMaxCandles
    ) {
      return null;
    }
  }

  return null;
}

function isPersistentCandidateOrigin(
  closed:
    readonly IndexedClosedCandle[],
  origin: IndexedClosedCandle,
  kind: LevelEngineKind,
  lookbackBars: number,
): boolean {
  const firstContextIndex =
    origin.closedIndex
    - lookbackBars;

  if (firstContextIndex < 0) {
    return false;
  }

  const price =
    extremumPrice(
      origin,
      kind,
    );

  return closed
    .slice(
      firstContextIndex,
      origin.closedIndex,
    )
    .every(
      (previous) =>
        kind === 'support'
          ? price
            < previous.candle.low
          : price
            > previous.candle.high,
    );
}

function hasPriorExactOriginEpisode(
  symbol: string,
  timeframe:
    LevelLinesDetectionInput['timeframe'],
  kind: LevelEngineKind,
  origin: IndexedClosedCandle,
  candles: readonly LevelEngineCandle[],
  closed:
    readonly IndexedClosedCandle[],
  options: LevelLinesDetectionOptions,
): boolean {
  const price =
    extremumPrice(
      origin,
      kind,
    );
  const originOpenMs =
    Date.parse(
      origin.candle.openTime,
    );

  for (
    let index =
      origin.closedIndex - 1;
    index >= 0;
    index -= 1
  ) {
    const prior =
      closed[index];

    if (
      !prior
      || prior.atr === null
      || extremumPrice(
        prior,
        kind,
      ) !== price
    ) {
      continue;
    }

    const structuralSupersession =
      findStructuralSupersession(
        closed,
        kind,
        price,
        prior.closedIndex,
        origin.closedIndex,
      );

    if (structuralSupersession) {
      continue;
    }

    const touchResult =
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
            options
              .originEpisodeMaxSpanCandles,
          scanFromCandleIndex:
            prior.originalIndex,
        },
      );
    const priorEpisode =
      touchResult.episodes.find(
        (episode) =>
          episode.startCandleIndex
            <= prior.originalIndex
          && episode.endCandleIndex
            >= prior.originalIndex
          && episode.anchorCandleIndex
            === prior.originalIndex
          && Date.parse(
            episode.confirmedAt,
          ) < originOpenMs,
      );

    if (!priorEpisode) {
      continue;
    }

    const interveningBreak =
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
              priorEpisode.confirmedAt,
            ),
          throughInclusiveMs:
            originOpenMs,
        },
        {
          decisiveBreakAtr:
            options.decisiveBreakAtr,
          consecutiveBreakCloses:
            options.consecutiveBreakCloses,
        },
      );

    if (!interveningBreak) {
      return true;
    }
  }

  return false;
}

function createLine(
  symbol: string,
  timeframe:
    LevelLinesDetectionInput['timeframe'],
  kind: LevelEngineKind,
  origin: IndexedClosedCandle,
  lifecycle: OriginLineLifecycle,
  supersessionEvidenceValue:
    LevelLineSupersessionEvidence | null,
  closed: readonly IndexedClosedCandle[],
  options: LevelLinesDetectionOptions,
): LevelLine {
  const price =
    kind === 'support'
      ? origin.candle.low
      : origin.candle.high;
  const detectedBreakEvidence =
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
          Number.POSITIVE_INFINITY,
      },
      {
        decisiveBreakAtr:
          options.decisiveBreakAtr,
        consecutiveBreakCloses:
          options.consecutiveBreakCloses,
      },
    );
  const supersessionHappensFirst =
    supersessionEvidenceValue !== null
    && (
      detectedBreakEvidence === null
      || Date.parse(
        supersessionEvidenceValue
          .supersededAt,
      ) < Date.parse(
        detectedBreakEvidence
          .brokenAt,
      )
    );
  const supersessionEvidence =
    supersessionHappensFirst
      ? supersessionEvidenceValue
      : null;
  const breakEvidence =
    supersessionHappensFirst
      ? null
      : detectedBreakEvidence;
  const endedAt =
    supersessionEvidence
      ?.supersededAt
    ?? breakEvidence
      ?.brokenAt
    ?? null;
  const confirmedAt =
    lifecycle.confirmedAt
    && (
      !endedAt
      || Date.parse(
        lifecycle.confirmedAt,
      ) <= Date.parse(endedAt)
    )
      ? lifecycle.confirmedAt
      : null;
  const workedAt =
    lifecycle.workedAt
    && (
      !endedAt
      || Date.parse(
        lifecycle.workedAt,
      ) <= Date.parse(endedAt)
    )
      ? lifecycle.workedAt
      : null;

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
    confirmedAt,
    touchCount:
      endedAt
        ? lifecycleTouchCountThrough(
            lifecycle,
            endedAt,
          )
        : lifecycle.touchCount,
    status:
      breakEvidence
        ? 'broken'
        : supersessionEvidence
          ? 'superseded'
          : workedAt
            ? 'worked'
            : confirmedAt
              ? 'confirmed'
              : 'candidate',
    workedAt:
      workedAt,
    supersededAt:
      supersessionEvidence
        ?.supersededAt
      ?? null,
    supersessionEvidence,
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
  closed:
    readonly IndexedClosedCandle[],
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
        scanFromCandleIndex:
          origin.originalIndex,
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
  const candidateQualifiedAt =
    candidateQualificationAt(
      origin,
      pivotConfirmation,
      closed,
      kind,
      price,
      options
        .candidateVisibilityMinDepartureAtr,
      options,
    );
  const persistentCandidateQualifiedAt =
    candidateQualificationAt(
      origin,
      pivotConfirmation,
      closed,
      kind,
      price,
      options
        .persistentCandidateMinDepartureAtr,
      options,
    );
  const hasPriorExactOrigin =
    hasPriorExactOriginEpisode(
      symbol,
      timeframe,
      kind,
      origin,
      candles,
      closed,
      options,
    );
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
      candidateQualifiedAt,
      persistentCandidateQualifiedAt,
      confirmedAt:
        hasPriorExactOrigin
          ? activeFrom
          : null,
      workedAt: null,
      touchCount:
        hasPriorExactOrigin
          ? 2
          : 1,
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
        requireFreshReturnBeforeFirstEpisode:
          true,
      },
    );

  const independentEpisodes =
    interactionTouchResult.episodes.filter(
      (episode) =>
        Date.parse(
          episode.startedAt,
        )
          > Date.parse(activeFrom),
    );
  const confirmationEpisode =
    independentEpisodes[0];
  const workedEpisode =
    independentEpisodes[1];
  const confirmedAt =
    hasPriorExactOrigin
      ? activeFrom
      : confirmationEpisode
        ?.confirmedAt
        ?? null;
  const workedAt =
    hasPriorExactOrigin
      ? confirmationEpisode
        ?.confirmedAt
        ?? null
      : workedEpisode
        ?.confirmedAt
        ?? null;

  return Object.freeze({
    activeFrom,
    candidateQualifiedAt,
    persistentCandidateQualifiedAt,
    confirmedAt,
    workedAt,
    touchCount:
      workedAt
        ? 3
        : confirmedAt
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
  const activeLineIds =
    new Set<string>();
  const currentLevelVisibleFrom =
    new Map<string, string>();
  const firstIndex =
    Math.max(
      options.pivotLeftBars,
      options.atrPeriod - 1,
    );

  for (
    let index = firstIndex;
    index < closed.length;
    index += 1
  ) {
    for (
      const kind
      of [
        'support',
        'resistance',
      ] as const
    ) {
      const pivot =
        findPivot(
          closed,
          index,
          kind,
          options.pivotLeftBars,
          options.pivotRightBars,
        );

      if (
        !pivot
        || pivot.origin.atr === null
      ) {
        continue;
      }

      const lifecycle =
        originLifecycle(
          symbol,
          input.timeframe,
          kind,
          pivot.origin,
          pivot.confirmation,
          candles,
          closed,
          options,
        );

      if (!lifecycle) {
        continue;
      }

      const originPrice =
        extremumPrice(
          pivot.origin,
          kind,
        );
      const detectedSupersession =
        findStructuralSupersession(
          closed,
          kind,
          originPrice,
          pivot.origin.closedIndex,
        );
      const supersessionEvidence =
        detectedSupersession;

      if (
        supersessionEvidence
        && Date.parse(
          supersessionEvidence
            .supersededAt,
        ) <= Date.parse(
          lifecycle.activeFrom,
        )
      ) {
        continue;
      }

      const line =
        createLine(
          symbol,
          input.timeframe,
          kind,
          pivot.origin,
          lifecycle,
          supersessionEvidence,
          closed,
          options,
        );

      lines.push(line);

      const candidateAgeBars =
        closed.length
        - 1
        - pivot.origin.closedIndex;
      const isRecentCandidate =
        line.status === 'candidate'
        && lifecycle
          .candidateQualifiedAt
          !== null
        && candidateAgeBars
          <= options
            .candidateVisibilityMaxAgeBars;
      const isPersistentCandidate =
        line.status === 'candidate'
        && lifecycle
          .persistentCandidateQualifiedAt
          !== null
        && isPersistentCandidateOrigin(
          closed,
          pivot.origin,
          kind,
          options
            .persistentCandidateLookbackBars,
        );
      const isVisibleCandidate =
        isRecentCandidate
        || isPersistentCandidate;

      if (
        line.status === 'confirmed'
        || line.status === 'worked'
        || isVisibleCandidate
      ) {
        activeLineIds.add(
          line.id,
        );
        const visibilityBoundaries = [
          lifecycle
            .candidateQualifiedAt,
          isPersistentCandidate
            ? lifecycle
                .persistentCandidateQualifiedAt
            : null,
          line.confirmedAt,
        ].filter(
          (value): value is string =>
            value !== null,
        );
        const visibleFrom =
          visibilityBoundaries.sort(
            (left, right) =>
              Date.parse(left)
              - Date.parse(right),
          )[0];

        if (!visibleFrom) {
          fail(
            `active line ${line.id} has no current visibility boundary`,
          );
        }

        currentLevelVisibleFrom.set(
          line.id,
          visibleFrom,
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
  const frozenLines =
    Object.freeze([
      ...lines,
    ]);
  const unresolvedActiveLevels =
    Object.freeze(
      frozenLines.filter(
        (line) =>
          activeLineIds.has(
            line.id,
          ),
      ),
    );
  const exactPriceOriginResolution =
    resolveLevelLinesExactPriceOrigins({
      symbol,
      timeframe:
        input.timeframe,
      lines: frozenLines,
      currentLevels:
        unresolvedActiveLevels,
      currentLevelVisibleFrom:
        Object.freeze(
          Object.fromEntries(
            currentLevelVisibleFrom,
          ),
        ),
    });
  const activeLevels =
    exactPriceOriginResolution
      .currentLevels;
  const departureExtremumTracking =
    trackDepartureExtrema({
      symbol,
      timeframe:
        input.timeframe,
      candles,
      lines:
        activeLevels,
    });
  const observationTracking =
    trackObservationProgress({
      symbol,
      timeframe:
        input.timeframe,
      candles,
      departureExtremumTracking,
    });
  const approachEvaluation =
    evaluateApproaches({
      symbol,
      timeframe:
        input.timeframe,
      observationTracking,
    });

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
      frozenLines,
    activeLevels:
      activeLevels,
    exactPriceOriginResolution,
    departureExtremumTracking,
    observationTracking,
    approachEvaluation,
    appliedOptions:
      options,
    observationalOnly: true,
    createsSetup: false,
    mergesNearbyExtrema: false,
    usesFutureCandles: false,
  });
}
