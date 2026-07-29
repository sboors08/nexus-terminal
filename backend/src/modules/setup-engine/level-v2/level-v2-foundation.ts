import type {
  LevelV2AtrPoint,
  LevelV2Candle,
  LevelV2Extremum,
  LevelV2ExtremumKind,
  LevelV2FoundationOptions,
  LevelV2FoundationResult,
  LevelV2TouchEvent,
} from './level-v2.types.js';

export const DEFAULT_LEVEL_V2_FOUNDATION_OPTIONS:
LevelV2FoundationOptions = {
  atrPeriod: 14,
  swingLeftCandles: 2,
  swingRightCandles: 2,
  minReactionAtr: 0.75,
  maxReactionLookaheadCandles: 8,
  plateauToleranceAtr: 0.08,
  maxPlateauWidthCandles: 4,
  maxTouchMergeCandles: 2,
  touchMergeToleranceAtr: 0.12,
};

interface ExtremumCandidate {
  kind: LevelV2ExtremumKind;
  candleIndex: number;
  price: number;
  atr: number;
}

interface CandidateSegment {
  kind: LevelV2ExtremumKind;
  indexes: number[];
  representativeIndex: number;
  extremePrice: number;
  atr: number;
}

const round = (
  value: number,
  digits = 8,
): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function validatePositiveInteger(
  value: number,
  name: string,
): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Level v2 ${name} must be a positive integer`);
  }
}

function validateNonNegativeFinite(
  value: number,
  name: string,
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Level v2 ${name} must be a non-negative finite number`);
  }
}

function validateOptions(
  options: LevelV2FoundationOptions,
): void {
  validatePositiveInteger(options.atrPeriod, 'atrPeriod');
  validatePositiveInteger(options.swingLeftCandles, 'swingLeftCandles');
  validatePositiveInteger(options.swingRightCandles, 'swingRightCandles');
  validatePositiveInteger(
    options.maxReactionLookaheadCandles,
    'maxReactionLookaheadCandles',
  );
  validatePositiveInteger(
    options.maxPlateauWidthCandles,
    'maxPlateauWidthCandles',
  );
  validatePositiveInteger(
    options.maxTouchMergeCandles,
    'maxTouchMergeCandles',
  );
  validateNonNegativeFinite(options.minReactionAtr, 'minReactionAtr');
  validateNonNegativeFinite(options.plateauToleranceAtr, 'plateauToleranceAtr');
  validateNonNegativeFinite(
    options.touchMergeToleranceAtr,
    'touchMergeToleranceAtr',
  );
}

function validateCandles(
  candles: readonly LevelV2Candle[],
): void {
  let previousOpenTime = Number.NEGATIVE_INFINITY;

  for (const candle of candles) {
    const prices = [candle.open, candle.high, candle.low, candle.close];
    if (prices.some((value) => !Number.isFinite(value) || value <= 0)) {
      throw new Error('Level v2 candle prices must be positive finite numbers');
    }
    if (
      candle.low > candle.high
      || candle.open < candle.low
      || candle.open > candle.high
      || candle.close < candle.low
      || candle.close > candle.high
    ) {
      throw new Error('Level v2 candle contains invalid OHLC values');
    }

    const openTime = Date.parse(candle.openTime);
    const closeTime = Date.parse(candle.closeTime);
    if (!Number.isFinite(openTime) || !Number.isFinite(closeTime)) {
      throw new Error('Level v2 candle timestamps must be valid ISO dates');
    }
    if (closeTime < openTime) {
      throw new Error('Level v2 candle closeTime cannot precede openTime');
    }
    if (openTime <= previousOpenTime) {
      throw new Error('Level v2 candles must be strictly ordered and unique');
    }
    previousOpenTime = openTime;
  }
}

export function calculateLevelV2Atr(
  candles: readonly LevelV2Candle[],
  period: number,
): LevelV2AtrPoint[] {
  validatePositiveInteger(period, 'ATR period');
  validateCandles(candles);

  const points: LevelV2AtrPoint[] = [];
  const ranges: number[] = [];

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    if (!candle) {
      continue;
    }
    const previous = candles[index - 1];
    const trueRange = previous
      ? Math.max(
          candle.high - candle.low,
          Math.abs(candle.high - previous.close),
          Math.abs(candle.low - previous.close),
        )
      : candle.high - candle.low;

    ranges.push(trueRange);
    const atr = ranges.length >= period
      ? ranges
          .slice(ranges.length - period)
          .reduce((sum, value) => sum + value, 0) / period
      : null;

    points.push({
      candleIndex: index,
      trueRange: round(trueRange),
      atr: atr === null ? null : round(atr),
    });
  }

  return points;
}

