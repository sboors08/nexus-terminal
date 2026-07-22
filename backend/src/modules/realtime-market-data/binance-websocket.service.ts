import type {
  MarketScannerMetrics,
} from './market-scanner-metrics.js';
import {
  MarketScannerMetricsSeries,
} from './market-scanner-metrics-series.js';
import {
  calculateScannerBtcCorrelation,
  calculateScannerRelativeStrengthPct,
} from './scanner-btc-comparison.js';
import {
  DEFAULT_MARKET_SCANNER_WINDOW,
  type MarketScannerWindowId,
} from './scanner-windows.js';
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

type BinanceWebSocketRoute =
  | 'market'
  | 'public';

const BINANCE_WEBSOCKET_ROUTES:
  readonly BinanceWebSocketRoute[] = [
    'market',
    'public',
  ];

interface BinanceAggregateTradeEvent {
  E?: number;
  s?: string;
  a?: number;
  p?: string;
  q?: string;
  f?: number;
  l?: number;
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
  private readonly scannerMetrics = new Map<string, MarketScannerMetricsSeries>();
  private readonly subscriptions = new Set<RealtimeSubscription>();
  private readonly sockets =
    new Map<
      BinanceWebSocketRoute,
      RealtimeWebSocket
    >();

  private readonly reconnectHandles =
    new Map<
      BinanceWebSocketRoute,
      unknown
    >();

  private readonly routeGenerations =
    new Map<
      BinanceWebSocketRoute,
      number
    >();

  private readonly openRoutes =
    new Set<
      BinanceWebSocketRoute
    >();

  private readonly routeReconnectAttempts =
    new Map<
      BinanceWebSocketRoute,
      number
    >();

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

      this.scannerMetrics.set(
        symbol,
        new MarketScannerMetricsSeries(symbol),
      );
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
    if (
      this.status.state === 'connecting'
      || this.status.state === 'connected'
      || this.status.state === 'reconnecting'
    ) {
      return;
    }

    this.manuallyStopped = false;

