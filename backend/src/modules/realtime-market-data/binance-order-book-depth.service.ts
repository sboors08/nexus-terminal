import { OrderBookDepthBook } from './order-book-depth-book.js';
import {
  bucketOrderBookDepth,
  calculateOrderBookDepthMetrics,
} from './order-book-depth-metrics.js';
import type {
  OrderBookDepthDelta,
  OrderBookDepthLevelInput,
  OrderBookDepthSnapshot,
} from './order-book-depth.types.js';
import type {
  GetOrderBookDepthSnapshotOptions,
  OrderBookDepthConnectionState,
  OrderBookDepthFreshnessState,
  OrderBookDepthRuntimeEvent,
  OrderBookDepthRuntimeListener,
  OrderBookDepthRuntimeService,
  OrderBookDepthRuntimeSnapshot,
  OrderBookDepthRuntimeStatus,
} from './order-book-depth-runtime.types.js';
import type {
  RealtimeSocketEvent,
  RealtimeWebSocket,
  RealtimeWebSocketFactory,
  ReconnectScheduler,
} from './realtime-market-data.types.js';

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface BinanceOrderBookDepthServiceOptions {
  restBaseUrl: string;
  websocketBaseUrl: string;
  symbols: string[];
  requestTimeoutMs: number;
  staleAfterMs: number;
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
  snapshotLimit?: number;
  maxLevelsPerSide?: number;
  maxBufferedDeltas?: number;
  defaultLevelsLimit?: number;
  defaultDepthRangePct?: number;
  fetchImpl?: FetchLike;
  socketFactory?: RealtimeWebSocketFactory;
  scheduler?: ReconnectScheduler;
  now?: () => Date;
}

interface CombinedDepthPayload {
  stream?: string;
  data?: unknown;
}

interface BinanceDepthEvent {
  E?: number;
  T?: number;
  s?: string;
  U?: number;
  u?: number;
  pu?: number;
  b?: unknown;
  a?: unknown;
}

interface BinanceDepthSnapshotPayload {
  lastUpdateId?: number;
  bids?: unknown;
  asks?: unknown;
}

interface OrderBookSubscription {
  listener: OrderBookDepthRuntimeListener;
  symbol?: string;
}

interface SymbolRuntime {
  book: OrderBookDepthBook;
  synchronizationGeneration: number;
  abortController: AbortController | null;
  retryHandle: unknown | null;
  phase: 'collecting' | 'error';
  lastError: string | null;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,20}$/u;

const SNAPSHOT_LIMITS =
  new Set([
    5,
    10,
    20,
    50,
    100,
    500,
    1_000,
  ]);

const defaultScheduler: ReconnectScheduler = {
  schedule: (callback, delayMs) =>
    setTimeout(callback, delayMs),
  cancel: (handle) =>
    clearTimeout(
      handle as ReturnType<typeof setTimeout>,
    ),
};

function normalizeSymbol(
  value: string,
): string {
  const symbol =
    value
      .trim()
      .toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new Error(
      `Invalid order book symbol: ${value}`,
    );
  }

  return symbol;
}

function assertPositiveInteger(
  value: number,
  name: string,
): void {
  if (
    !Number.isSafeInteger(value)
    || value < 1
  ) {
    throw new Error(
      `${name} must be a positive safe integer`,
    );
  }
}

function assertPositiveFinite(
  value: number,
  name: string,
): void {
  if (
    !Number.isFinite(value)
    || value <= 0
  ) {
    throw new Error(
      `${name} must be a positive finite number`,
    );
  }
}

function numberValue(
  value: unknown,
): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function updateIdValue(
  value: unknown,
): number | null {
  const parsed =
    numberValue(value);

  if (parsed === null) {
    return null;
  }

  const normalized =
    Math.trunc(parsed);

  return Number.isSafeInteger(normalized)
    && normalized >= 0
      ? normalized
      : null;
}

function parseLevels(
  value: unknown,
): OrderBookDepthLevelInput[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const levels:
    OrderBookDepthLevelInput[] = [];

  for (const item of value) {
    if (
      !Array.isArray(item)
      || item.length < 2
    ) {
      return null;
    }

    const price =
      numberValue(item[0]);

    const quantity =
      numberValue(item[1]);

    if (
      price === null
      || quantity === null
      || price <= 0
      || quantity < 0
    ) {
      return null;
    }

    levels.push({
      price,
      quantity,
    });
  }

  return levels;
}

function errorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof Error
    && error.message
      ? error.message
      : fallback;
}

function cloneStatus(
  status: OrderBookDepthRuntimeStatus,
): OrderBookDepthRuntimeStatus {
  return {
    ...status,
    subscribedSymbols: [
      ...status.subscribedSymbols,
    ],
  };
}

export class BinanceOrderBookDepthService
implements OrderBookDepthRuntimeService {
  private readonly restBaseUrl: string;
  private readonly websocketBaseUrl: string;
  private readonly initialSymbols:
    Set<string>;
  private readonly activeSymbols =
    new Set<string>();
  private readonly dynamicSymbolReferences =
    new Map<string, number>();
  private readonly requestTimeoutMs: number;
  private readonly staleAfterMs: number;
  private readonly reconnectBaseDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly snapshotLimit: number;
  private readonly maxLevelsPerSide: number;
  private readonly maxBufferedDeltas: number;
  private readonly defaultLevelsLimit: number;
  private readonly defaultDepthRangePct: number;
  private readonly fetchImpl: FetchLike;
  private readonly socketFactory:
    RealtimeWebSocketFactory;
  private readonly scheduler:
    ReconnectScheduler;
  private readonly now: () => Date;
  private readonly runtimes =
    new Map<string, SymbolRuntime>();
  private readonly subscriptions =
    new Set<OrderBookSubscription>();

  private socket:
    RealtimeWebSocket
    | null = null;
  private socketGeneration = 0;
  private socketOpen = false;
  private reconnectHandle:
    unknown
    | null = null;
  private reconnectAttempts = 0;
  private manuallyStopped = false;
  private status:
    OrderBookDepthRuntimeStatus;

  constructor(
    options:
      BinanceOrderBookDepthServiceOptions,
  ) {
    this.restBaseUrl =
      options.restBaseUrl
        .replace(/\/$/u, '');

    this.websocketBaseUrl =
      options.websocketBaseUrl
        .replace(/\/$/u, '');

    this.initialSymbols =
      new Set(
        options.symbols.map(
          normalizeSymbol,
        ),
      );

    if (this.initialSymbols.size === 0) {
      throw new Error(
        'At least one order book symbol is required',
      );
    }

    assertPositiveInteger(
      options.requestTimeoutMs,
      'requestTimeoutMs',
    );

    assertPositiveInteger(
      options.staleAfterMs,
      'staleAfterMs',
    );

    assertPositiveInteger(
      options.reconnectBaseDelayMs,
      'reconnectBaseDelayMs',
    );

    assertPositiveInteger(
      options.reconnectMaxDelayMs,
      'reconnectMaxDelayMs',
    );

    if (
      options.reconnectMaxDelayMs
      < options.reconnectBaseDelayMs
    ) {
      throw new Error(
        'reconnectMaxDelayMs must be greater than or equal to reconnectBaseDelayMs',
      );
    }

    const snapshotLimit =
      options.snapshotLimit
      ?? 1_000;

    if (!SNAPSHOT_LIMITS.has(snapshotLimit)) {
      throw new Error(
        'snapshotLimit must be one of 5, 10, 20, 50, 100, 500, 1000',
      );
    }

    const maxLevelsPerSide =
      options.maxLevelsPerSide
      ?? snapshotLimit;

    const maxBufferedDeltas =
      options.maxBufferedDeltas
      ?? 2_000;

    const defaultLevelsLimit =
      options.defaultLevelsLimit
      ?? 100;

    const defaultDepthRangePct =
      options.defaultDepthRangePct
      ?? 0.2;

    assertPositiveInteger(
      maxLevelsPerSide,
      'maxLevelsPerSide',
    );

    assertPositiveInteger(
      maxBufferedDeltas,
      'maxBufferedDeltas',
    );

    assertPositiveInteger(
      defaultLevelsLimit,
      'defaultLevelsLimit',
    );

    assertPositiveFinite(
      defaultDepthRangePct,
      'defaultDepthRangePct',
    );

    this.requestTimeoutMs =
      options.requestTimeoutMs;
    this.staleAfterMs =
      options.staleAfterMs;
    this.reconnectBaseDelayMs =
      options.reconnectBaseDelayMs;
    this.reconnectMaxDelayMs =
      options.reconnectMaxDelayMs;
    this.snapshotLimit =
      snapshotLimit;
    this.maxLevelsPerSide =
      maxLevelsPerSide;
    this.maxBufferedDeltas =
      maxBufferedDeltas;
    this.defaultLevelsLimit =
      Math.min(
        defaultLevelsLimit,
        maxLevelsPerSide,
      );
    this.defaultDepthRangePct =
      defaultDepthRangePct;
    this.fetchImpl =
      options.fetchImpl
      ?? globalThis.fetch;
    this.socketFactory =
      options.socketFactory
      ?? ((url) => {
        return new WebSocket(url) as unknown as RealtimeWebSocket;
      });
    this.scheduler =
      options.scheduler
      ?? defaultScheduler;
    this.now =
      options.now
      ?? (() => new Date());

    for (const symbol of this.initialSymbols) {
      this.activeSymbols.add(symbol);
      this.runtimes.set(
        symbol,
        this.createRuntime(symbol),
      );
    }

    this.status = {
      state: 'idle',
      connectedAt: null,
      disconnectedAt: null,
      lastMessageAt: null,
      reconnectAttempts: 0,
      subscribedSymbols:
        this.getActiveSymbols(),
      streamCount:
        this.activeSymbols.size,
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
    this.connect();
  }

  stop(): void {
    this.manuallyStopped = true;
    this.socketGeneration += 1;
    this.socketOpen = false;

    if (this.reconnectHandle !== null) {
      this.scheduler.cancel(
        this.reconnectHandle,
      );
      this.reconnectHandle = null;
    }

    for (const runtime of this.runtimes.values()) {
      this.cancelRuntimeWork(runtime);
    }

    if (this.socket) {
      this.socket.close(
        1000,
        'NEXUS order book shutdown',
      );
      this.socket = null;
    }

    this.reconnectAttempts = 0;
    this.status = {
      ...this.status,
      state: 'stopped',
      disconnectedAt:
        this.now().toISOString(),
      reconnectAttempts: 0,
    };

    this.emitStatus();
    this.emitAllSnapshots();
  }

  getStatus():
    OrderBookDepthRuntimeStatus {
    return cloneStatus(
      this.status,
    );
  }

  getSnapshot(
    symbol: string,
    options:
      GetOrderBookDepthSnapshotOptions = {},
  ): OrderBookDepthRuntimeSnapshot | null {
    const normalizedSymbol =
      normalizeSymbol(symbol);

    const runtime =
      this.runtimes.get(
        normalizedSymbol,
      );

    if (!runtime) {
      return null;
    }

    const levelsLimit =
      options.levelsLimit
      ?? this.defaultLevelsLimit;

    if (
      !Number.isSafeInteger(levelsLimit)
      || levelsLimit < 1
      || levelsLimit > this.maxLevelsPerSide
    ) {
      throw new Error(
        `levelsLimit must be between 1 and ${this.maxLevelsPerSide}`,
      );
    }

    const depthRangePct =
      options.depthRangePct
      ?? this.defaultDepthRangePct;

    assertPositiveFinite(
      depthRangePct,
      'depthRangePct',
    );

    const view =
      runtime.book.getView();

    const updatedAtMs =
      view.updatedAt === null
        ? null
        : Date.parse(
            view.updatedAt,
          );

    const ageMs =
      updatedAtMs === null
      || !Number.isFinite(updatedAtMs)
        ? null
        : Math.max(
            0,
            this.now().getTime()
            - updatedAtMs,
          );

    const state:
      OrderBookDepthFreshnessState =
      view.synchronized
        ? (
            !this.socketOpen
            || ageMs === null
            || ageMs > this.staleAfterMs
              ? 'stale'
              : 'live'
          )
        : runtime.phase;

    const buckets =
      options.bucketSize === undefined
        ? null
        : bucketOrderBookDepth(
            view,
            {
              bucketSize:
                options.bucketSize,
              maxBucketsPerSide:
                options.maxBucketsPerSide
                ?? 100,
            },
          );

    return {
      symbol:
        normalizedSymbol,
      state,
      synchronized:
        view.synchronized,
      lastUpdateId:
        view.lastUpdateId,
      bids:
        view.bids
          .slice(
            0,
            levelsLimit,
          )
          .map(
            (level) => ({
              ...level,
            }),
          ),
      asks:
        view.asks
          .slice(
            0,
            levelsLimit,
          )
          .map(
            (level) => ({
              ...level,
            }),
          ),
      buckets:
        buckets === null
          ? null
          : {
              bids:
                buckets.bids.map(
                  (bucket) => ({
                    ...bucket,
                  }),
                ),
              asks:
                buckets.asks.map(
                  (bucket) => ({
                    ...bucket,
                  }),
                ),
            },
      metrics:
        calculateOrderBookDepthMetrics(
          view,
          {
            depthRangePct,
          },
        ),
      updatedAt:
        view.updatedAt,
      ageMs,
      staleAfterMs:
        this.staleAfterMs,
      lastError:
        runtime.lastError,
    };
  }

  acquireSymbol(
    symbol: string,
  ): () => void {
    const normalizedSymbol =
      normalizeSymbol(symbol);

    const currentReferences =
      this.dynamicSymbolReferences.get(
        normalizedSymbol,
      )
      ?? 0;

    this.dynamicSymbolReferences.set(
      normalizedSymbol,
      currentReferences + 1,
    );

    if (
      !this.activeSymbols.has(
        normalizedSymbol,
      )
    ) {
      this.activeSymbols.add(
        normalizedSymbol,
      );

      this.runtimes.set(
        normalizedSymbol,
        this.createRuntime(
          normalizedSymbol,
        ),
      );

      this.restartForSubscriptionChange();
    }

    let released = false;

    return () => {
      if (released) {
        return;
      }

      released = true;

      const references =
        this.dynamicSymbolReferences.get(
          normalizedSymbol,
        )
        ?? 0;

      if (references > 1) {
        this.dynamicSymbolReferences.set(
          normalizedSymbol,
          references - 1,
        );
        return;
      }

      this.dynamicSymbolReferences.delete(
        normalizedSymbol,
      );

      if (
        this.initialSymbols.has(
          normalizedSymbol,
        )
      ) {
        return;
      }

      this.activeSymbols.delete(
        normalizedSymbol,
      );

      const runtime =
        this.runtimes.get(
          normalizedSymbol,
        );

      if (runtime) {
        this.cancelRuntimeWork(runtime);
      }

      this.runtimes.delete(
        normalizedSymbol,
      );

      this.restartForSubscriptionChange();
    };
  }

  subscribe(
    listener: OrderBookDepthRuntimeListener,
    symbol?: string,
  ): () => void {
    const normalizedSymbol =
      symbol === undefined
        ? undefined
        : normalizeSymbol(symbol);

    const subscription:
      OrderBookSubscription =
      normalizedSymbol === undefined
        ? { listener }
        : {
            listener,
            symbol:
              normalizedSymbol,
          };

    this.subscriptions.add(
      subscription,
    );

    return () => {
      this.subscriptions.delete(
        subscription,
      );
    };
  }

  private createRuntime(
    symbol: string,
  ): SymbolRuntime {
    return {
      book:
        new OrderBookDepthBook({
          symbol,
          maxLevelsPerSide:
            this.maxLevelsPerSide,
          maxBufferedDeltas:
            this.maxBufferedDeltas,
        }),
      synchronizationGeneration: 0,
      abortController: null,
      retryHandle: null,
      phase: 'collecting',
      lastError: null,
    };
  }

  private connect(): void {
    if (this.manuallyStopped) {
      return;
    }

    const generation =
      this.socketGeneration + 1;

    this.socketGeneration =
      generation;
    this.socketOpen = false;

    const state:
      OrderBookDepthConnectionState =
      this.reconnectAttempts > 0
        ? 'reconnecting'
        : 'connecting';

    this.status = {
      ...this.status,
      state,
      reconnectAttempts:
        this.reconnectAttempts,
      subscribedSymbols:
        this.getActiveSymbols(),
      streamCount:
        this.activeSymbols.size,
    };

    this.emitStatus();

    let socket:
      RealtimeWebSocket;

    try {
      socket =
        this.socketFactory(
          this.buildUrl(),
        );
    } catch (error) {
      this.status = {
        ...this.status,
        lastError:
          errorMessage(
            error,
            'Unable to create Binance order book WebSocket',
          ),
      };

      this.emitStatus();
      this.scheduleReconnect();
      return;
    }

    this.socket =
      socket;

    socket.addEventListener(
      'open',
      () =>
        this.handleOpen(
          generation,
        ),
    );

    socket.addEventListener(
      'message',
      (event) =>
        this.handleMessage(
          generation,
          event,
        ),
    );

    socket.addEventListener(
      'error',
      () =>
        this.handleError(
          generation,
        ),
    );

    socket.addEventListener(
      'close',
      (event) =>
        this.handleClose(
          generation,
          event,
        ),
    );
  }

  private buildUrl(): string {
    const streams =
      this.getActiveSymbols()
        .map(
          (symbol) =>
            `${symbol.toLowerCase()}@depth@100ms`,
        );

    return (
      `${this.websocketBaseUrl}/public/stream?streams=`
      + streams.join('/')
    );
  }

  private handleOpen(
    generation: number,
  ): void {
    if (!this.isCurrentGeneration(generation)) {
      return;
    }

    this.socketOpen = true;
    this.reconnectAttempts = 0;

    this.status = {
      ...this.status,
      state: 'connected',
      connectedAt:
        this.now().toISOString(),
      disconnectedAt: null,
      reconnectAttempts: 0,
      lastError: null,
    };

    this.emitStatus();

    for (const symbol of this.activeSymbols) {
      this.synchronizeSymbol(
        symbol,
        null,
      );
    }
  }

  private handleMessage(
    generation: number,
    event: RealtimeSocketEvent,
  ): void {
    if (!this.isCurrentGeneration(generation)) {
      return;
    }

    const data =
      event.data;

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
      void data.text().then(
        (text) => {
          if (
            this.isCurrentGeneration(
              generation,
            )
          ) {
            this.processTextMessage(
              text,
            );
          }
        },
      );
    }
  }

  private processTextMessage(
    text: string,
  ): void {
    let payload:
      CombinedDepthPayload;

    try {
      payload =
        JSON.parse(text) as CombinedDepthPayload;
    } catch {
      this.status = {
        ...this.status,
        lastError:
          'Binance order book WebSocket returned invalid JSON',
      };

      this.emitStatus();
      return;
    }

    if (
      !payload.stream
      || !payload.data
      || typeof payload.data !== 'object'
      || !payload.stream
        .toLowerCase()
        .includes('@depth')
    ) {
      return;
    }

    const receivedAt =
      this.now().toISOString();

    const delta =
      this.parseDelta(
        payload.data as BinanceDepthEvent,
        receivedAt,
      );

    if (!delta) {
      return;
    }

    const runtime =
      this.runtimes.get(
        delta.symbol,
      );

    if (!runtime) {
      return;
    }

    this.status = {
      ...this.status,
      lastMessageAt:
        receivedAt,
    };

    const result =
      runtime.book.applyDelta(
        delta,
      );

    if (result.status === 'gap') {
      const reason =
        result.reason
        ?? 'order-book-sequence-gap';

      this.synchronizeSymbol(
        delta.symbol,
        reason,
      );
      return;
    }

    if (result.status === 'applied') {
      runtime.phase =
        'collecting';
      runtime.lastError =
        null;
      this.emitSnapshot(
        delta.symbol,
      );
    }
  }

  private parseDelta(
    event: BinanceDepthEvent,
    receivedAt: string,
  ): OrderBookDepthDelta | null {
    const symbol =
      event.s === undefined
        ? null
        : (() => {
            try {
              return normalizeSymbol(
                event.s ?? '',
              );
            } catch {
              return null;
            }
          })();

    const firstUpdateId =
      updateIdValue(event.U);

    const finalUpdateId =
      updateIdValue(event.u);

    const previousFinalUpdateId =
      updateIdValue(event.pu);

    const bids =
      parseLevels(event.b);

    const asks =
      parseLevels(event.a);

    if (
      symbol === null
      || firstUpdateId === null
      || finalUpdateId === null
      || previousFinalUpdateId === null
      || finalUpdateId < firstUpdateId
      || bids === null
      || asks === null
    ) {
      return null;
    }

    const eventTimeMs =
      numberValue(event.T)
      ?? numberValue(event.E)
      ?? this.now().getTime();

    return {
      symbol,
      firstUpdateId,
      finalUpdateId,
      previousFinalUpdateId,
      bids,
      asks,
      eventTime:
        new Date(
          eventTimeMs,
        ).toISOString(),
      receivedAt,
    };
  }

  private synchronizeSymbol(
    symbol: string,
    reason: string | null,
  ): void {
    const runtime =
      this.runtimes.get(symbol);

    if (
      !runtime
      || this.manuallyStopped
      || !this.socketOpen
    ) {
      return;
    }

    this.cancelRuntimeWork(runtime);

    runtime.synchronizationGeneration += 1;
    runtime.phase = 'collecting';
    runtime.lastError = reason;
    runtime.book.reset();

    const generation =
      runtime.synchronizationGeneration;

    const controller =
      new AbortController();

    runtime.abortController =
      controller;

    this.emitSnapshot(symbol);

    void this.fetchSnapshot(
      symbol,
      controller,
    ).then(
      (snapshot) => {
        const currentRuntime =
          this.runtimes.get(symbol);

        if (
          !currentRuntime
          || currentRuntime
            .synchronizationGeneration
            !== generation
          || this.manuallyStopped
        ) {
          return;
        }

        currentRuntime.abortController =
          null;

        const result =
          currentRuntime.book.applySnapshot(
            snapshot,
          );

        if (result.status === 'gap') {
          currentRuntime.phase =
            'error';
          currentRuntime.lastError =
            result.reason
            ?? 'snapshot-update-id-not-bridged';

          this.emitSnapshot(symbol);
          this.scheduleSymbolRetry(symbol);
          return;
        }

        currentRuntime.phase =
          'collecting';
        currentRuntime.lastError =
          null;

        this.status = {
          ...this.status,
          lastError: null,
        };

        this.emitSnapshot(symbol);
      },
      (error: unknown) => {
        const currentRuntime =
          this.runtimes.get(symbol);

        if (
          !currentRuntime
          || currentRuntime
            .synchronizationGeneration
            !== generation
          || this.manuallyStopped
          || (
            error instanceof Error
            && error.name === 'AbortError'
          )
        ) {
          return;
        }

        currentRuntime.abortController =
          null;
        currentRuntime.phase =
          'error';
        currentRuntime.lastError =
          errorMessage(
            error,
            'Binance order book snapshot failed',
          );

        this.status = {
          ...this.status,
          lastError:
            currentRuntime.lastError,
        };

        this.emitStatus();
        this.emitSnapshot(symbol);
        this.scheduleSymbolRetry(symbol);
      },
    );
  }

  private async fetchSnapshot(
    symbol: string,
    controller: AbortController,
  ): Promise<OrderBookDepthSnapshot> {
    let timedOut =
      false;

    const timeout =
      setTimeout(
        () => {
          timedOut = true;
          controller.abort();
        },
        this.requestTimeoutMs,
      );

    try {
      const query =
        new URLSearchParams({
          symbol,
          limit:
            String(
              this.snapshotLimit,
            ),
        });

      const response =
        await this.fetchImpl(
          `${this.restBaseUrl}/fapi/v1/depth?${query.toString()}`,
          {
            headers: {
              accept:
                'application/json',
            },
            signal:
              controller.signal,
          },
        );

      const text =
        await response.text();

      let payload:
        BinanceDepthSnapshotPayload;

      try {
        payload =
          JSON.parse(text) as BinanceDepthSnapshotPayload;
      } catch {
        throw new Error(
          'Binance order book snapshot returned invalid JSON',
        );
      }

      if (!response.ok) {
        throw new Error(
          `Binance order book snapshot failed with status ${response.status}`,
        );
      }

      const lastUpdateId =
        updateIdValue(
          payload.lastUpdateId,
        );

      const bids =
        parseLevels(
          payload.bids,
        );

      const asks =
        parseLevels(
          payload.asks,
        );

      if (
        lastUpdateId === null
        || bids === null
        || asks === null
        || bids.some(
          (level) =>
            level.quantity === 0,
        )
        || asks.some(
          (level) =>
            level.quantity === 0,
        )
      ) {
        throw new Error(
          'Binance order book snapshot returned an invalid payload',
        );
      }

      return {
        symbol,
        lastUpdateId,
        bids,
        asks,
        receivedAt:
          this.now().toISOString(),
      };
    } catch (error) {
      if (
        timedOut
        && error instanceof Error
        && error.name === 'AbortError'
      ) {
        throw new Error(
          'Binance order book snapshot timed out',
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private scheduleSymbolRetry(
    symbol: string,
  ): void {
    const runtime =
      this.runtimes.get(symbol);

    if (
      !runtime
      || runtime.retryHandle !== null
      || this.manuallyStopped
      || !this.socketOpen
    ) {
      return;
    }

    runtime.retryHandle =
      this.scheduler.schedule(
        () => {
          const currentRuntime =
            this.runtimes.get(symbol);

          if (!currentRuntime) {
            return;
          }

          currentRuntime.retryHandle =
            null;

          this.synchronizeSymbol(
            symbol,
            currentRuntime.lastError,
          );
        },
        this.reconnectBaseDelayMs,
      );
  }

  private handleError(
    generation: number,
  ): void {
    if (!this.isCurrentGeneration(generation)) {
      return;
    }

    this.status = {
      ...this.status,
      lastError:
        'Binance order book WebSocket error',
    };

    this.emitStatus();
  }

  private handleClose(
    generation: number,
    event: RealtimeSocketEvent,
  ): void {
    if (!this.isCurrentGeneration(generation)) {
      return;
    }

    this.socket = null;
    this.socketOpen = false;

    for (const runtime of this.runtimes.values()) {
      this.cancelRuntimeWork(runtime);
    }

    this.status = {
      ...this.status,
      state: 'reconnecting',
      disconnectedAt:
        this.now().toISOString(),
      lastError:
        event.reason
        || `Binance order book WebSocket closed with code ${event.code ?? 1006}`,
    };

    this.emitStatus();
    this.emitAllSnapshots();
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (
      this.manuallyStopped
      || this.reconnectHandle !== null
    ) {
      return;
    }

    this.reconnectAttempts += 1;

    const delayMs =
      Math.min(
        this.reconnectMaxDelayMs,
        this.reconnectBaseDelayMs
        * 2 ** Math.max(
            0,
            this.reconnectAttempts - 1,
          ),
      );

    this.status = {
      ...this.status,
      state: 'reconnecting',
      reconnectAttempts:
        this.reconnectAttempts,
    };

    this.emitStatus();

    this.reconnectHandle =
      this.scheduler.schedule(
        () => {
          this.reconnectHandle = null;
          this.connect();
        },
        delayMs,
      );
  }

  private restartForSubscriptionChange(): void {
    this.status = {
      ...this.status,
      subscribedSymbols:
        this.getActiveSymbols(),
      streamCount:
        this.activeSymbols.size,
    };

    this.emitStatus();

    if (
      this.manuallyStopped
      || this.status.state === 'idle'
      || this.status.state === 'stopped'
    ) {
      return;
    }

    if (this.reconnectHandle !== null) {
      this.scheduler.cancel(
        this.reconnectHandle,
      );
      this.reconnectHandle = null;
    }

    this.socketGeneration += 1;
    this.socketOpen = false;
    this.reconnectAttempts = 0;

    for (const runtime of this.runtimes.values()) {
      this.cancelRuntimeWork(runtime);
    }

    if (this.socket) {
      this.socket.close(
        1000,
        'NEXUS order book subscriptions changed',
      );
      this.socket = null;
    }

    this.connect();
  }

  private cancelRuntimeWork(
    runtime: SymbolRuntime,
  ): void {
    runtime.synchronizationGeneration += 1;

    if (runtime.abortController) {
      runtime.abortController.abort();
      runtime.abortController = null;
    }

    if (runtime.retryHandle !== null) {
      this.scheduler.cancel(
        runtime.retryHandle,
      );
      runtime.retryHandle = null;
    }
  }

  private isCurrentGeneration(
    generation: number,
  ): boolean {
    return (
      generation
      === this.socketGeneration
      && !this.manuallyStopped
    );
  }

  private getActiveSymbols():
    string[] {
    return [
      ...this.activeSymbols,
    ];
  }

  private emitStatus(): void {
    const event:
      OrderBookDepthRuntimeEvent = {
      type: 'status',
      status:
        this.getStatus(),
      emittedAt:
        this.now().toISOString(),
    };

    for (const subscription of this.subscriptions) {
      subscription.listener(event);
    }
  }

  private emitSnapshot(
    symbol: string,
  ): void {
    const event:
      OrderBookDepthRuntimeEvent = {
      type: 'snapshot',
      symbol,
      emittedAt:
        this.now().toISOString(),
    };

    for (const subscription of this.subscriptions) {
      if (
        subscription.symbol
        && subscription.symbol !== symbol
      ) {
        continue;
      }

      subscription.listener(event);
    }
  }

  private emitAllSnapshots(): void {
    for (const symbol of this.activeSymbols) {
      this.emitSnapshot(symbol);
    }
  }
}
