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
  state:
    OrderBookDepthConnectionState;
  connectedAt:
    string
    | null;
  disconnectedAt:
    string
    | null;
  lastMessageAt:
    string
    | null;
  reconnectAttempts: number;
  subscribedSymbols: string[];
  streamCount: number;
  lastError:
    string
    | null;
}

export interface OrderBookDepthLevel {
  price: number;
  quantity: number;
  quoteValue: number;
}

export interface OrderBookDepthBucket {
  side:
    | 'bid'
    | 'ask';
  price: number;
  quantity: number;
  quoteValue: number;
  levelsCount: number;
}

export interface OrderBookDepthMetrics {
  symbol: string;
  synchronized: boolean;
  bestBid:
    number
    | null;
  bestAsk:
    number
    | null;
  midpoint:
    number
    | null;
  spread:
    number
    | null;
  spreadPct:
    number
    | null;
  depthRangePct: number;
  bidDepthQuote: number;
  askDepthQuote: number;
  totalDepthQuote: number;
  imbalancePct:
    number
    | null;
  updatedAt:
    string
    | null;
}

export interface OrderBookDepthRuntimeSnapshot {
  symbol: string;
  state:
    OrderBookDepthFreshnessState;
  synchronized: boolean;
  lastUpdateId:
    number
    | null;
  bids:
    OrderBookDepthLevel[];
  asks:
    OrderBookDepthLevel[];
  buckets: {
    bids:
      OrderBookDepthBucket[];
    asks:
      OrderBookDepthBucket[];
  } | null;
  metrics:
    OrderBookDepthMetrics;
  updatedAt:
    string
    | null;
  ageMs:
    number
    | null;
  staleAfterMs: number;
  lastError:
    string
    | null;
}

export type OrderBookDepthClientLifecycleState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'closed'
  | 'error';

export interface OrderBookDepthClientState {
  lifecycleState:
    OrderBookDepthClientLifecycleState;
  status:
    OrderBookDepthRuntimeStatus
    | null;
  snapshot:
    OrderBookDepthRuntimeSnapshot
    | null;
  error:
    Error
    | null;
}

export type OrderBookDepthClientListener =
  (
    state:
      OrderBookDepthClientState,
  ) => void;

export type OrderBookDepthEventSourceFactory =
  (
    url: string,
  ) => EventSource;

export interface OrderBookDepthClientOptions {
  baseUrl?: string;
  symbol: string;
  levelsLimit?: number;
  depthRangePct?: number;
  bucketSize?: number;
  maxBucketsPerSide?: number;
  eventSourceFactory?:
    OrderBookDepthEventSourceFactory;
}

export const ORDER_BOOK_DEPTH_STREAM_PATH =
  '/api/v1/market/order-book/stream';

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,20}$/u;

const EVENT_SOURCE_CONNECTING =
  0;

function normalizeSymbol(
  value: string,
): string {
  const symbol =
    value
      .trim()
      .toUpperCase();

  if (
    !SYMBOL_PATTERN.test(
      symbol,
    )
  ) {
    throw new Error(
      `Invalid order book symbol: ${value}`,
    );
  }

  return symbol;
}

function normalizeInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  const resolved =
    value
    ?? fallback;

  if (
    !Number.isSafeInteger(
      resolved,
    )
    || resolved < min
    || resolved > max
  ) {
    throw new Error(
      `${name} must be an integer between ${min} and ${max}`,
    );
  }

  return resolved;
}

function normalizeNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  const resolved =
    value
    ?? fallback;

  if (
    !Number.isFinite(
      resolved,
    )
    || resolved < min
    || resolved > max
  ) {
    throw new Error(
      `${name} must be between ${min} and ${max}`,
    );
  }

  return resolved;
}

function normalizeOptionalNumber(
  value: number | undefined,
  min: number,
  max: number,
  name: string,
): number | undefined {
  if (
    value === undefined
  ) {
    return undefined;
  }

  if (
    !Number.isFinite(
      value,
    )
    || value < min
    || value > max
  ) {
    throw new Error(
      `${name} must be between ${min} and ${max}`,
    );
  }

  return value;
}

