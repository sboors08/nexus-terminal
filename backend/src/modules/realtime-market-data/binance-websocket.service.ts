import type {
  RealtimeBookTicker,
  RealtimeConnectionStatus,
  RealtimeMarketDataEvent,
  RealtimeMarketDataListener,
  RealtimeMarketDataService,
  RealtimeSocketEvent,
  RealtimeSymbolSnapshot,
  RealtimeTrade,
  RealtimeWebSocket,
  RealtimeWebSocketFactory,
  ReconnectScheduler,
} from './realtime-market-data.types.js';

interface BinanceWebSocketServiceOptions {
  baseUrl: string;
  symbols: string[];
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
  tradesBufferSize: number;
  socketFactory?: RealtimeWebSocketFactory;
  scheduler?: ReconnectScheduler;
  now?: () => Date;
}

interface CombinedStreamPayload {
  stream?: string;
  data?: unknown;
}

interface RealtimeSubscription {
  listener: RealtimeMarketDataListener;
  symbol?: string;
}

interface BinanceTradeEvent {
  E?: number;
  s?: string;
  t?: number;
  p?: string;
  q?: string;
  T?: number;
  m?: boolean;
}

interface BinanceBookTickerEvent {
  s?: string;
  b?: string;
  B?: string;
  a?: string;
  A?: string;
  E?: number;
}

