import type {
  Candle,
} from '../../api/contracts.js';
import {
  normalizeMarketCandleSymbol,
  normalizeMarketCandleTimeframe,
  parseMarketCandle,
  type MarketCandleTimeframe,
} from './marketCandles.js';

export const LIVE_MARKET_CANDLES_STREAM_PATH =
  '/api/v1/market/realtime/stream';

const EVENT_SOURCE_CONNECTING =
  0;

export type LiveMarketCandleConnectionState =
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'error';

export interface LiveMarketCandle
  extends Candle {
  symbol: string;
  timeframe: MarketCandleTimeframe;
  quoteVolume: number;
  isClosed: boolean;
  updatedAt: string;
}

export interface LiveMarketCandleSubscriptionOptions {
  baseUrl?: string;
  symbol: string;
  timeframe: MarketCandleTimeframe;
}

export interface LiveMarketCandleSubscriptionState {
  connectionState:
    LiveMarketCandleConnectionState;
  candle:
    LiveMarketCandle
    | null;
  error:
    Error
    | null;
}

export type LiveMarketCandleListener =
  (
    state:
      LiveMarketCandleSubscriptionState,
  ) => void;

export type LiveMarketCandleEventSourceFactory =
  (
    url: string,
  ) => EventSource;

interface LiveMarketCandleEntry {
  url: string;
  symbol: string;
  timeframe:
    MarketCandleTimeframe;
  source:
    EventSource
    | null;
  detach:
    (() => void)
    | null;
  listeners:
    Set<
      LiveMarketCandleListener
    >;
  state:
    LiveMarketCandleSubscriptionState;
}

function resolveBaseUrl(
  baseUrl:
    string
    | undefined,
): string {
  return (
    baseUrl
      ?.trim()
      .replace(
        /\/+$/u,
        '',
      )
    ?? ''
  );
}

function isRecord(
  value: unknown,
): value is
Record<string, unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(
      value,
    )
  );
}

function readNonNegativeNumber(
  value: unknown,
  name: string,
): number {
  if (
    typeof value !== 'number'
    || !Number.isFinite(
      value,
    )
    || value < 0
  ) {
    throw new Error(
      `Invalid live market candle: ${name}`,
    );
  }

  return value;
}

function readTimestamp(
  value: unknown,
  name: string,
): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || !Number.isFinite(
      Date.parse(
        value,
      ),
    )
  ) {
    throw new Error(
      `Invalid live market candle: ${name}`,
    );
  }

  return value;
}

function cloneLiveCandle(
  candle:
    LiveMarketCandle
    | null,
): LiveMarketCandle | null {
  return candle
    ? {
        ...candle,
      }
    : null;
}

function cloneSubscriptionState(
  state:
    LiveMarketCandleSubscriptionState,
): LiveMarketCandleSubscriptionState {
  return {
    connectionState:
      state.connectionState,
    candle:
      cloneLiveCandle(
        state.candle,
      ),
    error:
      state.error,
  };
}

function shouldAcceptLiveCandle(
  current:
    LiveMarketCandle
    | null,
  next:
    LiveMarketCandle,
): boolean {
  if (!current) {
    return true;
  }

  const currentOpenTime =
    Date.parse(
      current.openTime,
    );

  const nextOpenTime =
    Date.parse(
      next.openTime,
    );

  if (
    nextOpenTime
    < currentOpenTime
  ) {
    return false;
  }

  if (
    nextOpenTime
    > currentOpenTime
  ) {
    return true;
  }

  return (
    Date.parse(
      next.updatedAt,
    )
    >= Date.parse(
      current.updatedAt,
    )
  );
}

function defaultEventSourceFactory(
  url: string,
): EventSource {
  return new EventSource(
    url,
  );
}