export function buildOrderBookDepthStreamUrl(
  options:
    Omit<
      OrderBookDepthClientOptions,
      'eventSourceFactory'
    >,
): string {
  const baseUrl =
    options.baseUrl
      ?.trim()
      .replace(
        /\/+$/u,
        '',
      )
    ?? '';

  const symbol =
    normalizeSymbol(
      options.symbol,
    );

  const levelsLimit =
    normalizeInteger(
      options.levelsLimit,
      40,
      1,
      1_000,
      'levelsLimit',
    );

  const depthRangePct =
    normalizeNumber(
      options.depthRangePct,
      0.2,
      0.01,
      5,
      'depthRangePct',
    );

  const bucketSize =
    normalizeOptionalNumber(
      options.bucketSize,
      0.00000001,
      1_000_000_000,
      'bucketSize',
    );

  const maxBucketsPerSide =
    normalizeInteger(
      options.maxBucketsPerSide,
      20,
      1,
      500,
      'maxBucketsPerSide',
    );

  const query =
    new URLSearchParams({
      symbol,
      levels:
        String(
          levelsLimit,
        ),
      depthRangePct:
        String(
          depthRangePct,
        ),
      maxBuckets:
        String(
          maxBucketsPerSide,
        ),
    });

  if (
    bucketSize
    !== undefined
  ) {
    query.set(
      'bucketSize',
      String(
        bucketSize,
      ),
    );
  }

  return (
    baseUrl
    + ORDER_BOOK_DEPTH_STREAM_PATH
    + '?'
    + query.toString()
  );
}

function defaultEventSourceFactory(
  url: string,
): EventSource {
  return new EventSource(
    url,
  );
}

function cloneStatus(
  status:
    OrderBookDepthRuntimeStatus
    | null,
): OrderBookDepthRuntimeStatus | null {
  return status
    ? {
        ...status,
        subscribedSymbols: [
          ...status.subscribedSymbols,
        ],
      }
    : null;
}

function cloneSnapshot(
  snapshot:
    OrderBookDepthRuntimeSnapshot
    | null,
): OrderBookDepthRuntimeSnapshot | null {
  if (!snapshot) {
    return null;
  }

  return {
    ...snapshot,
    bids:
      snapshot.bids.map(
        (level) => ({
          ...level,
        }),
      ),
    asks:
      snapshot.asks.map(
        (level) => ({
          ...level,
        }),
      ),
    buckets:
      snapshot.buckets
        ? {
            bids:
              snapshot.buckets.bids.map(
                (bucket) => ({
                  ...bucket,
                }),
              ),
            asks:
              snapshot.buckets.asks.map(
                (bucket) => ({
                  ...bucket,
                }),
              ),
          }
        : null,
    metrics: {
      ...snapshot.metrics,
    },
  };
}

function toError(
  error: unknown,
  fallbackMessage: string,
): Error {
  return error
    instanceof Error
      ? error
      : new Error(
          fallbackMessage,
        );
}

export class OrderBookDepthClient {
  private readonly url: string;
  private readonly eventSourceFactory:
    OrderBookDepthEventSourceFactory;

  private readonly listeners =
    new Set<
      OrderBookDepthClientListener
    >();

  private source:
    EventSource
    | null = null;

  private detachSourceListeners:
    (() => void)
    | null = null;

  private lifecycleState:
    OrderBookDepthClientLifecycleState =
      'idle';

  private status:
    OrderBookDepthRuntimeStatus
    | null = null;

  private snapshot:
    OrderBookDepthRuntimeSnapshot
    | null = null;

  private error:
    Error
    | null = null;

  constructor(
    options:
      OrderBookDepthClientOptions,
  ) {
    this.url =
      buildOrderBookDepthStreamUrl(
        options,
      );

    this.eventSourceFactory =
      options.eventSourceFactory
      ?? defaultEventSourceFactory;
  }

