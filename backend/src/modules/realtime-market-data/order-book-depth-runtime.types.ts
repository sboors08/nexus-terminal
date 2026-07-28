import type {
  OrderBookDepthBucket,
  OrderBookDepthLevel,
  OrderBookDepthMetrics,
} from './order-book-depth.types.js';

export type OrderBookDepthConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'stopped';

export type OrderBookDepthFreshnessState =
  | 'collecting'
  | 'live'
  | 'stale'
  | 'error';

export interface OrderBookDepthRuntimeStatus {
  state: OrderBookDepthConnectionState;
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastMessageAt: string | null;
  reconnectAttempts: number;
  subscribedSymbols: string[];
  streamCount: number;
  lastError: string | null;
}

export interface OrderBookDepthBuckets {
  bids: OrderBookDepthBucket[];
  asks: OrderBookDepthBucket[];
}

export interface OrderBookDepthRuntimeSnapshot {
  symbol: string;
  state: OrderBookDepthFreshnessState;
  synchronized: boolean;
  lastUpdateId: number | null;
  bids: OrderBookDepthLevel[];
  asks: OrderBookDepthLevel[];
  buckets: OrderBookDepthBuckets | null;
  metrics: OrderBookDepthMetrics;
  updatedAt: string | null;
  ageMs: number | null;
  staleAfterMs: number;
  lastError: string | null;
}

export interface GetOrderBookDepthSnapshotOptions {
  levelsLimit?: number;
  depthRangePct?: number;
  bucketSize?: number;
  maxBucketsPerSide?: number;
}

export type OrderBookDepthRuntimeEvent =
  | {
      type: 'status';
      status: OrderBookDepthRuntimeStatus;
      emittedAt: string;
    }
  | {
      type: 'snapshot';
      symbol: string;
      emittedAt: string;
    };

export type OrderBookDepthRuntimeListener =
  (event: OrderBookDepthRuntimeEvent) => void;

export interface OrderBookDepthRuntimeService {
  start(): void;
  stop(): void;
  getStatus(): OrderBookDepthRuntimeStatus;
  getSnapshot(
    symbol: string,
    options?: GetOrderBookDepthSnapshotOptions,
  ): OrderBookDepthRuntimeSnapshot | null;
  acquireSymbol(symbol: string): () => void;
  subscribe(
    listener: OrderBookDepthRuntimeListener,
    symbol?: string,
  ): () => void;
}