export function buildLiveMarketCandleStreamUrl(
  options:
    LiveMarketCandleSubscriptionOptions,
): string {
  const params =
    new URLSearchParams({
      candleSymbol:
        normalizeMarketCandleSymbol(
          options.symbol,
        ),
      candleTimeframe:
        normalizeMarketCandleTimeframe(
          options.timeframe,
        ),
      candleOnly:
        'true',
    });

  return (
    resolveBaseUrl(
      options.baseUrl,
    )
    + LIVE_MARKET_CANDLES_STREAM_PATH
    + `?${params.toString()}`
  );
}

export function parseLiveMarketCandle(
  value: unknown,
): LiveMarketCandle {
  if (!isRecord(value)) {
    throw new Error(
      'Invalid live market candle payload',
    );
  }

  if (
    typeof value.symbol
      !== 'string'
  ) {
    throw new Error(
      'Invalid live market candle: symbol',
    );
  }

  if (
    typeof value.timeframe
      !== 'string'
  ) {
    throw new Error(
      'Invalid live market candle: timeframe',
    );
  }

  if (
    typeof value.isClosed
      !== 'boolean'
  ) {
    throw new Error(
      'Invalid live market candle: isClosed',
    );
  }

  const candle =
    parseMarketCandle(
      value,
    );

  return {
    ...candle,
    symbol:
      normalizeMarketCandleSymbol(
        value.symbol,
      ),
    timeframe:
      normalizeMarketCandleTimeframe(
        value.timeframe,
      ),
    quoteVolume:
      readNonNegativeNumber(
        value.quoteVolume,
        'quoteVolume',
      ),
    isClosed:
      value.isClosed,
    updatedAt:
      readTimestamp(
        value.updatedAt,
        'updatedAt',
      ),
  };
}

export function toMarketCandle(
  candle:
    LiveMarketCandle,
): Candle {
  return {
    openTime:
      candle.openTime,
    closeTime:
      candle.closeTime,
    open:
      candle.open,
    high:
      candle.high,
    low:
      candle.low,
    close:
      candle.close,
    volume:
      candle.volume,
    tradesCount:
      candle.tradesCount,
    isClosed:
      candle.isClosed,
  };
}

export function mergeLiveMarketCandle(
  candles:
    readonly Candle[],
  liveCandle:
    LiveMarketCandle,
): Candle[] {
  const byOpenTime =
    new Map<
      string,
      Candle
    >();

  for (const candle of candles) {
    byOpenTime.set(
      candle.openTime,
      {
        ...candle,
      },
    );
  }

  const normalizedLiveCandle =
    toMarketCandle(
      liveCandle,
    );

  byOpenTime.set(
    normalizedLiveCandle.openTime,
    normalizedLiveCandle,
  );

  return [
    ...byOpenTime.values(),
  ].sort(
    (
      left,
      right,
    ) =>
      Date.parse(
        left.openTime,
      )
      - Date.parse(
        right.openTime,
      ),
  );
}

export class LiveMarketCandleStore {
  private readonly entries =
    new Map<
      string,
      LiveMarketCandleEntry
    >();

  private readonly eventSourceFactory:
    LiveMarketCandleEventSourceFactory;

  constructor(
    options: {
      eventSourceFactory?:
        LiveMarketCandleEventSourceFactory;
    } = {},
  ) {
    this.eventSourceFactory =
      options.eventSourceFactory
      ?? defaultEventSourceFactory;
  }

  subscribe(
    options:
      LiveMarketCandleSubscriptionOptions,
    listener:
      LiveMarketCandleListener,
  ): () => void {
    const url =
      buildLiveMarketCandleStreamUrl(
        options,
      );

    const symbol =
      normalizeMarketCandleSymbol(
        options.symbol,
      );

    const timeframe =
      normalizeMarketCandleTimeframe(
        options.timeframe,
      );

    let entry =
      this.entries.get(
        url,
      );

    if (!entry) {
      entry = {
        url,
        symbol,
        timeframe,
        source:
          null,
        detach:
          null,
        listeners:
          new Set(),
        state: {
          connectionState:
            'connecting',
          candle:
            null,
          error:
            null,
        },
      };

      this.entries.set(
        url,
        entry,
      );
    }

    entry.listeners.add(
      listener,
    );

    listener(
      cloneSubscriptionState(
        entry.state,
      ),
    );

    if (!entry.source) {
      this.connect(
        entry,
      );
    }

    let active =
      true;

    return () => {
      if (!active) {
        return;
      }

      active =
        false;

      entry?.listeners.delete(
        listener,
      );

      if (
        entry
        && entry.listeners.size
          === 0
      ) {
        this.closeEntry(
          entry,
        );

        this.entries.delete(
          url,
        );
      }
    };
  }

