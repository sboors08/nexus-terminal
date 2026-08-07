import {
  createTouchEpisode,
  isLevelEngineTimeframe,
  normalizeLevelEngineSymbol,
} from './level-engine.contract.js';
import type {
  LevelEngineKind,
  LevelEngineZone,
  TouchEpisode,
} from './level-engine.types.js';
import type {
  LevelEngineCandle,
  PendingTouchInteraction,
  RejectedTouchInteraction,
  TouchEpisodeDetectionOptions,
  TouchEpisodeDetectionResult,
  TouchEpisodeDetectionTarget,
  TouchInteractionRejectionReason,
} from './level-engine-touch-detector.types.js';

export const DEFAULT_TOUCH_EPISODE_DETECTION_OPTIONS:
TouchEpisodeDetectionOptions = Object.freeze({
  atrPeriod: 14,
  minDepartureAtr: 0.8,
  maxDepartureCandles: 8,
  minBarsBetweenEpisodes: 3,
  maxEpisodeSpanCandles: 6,
});

interface IndexedClosedCandle {
  readonly originalIndex: number;
  readonly closedIndex: number;
  readonly candle: LevelEngineCandle;
  readonly atr: number | null;
}

interface ActiveInteraction {
  readonly start: IndexedClosedCandle;
  lastContact: IndexedClosedCandle;
  anchor: IndexedClosedCandle;
  anchorPrice: number;
  anchorAtr: number;
}

interface SuppressedInteraction {
  readonly start: IndexedClosedCandle;
  lastContact: IndexedClosedCandle;
  referenceAtr: number | null;
}

function fail(message: string): never {
  throw new Error(`Touch Episode Detector: ${message}`);
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    fail(`${field} must be a positive integer`);
  }
  return value;
}

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    fail(`${field} must be a non-negative integer`);
  }
  return value;
}

function positiveFinite(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    fail(`${field} must be a positive finite number`);
  }
  return value;
}

function validateOptions(
  options: TouchEpisodeDetectionOptions,
): TouchEpisodeDetectionOptions {
  return Object.freeze({
    atrPeriod: positiveInteger(options.atrPeriod, 'atrPeriod'),
    minDepartureAtr: positiveFinite(
      options.minDepartureAtr,
      'minDepartureAtr',
    ),
    maxDepartureCandles: positiveInteger(
      options.maxDepartureCandles,
      'maxDepartureCandles',
    ),
    minBarsBetweenEpisodes: nonNegativeInteger(
      options.minBarsBetweenEpisodes,
      'minBarsBetweenEpisodes',
    ),
    maxEpisodeSpanCandles: positiveInteger(
      options.maxEpisodeSpanCandles,
      'maxEpisodeSpanCandles',
    ),
    scanFromCandleIndex: nonNegativeInteger(
      options.scanFromCandleIndex
      ?? 0,
      'scanFromCandleIndex',
    ),
  });
}

function canonicalTimestamp(value: string, field: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    fail(`${field} must be a valid timestamp`);
  }
  return new Date(timestamp).toISOString();
}

function validateZone(zone: LevelEngineZone): LevelEngineZone {
  const low = positiveFinite(zone.low, 'zone.low');
  const reference = positiveFinite(zone.reference, 'zone.reference');
  const high = positiveFinite(zone.high, 'zone.high');
  if (low > reference || reference > high) {
    fail('zone must satisfy low <= reference <= high');
  }
  return Object.freeze({ low, reference, high });
}

