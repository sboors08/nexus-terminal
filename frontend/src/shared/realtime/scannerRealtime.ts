import type {
  RealtimeClientLifecycleState,
  RealtimeConnectionState,
  RealtimeSymbolSnapshot,
  RealtimeTrade,
} from './realtimeClient';

export interface ScannerRealtimeMarketView {
  isLive: boolean;
  priceLabel: string;
  bidLabel: string;
  askLabel: string;
  spreadLabel: string;
  updatedAtLabel: string;
  recentTrades: RealtimeTrade[];
}

function formatFixed(value: number, minimumFractionDigits: number, maximumFractionDigits: number): string {
  if (!Number.isFinite(value)) return '—';

  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  const [integerPart, initialFraction = ''] = absolute.toFixed(maximumFractionDigits).split('.');
  let fraction = initialFraction;

  while (fraction.length > minimumFractionDigits && fraction.endsWith('0')) {
    fraction = fraction.slice(0, -1);
  }

  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return fraction.length > 0
    ? `${sign}${groupedInteger}.${fraction}`
    : `${sign}${groupedInteger}`;
}

export function formatScannerPrice(value: number): string {
  const absolute = Math.abs(value);

  if (absolute >= 1_000) return formatFixed(value, 2, 2);
  if (absolute >= 1) return formatFixed(value, 2, 4);
  if (absolute >= 0.01) return formatFixed(value, 4, 6);
  return formatFixed(value, 6, 8);
}

export function formatScannerQuantity(value: number): string {
  const absolute = Math.abs(value);

  if (absolute >= 1_000) return formatFixed(value, 2, 2);
  if (absolute >= 1) return formatFixed(value, 2, 6);
  return formatFixed(value, 4, 8);
}

export function formatScannerTradeTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function buildScannerRealtimeMarketView(
  snapshot: RealtimeSymbolSnapshot | undefined,
  fallbackPrice: string,
): ScannerRealtimeMarketView {
  if (!snapshot) {
    return {
      isLive: false,
      priceLabel: fallbackPrice,
      bidLabel: '—',
      askLabel: '—',
      spreadLabel: '—',
      updatedAtLabel: 'ожидание данных',
      recentTrades: [],
    };
  }

  const bookTicker = snapshot.bookTicker;
  const midpoint = bookTicker
    ? (bookTicker.bidPrice + bookTicker.askPrice) / 2
    : null;
  const currentPrice = snapshot.lastTrade?.price ?? midpoint;
  const updatedAt = snapshot.updatedAt
    ?? snapshot.lastTrade?.timestamp
    ?? bookTicker?.updatedAt
    ?? null;

  return {
    isLive: currentPrice !== null || bookTicker !== null,
    priceLabel: currentPrice === null ? fallbackPrice : formatScannerPrice(currentPrice),
    bidLabel: bookTicker ? formatScannerPrice(bookTicker.bidPrice) : '—',
    askLabel: bookTicker ? formatScannerPrice(bookTicker.askPrice) : '—',
    spreadLabel: bookTicker
      ? `${formatScannerPrice(bookTicker.spread)} · ${bookTicker.spreadPct.toFixed(5)}%`
      : '—',
    updatedAtLabel: updatedAt ? formatScannerTradeTime(updatedAt) : 'ожидание данных',
    recentTrades: [...snapshot.recentTrades].slice(-6).reverse(),
  };
}

export function getScannerRealtimeConnectionLabel(
  lifecycleState: RealtimeClientLifecycleState,
  backendState: RealtimeConnectionState | null,
): string {
  if (lifecycleState === 'open' && backendState === 'connected') return 'Realtime подключён';
  if (lifecycleState === 'connecting') return 'Подключение realtime';
  if (lifecycleState === 'reconnecting') return 'Переподключение realtime';
  if (lifecycleState === 'error') return 'Ошибка realtime';
  if (lifecycleState === 'closed') return 'Realtime остановлен';
  if (backendState === 'reconnecting') return 'Binance переподключается';
  return 'Realtime готовится';
}