  getConnectionCount(): number {
    return this.entries.size;
  }

  closeAll(): void {
    for (
      const entry
      of this.entries.values()
    ) {
      this.closeEntry(
        entry,
      );
    }

    this.entries.clear();
  }

  private connect(
    entry:
      LiveMarketCandleEntry,
  ): void {
    entry.state = {
      ...entry.state,
      connectionState:
        'connecting',
      error:
        null,
    };

    this.notify(
      entry,
    );

    let source:
      EventSource;

    try {
      source =
        this.eventSourceFactory(
          entry.url,
        );
    } catch (error) {
      entry.state = {
        ...entry.state,
        connectionState:
          'error',
        error:
          error instanceof Error
            ? error
            : new Error(
                'Unable to create live candle connection',
              ),
      };

      this.notify(
        entry,
      );

      return;
    }

    entry.source =
      source;

    const handleOpen =
      () => {
        if (
          entry.source
          !== source
        ) {
          return;
        }

        entry.state = {
          ...entry.state,
          connectionState:
            'open',
          error:
            null,
        };

        this.notify(
          entry,
        );
      };

    const handleError =
      () => {
        if (
          entry.source
          !== source
        ) {
          return;
        }

        entry.state = {
          ...entry.state,
          connectionState:
            source.readyState
              === EVENT_SOURCE_CONNECTING
              ? 'reconnecting'
              : 'error',
          error:
            new Error(
              'Live candle connection interrupted',
            ),
        };

        this.notify(
          entry,
        );
      };

    const handleCandle =
      (
        event:
          Event,
      ) => {
        if (
          entry.source
          !== source
        ) {
          return;
        }

        try {
          const data =
            (
              event as
                MessageEvent<string>
            ).data;

          if (
            typeof data
              !== 'string'
          ) {
            throw new Error(
              'Live candle event has no data',
            );
          }

          const candle =
            parseLiveMarketCandle(
              JSON.parse(
                data,
              ) as unknown,
            );

          if (
            candle.symbol
              !== entry.symbol
            || candle.timeframe
              !== entry.timeframe
          ) {
            throw new Error(
              'Live candle event does not match its subscription',
            );
          }

          if (
            !shouldAcceptLiveCandle(
              entry.state.candle,
              candle,
            )
          ) {
            return;
          }

          entry.state = {
            connectionState:
              'open',
            candle,
            error:
              null,
          };

          this.notify(
            entry,
          );
        } catch (error) {
          entry.state = {
            ...entry.state,
            connectionState:
              'error',
            error:
              error instanceof Error
                ? error
                : new Error(
                    'Unable to parse live candle event',
                  ),
          };

          this.notify(
            entry,
          );
        }
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
      'candle',
      handleCandle,
    );

    entry.detach =
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
          'candle',
          handleCandle,
        );
      };
  }

  private notify(
    entry:
      LiveMarketCandleEntry,
  ): void {
    const state =
      cloneSubscriptionState(
        entry.state,
      );

    for (
      const listener
      of entry.listeners
    ) {
      listener(
        state,
      );
    }
  }

  private closeEntry(
    entry:
      LiveMarketCandleEntry,
  ): void {
    entry.detach?.();
    entry.detach =
      null;

    entry.source?.close();
    entry.source =
      null;
  }
}

export const liveMarketCandleStore =
  new LiveMarketCandleStore();
