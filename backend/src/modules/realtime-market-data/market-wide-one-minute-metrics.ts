import {
  calculateMarketScannerActivityScore,
  calculateMarketScannerLiquidityScore,
  type MarketScannerMetrics,
} from './market-scanner-metrics.js';
import {
  calculateScannerRelativeStrengthPct,
} from './scanner-btc-comparison.js';
import type {
  RealtimeBookTicker,
} from './realtime-market-data.types.js';

export interface BinanceOneMinuteKlineUpdate {
  symbol: string;
  eventTime: string;
  openTime: string;
  closeTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  quoteVolume: number;
  tradesCount: number;
  takerBuyQuoteVolume: number;
  isClosed: boolean;
}

export interface MarketWideSymbolChange {
  addedSymbols: string[];
  removedSymbols: string[];
}

interface MarketWideSymbolState {
  kline:
    BinanceOneMinuteKlineUpdate
    | null;
  bookTicker:
    RealtimeBookTicker
    | null;
}

type UnknownRecord =
  Record<string, unknown>;

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

function normalizeSymbol(
  value: unknown,
): string {
  if (typeof value !== 'string') {
    throw new Error(
      'Invalid Binance market-wide symbol',
    );
  }

  const symbol =
    value.trim().toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new Error(
      `Invalid Binance market-wide symbol: ${value}`,
    );
  }

  return symbol;
}

function readString(
  record: UnknownRecord,
  key: string,
): string {
  const value = record[key];

  if (
    typeof value !== 'string'
    || value.length === 0
  ) {
    throw new Error(
      `Invalid Binance kline field: ${key}`,
    );
  }

  return value;
}

function readFiniteNumber(
  record: UnknownRecord,
  key: string,
  minimum: number,
): number {
  const value = record[key];

  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  if (
    !Number.isFinite(parsed)
    || parsed < minimum
  ) {
    throw new Error(
      `Invalid Binance kline field: ${key}`,
    );
  }

  return parsed;
}

function readInteger(
  record: UnknownRecord,
  key: string,
  minimum: number,
): number {
  const parsed =
    readFiniteNumber(
      record,
      key,
      minimum,
    );

  if (!Number.isInteger(parsed)) {
    throw new Error(
      `Invalid Binance kline field: ${key}`,
    );
  }

  return parsed;
}

function readBoolean(
  record: UnknownRecord,
  key: string,
): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new Error(
      `Invalid Binance kline field: ${key}`,
    );
  }

  return value;
}

function timestampToIso(
  timestampMs: number,
  field: string,
): string {
  const date =
    new Date(timestampMs);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new Error(
      `Invalid Binance kline timestamp: ${field}`,
    );
  }

  return date.toISOString();
}

function cloneKline(
  value:
    BinanceOneMinuteKlineUpdate
    | null,
):
  BinanceOneMinuteKlineUpdate
  | null {
  return value
    ? { ...value }
    : null;
}

function cloneBookTicker(
  value:
    RealtimeBookTicker
    | null,
):
  RealtimeBookTicker
  | null {
  return value
    ? { ...value }
    : null;
}

function createEmptyState():
MarketWideSymbolState {
  return {
    kline: null,
    bookTicker: null,
  };
}

function latestTimestamp(
  values:
    readonly (
      string
      | null
      | undefined
    )[],
): string | null {
  let latestValue:
    string | null = null;

  let latestTime =
    Number.NEGATIVE_INFINITY;

  for (const value of values) {
    if (!value) {
      continue;
    }

    const timestamp =
      Date.parse(value);

    if (
      Number.isFinite(timestamp)
      && timestamp > latestTime
    ) {
      latestTime = timestamp;
      latestValue = value;
    }
  }

  return latestValue;
}

