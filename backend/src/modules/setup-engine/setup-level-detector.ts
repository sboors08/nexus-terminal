import type {
  DetectedSetupLevel,
  SetupLevelDetectorCandle,
  SetupLevelDetectorOptions,
  SetupLevelKind,
  SetupLevelTouch,
} from './setup-level-detector.types.js';

export const DEFAULT_SETUP_LEVEL_DETECTOR_OPTIONS:
  SetupLevelDetectorOptions = {
    pivotWindow: 2,
    minTouches: 2,
    minTouchSpacingCandles: 3,
    maxDistancePct: 0.2,
    zonePaddingPct: 0.05,
  };

interface LevelTouchCandidate
  extends SetupLevelTouch {
  kind: SetupLevelKind;
}

interface MutableLevelCluster {
  kind: SetupLevelKind;
  touches: SetupLevelTouch[];
  totalPrice: number;
  minPrice: number;
  maxPrice: number;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

function round(
  value: number,
  digits = 8,
): number {
  const factor =
    10 ** digits;

  return Math.round(
    value * factor,
  ) / factor;
}

function normalizeSymbol(
  value: string,
): string {
  const symbol =
    value.trim().toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new Error(
      `Invalid Setup Level Detector symbol: ${value}`,
    );
  }

  return symbol;
}

function normalizeTimeframe(
  value: string,
): string {
  const timeframe =
    value.trim();

  if (timeframe.length === 0) {
    throw new Error(
      'Setup Level Detector timeframe cannot be empty',
    );
  }

  return timeframe;
}

function validateOptions(
  options: SetupLevelDetectorOptions,
): void {
  const positiveIntegers = [
    options.pivotWindow,
    options.minTouches,
    options.minTouchSpacingCandles,
  ];

  if (
    positiveIntegers.some(
      (value) =>
        !Number.isInteger(value)
        || value <= 0,
    )
  ) {
    throw new Error(
      'Setup Level Detector integer options must be positive',
    );
  }

  if (options.minTouches < 2) {
    throw new Error(
      'Setup Level Detector requires at least two touches',
    );
  }

  if (
    !Number.isFinite(
      options.maxDistancePct,
    )
    || options.maxDistancePct <= 0
  ) {
    throw new Error(
      'Setup Level Detector maximum distance must be positive',
    );
  }

  if (
    !Number.isFinite(
      options.zonePaddingPct,
    )
    || options.zonePaddingPct < 0
  ) {
    throw new Error(
      'Setup Level Detector zone padding must be non-negative',
    );
  }
}

function validateCandle(
  candle: SetupLevelDetectorCandle,
): void {
  const prices = [
    candle.open,
    candle.high,
    candle.low,
    candle.close,
  ];

  if (
    prices.some(
      (value) =>
        !Number.isFinite(value)
        || value <= 0,
    )
  ) {
    throw new Error(
      'Setup Level Detector candle prices must be positive',
    );
  }

  if (
    candle.high
      < Math.max(
        candle.open,
        candle.close,
      )
    || candle.low
      > Math.min(
        candle.open,
        candle.close,
      )
    || candle.high < candle.low
  ) {
    throw new Error(
      'Invalid Setup Level Detector OHLC values',
    );
  }

  const openTime =
    Date.parse(candle.openTime);

  const closeTime =
    Date.parse(candle.closeTime);

  if (
    !Number.isFinite(openTime)
    || !Number.isFinite(closeTime)
    || closeTime < openTime
  ) {
    throw new Error(
      'Invalid Setup Level Detector candle timestamp',
    );
  }
}

function calculateDistancePct(
  left: number,
  right: number,
): number {
  return (
    Math.abs(
      left - right,
    )
    / right
  ) * 100;
}

function buildTouchCandidates(
  candles:
    readonly SetupLevelDetectorCandle[],
  options: SetupLevelDetectorOptions,
): LevelTouchCandidate[] {
  const candidates:
    LevelTouchCandidate[] = [];

  for (
    let index = options.pivotWindow;
    index
      < candles.length
        - options.pivotWindow;
    index += 1
  ) {
    const candle =
      candles[index];

    if (!candle) {
      continue;
    }

    const neighbours = [
      ...candles.slice(
        index - options.pivotWindow,
        index,
      ),
      ...candles.slice(
        index + 1,
        index
          + options.pivotWindow
          + 1,
      ),
    ];

    const isSupport =
      neighbours.every(
        (item) =>
          item.low >= candle.low,
      )
      && neighbours.some(
        (item) =>
          item.low > candle.low,
      );

    const isResistance =
      neighbours.every(
        (item) =>
          item.high <= candle.high,
      )
      && neighbours.some(
        (item) =>
          item.high < candle.high,
      );

    if (isSupport) {
      candidates.push({
        kind: 'support',
        candleIndex: index,
        price: candle.low,
        occurredAt: candle.closeTime,
      });
    }

    if (isResistance) {
      candidates.push({
        kind: 'resistance',
        candleIndex: index,
        price: candle.high,
        occurredAt: candle.closeTime,
      });
    }
  }

  return candidates;
}

