import type {
  MarketScannerMetrics,
} from './market-scanner-metrics.js';
import type {
  MarketVolumeSpike,
  MarketVolumeSpikeOptions,
} from './market-volume-spikes.js';
import type {
  MarketScannerWindowId,
} from './scanner-windows.js';
import {
  MarketWideOneMinuteMetricsStore,
  parseBinanceOneMinuteKlineEvent,
  type BinanceOneMinuteKlineUpdate,
  type MarketWideSymbolChange,
} from './market-wide-one-minute-metrics.js';
import {
  REALTIME_CANDLE_TIMEFRAMES,
} from './realtime-market-data.types.js';
import type {
  RealtimeBookTicker,
  RealtimeCandle,
  RealtimeCandleTimeframe,
  RealtimeSocketEvent,
  RealtimeWebSocket,
  RealtimeWebSocketFactory,
  ReconnectScheduler,
} from './realtime-market-data.types.js';

export type MarketWideRealtimeState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'degraded'
  | 'reconnecting'
  | 'stopped';

export interface MarketWideRealtimeStatus {
  state: MarketWideRealtimeState;
  symbolsCount: number;
  streamCount: number;
  socketCount: number;
  connectedSockets: number;
  lastMessageAt: string | null;
  reconnectAttempts: number;
  lastError: string | null;
}

export type MarketWideStreamRoute =
  | 'market'
  | 'public';

export interface MarketWideStreamShard {
  id: number;
  route: MarketWideStreamRoute;
  symbols: string[];
  streams: string[];
}

export interface MarketWideRealtimeServiceOptions {
  baseUrl: string;
  symbols: string[];
  maxStreamsPerSocket: number;
  reconnectBaseDelayMs: number;
  reconnectMaxDelayMs: number;
  socketFactory?: RealtimeWebSocketFactory;
  scheduler?: ReconnectScheduler;
  watchdogScheduler?: ReconnectScheduler;
  silentStreamTimeoutMs?: number;
  now?: () => Date;
}

export type MarketWideKlineChangeSource =
  | 'live'
  | 'history';

export interface MarketWideKlineChange {
  source: MarketWideKlineChangeSource;
  symbols: string[];
}

export type MarketWideKlineChangeListener =
  (
    event: MarketWideKlineChange,
  ) => void;

export type MarketWideRealtimeCandleListener =
  (
    candle: RealtimeCandle,
  ) => void;

interface CombinedStreamPayload {
  stream?: string;
  data?: unknown;
}

interface BinanceBookTickerEvent {
  s?: string;
  b?: string;
  B?: string;
  a?: string;
  A?: string;
  E?: number;
  st?: number;
}

interface MarketWideShardRuntime
  extends MarketWideStreamShard {
  socket: RealtimeWebSocket | null;
  connected: boolean;
  reconnectAttempts: number;
  reconnectHandle: unknown;
  watchdogHandle: unknown;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const MARKET_WIDE_EVENT_STALE_AFTER_MS =
  30_000;

const MARKET_WIDE_SILENT_STREAM_TIMEOUT_MS =
  30_000;

const defaultScheduler:
ReconnectScheduler = {
  schedule: (
    callback,
    delayMs,
  ) =>
    setTimeout(
      callback,
      delayMs,
    ),
  cancel: (handle) =>
    clearTimeout(
      handle as
        ReturnType<typeof setTimeout>,
    ),
};

function normalizeSymbol(
  value: string,
): string {
  const symbol =
    value.trim().toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new Error(
      `Invalid market-wide realtime symbol: ${value}`,
    );
  }

  return symbol;
}

const REALTIME_CANDLE_DURATION_MS:
Record<
  RealtimeCandleTimeframe,
  number
> = {
  '1m':
    60_000,
  '3m':
    3 * 60_000,
  '5m':
    5 * 60_000,
  '15m':
    15 * 60_000,
  '30m':
    30 * 60_000,
  '1h':
    60 * 60_000,
  '2h':
    2 * 60 * 60_000,
  '4h':
    4 * 60 * 60_000,
  '6h':
    6 * 60 * 60_000,
  '8h':
    8 * 60 * 60_000,
  '12h':
    12 * 60 * 60_000,
  '1d':
    24 * 60 * 60_000,
};

