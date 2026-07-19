import {
  buildScannerRealtimeMarketView,
  formatScannerPrice,
  getScannerRealtimeConnectionLabel,
} from './scannerRealtime.js';
import type {
  RealtimeClientLifecycleState,
  RealtimeConnectionState,
  RealtimeSymbolSnapshot,
} from './realtimeClient';

export type WorkspaceRealtimeTone =
  | 'live'
  | 'pending'
  | 'error';

export type WorkspacePriceRangePosition =
  | 'inside'
  | 'above'
  | 'below'
  | 'unknown';

export interface WorkspaceRealtimeCandle {
  high: number;
  low: number;
}

export interface WorkspaceRealtimeView {
  isLive: boolean;
  priceValue: number | null;
  priceLabel: string;
  priceY: number;
  axisLabels: string[];
  rangePosition: WorkspacePriceRangePosition;
  updatedAtLabel: string;
  connectionLabel: string;
  connectionTone: WorkspaceRealtimeTone;
}

const CHART_TOP = 24;
const CHART_BOTTOM = 354;
const AXIS_STEPS = 4;

function parseFallbackPrice(value: string): number | null {
  const normalized = value
    .replace(/[\s\u00A0]/g, '')
    .replace(',', '.');

  const result = Number(normalized);

  return Number.isFinite(result) && result > 0
    ? result
    : null;
}

function getCurrentPrice(
  snapshot: RealtimeSymbolSnapshot | undefined,
): number | null {
  if (snapshot?.lastTrade) {
    return snapshot.lastTrade.price;
  }

  if (snapshot?.bookTicker) {
    return (
      snapshot.bookTicker.bidPrice
      + snapshot.bookTicker.askPrice
    ) / 2;
  }

  return null;
}

function getPriceRange(
  candles: readonly WorkspaceRealtimeCandle[],
  fallbackPrice: number | null,
): { minimum: number; maximum: number } | null {
  const lows = candles
    .map((candle) => candle.low)
    .filter(Number.isFinite);

  const highs = candles
    .map((candle) => candle.high)
    .filter(Number.isFinite);

  if (lows.length > 0 && highs.length > 0) {
    const minimum = Math.min(...lows);
    const maximum = Math.max(...highs);

    if (maximum > minimum) {
      return { minimum, maximum };
    }
  }

  if (fallbackPrice !== null) {
    const padding = Math.max(
      fallbackPrice * 0.01,
      0.00000001,
    );

    return {
      minimum: fallbackPrice - padding,
      maximum: fallbackPrice + padding,
    };
  }

  return null;
}

function getRangePosition(
  price: number | null,
  range: { minimum: number; maximum: number } | null,
): WorkspacePriceRangePosition {
  if (price === null || range === null) return 'unknown';
  if (price > range.maximum) return 'above';
  if (price < range.minimum) return 'below';
  return 'inside';
}

function getPriceY(
  price: number | null,
  range: { minimum: number; maximum: number } | null,
): number {
  if (price === null || range === null) {
    return (CHART_TOP + CHART_BOTTOM) / 2;
  }

  const ratio =
    (range.maximum - price)
    / (range.maximum - range.minimum);

  const rawY =
    CHART_TOP
    + ratio * (CHART_BOTTOM - CHART_TOP);

  const clampedY = Math.min(
    CHART_BOTTOM,
    Math.max(CHART_TOP, rawY),
  );

  return Number(clampedY.toFixed(1));
}

function buildAxisLabels(
  range: { minimum: number; maximum: number } | null,
): string[] {
  if (range === null) {
    return ['?', '?', '?', '?', '?'];
  }

  const step =
    (range.maximum - range.minimum) / AXIS_STEPS;

  return Array.from(
    { length: AXIS_STEPS + 1 },
    (_, index) => formatScannerPrice(
      range.maximum - step * index,
    ),
  );
}

export function buildWorkspaceRealtimeView(
  snapshot: RealtimeSymbolSnapshot | undefined,
  fallbackPrice: string,
  candles: readonly WorkspaceRealtimeCandle[],
  lifecycleState: RealtimeClientLifecycleState,
  backendState: RealtimeConnectionState | null,
): WorkspaceRealtimeView {
  const market = buildScannerRealtimeMarketView(
    snapshot,
    fallbackPrice,
  );

  const fallbackPriceValue =
    parseFallbackPrice(fallbackPrice);

  const livePriceValue = getCurrentPrice(snapshot);

  const priceValue =
    livePriceValue ?? fallbackPriceValue;

  const range = getPriceRange(
    candles,
    fallbackPriceValue,
  );

  const connectionTone: WorkspaceRealtimeTone =
    lifecycleState === 'open'
      && backendState === 'connected'
      ? 'live'
      : lifecycleState === 'error'
        ? 'error'
        : 'pending';

  return {
    isLive: market.isLive,
    priceValue,
    priceLabel: market.priceLabel,
    priceY: getPriceY(priceValue, range),
    axisLabels: buildAxisLabels(range),
    rangePosition: getRangePosition(priceValue, range),
    updatedAtLabel: market.updatedAtLabel,
    connectionLabel:
      getScannerRealtimeConnectionLabel(
        lifecycleState,
        backendState,
      ),
    connectionTone,
  };
}
