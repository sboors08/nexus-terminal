import type {
  LevelV2Candle,
  LevelV2Extremum,
  LevelV2FoundationResult,
  LevelV2TouchEvent,
} from './level-v2.types.js';
import type {
  LevelV2Cleanliness,
  LevelV2DetectedZone,
  LevelV2Kind,
  LevelV2RejectedZone,
  LevelV2Score,
  LevelV2ZoneGeometry,
  LevelV2ZoneRejectionCode,
  LevelV2ZonesScoreOptions,
  LevelV2ZonesScoreResult,
} from './level-v2-zones-score.types.js';

export const DEFAULT_LEVEL_V2_ZONES_SCORE_OPTIONS:
LevelV2ZonesScoreOptions = {
  minTouches: 2,
  minTouchSpacingCandles: 3,
  clusterToleranceAtr: 0.35,
  maxClusterTolerancePct: 0.25,
  corePaddingAtr: 0.08,
  outerPaddingAtr: 0.12,
  liquidityPaddingAtr: 0.3,
  acceptanceWindowCandles: 80,
  maxClosesInsideRatio: 0.35,
  maxCrossingsCount: 4,
  minStructureEdgePosition: 0.65,
  minLevelScore: 45,
  freshnessHalfLifeCandles: 240,
};

interface MutableCluster {
  kind: LevelV2TouchEvent['kind'];
  touches: LevelV2TouchEvent[];
}

const round = (
  value: number,
  digits = 8,
): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const clamp = (
  value: number,
  minimum: number,
  maximum: number,
): number => Math.min(maximum, Math.max(minimum, value));

function validatePositiveInteger(
  value: number,
  name: string,
): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Level v2 zones ${name} must be a positive integer`);
  }
}

function validateNonNegativeFinite(
  value: number,
  name: string,
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Level v2 zones ${name} must be a non-negative finite number`);
  }
}

function validateRatio(
  value: number,
  name: string,
): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`Level v2 zones ${name} must be between zero and one`);
  }
}

function validateOptions(
  options: LevelV2ZonesScoreOptions,
): void {
  validatePositiveInteger(options.minTouches, 'minTouches');
  validatePositiveInteger(options.minTouchSpacingCandles, 'minTouchSpacingCandles');
  validatePositiveInteger(options.acceptanceWindowCandles, 'acceptanceWindowCandles');
  validatePositiveInteger(options.freshnessHalfLifeCandles, 'freshnessHalfLifeCandles');
  validateNonNegativeFinite(options.clusterToleranceAtr, 'clusterToleranceAtr');
  validateNonNegativeFinite(options.maxClusterTolerancePct, 'maxClusterTolerancePct');
  validateNonNegativeFinite(options.corePaddingAtr, 'corePaddingAtr');
  validateNonNegativeFinite(options.outerPaddingAtr, 'outerPaddingAtr');
  validateNonNegativeFinite(options.liquidityPaddingAtr, 'liquidityPaddingAtr');
  validateNonNegativeFinite(options.maxCrossingsCount, 'maxCrossingsCount');
  validateNonNegativeFinite(options.minLevelScore, 'minLevelScore');
  validateRatio(options.maxClosesInsideRatio, 'maxClosesInsideRatio');
  validateRatio(options.minStructureEdgePosition, 'minStructureEdgePosition');
  if (options.minTouches < 2) {
    throw new Error('Level v2 zones require at least two touches');
  }
  if (options.minLevelScore > 100) {
    throw new Error('Level v2 zones minLevelScore cannot exceed 100');
  }
  if (options.minStructureEdgePosition < 0.5) {
    throw new Error('Level v2 zones minStructureEdgePosition must be at least 0.5');
  }
}

