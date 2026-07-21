import type {
  MarketScannerMetrics,
} from './market-scanner-metrics.js';
import {
  MarketWideOneMinuteMetricsStore,
  parseBinanceOneMinuteKlineEvent,
  type MarketWideSymbolChange,
} from './market-wide-one-minute-metrics.js';
import type {
  RealtimeBookTicker,
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

export interface MarketWideStreamShard {
  id: number;
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
  now?: () => Date;
}

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
}

interface MarketWideShardRuntime
  extends MarketWideStreamShard {
  socket: RealtimeWebSocket | null;
  connected: boolean;
  reconnectAttempts: number;
  reconnectHandle: unknown;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

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

  const symbolsPerSocket =
    Math.max(
      1,
      Math.floor(
        maxStreamsPerSocket / 2,
      ),
    );

  const shards:
    MarketWideStreamShard[] = [];

  for (
    let index = 0;
    index < normalizedSymbols.length;
    index += symbolsPerSocket
  ) {
    const shardSymbols =
      normalizedSymbols.slice(
        index,
        index + symbolsPerSocket,
      );

    const streams =
      shardSymbols.flatMap(
        (symbol) => {
          const normalized =
            symbol.toLowerCase();

          return [
            `${normalized}@kline_1m`,
            `${normalized}@bookTicker`,
          ];
        },
      );

    shards.push({
      id: shards.length,
      symbols: shardSymbols,
      streams,
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
  private readonly now: () => Date;

  private readonly metricsStore:
    MarketWideOneMinuteMetricsStore;

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

  getMetrics(
    symbol?: string,
  ): MarketScannerMetrics[] {
    return this.metricsStore.getMetrics(
      symbol,
    );
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
        this.symbols.length * 2,
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
        ) {
          return;
        }

        shard.connected = true;
        shard.reconnectAttempts = 0;
        this.lastError = null;
      },
    );

    socket.addEventListener(
      'message',
      (event) => {
        this.handleMessage(
          shard,
          generation,
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
        ) {
          return;
        }

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

  private buildShardUrl(
    shard:
      MarketWideStreamShard,
  ): string {
    return (
      `${this.baseUrl}/stream?streams=`
      + shard.streams.join('/')
    );
  }

  private handleMessage(
    shard:
      MarketWideShardRuntime,
    generation: number,
    event:
      RealtimeSocketEvent,
  ): void {
    if (
      this.manuallyStopped
      || generation
        !== this.generation
    ) {
      return;
    }

    const data = event.data;

    if (typeof data === 'string') {
      this.processTextMessage(
        shard,
        data,
      );

      return;
    }

    if (data instanceof ArrayBuffer) {
      this.processTextMessage(
        shard,
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
          ) {
            this.processTextMessage(
              shard,
              text,
            );
          }
        });
    }
  }

  private processTextMessage(
    shard:
      MarketWideShardRuntime,
    text: string,
  ): void {
    let payload:
      CombinedStreamPayload;

    try {
      payload =
        JSON.parse(text) as CombinedStreamPayload;
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

    this.lastMessageAt =
      receivedAt;

    try {
      if (
        stream.endsWith(
          '@kline_1m',
        )
      ) {
        this.metricsStore.applyKline(
          parseBinanceOneMinuteKlineEvent(
            payload.data,
          ),
        );

        return;
      }

      if (
        stream.endsWith(
          '@bookticker',
        )
      ) {
        this.metricsStore
          .applyBookTicker(
            parseBinanceMarketWideBookTicker(
              payload.data,
              receivedAt,
            ),
          );
      }
    } catch (error) {
      this.lastError =
        error instanceof Error
          ? error.message
          : `Unable to process market-wide shard ${shard.id} message`;
    }
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