export function parseBinanceOneMinuteKlineEvent(
  payload: unknown,
): BinanceOneMinuteKlineUpdate {
  if (!isRecord(payload)) {
    throw new Error(
      'Invalid Binance kline payload',
    );
  }

  if (payload.e !== 'kline') {
    throw new Error(
      'Binance payload is not a kline event',
    );
  }

  if (!isRecord(payload.k)) {
    throw new Error(
      'Invalid Binance kline body',
    );
  }

  const kline = payload.k;

  const symbol =
    normalizeSymbol(payload.s);

  const klineSymbol =
    normalizeSymbol(kline.s);

  if (symbol !== klineSymbol) {
    throw new Error(
      'Binance kline symbol mismatch',
    );
  }

  const interval =
    readString(kline, 'i');

  if (interval !== '1m') {
    throw new Error(
      `Unsupported Binance kline interval: ${interval}`,
    );
  }

  const eventTimeMs =
    readInteger(
      payload,
      'E',
      0,
    );

  const openTimeMs =
    readInteger(
      kline,
      't',
      0,
    );

  const closeTimeMs =
    readInteger(
      kline,
      'T',
      openTimeMs,
    );

  const open =
    readFiniteNumber(
      kline,
      'o',
      Number.MIN_VALUE,
    );

  const high =
    readFiniteNumber(
      kline,
      'h',
      Number.MIN_VALUE,
    );

  const low =
    readFiniteNumber(
      kline,
      'l',
      Number.MIN_VALUE,
    );

  const close =
    readFiniteNumber(
      kline,
      'c',
      Number.MIN_VALUE,
    );

  const quoteVolume =
    readFiniteNumber(
      kline,
      'q',
      0,
    );

  const tradesCount =
    readInteger(
      kline,
      'n',
      0,
    );

  const takerBuyQuoteVolume =
    readFiniteNumber(
      kline,
      'Q',
      0,
    );

  if (
    high < Math.max(open, close)
    || low > Math.min(open, close)
    || high < low
  ) {
    throw new Error(
      'Invalid Binance kline OHLC values',
    );
  }

  if (
    takerBuyQuoteVolume
    > quoteVolume + 0.00000001
  ) {
    throw new Error(
      'Invalid Binance kline taker buy volume',
    );
  }

  return {
    symbol,
    eventTime:
      timestampToIso(
        eventTimeMs,
        'E',
      ),
    openTime:
      timestampToIso(
        openTimeMs,
        't',
      ),
    closeTime:
      timestampToIso(
        closeTimeMs,
        'T',
      ),
    open,
    high,
    low,
    close,
    quoteVolume,
    tradesCount,
    takerBuyQuoteVolume,
    isClosed:
      readBoolean(kline, 'x'),
  };
}

export class MarketWideOneMinuteMetricsStore {
  private readonly states =
    new Map<
      string,
      MarketWideSymbolState
    >();

  constructor(
    symbols: readonly string[] = [],
  ) {
    this.replaceSymbols(symbols);
  }

  replaceSymbols(
    symbols: readonly string[],
  ): MarketWideSymbolChange {
    const normalizedSymbols =
      [
        ...new Set(
          symbols.map(
            normalizeSymbol,
          ),
        ),
      ].sort();

    const nextSymbolSet =
      new Set(normalizedSymbols);

    const removedSymbols =
      [...this.states.keys()]
        .filter(
          (symbol) =>
            !nextSymbolSet.has(symbol),
        )
        .sort();

    const addedSymbols =
      normalizedSymbols
        .filter(
          (symbol) =>
            !this.states.has(symbol),
        );

    for (
      const symbol
      of removedSymbols
    ) {
      this.states.delete(symbol);
    }

    for (
      const symbol
      of addedSymbols
    ) {
      this.states.set(
        symbol,
        createEmptyState(),
      );
    }

    return {
      addedSymbols,
      removedSymbols,
    };
  }

  getSymbols(): string[] {
    return [
      ...this.states.keys(),
    ].sort();
  }

  applyKline(
    update:
      BinanceOneMinuteKlineUpdate,
  ): boolean {
    const symbol =
      normalizeSymbol(
        update.symbol,
      );

    const state =
      this.states.get(symbol);

    if (!state) {
      return false;
    }

    const current =
      state.kline;

    if (current) {
      const currentOpenTime =
        Date.parse(
          current.openTime,
        );

      const nextOpenTime =
        Date.parse(
          update.openTime,
        );

      const currentEventTime =
        Date.parse(
          current.eventTime,
        );

      const nextEventTime =
        Date.parse(
          update.eventTime,
        );

      if (
        nextOpenTime < currentOpenTime
        || (
          nextOpenTime
            === currentOpenTime
          && nextEventTime
            < currentEventTime
        )
      ) {
        return false;
      }
    }

    state.kline = {
      ...update,
      symbol,
    };

    return true;
  }

  applyBookTicker(
    ticker:
      RealtimeBookTicker,
  ): boolean {
    const symbol =
      normalizeSymbol(
        ticker.symbol,
      );

    const state =
      this.states.get(symbol);

    if (!state) {
      return false;
    }

    const updatedAtMs =
      Date.parse(
        ticker.updatedAt,
      );

    if (
      !Number.isFinite(updatedAtMs)
      || !Number.isFinite(
        ticker.bidPrice,
      )
      || ticker.bidPrice <= 0
      || !Number.isFinite(
        ticker.askPrice,
      )
      || ticker.askPrice <= 0
      || !Number.isFinite(
        ticker.bidQuantity,
      )
      || ticker.bidQuantity < 0
      || !Number.isFinite(
        ticker.askQuantity,
      )
      || ticker.askQuantity < 0
      || ticker.askPrice
        < ticker.bidPrice
    ) {
      throw new Error(
        `Invalid market-wide book ticker: ${symbol}`,
      );
    }

    const currentUpdatedAtMs =
      state.bookTicker
        ? Date.parse(
            state.bookTicker
              .updatedAt,
          )
        : Number
            .NEGATIVE_INFINITY;

    if (
      updatedAtMs
      < currentUpdatedAtMs
    ) {
      return false;
    }

    const spread =
      ticker.askPrice
      - ticker.bidPrice;

    const midpoint =
      (
        ticker.askPrice
        + ticker.bidPrice
      ) / 2;

    state.bookTicker = {
      ...ticker,
      symbol,
      spread,
      spreadPct:
        midpoint > 0
          ? (
              spread
              / midpoint
            ) * 100
          : 0,
    };

    return true;
  }