function validateInput(
  symbolValue: string,
  timeframeValue: string,
  candles: readonly LevelV2Candle[],
  foundation: LevelV2FoundationResult,
): { symbol: string; timeframe: string; closedCandles: LevelV2Candle[] } {
  const symbol = symbolValue.trim().toUpperCase();
  const timeframe = timeframeValue.trim();
  if (!/^[A-Z0-9]{5,30}$/.test(symbol)) {
    throw new Error(`Invalid Level v2 zones symbol: ${symbolValue}`);
  }
  if (timeframe.length === 0) {
    throw new Error('Level v2 zones timeframe cannot be empty');
  }

  let previousOpenTime = Number.NEGATIVE_INFINITY;
  for (const candle of candles) {
    const openTime = Date.parse(candle.openTime);
    const closeTime = Date.parse(candle.closeTime);
    const prices = [candle.open, candle.high, candle.low, candle.close];
    if (
      !Number.isFinite(openTime)
      || !Number.isFinite(closeTime)
      || closeTime < openTime
      || openTime <= previousOpenTime
    ) {
      throw new Error('Level v2 zones candles must be strictly ordered with valid timestamps');
    }
    if (
      prices.some((price) => !Number.isFinite(price) || price <= 0)
      || candle.low > candle.high
      || candle.open < candle.low
      || candle.open > candle.high
      || candle.close < candle.low
      || candle.close > candle.high
    ) {
      throw new Error('Level v2 zones candle contains invalid OHLC values');
    }
    previousOpenTime = openTime;
  }

  const closedCandles = candles.filter((candle) => candle.isClosed);
  if (foundation.closedCandlesCount !== closedCandles.length) {
    throw new Error('Level v2 zones foundation candle count does not match closed candles');
  }

  return {
    symbol,
    timeframe,
    closedCandles,
  };
}

function weightedMedian(
  values: readonly { value: number; weight: number }[],
): number {
  const sorted = [...values].sort((left, right) => left.value - right.value);
  const totalWeight = sorted.reduce(
    (sum, item) => sum + Math.max(item.weight, 0.01),
    0,
  );
  let accumulated = 0;
  for (const item of sorted) {
    accumulated += Math.max(item.weight, 0.01);
    if (accumulated >= totalWeight / 2) {
      return item.value;
    }
  }
  return sorted.at(-1)?.value ?? 0;
}

function quantile(
  values: readonly number[],
  position: number,
): number {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) {
    return 0;
  }
  const index = (sorted.length - 1) * clamp(position, 0, 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const lowerValue = sorted[lower];
  const upperValue = sorted[upper];
  if (lowerValue === undefined || upperValue === undefined) {
    return sorted[0] ?? 0;
  }
  return lowerValue + (upperValue - lowerValue) * (index - lower);
}

function representativeExtremum(
  touch: LevelV2TouchEvent,
  extremaById: ReadonlyMap<string, LevelV2Extremum>,
): LevelV2Extremum | null {
  return extremaById.get(touch.representativeExtremumId) ?? null;
}

function averageAtr(
  touches: readonly LevelV2TouchEvent[],
  extremaById: ReadonlyMap<string, LevelV2Extremum>,
  foundation: LevelV2FoundationResult,
): number {
  const values = touches
    .map((touch) => representativeExtremum(touch, extremaById)?.atr)
    .filter((value): value is number => value !== undefined && value > 0);
  if (values.length > 0) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  const fallback = [...foundation.atr]
    .reverse()
    .find((point) => point.atr !== null && point.atr > 0)
    ?.atr;
  return fallback ?? 0.00000001;
}

function clusterReference(
  cluster: MutableCluster,
): number {
  return weightedMedian(
    cluster.touches.map((touch) => ({
      value: touch.extremePrice,
      weight: touch.qualityScore,
    })),
  );
}