const defaultScheduler: ReconnectScheduler = {
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function numberValue(value: string | number | undefined): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cloneTrade(trade: RealtimeTrade | null): RealtimeTrade | null {
  return trade ? { ...trade } : null;
}

function cloneSnapshot(snapshot: RealtimeSymbolSnapshot): RealtimeSymbolSnapshot {
  return {
    symbol: snapshot.symbol,
    lastTrade: cloneTrade(snapshot.lastTrade),
    bookTicker: snapshot.bookTicker ? { ...snapshot.bookTicker } : null,
    recentTrades: snapshot.recentTrades.map((trade) => ({ ...trade })),
    updatedAt: snapshot.updatedAt,
  };
}

export class BinanceWebSocketMarketDataService implements RealtimeMarketDataService {
  private readonly baseUrl: string;
  private readonly initialSymbols: Set<string>;
  private readonly activeSymbols = new Set<string>();
  private readonly dynamicSymbolReferences = new Map<string, number>();
  private readonly socketFactory: RealtimeWebSocketFactory;
  private readonly scheduler: ReconnectScheduler;
  private readonly now: () => Date;
  private readonly snapshots = new Map<string, RealtimeSymbolSnapshot>();
  private readonly subscriptions = new Set<RealtimeSubscription>();
  private socket: RealtimeWebSocket | null = null;
  private reconnectHandle: unknown = null;
  private generation = 0;
  private manuallyStopped = false;
  private status: RealtimeConnectionStatus;

  constructor(private readonly options: BinanceWebSocketServiceOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.initialSymbols = new Set(options.symbols.map((symbol) => symbol.toUpperCase()));
    for (const symbol of this.initialSymbols) this.activeSymbols.add(symbol);
    this.socketFactory = options.socketFactory ?? ((url) => new WebSocket(url) as unknown as RealtimeWebSocket);
    this.scheduler = options.scheduler ?? defaultScheduler;
    this.now = options.now ?? (() => new Date());

    for (const symbol of this.activeSymbols) {
      this.snapshots.set(symbol, {
        symbol,
        lastTrade: null,
        bookTicker: null,
        recentTrades: [],
        updatedAt: null,
      });
    }

    this.status = {
      state: 'idle',
      connectedAt: null,
      disconnectedAt: null,
      lastMessageAt: null,
      reconnectAttempts: 0,
      subscribedSymbols: this.getActiveSymbols(),
      streamCount: this.activeSymbols.size * 2,
      lastError: null,
    };
  }

  start(): void {
    if (this.status.state === 'connecting' || this.status.state === 'connected' || this.status.state === 'reconnecting') {
      return;
    }

    this.manuallyStopped = false;
    this.connect();
  }

  stop(): void {
    this.manuallyStopped = true;
    this.generation += 1;

    if (this.reconnectHandle !== null) {
      this.scheduler.cancel(this.reconnectHandle);
      this.reconnectHandle = null;
    }

    const socket = this.socket;
    this.socket = null;
    socket?.close(1000, 'NEXUS backend shutdown');

    this.status = {
      ...this.status,
      state: 'stopped',
      disconnectedAt: this.now().toISOString(),
    };
    this.emitStatus();
  }

  getStatus(): RealtimeConnectionStatus {
    return {
      ...this.status,
      subscribedSymbols: [...this.status.subscribedSymbols],
    };
  }

  getSnapshots(symbol?: string): RealtimeSymbolSnapshot[] {
    if (symbol) {
      const snapshot = this.snapshots.get(symbol.toUpperCase());
      return snapshot ? [cloneSnapshot(snapshot)] : [];
    }

    return this.getActiveSymbols()
      .map((item) => this.snapshots.get(item))
      .filter((snapshot): snapshot is RealtimeSymbolSnapshot => snapshot !== undefined)
      .map(cloneSnapshot);
  }

  acquireSymbol(symbol: string): () => void {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9]{5,20}$/.test(normalizedSymbol)) {
      throw new Error(`Invalid realtime symbol: ${symbol}`);
    }

    const currentReferences = this.dynamicSymbolReferences.get(normalizedSymbol) ?? 0;
    this.dynamicSymbolReferences.set(normalizedSymbol, currentReferences + 1);

    if (!this.activeSymbols.has(normalizedSymbol)) {
      this.activeSymbols.add(normalizedSymbol);
      this.snapshots.set(normalizedSymbol, {
        symbol: normalizedSymbol,
        lastTrade: null,
        bookTicker: null,
        recentTrades: [],
        updatedAt: null,
      });
      this.restartForSubscriptionChange();
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;

      const references = this.dynamicSymbolReferences.get(normalizedSymbol) ?? 0;
      if (references > 1) {
        this.dynamicSymbolReferences.set(normalizedSymbol, references - 1);
        return;
      }

      this.dynamicSymbolReferences.delete(normalizedSymbol);
      if (this.initialSymbols.has(normalizedSymbol)) return;

      this.activeSymbols.delete(normalizedSymbol);
      this.snapshots.delete(normalizedSymbol);
      this.restartForSubscriptionChange();
    };
  }

  subscribe(listener: RealtimeMarketDataListener, symbol?: string): () => void {
    const normalizedSymbol = symbol?.toUpperCase();
    const subscription: RealtimeSubscription = normalizedSymbol
      ? { listener, symbol: normalizedSymbol }
      : { listener };

    this.subscriptions.add(subscription);
    return () => {
      this.subscriptions.delete(subscription);
    };
  }

  private connect(): void {
    if (this.manuallyStopped) return;

    const generation = ++this.generation;
    this.status = {
      ...this.status,
      state: this.status.reconnectAttempts > 0 ? 'reconnecting' : 'connecting',
    };
    this.emitStatus();

    let socket: RealtimeWebSocket;
    try {
      socket = this.socketFactory(this.buildUrl());
    } catch (error) {
      this.status = {
        ...this.status,
        lastError: error instanceof Error ? error.message : 'Unable to create Binance WebSocket',
      };
      this.emitStatus();
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;
    socket.addEventListener('open', () => this.handleOpen(generation));
    socket.addEventListener('message', (event) => this.handleMessage(generation, event));
    socket.addEventListener('error', () => this.handleError(generation));
    socket.addEventListener('close', (event) => this.handleClose(generation, event));
  }

  private buildUrl(): string {
    const streams = this.getActiveSymbols().flatMap((symbol) => {
      const normalized = symbol.toLowerCase();
      return [`${normalized}@trade`, `${normalized}@bookTicker`];
    });

    return `${this.baseUrl}/stream?streams=${streams.join('/')}`;
  }

  private getActiveSymbols(): string[] {
    return [...this.activeSymbols];
  }

  private syncSubscriptionStatus(): void {
    this.status = {
      ...this.status,
      subscribedSymbols: this.getActiveSymbols(),
      streamCount: this.activeSymbols.size * 2,
    };
  }

  private restartForSubscriptionChange(): void {
    this.syncSubscriptionStatus();
    this.emitStatus();

    if (
      this.manuallyStopped
      || this.status.state === 'idle'
      || this.status.state === 'stopped'
    ) {
      return;
    }

    if (this.reconnectHandle !== null) {
      this.scheduler.cancel(this.reconnectHandle);
      this.reconnectHandle = null;
    }

    const socket = this.socket;
    this.socket = null;
    this.generation += 1;
    socket?.close(1000, 'NEXUS subscriptions changed');

    this.status = {
      ...this.status,
      reconnectAttempts: 0,
    };
    this.connect();
  }

  private handleOpen(generation: number): void {
    if (generation !== this.generation || this.manuallyStopped) return;

    this.status = {
      ...this.status,
      state: 'connected',
      connectedAt: this.now().toISOString(),
      disconnectedAt: null,
      reconnectAttempts: 0,
      lastError: null,
    };
    this.emitStatus();
  }

  private handleMessage(generation: number, event: RealtimeSocketEvent): void {
    if (generation !== this.generation || this.manuallyStopped) return;

    const data = event.data;
    if (typeof data === 'string') {
      this.processTextMessage(data);
      return;
    }

    if (data instanceof ArrayBuffer) {
      this.processTextMessage(new TextDecoder().decode(data));
      return;
    }

    if (ArrayBuffer.isView(data)) {
      const bytes = new Uint8Array(data.byteLength);
      bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      this.processTextMessage(new TextDecoder().decode(bytes));
      return;
    }

    if (data instanceof Blob) {
      void data.text().then((text) => {
        if (generation === this.generation && !this.manuallyStopped) this.processTextMessage(text);
      });
    }
  }

  private processTextMessage(text: string): void {
    let payload: CombinedStreamPayload;
    try {
      payload = JSON.parse(text) as CombinedStreamPayload;
    } catch {
      this.status = { ...this.status, lastError: 'Binance WebSocket returned invalid JSON' };
      this.emitStatus();
      return;
    }

    if (!payload.stream || !payload.data || typeof payload.data !== 'object') return;

    const receivedAt = this.now().toISOString();
    this.status = { ...this.status, lastMessageAt: receivedAt };
    const stream = payload.stream.toLowerCase();

    if (stream.endsWith('@trade')) {
      this.applyTrade(payload.data as BinanceTradeEvent, receivedAt);
    } else if (stream.endsWith('@bookticker')) {
      this.applyBookTicker(payload.data as BinanceBookTickerEvent, receivedAt);
    }
  }

  private applyTrade(event: BinanceTradeEvent, receivedAt: string): void {
    const symbol = event.s?.toUpperCase();
    const price = numberValue(event.p);
    const quantity = numberValue(event.q);
    const tradeId = numberValue(event.t);

    if (!symbol || price === null || quantity === null || tradeId === null) return;
    const snapshot = this.snapshots.get(symbol);
    if (!snapshot) return;

    const timestampMs = numberValue(event.T) ?? numberValue(event.E) ?? this.now().getTime();
    const isBuyerMaker = event.m === true;
    const trade: RealtimeTrade = {
      id: `${symbol}-${Math.trunc(tradeId)}`,
      symbol,
      timestamp: new Date(timestampMs).toISOString(),
      price,
      quantity,
      quoteValue: price * quantity,
      side: isBuyerMaker ? 'sell' : 'buy',
      isBuyerMaker,
    };

    snapshot.lastTrade = trade;
    snapshot.recentTrades.push(trade);
    if (snapshot.recentTrades.length > this.options.tradesBufferSize) {
      snapshot.recentTrades.splice(0, snapshot.recentTrades.length - this.options.tradesBufferSize);
    }
    snapshot.updatedAt = receivedAt;
    this.emitSnapshot(snapshot);
  }

  private applyBookTicker(event: BinanceBookTickerEvent, receivedAt: string): void {
    const symbol = event.s?.toUpperCase();
    const bidPrice = numberValue(event.b);
    const bidQuantity = numberValue(event.B);
    const askPrice = numberValue(event.a);
    const askQuantity = numberValue(event.A);

    if (!symbol || bidPrice === null || bidQuantity === null || askPrice === null || askQuantity === null) return;
    const snapshot = this.snapshots.get(symbol);
    if (!snapshot) return;

    const spread = Math.max(0, askPrice - bidPrice);
    const midpoint = (askPrice + bidPrice) / 2;
    const updatedAtMs = numberValue(event.E);
    const bookTicker: RealtimeBookTicker = {
      symbol,
      bidPrice,
      bidQuantity,
      askPrice,
      askQuantity,
      spread,
      spreadPct: midpoint > 0 ? (spread / midpoint) * 100 : 0,
      updatedAt: updatedAtMs === null ? receivedAt : new Date(updatedAtMs).toISOString(),
    };

    snapshot.bookTicker = bookTicker;
    snapshot.updatedAt = receivedAt;
    this.emitSnapshot(snapshot);
  }

  private handleError(generation: number): void {
    if (generation !== this.generation || this.manuallyStopped) return;
    this.status = { ...this.status, lastError: 'Binance WebSocket connection error' };
    this.emitStatus();
  }

  private handleClose(generation: number, event: RealtimeSocketEvent): void {
    if (generation !== this.generation || this.manuallyStopped) return;

    this.socket = null;
    const closeDetails = event.code
      ? `Binance WebSocket closed with code ${event.code}${event.reason ? `: ${event.reason}` : ''}`
      : 'Binance WebSocket connection closed';

    this.status = {
      ...this.status,
      disconnectedAt: this.now().toISOString(),
      lastError: event.code === 1000 ? this.status.lastError : closeDetails,
    };
    this.emitStatus();
    this.scheduleReconnect();
  }

  private emitStatus(): void {
    this.emit({
      type: 'status',
      status: this.getStatus(),
      emittedAt: this.now().toISOString(),
    });
  }

  private emitSnapshot(snapshot: RealtimeSymbolSnapshot): void {
    this.emit({
      type: 'snapshot',
      snapshot: cloneSnapshot(snapshot),
      emittedAt: snapshot.updatedAt ?? this.now().toISOString(),
    });
  }

  private emit(event: RealtimeMarketDataEvent): void {
    for (const subscription of this.subscriptions) {
      if (
        event.type === 'snapshot'
        && subscription.symbol
        && subscription.symbol !== event.snapshot.symbol
      ) {
        continue;
      }

      subscription.listener(event);
    }
  }

  private scheduleReconnect(): void {
    if (this.manuallyStopped || this.reconnectHandle !== null) return;

    const attempt = this.status.reconnectAttempts + 1;
    const delayMs = Math.min(
      this.options.reconnectBaseDelayMs * 2 ** (attempt - 1),
      this.options.reconnectMaxDelayMs,
    );

    this.status = {
      ...this.status,
      state: 'reconnecting',
      reconnectAttempts: attempt,
    };
    this.emitStatus();

    this.reconnectHandle = this.scheduler.schedule(() => {
      this.reconnectHandle = null;
      this.connect();
    }, delayMs);
  }
}