function validateCandles(
  candles: readonly LevelEngineCandle[],
): readonly LevelEngineCandle[] {
  let previousOpenTime = Number.NEGATIVE_INFINITY;
  let openCandleSeen = false;

  return candles.map((candle, index) => {
    const openTime = canonicalTimestamp(candle.openTime, `candles[${index}].openTime`);
    const closeTime = canonicalTimestamp(candle.closeTime, `candles[${index}].closeTime`);
    const openMs = Date.parse(openTime);
    const closeMs = Date.parse(closeTime);

    if (openMs <= previousOpenTime) {
      fail('candles must be strictly ordered and unique');
    }
    if (closeMs < openMs) {
      fail(`candles[${index}].closeTime cannot precede openTime`);
    }

    const open = positiveFinite(candle.open, `candles[${index}].open`);
    const high = positiveFinite(candle.high, `candles[${index}].high`);
    const low = positiveFinite(candle.low, `candles[${index}].low`);
    const close = positiveFinite(candle.close, `candles[${index}].close`);

    if (
      low > high
      || open < low
      || open > high
      || close < low
      || close > high
    ) {
      fail(`candles[${index}] contains invalid OHLC values`);
    }

    if (!candle.isClosed) {
      openCandleSeen = true;
    } else if (openCandleSeen) {
      fail('closed candles cannot appear after an open candle');
    }

    previousOpenTime = openMs;
    return Object.freeze({
      openTime,
      closeTime,
      open,
      high,
      low,
      close,
      isClosed: candle.isClosed,
    });
  });
}

function calculateIndexedClosedCandles(
  candles: readonly LevelEngineCandle[],
  atrPeriod: number,
): readonly IndexedClosedCandle[] {
  const closed: Array<{
    originalIndex: number;
    candle: LevelEngineCandle;
  }> = [];

  candles.forEach((candle, originalIndex) => {
    if (candle.isClosed) {
      closed.push({ originalIndex, candle });
    }
  });

  const trueRanges: number[] = [];
  return closed.map((item, closedIndex) => {
    const previous = closed[closedIndex - 1]?.candle;
    const trueRange = previous
      ? Math.max(
          item.candle.high - item.candle.low,
          Math.abs(item.candle.high - previous.close),
          Math.abs(item.candle.low - previous.close),
        )
      : item.candle.high - item.candle.low;

    trueRanges.push(trueRange);
    const atr = trueRanges.length >= atrPeriod
      ? trueRanges
          .slice(trueRanges.length - atrPeriod)
          .reduce((sum, value) => sum + value, 0) / atrPeriod
      : null;

    return Object.freeze({
      originalIndex: item.originalIndex,
      closedIndex,
      candle: item.candle,
      atr,
    });
  });
}

function intersectsZone(
  candle: LevelEngineCandle,
  zone: LevelEngineZone,
): boolean {
  return candle.high >= zone.low && candle.low <= zone.high;
}

function departureDistance(
  candle: LevelEngineCandle,
  zone: LevelEngineZone,
  kind: LevelEngineKind,
): number {
  return kind === 'resistance'
    ? Math.max(0, zone.low - candle.low)
    : Math.max(0, candle.high - zone.high);
}

function isWrongSideBreak(
  candle: LevelEngineCandle,
  zone: LevelEngineZone,
  kind: LevelEngineKind,
): boolean {
  return kind === 'resistance'
    ? candle.close > zone.high
    : candle.close < zone.low;
}

function anchorPrice(
  candle: LevelEngineCandle,
  kind: LevelEngineKind,
): number {
  return kind === 'resistance' ? candle.high : candle.low;
}

function isMoreExtreme(
  nextPrice: number,
  currentPrice: number,
  kind: LevelEngineKind,
): boolean {
  return kind === 'resistance'
    ? nextPrice > currentPrice
    : nextPrice < currentPrice;
}

function stableEpisodeId(
  symbol: string,
  timeframe: string,
  kind: LevelEngineKind,
  startedAt: string,
): string {
  return `${symbol}-${timeframe}-touch-${kind}-${Date.parse(startedAt)}`;
}

function freezeRejection(
  start: IndexedClosedCandle,
  end: IndexedClosedCandle,
  reason: TouchInteractionRejectionReason,
): RejectedTouchInteraction {
  return Object.freeze({
    startCandleIndex: start.originalIndex,
    endCandleIndex: end.originalIndex,
    startedAt: start.candle.closeTime,
    endedAt: end.candle.closeTime,
    reason,
  });
}