  connect(): void {
    if (
      this.source
      !== null
    ) {
      return;
    }

    this.setState(
      'connecting',
      null,
    );

    let source:
      EventSource;

    try {
      source =
        this.eventSourceFactory(
          this.url,
        );
    } catch (
      error: unknown
    ) {
      this.setState(
        'error',
        toError(
          error,
          'Failed to create order book connection',
        ),
      );

      return;
    }

    this.source =
      source;

    const handleOpen =
      () => {
        if (
          this.source
          !== source
        ) {
          return;
        }

        this.setState(
          'open',
          null,
        );
      };

    const handleError =
      () => {
        if (
          this.source
          !== source
        ) {
          return;
        }

        const nextState:
          OrderBookDepthClientLifecycleState =
            source.readyState
              === EVENT_SOURCE_CONNECTING
              ? 'reconnecting'
              : 'error';

        this.setState(
          nextState,
          new Error(
            'Order book connection interrupted',
          ),
        );
      };

    const handleStatus =
      (
        event: Event,
      ) => {
        const payload =
          this.parsePayload<
            OrderBookDepthRuntimeStatus
          >(
            event,
            'status',
          );

        if (
          payload === null
        ) {
          return;
        }

        this.status =
          cloneStatus(
            payload,
          );

        this.lifecycleState = 'open';
        this.error =
          null;

        this.notify();
      };

    const handleSnapshot =
      (
        event: Event,
      ) => {
        const payload =
          this.parsePayload<
            OrderBookDepthRuntimeSnapshot
          >(
            event,
            'snapshot',
          );

        if (
          payload === null
        ) {
          return;
        }

        this.snapshot =
          cloneSnapshot(
            payload,
          );

        this.lifecycleState = 'open';
        this.error =
          null;

        this.notify();
      };

    source.addEventListener(
      'open',
      handleOpen,
    );

    source.addEventListener(
      'error',
      handleError,
    );

    source.addEventListener(
      'status',
      handleStatus,
    );

    source.addEventListener(
      'snapshot',
      handleSnapshot,
    );

    this.detachSourceListeners =
      () => {
        source.removeEventListener(
          'open',
          handleOpen,
        );

        source.removeEventListener(
          'error',
          handleError,
        );

        source.removeEventListener(
          'status',
          handleStatus,
        );

        source.removeEventListener(
          'snapshot',
          handleSnapshot,
        );
      };
  }

  reconnect(): void {
    this.disconnectSource();
    this.connect();
  }

  close(): void {
    this.disconnectSource();

    this.setState(
      'closed',
      null,
    );
  }

  subscribe(
    listener:
      OrderBookDepthClientListener,
  ): () => void {
    this.listeners.add(
      listener,
    );

    listener(
      this.getState(),
    );

    return () => {
      this.listeners.delete(
        listener,
      );
    };
  }

  getState():
    OrderBookDepthClientState {
    return {
      lifecycleState:
        this.lifecycleState,
      status:
        cloneStatus(
          this.status,
        ),
      snapshot:
        cloneSnapshot(
          this.snapshot,
        ),
      error:
        this.error,
    };
  }

  private disconnectSource():
    void {
    this.detachSourceListeners?.();
    this.detachSourceListeners =
      null;

    this.source?.close();
    this.source =
      null;
  }

  private parsePayload<T>(
    event: Event,
    eventName: string,
  ): T | null {
    const data =
      (
        event as
          MessageEvent<string>
      ).data;

    if (
      typeof data
      !== 'string'
    ) {
      this.setState(
        this.lifecycleState,
        new Error(
          `Order book ${eventName} event has no data`,
        ),
      );

      return null;
    }

    try {
      return JSON.parse(
        data,
      ) as T;
    } catch (
      error: unknown
    ) {
      this.setState(
        this.lifecycleState,
        toError(
          error,
          `Failed to parse order book ${eventName} event`,
        ),
      );

      return null;
    }
  }

  private setState(
    lifecycleState:
      OrderBookDepthClientLifecycleState,
    error:
      Error
      | null,
  ): void {
    this.lifecycleState =
      lifecycleState;

    this.error =
      error;

    this.notify();
  }

  private notify(): void {
    const state =
      this.getState();

    for (
      const listener
      of this.listeners
    ) {
      listener(
        state,
      );
    }
  }
}