    for (
      const route
      of BINANCE_WEBSOCKET_ROUTES
    ) {
      this.connectRoute(route);
    }
  }

  stop(): void {
    this.manuallyStopped = true;

    for (
      const route
      of BINANCE_WEBSOCKET_ROUTES
    ) {
      this.incrementRouteGeneration(
        route,
      );
    }

    for (
      const handle
      of this.reconnectHandles.values()
    ) {
      this.scheduler.cancel(handle);
    }

    this.reconnectHandles.clear();

    for (
      const socket
      of this.sockets.values()
    ) {
      socket.close(
        1000,
        'NEXUS backend shutdown',
      );
    }

    this.sockets.clear();
    this.openRoutes.clear();
    this.routeReconnectAttempts.clear();

    this.status = {
      ...this.status,
      state: 'stopped',
      disconnectedAt:
        this.now().toISOString(),
      reconnectAttempts: 0,
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

    getScannerMetrics(
    symbol?: string,
    scannerWindow?: MarketScannerWindowId,
  ): MarketScannerMetrics[] {
    const referenceTime = this.now();

    const resolvedScannerWindow =
      scannerWindow
      ?? DEFAULT_MARKET_SCANNER_WINDOW;

    const btcSeries =
      this.scannerMetrics.get(
        'BTCUSDT',
      );

    const btcMetrics =
      btcSeries?.getMetrics(
        resolvedScannerWindow,
        referenceTime,
      ) ?? null;

    const btcPriceSamples =
      btcSeries?.getPriceSamples(
        resolvedScannerWindow,
        referenceTime,
      ) ?? [];

    const buildMetrics = (
      metricsSeries:
        MarketScannerMetricsSeries,
    ): MarketScannerMetrics => {
      const metrics =
        metricsSeries.getMetrics(
          resolvedScannerWindow,
          referenceTime,
        );

      const btcCorrelation =
        btcSeries
          ? calculateScannerBtcCorrelation(
              metricsSeries.getPriceSamples(
                resolvedScannerWindow,
                referenceTime,
              ),
              btcPriceSamples,
            )
          : null;

      const relativeStrengthPct =
        calculateScannerRelativeStrengthPct(
          metrics.priceChangePct,
          btcMetrics?.priceChangePct
          ?? null,
        );

      return {
        ...metrics,
        btcCorrelation,
        relativeStrengthPct,
      };
    };

    if (symbol) {
      const metricsSeries =
        this.scannerMetrics.get(
          symbol.toUpperCase(),
        );

      return metricsSeries
        ? [buildMetrics(metricsSeries)]
        : [];
    }

    return this.getActiveSymbols()
      .map(
        (item) =>
          this.scannerMetrics.get(item),
      )
      .filter(
        (
          metricsSeries,
        ): metricsSeries is
          MarketScannerMetricsSeries =>
          metricsSeries !== undefined,
      )
      .map(buildMetrics);
  }

  acquireSymbol(symbol: string): () => void {
    return this.acquireSymbols([symbol]);
  }

  acquireSymbols(symbols: readonly string[]): () => void {
    const normalizedSymbols = [...new Set(symbols.map((symbol) => {
      const normalizedSymbol = symbol.trim().toUpperCase();
      if (!/^[A-Z0-9]{5,20}$/.test(normalizedSymbol)) {
        throw new Error(`Invalid realtime symbol: ${symbol}`);
      }
      return normalizedSymbol;
    }))];

    let subscriptionsChanged = false;

    for (const normalizedSymbol of normalizedSymbols) {
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

        this.scannerMetrics.set(
          normalizedSymbol,
          new MarketScannerMetricsSeries(
            normalizedSymbol,
          ),
        );

        subscriptionsChanged = true;
      }
    }

    if (subscriptionsChanged) {
      this.restartForSubscriptionChange();
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;

      let releasedSubscriptionsChanged = false;

      for (const normalizedSymbol of normalizedSymbols) {
        const references = this.dynamicSymbolReferences.get(normalizedSymbol) ?? 0;

        if (references > 1) {
          this.dynamicSymbolReferences.set(normalizedSymbol, references - 1);
          continue;
        }

        this.dynamicSymbolReferences.delete(normalizedSymbol);
        if (this.initialSymbols.has(normalizedSymbol)) continue;

        if (this.activeSymbols.delete(normalizedSymbol)) {
          this.snapshots.delete(normalizedSymbol);
          this.scannerMetrics.delete(
            normalizedSymbol,
          );
          releasedSubscriptionsChanged = true;
        }
      }

      if (releasedSubscriptionsChanged) {
        this.restartForSubscriptionChange();
      }
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

  private connectRoute(
    route: BinanceWebSocketRoute,
  ): void {
    if (this.manuallyStopped) return;

    const generation =
      this.incrementRouteGeneration(
        route,
      );

    this.openRoutes.delete(route);

    const reconnectAttempts =
      this.getMaxReconnectAttempts();

    this.status = {
      ...this.status,
      state:
        reconnectAttempts > 0
          ? 'reconnecting'
          : 'connecting',
      reconnectAttempts,
    };

    this.emitStatus();

    let socket: RealtimeWebSocket;

    try {
      socket =
        this.socketFactory(
          this.buildUrl(route),
        );
    } catch (error) {
      this.status = {
        ...this.status,
        lastError:
          error instanceof Error
            ? error.message
            : 'Unable to create Binance WebSocket',
      };

      this.emitStatus();
      this.scheduleReconnect(route);
      return;
    }

    this.sockets.set(
      route,
      socket,
    );

    socket.addEventListener(
      'open',
      () =>
        this.handleOpen(
          route,
          generation,
        ),
    );

    socket.addEventListener(
      'message',
      (event) =>
        this.handleMessage(
          route,
          generation,
          event,
        ),
    );

    socket.addEventListener(
      'error',
      () =>
        this.handleError(
          route,
          generation,
        ),
    );

    socket.addEventListener(
      'close',
      (event) =>
        this.handleClose(
          route,
          generation,
          event,
        ),
    );
  }

  private buildUrl(
    route: BinanceWebSocketRoute,
  ): string {
    const streamSuffix =
      route === 'market'
        ? '@aggTrade'
        : '@bookTicker';

    const streams =
      this.getActiveSymbols()
        .map(
          (symbol) =>
            `${symbol.toLowerCase()}${streamSuffix}`,
        );

    return (
      `${this.baseUrl}/${route}/stream?streams=`
      + streams.join('/')
    );
  }

  private getRouteGeneration(
    route: BinanceWebSocketRoute,
  ): number {
    return (
      this.routeGenerations.get(route)
      ?? 0
    );
  }

  private incrementRouteGeneration(
    route: BinanceWebSocketRoute,
  ): number {
    const generation =
      this.getRouteGeneration(route)
      + 1;

    this.routeGenerations.set(
      route,
      generation,
    );

    return generation;
  }

  private isCurrentRouteGeneration(
    route: BinanceWebSocketRoute,
    generation: number,
  ): boolean {
    return (
      generation
      === this.getRouteGeneration(route)
    );
  }

  private getMaxReconnectAttempts():
    number {
    return Math.max(
      0,
      ...this.routeReconnectAttempts
        .values(),
    );
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

    for (
      const handle
      of this.reconnectHandles.values()
    ) {
      this.scheduler.cancel(handle);
    }

    this.reconnectHandles.clear();

    for (
      const route
      of BINANCE_WEBSOCKET_ROUTES
    ) {
      this.incrementRouteGeneration(
        route,
      );
    }

    for (
      const socket
      of this.sockets.values()
    ) {
      socket.close(
        1000,
        'NEXUS subscriptions changed',
      );
    }

    this.sockets.clear();
    this.openRoutes.clear();
    this.routeReconnectAttempts.clear();

    this.status = {
      ...this.status,
      reconnectAttempts: 0,
    };

    for (
      const route
      of BINANCE_WEBSOCKET_ROUTES
    ) {
      this.connectRoute(route);
    }
  }

  private handleOpen(
    route: BinanceWebSocketRoute,
    generation: number,
  ): void {
    if (
      !this.isCurrentRouteGeneration(
        route,
        generation,
      )
      || this.manuallyStopped
    ) {
      return;
    }

    this.openRoutes.add(route);

    this.routeReconnectAttempts.set(
      route,
      0,
    );

    const allConnected =
      BINANCE_WEBSOCKET_ROUTES.every(
        (item) =>
          this.openRoutes.has(item),
      );

    const reconnectAttempts =
      this.getMaxReconnectAttempts();

    this.status = {
      ...this.status,
      state:
        allConnected
          ? 'connected'
          : reconnectAttempts > 0
            ? 'reconnecting'
            : 'connecting',
      connectedAt:
        allConnected
          ? this.now().toISOString()
          : this.status.connectedAt,
      disconnectedAt:
        allConnected
          ? null
          : this.status.disconnectedAt,
      reconnectAttempts,
      lastError:
        allConnected
          ? null
          : this.status.lastError,
    };

    this.emitStatus();
  }

  private handleMessage(
    route: BinanceWebSocketRoute,
    generation: number,
    event: RealtimeSocketEvent,
  ): void {
    if (
      !this.isCurrentRouteGeneration(
        route,
        generation,
      )
      || this.manuallyStopped
    ) {
      return;
    }

    const data = event.data;

    if (typeof data === 'string') {
      this.processTextMessage(data);
      return;
    }

    if (data instanceof ArrayBuffer) {
      this.processTextMessage(
        new TextDecoder().decode(data),
      );
      return;
    }

    if (ArrayBuffer.isView(data)) {
      const bytes =
        new Uint8Array(
          data.byteLength,
        );

      bytes.set(
        new Uint8Array(
          data.buffer,
          data.byteOffset,
          data.byteLength,
        ),
      );

      this.processTextMessage(
        new TextDecoder().decode(bytes),
      );

      return;
    }

    if (data instanceof Blob) {
      void data.text().then((text) => {
        if (
          this.isCurrentRouteGeneration(
            route,
            generation,
          )
          && !this.manuallyStopped
        ) {
          this.processTextMessage(text);
        }
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

    if (stream.endsWith('@aggtrade')) {
      this.applyTrade(
        payload.data as BinanceAggregateTradeEvent,
        receivedAt,
      );
    } else if (stream.endsWith('@bookticker')) {
      this.applyBookTicker(payload.data as BinanceBookTickerEvent, receivedAt);
    }
  }

  private applyTrade(
    event: BinanceAggregateTradeEvent,
    receivedAt: string,
  ): void {
    const symbol =
      event.s?.toUpperCase();

    const price =
      numberValue(event.p);

    const quantity =
      numberValue(event.q);

    const aggregateTradeId =
      numberValue(event.a);

    const firstTradeId =
      numberValue(event.f);

    const lastTradeId =
      numberValue(event.l);

    if (
      !symbol
      || price === null
      || quantity === null
      || aggregateTradeId === null
      || firstTradeId === null
      || lastTradeId === null
    ) {
      return;
    }

    const normalizedAggregateTradeId =
      Math.trunc(aggregateTradeId);

    const normalizedFirstTradeId =
      Math.trunc(firstTradeId);

    const normalizedLastTradeId =
      Math.trunc(lastTradeId);

    if (
      !Number.isSafeInteger(
        normalizedAggregateTradeId,
      )
      || !Number.isSafeInteger(
        normalizedFirstTradeId,
      )
      || !Number.isSafeInteger(
        normalizedLastTradeId,
      )
      || normalizedLastTradeId
        < normalizedFirstTradeId
    ) {
      return;
    }

    const snapshot =
      this.snapshots.get(symbol);

    if (!snapshot) return;

    const timestampMs =
      numberValue(event.T)
      ?? numberValue(event.E)
      ?? this.now().getTime();

    const isBuyerMaker =
      event.m === true;

    const trade: RealtimeTrade = {
      id:
        `${symbol}-${normalizedAggregateTradeId}`,
      symbol,
      timestamp:
        new Date(
          timestampMs,
        ).toISOString(),
      price,
      quantity,
      quoteValue:
        price * quantity,
      tradesCount:
        normalizedLastTradeId
        - normalizedFirstTradeId
        + 1,
      side:
        isBuyerMaker
          ? 'sell'
          : 'buy',
      isBuyerMaker,
    };

    snapshot.lastTrade = trade;
    snapshot.recentTrades.push(trade);

    if (
      snapshot.recentTrades.length
      > this.options.tradesBufferSize
    ) {
      snapshot.recentTrades.splice(
        0,
        snapshot.recentTrades.length
        - this.options.tradesBufferSize,
      );
    }

    this.scannerMetrics
      .get(symbol)
      ?.addTrade(trade);

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

    this.scannerMetrics
      .get(symbol)
      ?.updateBookTicker(bookTicker);

    snapshot.bookTicker = bookTicker;
    snapshot.updatedAt = receivedAt;
    this.emitSnapshot(snapshot);
  }

  private handleError(
    route: BinanceWebSocketRoute,
    generation: number,
  ): void {
    if (
      !this.isCurrentRouteGeneration(
        route,
        generation,
      )
      || this.manuallyStopped
    ) {
      return;
    }

    this.status = {
      ...this.status,
      lastError:
        `Binance Futures ${route} WebSocket connection error`,
    };

    this.emitStatus();
  }

  private handleClose(
    route: BinanceWebSocketRoute,
    generation: number,
    event: RealtimeSocketEvent,
  ): void {
    if (
      !this.isCurrentRouteGeneration(
        route,
        generation,
      )
      || this.manuallyStopped
    ) {
      return;
    }

    this.sockets.delete(route);
    this.openRoutes.delete(route);

    const closeDetails =
      event.code
        ? (
            `Binance Futures ${route} WebSocket closed with code `
            + `${event.code}`
            + (
              event.reason
                ? `: ${event.reason}`
                : ''
            )
          )
        : (
            `Binance Futures ${route} WebSocket connection closed`
          );

    this.status = {
      ...this.status,
      disconnectedAt:
        this.now().toISOString(),
      lastError:
        event.code === 1000
          ? this.status.lastError
          : closeDetails,
    };

    this.scheduleReconnect(route);
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

  private scheduleReconnect(
    route: BinanceWebSocketRoute,
  ): void {
    if (
      this.manuallyStopped
      || this.reconnectHandles.has(
        route,
      )
    ) {
      return;
    }

    const attempt =
      (
        this.routeReconnectAttempts
          .get(route)
        ?? 0
      )
      + 1;

    const delayMs =
      Math.min(
        this.options
          .reconnectBaseDelayMs
        * 2 ** (attempt - 1),
        this.options
          .reconnectMaxDelayMs,
      );

    this.routeReconnectAttempts.set(
      route,
      attempt,
    );

    this.status = {
      ...this.status,
      state: 'reconnecting',
      reconnectAttempts:
        this.getMaxReconnectAttempts(),
    };

    this.emitStatus();

    const handle =
      this.scheduler.schedule(
        () => {
          this.reconnectHandles.delete(
            route,
          );

          this.connectRoute(route);
        },
        delayMs,
      );

    this.reconnectHandles.set(
      route,
      handle,
    );
  }
}
