import {
  buildScannerRealtimeMarketView,
  getScannerRealtimeConnectionLabel,
} from './scannerRealtime.js';
import type {
  RealtimeClientLifecycleState,
  RealtimeConnectionState,
  RealtimeSymbolSnapshot,
} from './realtimeClient';

export type MarketRealtimeTone = 'live' | 'pending' | 'error';

export interface MarketRealtimeView {
  isLive: boolean;
  priceLabel: string;
  bidLabel: string;
  askLabel: string;
  spreadLabel: string;
  updatedAtLabel: string;
  connectionLabel: string;
  connectionTone: MarketRealtimeTone;
}

export function buildMarketRealtimeView(
  snapshot: RealtimeSymbolSnapshot | undefined,
  fallbackPrice: string,
  lifecycleState: RealtimeClientLifecycleState,
  backendState: RealtimeConnectionState | null,
): MarketRealtimeView {
  const market = buildScannerRealtimeMarketView(
    snapshot,
    fallbackPrice,
  );

  const connectionLabel = getScannerRealtimeConnectionLabel(
    lifecycleState,
    backendState,
  );

  const connectionTone: MarketRealtimeTone =
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
