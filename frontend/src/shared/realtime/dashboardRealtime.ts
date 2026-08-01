import {
  formatScannerPrice,
  formatScannerTradeTime,
  getScannerRealtimeConnectionLabel,
} from './scannerRealtime.js';
import type {
  RealtimeClientLifecycleState,
  RealtimeConnectionState,
  RealtimeSymbolSnapshot,
} from './realtimeClient';

export type DashboardRealtimeTone =
  | 'live'
  | 'pending'
  | 'error';

export interface DashboardRealtimeCoinSource {
  symbol: string;
  fallbackPrice: string | number;
  fallbackChange: string | number;
}

export interface DashboardRealtimeCoinView {
  symbol: string;
  isLive: boolean;
  priceValue: number | null;
  priceLabel: string;
  changePct: number | null;
  changeLabel: string;
  updatedAtLabel: string;
  sourceLabel: 'LIVE' | 'UNAVAILABLE';
}

export interface DashboardRealtimeView {
  coins: Readonly<
    Record<string, DashboardRealtimeCoinView>
  >;
  liveCount: number;
  totalCount: number;
  connectionLabel: string;
  connectionTone: DashboardRealtimeTone;
}

export function normalizeDashboardRealtimeSymbol(
  symbol: string,
): string {
  return symbol
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function formatDashboardChange(
  value: number,
): string {
  if (!Number.isFinite(value)) return '?';

  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function resolveCurrentPrice(
  snapshot: RealtimeSymbolSnapshot | undefined,
): number | null {
  if (!snapshot) return null;

  if (
    snapshot.lastTrade
    && Number.isFinite(snapshot.lastTrade.price)
  ) {
    return snapshot.lastTrade.price;
  }

  if (
    snapshot.bookTicker
    && Number.isFinite(snapshot.bookTicker.bidPrice)
    && Number.isFinite(snapshot.bookTicker.askPrice)
  ) {
    return (
      snapshot.bookTicker.bidPrice
      + snapshot.bookTicker.askPrice
    ) / 2;
  }

  return null;
}

function resolveStreamChangePct(
  snapshot: RealtimeSymbolSnapshot | undefined,
  currentPrice: number | null,
): number | null {
  if (!snapshot || currentPrice === null) return null;

  const validTrades = snapshot.recentTrades.filter(
    (trade) =>
      Number.isFinite(trade.price)
      && trade.price > 0,
  );

  if (validTrades.length < 2) return null;

  const baselinePrice = validTrades[0].price;

  return (
    (currentPrice - baselinePrice)
    / baselinePrice
  ) * 100;
}

function resolveUpdatedAt(
  snapshot: RealtimeSymbolSnapshot | undefined,
): string | null {
  if (!snapshot) return null;

  return snapshot.updatedAt
    ?? snapshot.lastTrade?.timestamp
    ?? snapshot.bookTicker?.updatedAt
    ?? null;
}

export function buildDashboardRealtimeCoinView(
  source: DashboardRealtimeCoinSource,
  snapshot: RealtimeSymbolSnapshot | undefined,
): DashboardRealtimeCoinView {
  const symbol = normalizeDashboardRealtimeSymbol(
    source.symbol,
  );

  const currentPrice = resolveCurrentPrice(snapshot);
  const isLive = currentPrice !== null;
  const priceValue = currentPrice;

  const changePct = isLive
    ? resolveStreamChangePct(snapshot, currentPrice)
    : null;

  const updatedAt = resolveUpdatedAt(snapshot);

  return {
    symbol,
    isLive,
    priceValue,
    priceLabel: isLive
      ? formatScannerPrice(currentPrice)
      : '—',
    changePct,
    changeLabel: isLive
      ? (
          changePct === null
            ? '\u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445'
            : formatDashboardChange(changePct)
        )
      : '\u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445',
    updatedAtLabel: updatedAt
      ? formatScannerTradeTime(updatedAt)
      : '\u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445',
    sourceLabel: isLive ? 'LIVE' : 'UNAVAILABLE',
  };
}

function getDashboardRealtimeTone(
  lifecycleState: RealtimeClientLifecycleState,
  backendState: RealtimeConnectionState | null,
): DashboardRealtimeTone {
  if (
    lifecycleState === 'open'
    && backendState === 'connected'
  ) {
    return 'live';
  }

  if (lifecycleState === 'error') return 'error';

  return 'pending';
}

export function buildDashboardRealtimeView(
  sources: readonly DashboardRealtimeCoinSource[],
  snapshots: Readonly<
    Record<string, RealtimeSymbolSnapshot>
  >,
  lifecycleState: RealtimeClientLifecycleState,
  backendState: RealtimeConnectionState | null,
): DashboardRealtimeView {
  const coins: Record<
    string,
    DashboardRealtimeCoinView
  > = {};

  for (const source of sources) {
    const symbol = normalizeDashboardRealtimeSymbol(
      source.symbol,
    );

    coins[symbol] = buildDashboardRealtimeCoinView(
      source,
      snapshots[symbol],
    );
  }

  const views = Object.values(coins);

  return {
    coins,
    liveCount: views.filter(
      (view) => view.isLive,
    ).length,
    totalCount: views.length,
    connectionLabel:
      getScannerRealtimeConnectionLabel(
        lifecycleState,
        backendState,
      ),
    connectionTone: getDashboardRealtimeTone(
      lifecycleState,
      backendState,
    ),
  };
}
