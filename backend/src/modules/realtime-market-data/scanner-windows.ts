export const MARKET_SCANNER_WINDOW_IDS = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '12h',
  '1d',
  '3d',
] as const;

export type MarketScannerWindowId =
  (typeof MARKET_SCANNER_WINDOW_IDS)[number];

export const DEFAULT_MARKET_SCANNER_WINDOW: MarketScannerWindowId =
  '1m';

export const MARKET_SCANNER_WINDOW_MS: Record<
  MarketScannerWindowId,
  number
> = {
  '1m': 60_000,
  '3m': 3 * 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '12h': 12 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
  '3d': 3 * 24 * 60 * 60_000,
};

export function isMarketScannerWindowId(
  value: string | null | undefined,
): value is MarketScannerWindowId {
  return value !== null
    && value !== undefined
    && MARKET_SCANNER_WINDOW_IDS.includes(
      value as MarketScannerWindowId,
    );
}

export function getMarketScannerWindowMs(
  windowId: MarketScannerWindowId,
): number {
  return MARKET_SCANNER_WINDOW_MS[windowId];
}