function isCandidate(
  candles: readonly LevelV2Candle[],
  index: number,
  kind: LevelV2ExtremumKind,
  options: LevelV2FoundationOptions,
): boolean {
  const candle = candles[index];
  if (!candle) {
    return false;
  }

  const left = candles.slice(index - options.swingLeftCandles, index);
  const right = candles.slice(index + 1, index + options.swingRightCandles + 1);
  if (
    left.length !== options.swingLeftCandles
    || right.length !== options.swingRightCandles
  ) {
    return false;
  }

  if (kind === 'swing_high') {
    const neighbours = [...left, ...right].map((item) => item.high);
    return neighbours.every((value) => candle.high >= value)
      && neighbours.some((value) => candle.high > value);
  }

  const neighbours = [...left, ...right].map((item) => item.low);
  return neighbours.every((value) => candle.low <= value)
    && neighbours.some((value) => candle.low < value);
}

function buildCandidates(
  candles: readonly LevelV2Candle[],
  atr: readonly LevelV2AtrPoint[],
  options: LevelV2FoundationOptions,
): ExtremumCandidate[] {
  const candidates: ExtremumCandidate[] = [];
  const end = candles.length - options.swingRightCandles;

  for (let index = options.swingLeftCandles; index < end; index += 1) {
    const atrValue = atr[index]?.atr;
    const candle = candles[index];
    if (!candle || atrValue === null || atrValue === undefined || atrValue <= 0) {
      continue;
    }

    if (isCandidate(candles, index, 'swing_high', options)) {
      candidates.push({
        kind: 'swing_high',
        candleIndex: index,
        price: candle.high,
        atr: atrValue,
      });
    }
    if (isCandidate(candles, index, 'swing_low', options)) {
      candidates.push({
        kind: 'swing_low',
        candleIndex: index,
        price: candle.low,
        atr: atrValue,
      });
    }
  }

  return candidates.sort((left, right) =>
    left.candleIndex - right.candleIndex
    || left.kind.localeCompare(right.kind));
}

function segmentCandidates(
  candidates: readonly ExtremumCandidate[],
  options: LevelV2FoundationOptions,
): CandidateSegment[] {
  const segments: CandidateSegment[] = [];

  for (const candidate of candidates) {
    const previous = segments.at(-1);
    const tolerance = candidate.atr * options.plateauToleranceAtr;
    const canMerge = previous
      && previous.kind === candidate.kind
      && candidate.candleIndex - (previous.indexes.at(-1) ?? candidate.candleIndex) <= 1
      && Math.abs(candidate.price - previous.extremePrice) <= tolerance
      && previous.indexes.length < options.maxPlateauWidthCandles;

    if (!canMerge) {
      segments.push({
        kind: candidate.kind,
        indexes: [candidate.candleIndex],
        representativeIndex: candidate.candleIndex,
        extremePrice: candidate.price,
        atr: candidate.atr,
      });
      continue;
    }

    previous.indexes.push(candidate.candleIndex);
    const isMoreExtreme = candidate.kind === 'swing_high'
      ? candidate.price > previous.extremePrice
      : candidate.price < previous.extremePrice;
    if (isMoreExtreme) {
      previous.extremePrice = candidate.price;
      previous.representativeIndex = candidate.candleIndex;
      previous.atr = candidate.atr;
    }
  }

  return segments;
}

