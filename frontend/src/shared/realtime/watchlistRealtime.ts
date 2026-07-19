import {
  buildScannerRealtimeMarketView,
  getScannerRealtimeConnectionLabel,
} from './scannerRealtime.js';
import type {
  RealtimeClientLifecycleState,
  RealtimeConnectionState,
  RealtimeSymbolSnapshot,
} from './realtimeClient';

export type WatchlistRealtimeTone = 'live' | 'pending' | 'error';

export interface WatchlistRealtimeView {
  isLive: boolean;
  priceLabel: string;
  bidLabel: string;
  askLabel: string;
  spreadLabel: string;
  updatedAtLabel: string;
  connectionLabel: string;
  connectionTone: WatchlistRealtimeTone;
}

export function buildWatchlistRealtimeView(
  snapshot: RealtimeSymbolSnapshot | undefined,
  lifecycleState: RealtimeClientLifecycleState,
  backendState: RealtimeConnectionState | null,
): WatchlistRealtimeView {
  const market = buildScannerRealtimeMarketView(snapshot, '—');
  const connectionLabel = getScannerRealtimeConnectionLabel(
    lifecycleState,
    backendState,
  );

  const connectionTone: WatchlistRealtimeTone =
    lifecycleState === 'open' && backendState === 'connected'
      ? 'live'
      : lifecycleState === 'error'
        ? 'error'
        : 'pending';

  return {
    isLive: market.isLive,
    priceLabel: market.priceLabel,
    bidLabel: market.bidLabel,
    askLabel: market.askLabel,
    spreadLabel: market.spreadLabel,
    updatedAtLabel: market.updatedAtLabel,
    connectionLabel,
    connectionTone,
  };
}