function getRealtimeCandleWindowSize(
  timeframe:
    RealtimeCandleTimeframe,
): number {
  return Math.max(
    1,
    Math.ceil(
      REALTIME_CANDLE_DURATION_MS[
        timeframe
      ] / 60_000,
    ),
  );
}

export function normalizeRealtimeCandleTimeframe(
  value:
    string
    | undefined,
): RealtimeCandleTimeframe | null {
  if (value === undefined) {
    return '1m';
  }

  const normalized =
    value
      .trim()
      .toLowerCase();

  return REALTIME_CANDLE_TIMEFRAMES.includes(
    normalized as
      RealtimeCandleTimeframe,
  )
    ? normalized as
        RealtimeCandleTimeframe
    : null;
}

function buildRealtimeCandle(
  update: BinanceOneMinuteKlineUpdate,
): RealtimeCandle {
  return {
    symbol:
      update.symbol,
    timeframe:
      '1m',
    openTime:
      update.openTime,
    closeTime:
      update.closeTime,
    open:
      update.open,
    high:
      update.high,
    low:
      update.low,
    close:
      update.close,
    volume:
      update.volume
      ?? null,
    quoteVolume:
      update.quoteVolume,
    tradesCount:
      update.tradesCount,
    isClosed:
      update.isClosed,
    updatedAt:
      update.eventTime,
  };
}

function aggregateRealtimeCandle(
  klines:
    readonly BinanceOneMinuteKlineUpdate[],
  timeframe:
    RealtimeCandleTimeframe,
): RealtimeCandle | null {
  if (klines.length === 0) {
    return null;
  }

  const ordered =
    [...klines].sort(
      (
        left,
        right,
      ) => {
        const openDifference =
          Date.parse(
            left.openTime,
          )
          - Date.parse(
            right.openTime,
          );

        if (openDifference !== 0) {
          return openDifference;
        }

        return (
          Date.parse(
            left.eventTime,
          )
          - Date.parse(
            right.eventTime,
          )
        );
      },
    );

  const latest =
    ordered[
      ordered.length - 1
    ];

  if (!latest) {
    return null;
  }

  const latestOpenTimeMs =
    Date.parse(
      latest.openTime,
    );

  if (
    !Number.isFinite(
      latestOpenTimeMs,
    )
  ) {
    throw new Error(
      `Invalid realtime candle open time: ${latest.symbol}`,
    );
  }

  const durationMs =
    REALTIME_CANDLE_DURATION_MS[
      timeframe
    ];

  const bucketOpenTimeMs =
    Math.floor(
      latestOpenTimeMs
      / durationMs,
    ) * durationMs;

  const bucketCloseTimeMs =
    bucketOpenTimeMs
    + durationMs
    - 1;

  const bucketKlines =
    ordered.filter(
      (kline) => {
        const openTimeMs =
          Date.parse(
            kline.openTime,
          );

        return (
          Number.isFinite(
            openTimeMs,
          )
          && openTimeMs
            >= bucketOpenTimeMs
          && openTimeMs
            <= bucketCloseTimeMs
        );
      },
    );

  const first =
    bucketKlines[0];

  const last =
    bucketKlines[
      bucketKlines.length - 1
    ];

  if (
    !first
    || !last
  ) {
    return null;
  }

  let high =
    Number.NEGATIVE_INFINITY;

  let low =
    Number.POSITIVE_INFINITY;

  let volume:
    number | null = 0;

  let quoteVolume =
    0;

  let tradesCount =
    0;

  for (
    const kline
    of bucketKlines
  ) {
    high =
      Math.max(
        high,
        kline.high,
      );

    low =
      Math.min(
        low,
        kline.low,
      );

    quoteVolume +=
      kline.quoteVolume;

    tradesCount +=
      kline.tradesCount;

    if (
      volume === null
      || kline.volume
        === undefined
      || kline.volume
        === null
    ) {
      volume =
        null;
    } else {
      volume +=
        kline.volume;
    }
  }

  const lastCloseTimeMs =
    Date.parse(
      last.closeTime,
    );

  return {
    symbol:
      last.symbol,
    timeframe,
    openTime:
      new Date(
        bucketOpenTimeMs,
      ).toISOString(),
    closeTime:
      new Date(
        bucketCloseTimeMs,
      ).toISOString(),
    open:
      first.open,
    high,
    low,
    close:
      last.close,
    volume,
    quoteVolume,
    tradesCount,
    isClosed:
      last.isClosed
      && Number.isFinite(
        lastCloseTimeMs,
      )
      && lastCloseTimeMs
        >= bucketCloseTimeMs,
    updatedAt:
      last.eventTime,
  };
}

