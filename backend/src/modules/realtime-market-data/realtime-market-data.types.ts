import type { MarketScannerMetrics } from './market-scanner-metrics.js';
import type { MarketScannerWindowId } from './scanner-windows.js';

export type RealtimeConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'stopped';

export interface RealtimeConnectionStatus {
  state: RealtimeConnectionState;
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastMessageAt: string | null;
  reconnectAttempts: number;
  subscribedSymbols: string[];
  streamCount: number;
  lastError: string | null;
}

export interface RealtimeTrade {
  id: string;
  symbol: string;
  timestamp: string;
  price: number;
  quantity: number;
  quoteValue: number;
  tradesCount?: number;
  side: 'buy' | 'sell';
  isBuyerMaker: boolean;
}

export interface RealtimeBookTicker {
  symbol: string;
  bidPrice: number;
  bidQuantity: number;
  askPrice: number;
  askQuantity: number;
  spread: number;
  spreadPct: number;
  updatedAt: string;
}

export interface RealtimeSymbolSnapshot {
  symbol: string;
  lastTrade: RealtimeTrade | null;
  bookTicker: RealtimeBookTicker | null;
  recentTrades: RealtimeTrade[];
  updatedAt: string | null;
}

export type RealtimeMarketDataEvent =
  | {
    type: 'status';
    status: RealtimeConnectionStatus;
    emittedAt: string;
  }
  | {
    type: 'snapshot';
    snapshot: RealtimeSymbolSnapshot;
    emittedAt: string;
  };

export type RealtimeMarketDataListener = (event: RealtimeMarketDataEvent) => void;

export interface RealtimeMarketDataService {
  start(): void;
  stop(): void;
  getStatus(): RealtimeConnectionStatus;
  getSnapshots(symbol?: string): RealtimeSymbolSnapshot[];
  getScannerMetrics?(
    symbol?: string,
    scannerWindow?: MarketScannerWindowId,
  ): MarketScannerMetrics[];
  acquireSymbol(symbol: string): () => void;
  acquireSymbols?(symbols: readonly string[]): () => void;
  subscribe(listener: RealtimeMarketDataListener, symbol?: string): () => void;
}

export interface RealtimeSocketEvent {
  data?: unknown;
  code?: number;
  reason?: string;
}

export interface RealtimeWebSocket {
  addEventListener(
    type: 'open' | 'message' | 'error' | 'close',
    listener: (event: RealtimeSocketEvent) => void,
  ): void;
  close(code?: number, reason?: string): void;
}

export type RealtimeWebSocketFactory = (url: string) => RealtimeWebSocket;

export interface ReconnectScheduler {
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}
