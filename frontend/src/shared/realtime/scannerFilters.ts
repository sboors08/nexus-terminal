export const SCANNER_SORT_KEYS = [
  'activity',
  'quoteVolume',
  'tradesCount',
  'speed',
  'volatility',
  'liquidity',
  'btcCorrelation',
  'relativeStrength',
] as const;

export type ScannerSortKey =
  (typeof SCANNER_SORT_KEYS)[number];

export type ScannerSortDirection =
  | 'asc'
  | 'desc';

export interface ScannerFilterState {
  query: string;
  onlyLive: boolean;
  minActivityScore: number | null;
  minQuoteVolume: number | null;
  minTradesCount: number | null;
  minTradesPerMinute: number | null;
  minVolatilityPct: number | null;
  minLiquidityScore: number | null;
  minBtcCorrelation: number | null;
  minRelativeStrengthPct: number | null;
  sortBy: ScannerSortKey;
  sortDirection: ScannerSortDirection;
}

export interface ScannerFilterableMetricView {
  symbol: string;
  isLive: boolean;
  activityScore: number | null;
  quoteVolumeValue: number | null;
  tradesCountValue: number | null;
  tradesPerMinuteValue: number | null;
  volatilityPct: number | null;
  liquidityScore: number | null;
  btcCorrelation: number | null;
  relativeStrengthPct: number | null;
}

export interface ScannerFilterableItem {
  view: ScannerFilterableMetricView;
}

export const DEFAULT_SCANNER_FILTER_STATE:
ScannerFilterState = {
  query: '',
  onlyLive: false,
  minActivityScore: null,
  minQuoteVolume: null,
  minTradesCount: null,
  minTradesPerMinute: null,
  minVolatilityPct: null,
  minLiquidityScore: null,
  minBtcCorrelation: null,
  minRelativeStrengthPct: null,
  sortBy: 'activity',
  sortDirection: 'desc',
};

export function createDefaultScannerFilterState():
ScannerFilterState {
  return {
    ...DEFAULT_SCANNER_FILTER_STATE,
  };
}

function normalizeScannerSearchValue(
  value: string,
): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function passesMinimum(
  value: number | null,
  minimum: number | null,
): boolean {
  if (minimum === null) {
    return true;
  }

  return (
    value !== null
    && Number.isFinite(value)
    && value >= minimum
  );
}

function getScannerSortValue(
  view: ScannerFilterableMetricView,
  sortBy: ScannerSortKey,
): number | null {
  switch (sortBy) {
    case 'activity':
      return view.activityScore;

    case 'quoteVolume':
      return view.quoteVolumeValue;

    case 'tradesCount':
      return view.tradesCountValue;

    case 'speed':
      return view.tradesPerMinuteValue;

    case 'volatility':
      return view.volatilityPct;

    case 'liquidity':
      return view.liquidityScore;

    case 'btcCorrelation':
      return view.btcCorrelation;

    case 'relativeStrength':
      return view.relativeStrengthPct;
  }
}

export function countActiveScannerFilters(
  state: ScannerFilterState,
): number {
  let count = 0;

  if (
    normalizeScannerSearchValue(
      state.query,
    ).length > 0
  ) {
    count += 1;
  }

  if (state.onlyLive) {
    count += 1;
  }

  const minimums = [
    state.minActivityScore,
    state.minQuoteVolume,
    state.minTradesCount,
    state.minTradesPerMinute,
    state.minVolatilityPct,
    state.minLiquidityScore,
    state.minBtcCorrelation,
    state.minRelativeStrengthPct,
  ];

  count += minimums.filter(
    (value) => value !== null,
  ).length;

  return count;
}

export function hasActiveScannerFilters(
  state: ScannerFilterState,
): boolean {
  return countActiveScannerFilters(state) > 0;
}

export function filterAndSortScannerRows<
  T extends ScannerFilterableItem,
>(
  rows: readonly T[],
  state: ScannerFilterState,
): T[] {
  const normalizedQuery =
    normalizeScannerSearchValue(
      state.query,
    );

  return rows
    .filter(({ view }) => {
      if (
        normalizedQuery
        && !normalizeScannerSearchValue(
          view.symbol,
        ).includes(normalizedQuery)
      ) {
        return false;
      }

      if (
        state.onlyLive
        && !view.isLive
      ) {
        return false;
      }

      return (
        passesMinimum(
          view.activityScore,
          state.minActivityScore,
        )
        && passesMinimum(
          view.quoteVolumeValue,
          state.minQuoteVolume,
        )
        && passesMinimum(
          view.tradesCountValue,
          state.minTradesCount,
        )
        && passesMinimum(
          view.tradesPerMinuteValue,
          state.minTradesPerMinute,
        )
        && passesMinimum(
          view.volatilityPct,
          state.minVolatilityPct,
        )
        && passesMinimum(
          view.liquidityScore,
          state.minLiquidityScore,
        )
        && passesMinimum(
          view.btcCorrelation,
          state.minBtcCorrelation,
        )
        && passesMinimum(
          view.relativeStrengthPct,
          state.minRelativeStrengthPct,
        )
      );
    })
    .map((row, originalIndex) => ({
      row,
      originalIndex,
      sortValue:
        getScannerSortValue(
          row.view,
          state.sortBy,
        ),
    }))
    .sort((left, right) => {
      if (
        left.sortValue === null
        && right.sortValue === null
      ) {
        return (
          left.originalIndex
          - right.originalIndex
        );
      }

      if (left.sortValue === null) {
        return 1;
      }

      if (right.sortValue === null) {
        return -1;
      }

      const difference =
        left.sortValue
        - right.sortValue;

      if (difference === 0) {
        return (
          left.originalIndex
          - right.originalIndex
        );
      }

      return state.sortDirection === 'asc'
        ? difference
        : -difference;
    })
    .map(({ row }) => row);
}