function cloneRealtimeCandle(
  candle: RealtimeCandle,
): RealtimeCandle {
  return {
    ...candle,
  };
}

function normalizeSymbols(
  symbols: readonly string[],
): string[] {
  return [
    ...new Set(
      symbols.map(normalizeSymbol),
    ),
  ].sort();
}

function readNumber(
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

function validateInteger(
  value: number,
  name: string,
  minimum: number,
): void {
  if (
    !Number.isInteger(value)
    || value < minimum
  ) {
    throw new Error(
      `${name} must be an integer greater than or equal to ${minimum}`,
    );
  }
}

export function buildMarketWideStreamShards(
  symbols: readonly string[],
  maxStreamsPerSocket: number,
): MarketWideStreamShard[] {
  validateInteger(
    maxStreamsPerSocket,
    'maxStreamsPerSocket',
    2,
  );

  const normalizedSymbols =
    normalizeSymbols(symbols);

  const shards:
    MarketWideStreamShard[] = [];

  /*
   * Klines remain symbol-scoped because Binance does not
   * provide an equivalent all-symbol kline stream.
   */
  for (
    let index = 0;
    index < normalizedSymbols.length;
    index += maxStreamsPerSocket
  ) {
    const shardSymbols =
      normalizedSymbols.slice(
        index,
        index + maxStreamsPerSocket,
      );

    shards.push({
      id:
        shards.length,
      route:
        'market',
      symbols:
        shardSymbols,
      streams:
        shardSymbols.map(
          (symbol) =>
            symbol.toLowerCase()
            + '@kline_1m',
        ),
    });
  }

  /*
   * Binance provides one official all-symbol best-bid/ask
   * stream. Using it avoids dividing quiet bookTicker
   * symbols across multiple sockets and then mistaking
   * legitimate inactivity for a dead public shard.
   */
  if (normalizedSymbols.length > 0) {
    shards.push({
      id:
        shards.length,
      route:
        'public',
      symbols:
        normalizedSymbols,
      streams: [
        '!bookTicker',
      ],
    });
  }

  return shards;
}


export function parseBinanceMarketWideBookTicker(
  payload: unknown,
  receivedAt: string,
): RealtimeBookTicker {
  if (
    typeof payload !== 'object'
    || payload === null
    || Array.isArray(payload)
  ) {
    throw new Error(
      'Invalid Binance market-wide book ticker payload',
    );
  }

  const event =
    payload as BinanceBookTickerEvent;

  const symbol =
    typeof event.s === 'string'
      ? normalizeSymbol(event.s)
      : null;

  const bidPrice =
    readNumber(event.b);

  const bidQuantity =
    readNumber(event.B);

  const askPrice =
    readNumber(event.a);

  const askQuantity =
    readNumber(event.A);

  if (
    !symbol
    || bidPrice === null
    || bidPrice <= 0
    || bidQuantity === null
    || bidQuantity < 0
    || askPrice === null
    || askPrice <= 0
    || askQuantity === null
    || askQuantity < 0
    || askPrice < bidPrice
  ) {
    throw new Error(
      'Invalid Binance market-wide book ticker values',
    );
  }

  const spread =
    askPrice - bidPrice;

  const midpoint =
    (
      askPrice
      + bidPrice
    ) / 2;

  const eventTime =
    readNumber(event.E);

  const updatedAt =
    eventTime === null
      ? receivedAt
      : new Date(
          eventTime,
        ).toISOString();

  return {
    symbol,
    bidPrice,
    bidQuantity,
    askPrice,
    askQuantity,
    spread,
    spreadPct:
      midpoint > 0
        ? (
            spread
            / midpoint
          ) * 100
        : 0,
    updatedAt,
  };
}

export class MarketWideRealtimeService {
  private readonly baseUrl: string;
  private readonly socketFactory:
    RealtimeWebSocketFactory;
  private readonly scheduler:
    ReconnectScheduler;

  private readonly watchdogScheduler:
    ReconnectScheduler;

  private readonly silentStreamTimeoutMs:
    number;

  private readonly now: () => Date;

  private readonly metricsStore:
    MarketWideOneMinuteMetricsStore;

  private readonly klineChangeListeners =
    new Set<
      MarketWideKlineChangeListener
    >();

  private readonly realtimeCandleListeners =
    new Map<
      string,
      Set<
        MarketWideRealtimeCandleListener
      >
    >();

  private symbols: string[];
  private shards:
    MarketWideShardRuntime[] = [];

  private started = false;
  private manuallyStopped = false;
  private generation = 0;

  private lastMessageAt:
    string | null = null;

  private lastError:
    string | null = null;

  constructor(
    private readonly options:
      MarketWideRealtimeServiceOptions,
  ) {
    validateInteger(
      options.maxStreamsPerSocket,
      'maxStreamsPerSocket',
      2,
    );

    validateInteger(
      options.reconnectBaseDelayMs,
      'reconnectBaseDelayMs',
      1,
    );

    validateInteger(
      options.reconnectMaxDelayMs,
      'reconnectMaxDelayMs',
      options.reconnectBaseDelayMs,
    );

    if (
      options.silentStreamTimeoutMs
      !== undefined
    ) {
      validateInteger(
        options.silentStreamTimeoutMs,
        'silentStreamTimeoutMs',
        1,
      );
    }

    this.baseUrl =
      options.baseUrl.replace(
        /\/$/,
        '',
      );

    this.symbols =
      normalizeSymbols(
        options.symbols,
      );

    this.socketFactory =
      options.socketFactory
      ?? (
        (url) =>
          new WebSocket(
            url,
          ) as unknown as
            RealtimeWebSocket
      );

    this.scheduler =
      options.scheduler
      ?? defaultScheduler;

    this.watchdogScheduler =
      options.watchdogScheduler
      ?? defaultScheduler;

    this.silentStreamTimeoutMs =
      options.silentStreamTimeoutMs
      ?? MARKET_WIDE_SILENT_STREAM_TIMEOUT_MS;

    this.now =
      options.now
      ?? (() => new Date());

    this.metricsStore =
      new MarketWideOneMinuteMetricsStore(
        this.symbols,
      );
  }

  start(): void {
    if (
      this.started
      && !this.manuallyStopped
    ) {
      return;
    }

    this.started = true;
    this.manuallyStopped = false;
    this.lastError = null;

    this.rebuildSockets();
  }

  stop(): void {
    this.manuallyStopped = true;
    this.started = false;
    this.generation += 1;

    this.closeShards(
      'NEXUS market-wide shutdown',
    );
  }

  replaceSymbols(
    symbols: readonly string[],
  ): MarketWideSymbolChange {
    const normalizedSymbols =
      normalizeSymbols(symbols);

    const changes =
      this.metricsStore.replaceSymbols(
        normalizedSymbols,
      );

    this.symbols =
      normalizedSymbols;

    if (
      this.started
      && (
        changes.addedSymbols.length > 0
        || changes.removedSymbols.length > 0
      )
    ) {
      this.rebuildSockets();
    }

    return changes;
  }

  getSymbols(): string[] {
    return [...this.symbols];
  }

  getKlines(
    symbol: string,
    limit?: number,
  ): BinanceOneMinuteKlineUpdate[] {
    return this.metricsStore.getKlines(
      symbol,
      limit,
    );
  }

  getLatestRealtimeCandle(
    symbol: string,
    timeframe:
      RealtimeCandleTimeframe =
        '1m',
  ): RealtimeCandle | null {
    return aggregateRealtimeCandle(
      this.getKlines(
        symbol,
        getRealtimeCandleWindowSize(
          timeframe,
        ),
      ),
      timeframe,
    );
  }

  subscribeRealtimeCandles(
    symbol: string,
    listener:
      MarketWideRealtimeCandleListener,
  ): () => void {
    const normalizedSymbol =
      normalizeSymbol(
        symbol,
      );

    const listeners =
      this.realtimeCandleListeners.get(
        normalizedSymbol,
      )
      ?? new Set<
        MarketWideRealtimeCandleListener
      >();

    listeners.add(
      listener,
    );

    this.realtimeCandleListeners.set(
      normalizedSymbol,
      listeners,
    );

    return () => {
      const currentListeners =
        this.realtimeCandleListeners.get(
          normalizedSymbol,
        );

      if (!currentListeners) {
        return;
      }

      currentListeners.delete(
        listener,
      );

      if (
        currentListeners.size === 0
      ) {
        this.realtimeCandleListeners.delete(
          normalizedSymbol,
        );
      }
    };
  }

  getState(
    symbol: string,
  ): {
    kline:
      BinanceOneMinuteKlineUpdate
      | null;
    bookTicker:
      RealtimeBookTicker
      | null;
  } | null {
    return this.metricsStore.getState(
      symbol,
    );
  }

  subscribeKlineChanges(
    listener:
      MarketWideKlineChangeListener,
  ): () => void {
    this.klineChangeListeners.add(
      listener,
    );

    return () => {
      this.klineChangeListeners.delete(
        listener,
      );
    };
  }

  getMetrics(
    symbol?: string,
    scannerWindow:
      MarketScannerWindowId = '1m',
  ): MarketScannerMetrics[] {
    return this.metricsStore.getMetrics(
      symbol,
      scannerWindow,
    );
  }

  getVolumeSpikes(
    symbol?: string,
    options?: MarketVolumeSpikeOptions,
  ): MarketVolumeSpike[] {
    return this.metricsStore.getVolumeSpikes(
      symbol,
      options,
    );
  }

  applyHistoricalKlines(
    updates:
      readonly BinanceOneMinuteKlineUpdate[],
  ): number {
    const appliedCount =
      this.metricsStore
        .applyHistoricalKlines(
          updates,
        );

    if (appliedCount > 0) {
      const trackedSymbols =
        new Set(
          this.symbols,
        );

      const changedSymbols =
        [
          ...new Set(
            updates
              .filter(
                (update) =>
                  update.isClosed,
              )
              .map(
                (update) =>
                  normalizeSymbol(
                    update.symbol,
                  ),
              )
              .filter(
                (symbol) =>
                  trackedSymbols.has(
                    symbol,
                  ),
              ),
          ),
        ].sort();

      if (
        changedSymbols.length > 0
      ) {
        this.emitKlineChange({
          source: 'history',
          symbols:
            changedSymbols,
        });
      }
    }

    return appliedCount;
  }

  getStatus():
  MarketWideRealtimeStatus {
    const connectedSockets =
      this.shards.filter(
        (shard) =>
          shard.connected,
      ).length;

    const reconnectAttempts =
      this.shards.reduce(
        (
          total,
          shard,
        ) =>
          total
          + shard.reconnectAttempts,
        0,
      );

    let state:
      MarketWideRealtimeState;

    if (this.manuallyStopped) {
      state = 'stopped';
    } else if (!this.started) {
      state = 'idle';
    } else if (
      this.shards.length === 0
    ) {
      state = 'connected';
    } else if (
      connectedSockets
      === this.shards.length
    ) {
      state = 'connected';
    } else if (
      connectedSockets > 0
    ) {
      state = 'degraded';
    } else if (
      reconnectAttempts > 0
    ) {
      state = 'reconnecting';
    } else {
      state = 'connecting';
    }

    return {
      state,
      symbolsCount:
        this.symbols.length,
      streamCount:
        this.shards.reduce(
          (
            total,
            shard,
          ) =>
            total
            + shard.streams.length,
          0,
        ),
      socketCount:
        this.shards.length,
      connectedSockets,
      lastMessageAt:
        this.lastMessageAt,
      reconnectAttempts,
      lastError:
        this.lastError,
    };
  }

  getShards():
  MarketWideStreamShard[] {
    return this.shards.map(
      (shard) => ({
        id: shard.id,
        route: shard.route,
        symbols:
          [...shard.symbols],
        streams:
          [...shard.streams],
      }),
    );
  }

  private rebuildSockets(): void {
    this.generation += 1;

    this.closeShards(
      'NEXUS market-wide subscriptions changed',
    );

    const definitions =
      buildMarketWideStreamShards(
        this.symbols,
        this.options
          .maxStreamsPerSocket,
      );

    this.shards =
      definitions.map(
        (
          definition,
        ): MarketWideShardRuntime => ({
          ...definition,
          socket: null,
          connected: false,
          reconnectAttempts: 0,
          reconnectHandle: null,
          watchdogHandle: null,
        }),
      );

    const generation =
      this.generation;

    for (const shard of this.shards) {
      this.connectShard(
        shard,
        generation,
      );
    }
  }

  private closeShards(
    reason: string,
  ): void {
    for (const shard of this.shards) {
      if (
        shard.reconnectHandle
        !== null
      ) {
        this.scheduler.cancel(
          shard.reconnectHandle,
        );

        shard.reconnectHandle =
          null;
      }

      this.cancelShardWatchdog(
        shard,
      );

      const socket =
        shard.socket;

      shard.socket = null;
      shard.connected = false;

      socket?.close(
        1000,
        reason,
      );
    }

    this.shards = [];
  }

  private connectShard(
    shard:
      MarketWideShardRuntime,
    generation: number,
  ): void {
    if (
      this.manuallyStopped
      || generation
        !== this.generation
    ) {
      return;
    }

    let socket:
      RealtimeWebSocket;

    try {
      socket =
        this.socketFactory(
          this.buildShardUrl(
            shard,
          ),
        );
    } catch (error) {
      this.lastError =
        error instanceof Error
          ? error.message
          : 'Unable to create market-wide Binance WebSocket';

      this.scheduleReconnect(
        shard,
        generation,
      );

      return;
    }

    shard.socket = socket;
    shard.connected = false;

    socket.addEventListener(
      'open',
      () => {
        if (
          this.manuallyStopped
          || generation
            !== this.generation
          || shard.socket
            !== socket
        ) {
          return;
        }

        shard.connected = true;
        shard.reconnectAttempts = 0;
        this.lastError = null;

        this.armShardWatchdog(
          shard,
          generation,
          socket,
        );
      },
    );

    socket.addEventListener(
      'message',
      (event) => {
        this.handleMessage(
          shard,
          generation,
          socket,
          event,
        );
      },
    );

    socket.addEventListener(
      'error',
      () => {
        if (
          this.manuallyStopped
          || generation
            !== this.generation
          || shard.socket
            !== socket
        ) {
          return;
        }

        this.lastError =
          `Binance market-wide WebSocket shard ${shard.id} error`;
      },
    );

    socket.addEventListener(
      'close',
      (event) => {
        if (
          this.manuallyStopped
          || generation
            !== this.generation
          || shard.socket
            !== socket
        ) {
          return;
        }

        this.cancelShardWatchdog(
          shard,
        );

        shard.socket = null;
        shard.connected = false;

        if (event.code !== 1000) {
          this.lastError =
            `Binance market-wide WebSocket shard ${shard.id} closed`
            + (
              event.code
                ? ` with code ${event.code}`
                : ''
            )
            + (
              event.reason
                ? `: ${event.reason}`
                : ''
            );
        }

        this.scheduleReconnect(
          shard,
          generation,
        );
      },
    );
  }

  private emitRealtimeCandle(
    candle: RealtimeCandle,
  ): void {
    const listeners =
      this.realtimeCandleListeners.get(
        candle.symbol,
      );

    if (!listeners) {
      return;
    }

    for (
      const listener
      of listeners
    ) {
      try {
        listener(
          cloneRealtimeCandle(
            candle,
          ),
        );
      } catch (error) {
        this.lastError =
          error instanceof Error
            ? error.message
            : 'Unable to notify realtime candle listener';
      }
    }
  }

  private emitKlineChange(
    event: MarketWideKlineChange,
  ): void {
    for (
      const listener
      of this.klineChangeListeners
    ) {
      try {
        listener({
          source:
            event.source,
          symbols: [
            ...event.symbols,
          ],
        });
      } catch (error) {
        this.lastError =
          error instanceof Error
            ? error.message
            : 'Unable to notify market-wide kline listener';
      }
    }
  }

  private buildShardUrl(
    shard:
      MarketWideStreamShard,
  ): string {
    return (
      `${this.baseUrl}/${shard.route}/stream?streams=`
      + shard.streams.join('/')
    );
  }

  private handleMessage(
    shard:
      MarketWideShardRuntime,
    generation: number,
    socket:
      RealtimeWebSocket,
    event:
      RealtimeSocketEvent,
  ): void {
    if (
      this.manuallyStopped
      || generation
        !== this.generation
      || shard.socket
        !== socket
    ) {
      return;
    }

    const data = event.data;

    if (typeof data === 'string') {
      this.processTextMessage(
        shard,
        generation,
        socket,
        data,
      );

      return;
    }

    if (data instanceof ArrayBuffer) {
      this.processTextMessage(
        shard,
        generation,
        socket,
        new TextDecoder()
          .decode(data),
      );

      return;
    }

    if (ArrayBuffer.isView(data)) {
      const bytes =
        new Uint8Array(
          data.buffer,
          data.byteOffset,
          data.byteLength,
        );

      this.processTextMessage(
        shard,
        generation,
        socket,
        new TextDecoder()
          .decode(bytes),
      );

      return;
    }

    if (data instanceof Blob) {
      void data.text()
        .then((text) => {
          if (
            !this.manuallyStopped
            && generation
              === this.generation
            && shard.socket
              === socket
          ) {
            this.processTextMessage(
              shard,
              generation,
              socket,
              text,
            );
          }
        });
    }
  }

  private processTextMessage(
    shard:
      MarketWideShardRuntime,
    generation: number,
    socket:
      RealtimeWebSocket,
    text: string,
  ): void {
    let payload:
      CombinedStreamPayload;

    try {
      payload =
        JSON.parse(
          text,
        ) as CombinedStreamPayload;
    } catch {
      this.lastError =
        `Binance market-wide shard ${shard.id} returned invalid JSON`;

      return;
    }

    if (
      typeof payload.stream
        !== 'string'
      || typeof payload.data
        !== 'object'
      || payload.data === null
    ) {
      return;
    }

    const stream =
      payload.stream.toLowerCase();

    const receivedAt =
      this.now().toISOString();

    try {
      if (
        stream.endsWith(
          '@kline_1m',
        )
      ) {
        const update =
          parseBinanceOneMinuteKlineEvent(
            payload.data,
          );

        const lagMs =
          this.getExchangeLagMs(
            update.eventTime,
            receivedAt,
          );

        if (
          lagMs !== null
          && lagMs
            > MARKET_WIDE_EVENT_STALE_AFTER_MS
        ) {
          /*
           * A delayed exchange event is a data-quality
           * anomaly, not proof that the WebSocket shard
           * itself is broken.
           *
           * Drop the event without refreshing the silence
           * watchdog. If the shard actually stops delivering
           * fresh events, silent-stream recovery will replace
           * it.
           */
          return;
        }

        this.lastMessageAt =
          receivedAt;

        this.armShardWatchdog(
          shard,
          generation,
          socket,
        );

        const applied =
          this.metricsStore.applyKline(
            update,
          );

        if (applied) {
          this.emitRealtimeCandle(
            buildRealtimeCandle(
              update,
            ),
          );
        }

        if (
          applied
          && update.isClosed
        ) {
          this.emitKlineChange({
            source: 'live',
            symbols: [
              update.symbol,
            ],
          });
        }

        return;
      }

      if (
        stream === '!bookticker'
        || stream.endsWith(
          '@bookticker',
        )
      ) {
        const rawBookTicker =
          payload.data as
            BinanceBookTickerEvent;

        if (
          stream === '!bookticker'
          && rawBookTicker.st === 2
        ) {
          const eventTime =
            readNumber(
              rawBookTicker.E,
            );

          const receivedAtMs =
            Date.parse(
              receivedAt,
            );

          const lagMs =
            eventTime === null
            || !Number.isFinite(
              receivedAtMs,
            )
              ? null
              : receivedAtMs
                - eventTime;

          if (
            lagMs !== null
            && lagMs
              > MARKET_WIDE_EVENT_STALE_AFTER_MS
          ) {
            return;
          }

          /*
           * The all-market public stream itself is healthy.
           * The event belongs to COIN-M, so it must not enter
           * the USD-M metrics store, but it may refresh the
           * transport watchdog.
           */
          this.lastMessageAt =
            receivedAt;

          this.armShardWatchdog(
            shard,
            generation,
            socket,
          );

          return;
        }

        const ticker =
          parseBinanceMarketWideBookTicker(
            payload.data,
            receivedAt,
          );

        const lagMs =
          this.getExchangeLagMs(
            ticker.updatedAt,
            receivedAt,
          );

        if (
          lagMs !== null
          && lagMs
            > MARKET_WIDE_EVENT_STALE_AFTER_MS
        ) {
          /*
           * A delayed exchange event is a data-quality
           * anomaly, not proof that the WebSocket shard
           * itself is broken.
           *
           * Drop the event without refreshing the silence
           * watchdog. If the shard actually stops delivering
           * fresh events, silent-stream recovery will replace
           * it.
           */
          return;
        }

        this.lastMessageAt =
          receivedAt;

        this.armShardWatchdog(
          shard,
          generation,
          socket,
        );

        this.metricsStore
          .applyBookTicker(
            ticker,
          );
      }
    } catch (error) {
      this.lastError =
        error instanceof Error
          ? error.message
          : `Unable to process market-wide shard ${shard.id} message`;
    }
  }

  private getExchangeLagMs(
    exchangeTimestamp:
      string,
    receivedAt:
      string,
  ): number | null {
    const exchangeMs =
      Date.parse(
        exchangeTimestamp,
      );

    const receivedMs =
      Date.parse(
        receivedAt,
      );

    if (
      !Number.isFinite(
        exchangeMs,
      )
      || !Number.isFinite(
        receivedMs,
      )
    ) {
      return null;
    }

    return (
      receivedMs
      - exchangeMs
    );
  }

  private cancelShardWatchdog(
    shard:
      MarketWideShardRuntime,
  ): void {
    const handle =
      shard.watchdogHandle;

    shard.watchdogHandle =
      null;

    if (handle !== null) {
      this.watchdogScheduler
        .cancel(
          handle,
        );
    }
  }

  private armShardWatchdog(
    shard:
      MarketWideShardRuntime,
    generation: number,
    socket:
      RealtimeWebSocket,
  ): void {
    if (
      this.manuallyStopped
      || generation
        !== this.generation
      || shard.socket
        !== socket
      || !shard.connected
    ) {
      return;
    }

    this.cancelShardWatchdog(
      shard,
    );

    let handle:
      unknown = null;

    handle =
      this.watchdogScheduler
        .schedule(
          () => {
            /*
             * Ignore a callback belonging to an older,
             * already cancelled watchdog generation.
             */
            if (
              shard.watchdogHandle
              !== handle
            ) {
              return;
            }

            shard.watchdogHandle =
              null;

            if (
              this.manuallyStopped
              || generation
                !== this.generation
              || shard.socket
                !== socket
              || !shard.connected
            ) {
              return;
            }

            this.recoverSilentShard(
              shard,
              generation,
              socket,
            );
          },
          this.silentStreamTimeoutMs,
        );

    shard.watchdogHandle =
      handle;
  }

  private recoverSilentShard(
    shard:
      MarketWideShardRuntime,
    generation: number,
    socket:
      RealtimeWebSocket,
  ): void {
    if (
      this.manuallyStopped
      || generation
        !== this.generation
      || shard.socket
        !== socket
      || shard.reconnectHandle
        !== null
    ) {
      return;
    }

    this.cancelShardWatchdog(
      shard,
    );

    shard.socket =
      null;

    shard.connected =
      false;

    this.lastError =
      `Binance market-wide shard ${shard.id} silent stream: `
      + `no fresh messages for ${this.silentStreamTimeoutMs}ms`;

    this.scheduleReconnect(
      shard,
      generation,
    );

    socket.close(
      1000,
      'NEXUS silent stream recovery',
    );
  }

  private scheduleReconnect(
    shard:
      MarketWideShardRuntime,
    generation: number,
  ): void {
    if (
      this.manuallyStopped
      || generation
        !== this.generation
      || shard.reconnectHandle
        !== null
    ) {
      return;
    }

    shard.reconnectAttempts += 1;

    const delayMs =
      Math.min(
        this.options
          .reconnectBaseDelayMs
          * 2 ** (
            shard.reconnectAttempts
            - 1
          ),
        this.options
          .reconnectMaxDelayMs,
      );

    shard.reconnectHandle =
      this.scheduler.schedule(
        () => {
          shard.reconnectHandle =
            null;

          this.connectShard(
            shard,
            generation,
          );
        },
        delayMs,
      );
  }
}