function clusterTouches(
  foundation: LevelV2FoundationResult,
  options: LevelV2ZonesScoreOptions,
): MutableCluster[] {
  const extremaById = new Map(
    foundation.extrema.map((extremum) => [extremum.id, extremum]),
  );
  const sorted = [...foundation.touchEvents].sort((left, right) =>
    left.firstCandleIndex - right.firstCandleIndex
    || left.kind.localeCompare(right.kind));
  const clusters: MutableCluster[] = [];

  for (const touch of sorted) {
    const extremum = representativeExtremum(touch, extremaById);
    if (!extremum) {
      continue;
    }

    let bestCluster: MutableCluster | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const cluster of clusters) {
      if (cluster.kind !== touch.kind) {
        continue;
      }
      const lastTouch = cluster.touches.at(-1);
      if (
        !lastTouch
        || touch.firstCandleIndex - lastTouch.lastCandleIndex
          < options.minTouchSpacingCandles
      ) {
        continue;
      }

      const reference = clusterReference(cluster);
      const clusterAtr = averageAtr(cluster.touches, extremaById, foundation);
      const atrTolerance = Math.max(clusterAtr, extremum.atr)
        * options.clusterToleranceAtr;
      const percentageCap = reference
        * options.maxClusterTolerancePct
        / 100;
      const tolerance = Math.min(atrTolerance, percentageCap);
      const distance = Math.abs(touch.extremePrice - reference);
      if (distance <= tolerance && distance < bestDistance) {
        bestCluster = cluster;
        bestDistance = distance;
      }
    }

    if (bestCluster) {
      bestCluster.touches.push(touch);
    } else {
      clusters.push({
        kind: touch.kind,
        touches: [touch],
      });
    }
  }

  return clusters;
}

function buildGeometry(
  kind: LevelV2Kind,
  touches: readonly LevelV2TouchEvent[],
  averageAtrValue: number,
  options: LevelV2ZonesScoreOptions,
): LevelV2ZoneGeometry {
  const prices = touches.map((touch) => touch.extremePrice);
  const referencePrice = weightedMedian(
    touches.map((touch) => ({
      value: touch.extremePrice,
      weight: touch.qualityScore,
    })),
  );
  const lowerQuartile = quantile(prices, 0.25);
  const upperQuartile = quantile(prices, 0.75);
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  const corePadding = averageAtrValue * options.corePaddingAtr;
  const outerPadding = averageAtrValue * options.outerPaddingAtr;
  const liquidityPadding = averageAtrValue * options.liquidityPaddingAtr;

  const coreLow = kind === 'resistance'
    ? lowerQuartile - corePadding
    : lowerQuartile;
  const coreHigh = kind === 'resistance'
    ? upperQuartile
    : upperQuartile + corePadding;
  const outerLow = kind === 'resistance'
    ? coreLow - outerPadding
    : minimum - outerPadding;
  const outerHigh = kind === 'resistance'
    ? maximum + outerPadding
    : coreHigh + outerPadding;
  const liquidityLow = kind === 'resistance'
    ? outerHigh
    : outerLow - liquidityPadding;
  const liquidityHigh = kind === 'resistance'
    ? outerHigh + liquidityPadding
    : outerLow;
  const width = outerHigh - outerLow;

  return {
    referencePrice: round(referencePrice),
    coreLow: round(coreLow),
    coreHigh: round(coreHigh),
    outerLow: round(outerLow),
    outerHigh: round(outerHigh),
    liquidityLow: round(liquidityLow),
    liquidityHigh: round(liquidityHigh),
    widthPct: round(width / referencePrice * 100, 4),
    widthAtr: round(width / averageAtrValue, 4),
  };
}