function addTouchToClusters(
  clusters: MutableLevelCluster[],
  candidate: LevelTouchCandidate,
  options: SetupLevelDetectorOptions,
): void {
  const nearbyClusters =
    clusters
      .filter(
        (cluster) => {
          if (
            cluster.kind
              !== candidate.kind
          ) {
            return false;
          }

          const center =
            cluster.totalPrice
            / cluster.touches.length;

          return calculateDistancePct(
            candidate.price,
            center,
          ) <= options.maxDistancePct;
        },
      )
      .sort(
        (left, right) => {
          const leftCenter =
            left.totalPrice
            / left.touches.length;

          const rightCenter =
            right.totalPrice
            / right.touches.length;

          return calculateDistancePct(
            candidate.price,
            leftCenter,
          )
          - calculateDistancePct(
            candidate.price,
            rightCenter,
          );
        },
      );

  const eligibleCluster =
    nearbyClusters.find(
      (cluster) => {
        const lastTouch =
          cluster.touches.at(-1);

        return (
          !lastTouch
          || candidate.candleIndex
            - lastTouch.candleIndex
            >= options
              .minTouchSpacingCandles
        );
      },
    );

  if (eligibleCluster) {
    eligibleCluster.touches.push({
      candleIndex:
        candidate.candleIndex,
      price: candidate.price,
      occurredAt:
        candidate.occurredAt,
    });

    eligibleCluster.totalPrice +=
      candidate.price;

    eligibleCluster.minPrice =
      Math.min(
        eligibleCluster.minPrice,
        candidate.price,
      );

    eligibleCluster.maxPrice =
      Math.max(
        eligibleCluster.maxPrice,
        candidate.price,
      );

    return;
  }

  if (nearbyClusters.length > 0) {
    return;
  }

  clusters.push({
    kind: candidate.kind,
    touches: [
      {
        candleIndex:
          candidate.candleIndex,
        price: candidate.price,
        occurredAt:
          candidate.occurredAt,
      },
    ],
    totalPrice: candidate.price,
    minPrice: candidate.price,
    maxPrice: candidate.price,
  });
}

function buildDetectedLevel(
  symbol: string,
  timeframe: string,
  cluster: MutableLevelCluster,
  options: SetupLevelDetectorOptions,
): DetectedSetupLevel {
  const firstTouch =
    cluster.touches[0];

  const lastTouch =
    cluster.touches.at(-1);

  const confirmationTouch =
    cluster.touches[
      options.minTouches - 1
    ];

  if (
    !firstTouch
    || !lastTouch
    || !confirmationTouch
  ) {
    throw new Error(
      'Setup Level Detector cluster is incomplete',
    );
  }

  const centerPrice =
    cluster.totalPrice
    / cluster.touches.length;

  const paddingRatio =
    options.zonePaddingPct
    / 100;

  const formationDurationSec =
    Math.max(
      0,
      (
        Date.parse(
          confirmationTouch.occurredAt,
        )
        - Date.parse(
          firstTouch.occurredAt,
        )
      ) / 1_000,
    );

  return {
    id:
      `${symbol}-${timeframe}-${cluster.kind}-${Date.parse(firstTouch.occurredAt)}`,
    symbol,
    timeframe,
    kind: cluster.kind,
    zoneLow:
      round(
        cluster.minPrice
        * (1 - paddingRatio),
      ),
    zoneHigh:
      round(
        cluster.maxPrice
        * (1 + paddingRatio),
      ),
    centerPrice:
      round(centerPrice),
    touchesCount:
      cluster.touches.length,
    firstTouchAt:
      firstTouch.occurredAt,
    lastTouchAt:
      lastTouch.occurredAt,
    formedAt:
      confirmationTouch.occurredAt,
    confirmedAt:
      confirmationTouch.occurredAt,
    formationDurationSec:
      round(
        formationDurationSec,
        4,
      ),
    touches:
      cluster.touches.map(
        (touch) => ({
          ...touch,
        }),
      ),
  };
}

export function detectSetupLevels(
  symbolValue: string,
  timeframeValue: string,
  candles:
    readonly SetupLevelDetectorCandle[],
  options:
    SetupLevelDetectorOptions =
      DEFAULT_SETUP_LEVEL_DETECTOR_OPTIONS,
): DetectedSetupLevel[] {
  const symbol =
    normalizeSymbol(symbolValue);

  const timeframe =
    normalizeTimeframe(
      timeframeValue,
    );

  validateOptions(options);

  for (const candle of candles) {
    validateCandle(candle);
  }

  const closedCandles =
    candles.filter(
      (candle) =>
        candle.isClosed,
    );

  const minimumCandleCount =
    options.pivotWindow
      * 2
    + 1;

  if (
    closedCandles.length
    < minimumCandleCount
  ) {
    return [];
  }

  const candidates =
    buildTouchCandidates(
      closedCandles,
      options,
    );

  const clusters:
    MutableLevelCluster[] = [];

  for (const candidate of candidates) {
    addTouchToClusters(
      clusters,
      candidate,
      options,
    );
  }

  return clusters
    .filter(
      (cluster) =>
        cluster.touches.length
        >= options.minTouches,
    )
    .map(
      (cluster) =>
        buildDetectedLevel(
          symbol,
          timeframe,
          cluster,
          options,
        ),
    )
    .sort(
      (left, right) => {
        const touchesDifference =
          right.touchesCount
          - left.touchesCount;

        if (touchesDifference !== 0) {
          return touchesDifference;
        }

        return (
          Date.parse(right.lastTouchAt)
          - Date.parse(left.lastTouchAt)
        );
      },
    );
}
