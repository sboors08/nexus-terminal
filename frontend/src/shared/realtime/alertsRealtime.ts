import {
  buildScannerRealtimeMarketView,
  getScannerRealtimeConnectionLabel,
} from './scannerRealtime.js';
import type {
  RealtimeClientLifecycleState,
  RealtimeConnectionState,
  RealtimeSymbolSnapshot,
} from './realtimeClient';

export type AlertsRealtimeTone = 'live' | 'pending' | 'error';

export interface AlertsRealtimeView {
  isLive: boolean;
  currentPriceLabel: string;
  alertPriceLabel: string;
  moveSinceAlertPct: number | null;
  moveSinceAlertLabel: string;
  updatedAtLabel: string;
  connectionLabel: string;
  connectionTone: AlertsRealtimeTone;
}

function parseAlertPrice(value: string): number | null {
  const normalized = value
    .replace(/[\s\u00A0]/g, '')
    .replace(',', '.');

  const result = Number(normalized);

  return Number.isFinite(result) && result > 0 ? result : null;
}

function getCurrentPrice(
  snapshot: RealtimeSymbolSnapshot | undefined,
): number | null {
  if (snapshot?.lastTrade) return snapshot.lastTrade.price;

  if (snapshot?.bookTicker) {
    return (
      snapshot.bookTicker.bidPrice
      + snapshot.bookTicker.askPrice
    ) / 2;
  }

  return null;
}

function formatMoveSinceAlert(value: number | null): string {
  if (value === null) return '\u2014';

  const prefix = value > 0 ? '+' : '';

  return `${prefix}${value.toFixed(2)}%`;
}

export function buildAlertsRealtimeView(
  snapshot: RealtimeSymbolSnapshot | undefined,
  alertPrice: string,
  lifecycleState: RealtimeClientLifecycleState,
  backendState: RealtimeConnectionState | null,
): AlertsRealtimeView {
  const market = buildScannerRealtimeMarketView(
    snapshot,
    alertPrice,
  );

  const alertPriceValue = parseAlertPrice(alertPrice);
  const currentPrice = getCurrentPrice(snapshot);

  const moveSinceAlertPct =
    currentPrice !== null && alertPriceValue !== null
      ? ((currentPrice - alertPriceValue) / alertPriceValue) * 100
      : null;

  const connectionTone: AlertsRealtimeTone =
    lifecycleState === 'open' && backendState === 'connected'
      ? 'live'
      : lifecycleState === 'error'
        ? 'error'
        : 'pending';

  return {
    isLive: market.isLive,
    currentPriceLabel: market.priceLabel,
    alertPriceLabel: alertPrice,
    moveSinceAlertPct,
    moveSinceAlertLabel: formatMoveSinceAlert(moveSinceAlertPct),
    updatedAtLabel: market.updatedAtLabel,
    connectionLabel: getScannerRealtimeConnectionLabel(
      lifecycleState,
      backendState,
    ),
    connectionTone,
  };
}