function calculateCleanliness(
  kind: LevelV2Kind,
  candles: readonly LevelV2Candle[],
  firstTouchIndex: number,
  zone: LevelV2ZoneGeometry,
  options: LevelV2ZonesScoreOptions,
): LevelV2Cleanliness {
  const start = Math.max(
    firstTouchIndex,
    candles.length - options.acceptanceWindowCandles,
  );
  const window = candles.slice(start);
  if (window.length === 0) {
    return {
      closesInsideRatio: 0,
      closesAboveRatio: 0,
      closesBelowRatio: 0,
      crossingsCount: 0,
      timeInsideCandles: 0,
      rangeEdgePosition: kind === 'resistance' ? 1 : 0,
      isAcceptanceZone: false,
    };
  }

  let inside = 0;
  let above = 0;
  let below = 0;
  let crossings = 0;
  let previousOutsideSide: 'above' | 'below' | null = null;

  for (const candle of window) {
    let side: 'above' | 'inside' | 'below';
    if (candle.close > zone.outerHigh) {
      side = 'above';
      above += 1;
    } else if (candle.close < zone.outerLow) {
      side = 'below';
      below += 1;
    } else {
      side = 'inside';
      inside += 1;
    }

    if (side !== 'inside') {
      if (previousOutsideSide && previousOutsideSide !== side) {
        crossings += 1;
      }
      previousOutsideSide = side;
    }
  }

  const rangeLow = Math.min(...window.map((candle) => candle.low));
  const rangeHigh = Math.max(...window.map((candle) => candle.high));
  const range = rangeHigh - rangeLow;
  const rangeEdgePosition = range > 0
    ? clamp((zone.referencePrice - rangeLow) / range, 0, 1)
    : 0.5;
  const closesInsideRatio = inside / window.length;
  const closesAboveRatio = above / window.length;
  const closesBelowRatio = below / window.length;

  return {
    closesInsideRatio: round(closesInsideRatio, 4),
    closesAboveRatio: round(closesAboveRatio, 4),
    closesBelowRatio: round(closesBelowRatio, 4),
    crossingsCount: crossings,
    timeInsideCandles: inside,
    rangeEdgePosition: round(rangeEdgePosition, 4),
    isAcceptanceZone:
      closesInsideRatio > options.maxClosesInsideRatio
      || crossings > options.maxCrossingsCount,
  };
}

function calculateScore(
  kind: LevelV2Kind,
  touches: readonly LevelV2TouchEvent[],
  extremaById: ReadonlyMap<string, LevelV2Extremum>,
  cleanliness: LevelV2Cleanliness,
  averageAtrValue: number,
  lastClosedCandleIndex: number,
  options: LevelV2ZonesScoreOptions,
): LevelV2Score {
  const touchComponent = clamp(touches.length * 25, 0, 100);
  const reactionValues = touches
    .map((touch) => representativeExtremum(touch, extremaById)?.reactionAtr)
    .filter((value): value is number => value !== undefined);
  const averageReaction = reactionValues.length > 0
    ? reactionValues.reduce((sum, value) => sum + value, 0) / reactionValues.length
    : 0;
  const reactionComponent = clamp(averageReaction / 2 * 100, 0, 100);
  const cleanlinessComponent = clamp(
    100
    - cleanliness.closesInsideRatio * 100
    - cleanliness.crossingsCount * 12.5,
    0,
    100,
  );
  const gaps = touches.slice(1).map((touch, index) => {
    const previous = touches[index];
    return previous
      ? touch.firstCandleIndex - previous.lastCandleIndex
      : 0;
  });
  const averageGap = gaps.length > 0
    ? gaps.reduce((sum, value) => sum + value, 0) / gaps.length
    : 0;
  const spacingComponent = clamp(
    averageGap / (options.minTouchSpacingCandles * 3) * 100,
    0,
    100,
  );
  const latestTouch = touches.at(-1);
  const age = latestTouch
    ? Math.max(0, lastClosedCandleIndex - latestTouch.lastCandleIndex)
    : options.freshnessHalfLifeCandles;
  const freshnessComponent = clamp(
    100 * (0.5 ** (age / options.freshnessHalfLifeCandles)),
    0,
    100,
  );
  const spread = Math.max(...touches.map((touch) => touch.extremePrice))
    - Math.min(...touches.map((touch) => touch.extremePrice));
  const precisionDenominator = Math.max(
    averageAtrValue * options.clusterToleranceAtr * 2,
    Number.EPSILON,
  );
  const precisionComponent = clamp(
    100 * (1 - spread / precisionDenominator),
    0,
    100,
  );
  const edge = kind === 'resistance'
    ? cleanliness.rangeEdgePosition
    : 1 - cleanliness.rangeEdgePosition;
  const structureEdgeComponent = clamp(edge * 100, 0, 100);
  const total =
    touchComponent * 0.2
    + reactionComponent * 0.25
    + cleanlinessComponent * 0.2
    + spacingComponent * 0.1
    + freshnessComponent * 0.1
    + precisionComponent * 0.1
    + structureEdgeComponent * 0.05;

  return {
    total: round(total, 2),
    touches: round(touchComponent, 2),
    reactions: round(reactionComponent, 2),
    cleanliness: round(cleanlinessComponent, 2),
    spacing: round(spacingComponent, 2),
    freshness: round(freshnessComponent, 2),
    precision: round(precisionComponent, 2),
    structureEdge: round(structureEdgeComponent, 2),
  };
}