function freezePending(
  interaction: ActiveInteraction,
): PendingTouchInteraction {
  return Object.freeze({
    startCandleIndex: interaction.start.originalIndex,
    lastContactCandleIndex: interaction.lastContact.originalIndex,
    startedAt: interaction.start.candle.closeTime,
    lastContactAt: interaction.lastContact.candle.closeTime,
    status: 'awaiting_departure_confirmation',
  });
}

function beginActiveInteraction(
  candle: IndexedClosedCandle,
  kind: LevelEngineKind,
): ActiveInteraction {
  if (candle.atr === null || candle.atr <= 0) {
    fail('cannot begin an active interaction without ATR');
  }
  const price = anchorPrice(candle.candle, kind);
  return {
    start: candle,
    lastContact: candle,
    anchor: candle,
    anchorPrice: price,
    anchorAtr: candle.atr,
  };
}

function updateActiveContact(
  interaction: ActiveInteraction,
  candle: IndexedClosedCandle,
  kind: LevelEngineKind,
): void {
  interaction.lastContact = candle;
  const price = anchorPrice(candle.candle, kind);
  if (isMoreExtreme(price, interaction.anchorPrice, kind)) {
    interaction.anchor = candle;
    interaction.anchorPrice = price;
    if (candle.atr !== null && candle.atr > 0) {
      interaction.anchorAtr = candle.atr;
    }
  }
}

function episodeSpanCandles(interaction: ActiveInteraction): number {
  return interaction.lastContact.closedIndex - interaction.start.closedIndex + 1;
}

function barsBetween(
  previous: TouchEpisode,
  next: IndexedClosedCandle,
): number {
  return next.originalIndex - previous.endCandleIndex - 1;
}

function canClearSuppressedInteraction(
  interaction: SuppressedInteraction,
  candle: IndexedClosedCandle,
  zone: LevelEngineZone,
  kind: LevelEngineKind,
  minDepartureAtr: number,
): boolean {
  if (interaction.referenceAtr === null && candle.atr !== null && candle.atr > 0) {
    interaction.referenceAtr = candle.atr;
  }
  if (interaction.referenceAtr === null || interaction.referenceAtr <= 0) {
    return false;
  }
  return !intersectsZone(candle.candle, zone)
    && departureDistance(candle.candle, zone, kind)
      / interaction.referenceAtr >= minDepartureAtr;
}

