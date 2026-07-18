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

export type RealtimeClientLifecycleState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'closed'
  | 'error';

export interface RealtimeClientState {
  lifecycleState: RealtimeClientLifecycleState;
  status: RealtimeConnectionStatus | null;
  snapshots: Readonly<Record<string, RealtimeSymbolSnapshot>>;
  error: Error | null;
}

export type RealtimeClientListener = (state: RealtimeClientState) => void;
export type RealtimeEventSourceFactory = (url: string) => EventSource;

export interface RealtimeMarketDataClientOptions {
  baseUrl?: string;
  symbol?: string;
  eventSourceFactory?: RealtimeEventSourceFactory;
}

export const REALTIME_STREAM_PATH = '/api/v1/market/realtime/stream';

const SYMBOL_PATTERN = /^[A-Z0-9]{5,20}$/;
const EVENT_SOURCE_CONNECTING = 0;

function normalizeSymbol(symbol: string | undefined): string | undefined {
  if (symbol === undefined) return undefined;

  const normalized = symbol.trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(normalized)) {
    throw new Error(`Invalid realtime symbol: ${symbol}`);
  }

  return normalized;
}

export function buildRealtimeStreamUrl(
  options: Pick<RealtimeMarketDataClientOptions, 'baseUrl' | 'symbol'> = {},
): string {
  const baseUrl = options.baseUrl?.trim().replace(/\/+$/, '') ?? '';
  const symbol = normalizeSymbol(options.symbol);
  const query = symbol ? `?symbol=${encodeURIComponent(symbol)}` : '';
  return `${baseUrl}${REALTIME_STREAM_PATH}${query}`;
}

function defaultEventSourceFactory(url: string): EventSource {
  return new EventSource(url);
}

export class RealtimeMarketDataClient {
  private readonly url: string;
  private readonly eventSourceFactory: RealtimeEventSourceFactory;
  private readonly listeners = new Set<RealtimeClientListener>();
  private readonly snapshots = new Map<string, RealtimeSymbolSnapshot>();
  private source: EventSource | null = null;
  private detachSourceListeners: (() => void) | null = null;
  private lifecycleState: RealtimeClientLifecycleState = 'idle';
  private status: RealtimeConnectionStatus | null = null;
  private error: Error | null = null;

  constructor(options: RealtimeMarketDataClientOptions = {}) {
    this.url = buildRealtimeStreamUrl(options);
    this.eventSourceFactory = options.eventSourceFactory ?? defaultEventSourceFactory;
  }

  connect(): void {
    if (this.source !== null) return;

    this.setState('connecting', null);

    let source: EventSource;
    try {
      source = this.eventSourceFactory(this.url);
    } catch (error: unknown) {
      this.setState('error', toError(error, 'Failed to create realtime connection'));
      return;
    }

    this.source = source;

    const handleOpen = () => {
      if (this.source !== source) return;
      this.setState('open', null);
    };

    const handleError = () => {
      if (this.source !== source) return;

      const lifecycleState = source.readyState === EVENT_SOURCE_CONNECTING
        ? 'reconnecting'
        : 'error';
      this.setState(lifecycleState, new Error('Realtime connection interrupted'));
    };

    const handleStatus = (event: Event) => {
      const payload = this.parsePayload<RealtimeConnectionStatus>(event, 'status');
      if (payload === null) return;
      this.status = payload;
      this.error = null;
      this.notify();
    };

    const handleSnapshot = (event: Event) => {
      const payload = this.parsePayload<RealtimeSymbolSnapshot>(event, 'snapshot');
      if (payload === null) return;
      this.snapshots.set(payload.symbol, payload);
      this.error = null;
      this.notify();
    };

    source.addEventListener('open', handleOpen);
    source.addEventListener('error', handleError);
    source.addEventListener('status', handleStatus);
    source.addEventListener('snapshot', handleSnapshot);

    this.detachSourceListeners = () => {
      source.removeEventListener('open', handleOpen);
      source.removeEventListener('error', handleError);
      source.removeEventListener('status', handleStatus);
      source.removeEventListener('snapshot', handleSnapshot);
    };
  }

  reconnect(): void {
    this.disconnectSource();
    this.connect();
  }

  close(): void {
    this.disconnectSource();
    this.setState('closed', null);
  }

  subscribe(listener: RealtimeClientListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());

    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): RealtimeClientState {
    return {
      lifecycleState: this.lifecycleState,
      status: this.status,
      snapshots: Object.fromEntries(this.snapshots),
      error: this.error,
    };
  }

  private disconnectSource(): void {
    this.detachSourceListeners?.();
    this.detachSourceListeners = null;
    this.source?.close();
    this.source = null;
  }

  private parsePayload<T>(event: Event, eventName: string): T | null {
    const data = (event as MessageEvent<string>).data;
    if (typeof data !== 'string') {
      this.setState(this.lifecycleState, new Error(`Realtime ${eventName} event has no data`));
      return null;
    }

    try {
      return JSON.parse(data) as T;
    } catch (error: unknown) {
      this.setState(
        this.lifecycleState,
        toError(error, `Failed to parse realtime ${eventName} event`),
      );
      return null;
    }
  }

  private setState(lifecycleState: RealtimeClientLifecycleState, error: Error | null): void {
    this.lifecycleState = lifecycleState;
    this.error = error;
    this.notify();
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

function toError(error: unknown, fallbackMessage: string): Error {
  return error instanceof Error ? error : new Error(fallbackMessage);
}