function findReaction(
  candles: readonly LevelV2Candle[],
  segment: CandidateSegment,
  options: LevelV2FoundationOptions,
): { distance: number; duration: number; confirmedIndex: number } | null {
  const segmentEnd = segment.indexes.at(-1);
  if (segmentEnd === undefined) {
    return null;
  }
  const threshold = segment.atr * options.minReactionAtr;
  const end = Math.min(
    candles.length - 1,
    segmentEnd + options.maxReactionLookaheadCandles,
  );

  for (let index = segmentEnd + 1; index <= end; index += 1) {
    const candle = candles[index];
    if (!candle) {
      continue;
    }
    const distance = segment.kind === 'swing_high'
      ? segment.extremePrice - candle.low
      : candle.high - segment.extremePrice;
    if (distance >= threshold) {
      return {
        distance,
        duration: index - segmentEnd,
        confirmedIndex: index,
      };
    }
  }

  return null;
}

function calculateQuality(
  reactionAtr: number,
  leftProminenceAtr: number,
  rightProminenceAtr: number,
  duration: number,
  options: LevelV2FoundationOptions,
): number {
  const reaction = Math.min(1, reactionAtr / Math.max(options.minReactionAtr * 2, 0.01));
  const prominence = Math.min(
    1,
    Math.max(0, Math.min(leftProminenceAtr, rightProminenceAtr)),
  );
  const speed = Math.max(
    0,
    1 - (duration - 1) / Math.max(options.maxReactionLookaheadCandles, 1),
  );
  return round((reaction * 55) + (prominence * 30) + (speed * 15), 2);
}

function buildExtremum(
  symbol: string,
  timeframe: string,
  candles: readonly LevelV2Candle[],
  segment: CandidateSegment,
  options: LevelV2FoundationOptions,
): LevelV2Extremum | null {
  const segmentStart = segment.indexes[0];
  const segmentEnd = segment.indexes.at(-1);
  const representative = candles[segment.representativeIndex];
  if (segmentStart === undefined || segmentEnd === undefined || !representative) {
    return null;
  }

  const reaction = findReaction(candles, segment, options);
  if (!reaction) {
    return null;
  }

  const leftCandles = candles.slice(
    Math.max(0, segmentStart - options.swingLeftCandles),
    segmentStart,
  );
  const rightCandles = candles.slice(
    segmentEnd + 1,
    segmentEnd + options.swingRightCandles + 1,
  );
  if (
    leftCandles.length !== options.swingLeftCandles
    || rightCandles.length !== options.swingRightCandles
  ) {
    return null;
  }

  const leftReference = segment.kind === 'swing_high'
    ? Math.max(...leftCandles.map((item) => item.high))
    : Math.min(...leftCandles.map((item) => item.low));
  const rightReference = segment.kind === 'swing_high'
    ? Math.max(...rightCandles.map((item) => item.high))
    : Math.min(...rightCandles.map((item) => item.low));
  const leftProminence = segment.kind === 'swing_high'
    ? segment.extremePrice - leftReference
    : leftReference - segment.extremePrice;
  const rightProminence = segment.kind === 'swing_high'
    ? segment.extremePrice - rightReference
    : rightReference - segment.extremePrice;

  const reactionAtr = reaction.distance / segment.atr;
  const leftProminenceAtr = leftProminence / segment.atr;
  const rightProminenceAtr = rightProminence / segment.atr;
  const confirmedCandle = candles[reaction.confirmedIndex];
  if (!confirmedCandle) {
    return null;
  }

  const stableKind = segment.kind === 'swing_high' ? 'high' : 'low';
  return {
    id: `${symbol}-${timeframe}-v2-${stableKind}-${Date.parse(representative.closeTime)}`,
    kind: segment.kind,
    candleIndex: segment.representativeIndex,
    segmentStartIndex: segmentStart,
    segmentEndIndex: segmentEnd,
    occurredAt: representative.closeTime,
    confirmedAt: confirmedCandle.closeTime,
    extremePrice: round(segment.extremePrice),
    atr: round(segment.atr),
    reactionDistance: round(reaction.distance),
    reactionAtr: round(reactionAtr, 4),
    reactionDurationCandles: reaction.duration,
    leftProminenceAtr: round(leftProminenceAtr, 4),
    rightProminenceAtr: round(rightProminenceAtr, 4),
    qualityScore: calculateQuality(
      reactionAtr,
      leftProminenceAtr,
      rightProminenceAtr,
      reaction.duration,
      options,
    ),
  };
}