  getMetrics(
    symbol?: string,
  ): MarketScannerMetrics[] {
    if (symbol) {
      const normalizedSymbol =
        normalizeSymbol(symbol);

      const state =
        this.states.get(
          normalizedSymbol,
        );

      return state
        ? [
            this.buildMetrics(
              normalizedSymbol,
              state,
            ),
          ]
        : [];
    }

    const baseMetrics =
      this.getSymbols()
        .map((item) => {
          const state =
            this.states.get(item);

          if (!state) {
            throw new Error(
              `Missing market-wide state: ${item}`,
            );
          }

          return this.buildMetrics(
            item,
            state,
          );
        });

    const btcChange =
      baseMetrics.find(
        (metric) =>
          metric.symbol
          === 'BTCUSDT',
      )?.priceChangePct
      ?? null;

    return baseMetrics.map(
      (metric) => ({
        ...metric,
        relativeStrengthPct:
          calculateScannerRelativeStrengthPct(
            metric.priceChangePct,
            btcChange,
          ),
      }),
    );
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
    const normalizedSymbol =
      normalizeSymbol(symbol);

    const state =
      this.states.get(
        normalizedSymbol,
      );

    return state
      ? {
          kline:
            cloneKline(
              state.kline,
            ),
          bookTicker:
            cloneBookTicker(
              state.bookTicker,
            ),
        }
      : null;
  }

  private buildMetrics(
    symbol: string,
    state:
      MarketWideSymbolState,
  ): MarketScannerMetrics {
    const kline =
      state.kline;

    const bookTicker =
      state.bookTicker;

    const bidQuoteValue =
      bookTicker
        ? (
            bookTicker.bidPrice
            * bookTicker
                .bidQuantity
          )
        : null;

    const askQuoteValue =
      bookTicker
        ? (
            bookTicker.askPrice
            * bookTicker
                .askQuantity
          )
        : null;

    const topBookQuoteValue =
      bidQuoteValue !== null
      && askQuoteValue !== null
        ? (
            bidQuoteValue
            + askQuoteValue
          )
        : null;

    const orderBookImbalancePct =
      bidQuoteValue !== null
      && askQuoteValue !== null
      && (
        bidQuoteValue
        + askQuoteValue
      ) > 0
        ? (
            (
              bidQuoteValue
              - askQuoteValue
            )
            / (
              bidQuoteValue
              + askQuoteValue
            )
          ) * 100
        : null;

    const liquidityScore =
      bookTicker
      && topBookQuoteValue !== null
        ? calculateMarketScannerLiquidityScore(
            bookTicker.spreadPct,
            topBookQuoteValue,
          )
        : null;

    const price =
      kline?.close
      ?? (
        bookTicker
          ? (
              bookTicker.bidPrice
              + bookTicker.askPrice
            ) / 2
          : null
      );

    const priceChangePct =
      kline
        ? (
            (
              kline.close
              - kline.open
            )
            / kline.open
          ) * 100
        : null;

    const volatilityPct =
      kline
        ? (
            (
              kline.high
              - kline.low
            )
            / kline.open
          ) * 100
        : null;

    const quoteVolume =
      kline?.quoteVolume
      ?? 0;

    const tradesCount =
      kline?.tradesCount
      ?? 0;

    const buyQuoteVolume =
      kline
        ?.takerBuyQuoteVolume
      ?? 0;

    const sellQuoteVolume =
      Math.max(
        0,
        quoteVolume
        - buyQuoteVolume,
      );

    const activityScore =
      calculateMarketScannerActivityScore(
        quoteVolume,
        tradesCount,
        volatilityPct,
        liquidityScore,
        tradesCount,
      );

    return {
      symbol,
      scannerWindow: '1m',
      windowMs: 60_000,
      price,
      priceChangePct,
      btcCorrelation: null,
      relativeStrengthPct: null,
      volatilityPct,
      spreadPct:
        bookTicker?.spreadPct
        ?? null,
      topBookQuoteValue,
      orderBookImbalancePct,
      liquidityScore,
      activityScore,
      quoteVolume,
      tradesCount,
      tradesPerMinute:
        tradesCount,
      buyTradesCount: 0,
      sellTradesCount: 0,
      buyQuoteVolume,
      sellQuoteVolume,
      windowStartedAt:
        kline?.openTime
        ?? null,
      updatedAt:
        latestTimestamp([
          kline?.eventTime,
          bookTicker?.updatedAt,
        ]),
    };
  }
}