export function detectTouchEpisodes(
  targetValue: TouchEpisodeDetectionTarget,
  candlesValue: readonly LevelEngineCandle[],
  optionsValue: TouchEpisodeDetectionOptions =
    DEFAULT_TOUCH_EPISODE_DETECTION_OPTIONS,
): TouchEpisodeDetectionResult {
  if (!isLevelEngineTimeframe(targetValue.sourceTimeframe)) {
    fail(`unsupported timeframe: ${targetValue.sourceTimeframe}`);
  }

  const symbol = normalizeLevelEngineSymbol(targetValue.symbol);
  const zone = validateZone(targetValue.zone);
  const options = validateOptions(optionsValue);
  const candles = validateCandles(candlesValue);
  const closed = calculateIndexedClosedCandles(candles, options.atrPeriod);
  const episodes: TouchEpisode[] = [];
  const rejectedInteractions: RejectedTouchInteraction[] = [];

  let active: ActiveInteraction | null = null;
  let suppressed: SuppressedInteraction | null = null;

  for (const indexed of closed) {
    if (
      indexed.originalIndex
      < (
        options.scanFromCandleIndex
        ?? 0
      )
    ) {
      continue;
    }

    const contact = intersectsZone(indexed.candle, zone);

    if (suppressed) {
      if (contact) {
        suppressed.lastContact = indexed;
        if (suppressed.referenceAtr === null && indexed.atr !== null && indexed.atr > 0) {
          suppressed.referenceAtr = indexed.atr;
        }
      } else if (
        canClearSuppressedInteraction(
          suppressed,
          indexed,
          zone,
          targetValue.kind,
          options.minDepartureAtr,
        )
      ) {
        suppressed = null;
      }
      continue;
    }

    if (!active) {
      if (!contact) {
        continue;
      }

      if (isWrongSideBreak(indexed.candle, zone, targetValue.kind)) {
        rejectedInteractions.push(
          freezeRejection(indexed, indexed, 'wrong_side_break'),
        );
        suppressed = {
          start: indexed,
          lastContact: indexed,
          referenceAtr: indexed.atr,
        };
        continue;
      }

      if (indexed.atr === null || indexed.atr <= 0) {
        rejectedInteractions.push(
          freezeRejection(indexed, indexed, 'missing_atr'),
        );
        suppressed = {
          start: indexed,
          lastContact: indexed,
          referenceAtr: null,
        };
        continue;
      }

      const previousEpisode = episodes.at(-1);
      if (
        previousEpisode
        && barsBetween(previousEpisode, indexed) < options.minBarsBetweenEpisodes
      ) {
        rejectedInteractions.push(
          freezeRejection(
            indexed,
            indexed,
            'insufficient_time_separation',
          ),
        );
        suppressed = {
          start: indexed,
          lastContact: indexed,
          referenceAtr: indexed.atr,
        };
        continue;
      }

      active = beginActiveInteraction(indexed, targetValue.kind);
      continue;
    }

    if (isWrongSideBreak(indexed.candle, zone, targetValue.kind)) {
      rejectedInteractions.push(
        freezeRejection(active.start, indexed, 'wrong_side_break'),
      );
      suppressed = {
        start: active.start,
        lastContact: indexed,
        referenceAtr: active.anchorAtr,
      };
      active = null;
      continue;
    }

    if (contact) {
      updateActiveContact(active, indexed, targetValue.kind);
      if (episodeSpanCandles(active) > options.maxEpisodeSpanCandles) {
        rejectedInteractions.push(
          freezeRejection(
            active.start,
            active.lastContact,
            'prolonged_zone_chop',
          ),
        );
        suppressed = {
          start: active.start,
          lastContact: active.lastContact,
          referenceAtr: active.anchorAtr,
        };
        active = null;
      }
      continue;
    }

    const distance = departureDistance(
      indexed.candle,
      zone,
      targetValue.kind,
    );
    const departureAtr = distance / active.anchorAtr;
    const candlesAfterContact =
      indexed.closedIndex - active.lastContact.closedIndex;

    if (departureAtr >= options.minDepartureAtr) {
      episodes.push(createTouchEpisode({
        id: stableEpisodeId(
          symbol,
          targetValue.sourceTimeframe,
          targetValue.kind,
          active.start.candle.closeTime,
        ),
        symbol,
        sourceTimeframe: targetValue.sourceTimeframe,
        kind: targetValue.kind,
        startCandleIndex: active.start.originalIndex,
        endCandleIndex: active.lastContact.originalIndex,
        anchorCandleIndex: active.anchor.originalIndex,
        startedAt: active.start.candle.closeTime,
        endedAt: active.lastContact.candle.closeTime,
        anchorAt: active.anchor.candle.closeTime,
        confirmedAt: indexed.candle.closeTime,
        extremePrice: active.anchorPrice,
        atrAtTouch: active.anchorAtr,
        departureDistance: distance,
        departureAtr,
        departureCandles: candlesAfterContact,
      }));
      active = null;
      continue;
    }

    if (candlesAfterContact >= options.maxDepartureCandles) {
      rejectedInteractions.push(
        freezeRejection(
          active.start,
          indexed,
          'insufficient_departure',
        ),
      );
      suppressed = {
        start: active.start,
        lastContact: active.lastContact,
        referenceAtr: active.anchorAtr,
      };
      active = null;
    }
  }

  const pendingInteraction = active ? freezePending(active) : null;

  return Object.freeze({
    symbol,
    sourceTimeframe: targetValue.sourceTimeframe,
    kind: targetValue.kind,
    zone,
    closedCandlesCount: closed.length,
    ignoredOpenCandlesCount: candles.length - closed.length,
    episodes: Object.freeze([...episodes]),
    rejectedInteractions: Object.freeze([...rejectedInteractions]),
    pendingInteraction,
    observationalOnly: true,
    createsSetup: false,
  });
}