export function detectLevelV2Extrema(
  symbolValue: string,
  timeframeValue: string,
  candlesValue: readonly LevelV2Candle[],
  options: LevelV2FoundationOptions = DEFAULT_LEVEL_V2_FOUNDATION_OPTIONS,
): LevelV2Extremum[] {
  const symbol = symbolValue.trim().toUpperCase();
  const timeframe = timeframeValue.trim();
  if (!/^[A-Z0-9]{5,30}$/.test(symbol)) {
    throw new Error(`Invalid Level v2 symbol: ${symbolValue}`);
  }
  if (timeframe.length === 0) {
    throw new Error('Level v2 timeframe cannot be empty');
  }
  validateOptions(options);
  validateCandles(candlesValue);

  const candles = candlesValue.filter((candle) => candle.isClosed);
  const atr = calculateLevelV2Atr(candles, options.atrPeriod);
  const candidates = buildCandidates(candles, atr, options);
  const segments = segmentCandidates(candidates, options);

  return segments
    .map((segment) => buildExtremum(symbol, timeframe, candles, segment, options))
    .filter((item): item is LevelV2Extremum => item !== null)
    .sort((left, right) =>
      left.candleIndex - right.candleIndex
      || left.kind.localeCompare(right.kind));
}

export function buildLevelV2TouchEvents(
  symbolValue: string,
  timeframeValue: string,
  extrema: readonly LevelV2Extremum[],
  options: LevelV2FoundationOptions = DEFAULT_LEVEL_V2_FOUNDATION_OPTIONS,
): LevelV2TouchEvent[] {
  const symbol = symbolValue.trim().toUpperCase();
  const timeframe = timeframeValue.trim();
  validateOptions(options);
  const sorted = [...extrema].sort((left, right) =>
    left.candleIndex - right.candleIndex
    || left.kind.localeCompare(right.kind));
  const events: LevelV2TouchEvent[] = [];

  for (const extremum of sorted) {
    const previous = events.at(-1);
    const tolerance = extremum.atr * options.touchMergeToleranceAtr;
    const canMerge = previous
      && previous.kind === extremum.kind
      && extremum.candleIndex - previous.lastCandleIndex <= options.maxTouchMergeCandles
      && Math.abs(extremum.extremePrice - previous.extremePrice) <= tolerance;

    if (!canMerge) {
      events.push({
        id: `${symbol}-${timeframe}-touch-${extremum.kind}-${Date.parse(extremum.occurredAt)}`,
        kind: extremum.kind,
        extremumIds: [extremum.id],
        representativeExtremumId: extremum.id,
        firstCandleIndex: extremum.segmentStartIndex,
        lastCandleIndex: extremum.segmentEndIndex,
        occurredAt: extremum.occurredAt,
        extremePrice: extremum.extremePrice,
        qualityScore: extremum.qualityScore,
      });
      continue;
    }

    const representativeIsNew = extremum.qualityScore > previous.qualityScore;
    events[events.length - 1] = {
      ...previous,
      extremumIds: [...previous.extremumIds, extremum.id],
      representativeExtremumId: representativeIsNew
        ? extremum.id
        : previous.representativeExtremumId,
      lastCandleIndex: Math.max(previous.lastCandleIndex, extremum.segmentEndIndex),
      occurredAt: representativeIsNew ? extremum.occurredAt : previous.occurredAt,
      extremePrice: representativeIsNew ? extremum.extremePrice : previous.extremePrice,
      qualityScore: Math.max(previous.qualityScore, extremum.qualityScore),
    };
  }

  return events;
}

export function buildLevelV2Foundation(
  symbol: string,
  timeframe: string,
  candlesValue: readonly LevelV2Candle[],
  options: LevelV2FoundationOptions = DEFAULT_LEVEL_V2_FOUNDATION_OPTIONS,
): LevelV2FoundationResult {
  validateOptions(options);
  validateCandles(candlesValue);
  const closedCandles = candlesValue.filter((candle) => candle.isClosed);
  const atr = calculateLevelV2Atr(closedCandles, options.atrPeriod);
  const extrema = detectLevelV2Extrema(symbol, timeframe, closedCandles, options);
  const touchEvents = buildLevelV2TouchEvents(symbol, timeframe, extrema, options);
  return {
    closedCandlesCount: closedCandles.length,
    atr,
    extrema,
    touchEvents,
  };
}