function levelId(
  symbol: string,
  timeframe: string,
  kind: LevelV2Kind,
  touches: readonly LevelV2TouchEvent[],
  referencePrice: number,
): string {
  const first = touches[0];
  const timestamp = first ? Date.parse(first.occurredAt) : 0;
  return `${symbol}-${timeframe}-level-v2-${kind}-${timestamp}-${round(referencePrice, 8)}`;
}

export function buildLevelV2ZonesScore(
  symbolValue: string,
  timeframeValue: string,
  candlesValue: readonly LevelV2Candle[],
  foundation: LevelV2FoundationResult,
  options: LevelV2ZonesScoreOptions = DEFAULT_LEVEL_V2_ZONES_SCORE_OPTIONS,
): LevelV2ZonesScoreResult {
  validateOptions(options);
  const {
    symbol,
    timeframe,
    closedCandles,
  } = validateInput(symbolValue, timeframeValue, candlesValue, foundation);
  const extremaById = new Map(
    foundation.extrema.map((extremum) => [extremum.id, extremum]),
  );
  const levels: LevelV2DetectedZone[] = [];
  const rejected: LevelV2RejectedZone[] = [];

  for (const cluster of clusterTouches(foundation, options)) {
    const touches = [...cluster.touches].sort((left, right) =>
      left.firstCandleIndex - right.firstCandleIndex);
    const kind: LevelV2Kind = cluster.kind === 'swing_high'
      ? 'resistance'
      : 'support';
    const averageAtrValue = averageAtr(touches, extremaById, foundation);
    const zone = buildGeometry(kind, touches, averageAtrValue, options);
    const firstTouch = touches[0];
    const lastTouch = touches.at(-1);
    if (!firstTouch || !lastTouch) {
      continue;
    }
    const cleanliness = calculateCleanliness(
      kind,
      closedCandles,
      firstTouch.firstCandleIndex,
      zone,
      options,
    );
    const score = calculateScore(
      kind,
      touches,
      extremaById,
      cleanliness,
      averageAtrValue,
      Math.max(0, closedCandles.length - 1),
      options,
    );
    const id = levelId(symbol, timeframe, kind, touches, zone.referencePrice);
    const reasons: LevelV2ZoneRejectionCode[] = [];

    if (touches.length < options.minTouches) {
      reasons.push('insufficient_touches');
    }
    if (cleanliness.isAcceptanceZone) {
      reasons.push('acceptance_zone');
    }
    const structureIsValid = kind === 'resistance'
      ? cleanliness.rangeEdgePosition >= options.minStructureEdgePosition
      : cleanliness.rangeEdgePosition <= 1 - options.minStructureEdgePosition;
    if (!structureIsValid) {
      reasons.push('structure_midrange');
    }
    if (score.total < options.minLevelScore) {
      reasons.push('score_below_threshold');
    }

    if (reasons.length > 0) {
      rejected.push({
        id,
        kind,
        touches,
        zone,
        cleanliness,
        score,
        reasons,
      });
      continue;
    }

    levels.push({
      id,
      version: 2,
      symbol,
      timeframe,
      kind,
      sourceKind: cluster.kind,
      zone,
      touches,
      touchesCount: touches.length,
      firstTouchAt: firstTouch.occurredAt,
      lastTouchAt: lastTouch.occurredAt,
      firstTouchCandleIndex: firstTouch.firstCandleIndex,
      lastTouchCandleIndex: lastTouch.lastCandleIndex,
      cleanliness,
      score,
    });
  }

  return {
    foundation,
    levels: levels.sort((left, right) =>
      right.score.total - left.score.total
      || right.lastTouchCandleIndex - left.lastTouchCandleIndex),
    rejected: rejected.sort((left, right) =>
      right.score.total - left.score.total),
  };
}
