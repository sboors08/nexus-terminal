import {
  calculateMarketScannerActivityScore,
  calculateMarketScannerLiquidityScore,
  type MarketScannerMetrics,
} from './market-scanner-metrics.js';
import {
  calculateScannerBtcCorrelation,
  calculateScannerRelativeStrengthPct,
  type ScannerPriceSample,
} from './scanner-btc-comparison.js';
import {
  calculateMarketVolumeSpike,
  DEFAULT_MARKET_VOLUME_SPIKE_OPTIONS,
  type MarketVolumeSpike,
  type MarketVolumeSpikeOptions,
} from './market-volume-spikes.js';
import {
  DEFAULT_MARKET_SCANNER_WINDOW,
  getMarketScannerWindowMs,
  type MarketScannerWindowId,
} from './scanner-windows.js';
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
  klines:
    BinanceOneMinuteKlineUpdate[];
  bookTicker:
    RealtimeBookTicker
    | null;
}

type UnknownRecord =
  Record<string, unknown>;

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const MAX_MARKET_WIDE_KLINES =
  getMarketScannerWindowMs(
    '3d',
  ) / 60_000;

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
    klines: [],
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

    const nextOpenTime =
      Date.parse(
        update.openTime,
      );

    const nextEventTime =
      Date.parse(
        update.eventTime,
      );

    if (
      !Number.isFinite(
        nextOpenTime,
      )
      || !Number.isFinite(
        nextEventTime,
      )
    ) {
      throw new Error(
        `Invalid market-wide kline timestamp: ${symbol}`,
      );
    }

    const latest =
      state.klines.at(-1);

    if (latest) {
      const latestOpenTime =
        Date.parse(
          latest.openTime,
        );

      const latestEventTime =
        Date.parse(
          latest.eventTime,
        );

      if (
        nextOpenTime
        < latestOpenTime
      ) {
        return false;
      }

      if (
        nextOpenTime
          === latestOpenTime
        && nextEventTime
          < latestEventTime
      ) {
        return false;
      }
    }

    const normalizedUpdate = {
      ...update,
      symbol,
    };

    if (
      latest
      && latest.openTime
        === normalizedUpdate.openTime
    ) {
      state.klines[
        state.klines.length - 1
      ] = normalizedUpdate;
    } else {
      state.klines.push(
        normalizedUpdate,
      );
    }

    if (
      state.klines.length
      > MAX_MARKET_WIDE_KLINES
    ) {
      state.klines.splice(
        0,
        state.klines.length
          - MAX_MARKET_WIDE_KLINES,
      );
    }

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
    scannerWindow:
      MarketScannerWindowId =
        DEFAULT_MARKET_SCANNER_WINDOW,
  ): MarketScannerMetrics[] {
    const symbols =
      symbol
        ? [
            normalizeSymbol(
              symbol,
            ),
          ]
        : this.getSymbols();

    const baseMetrics =
      symbols
        .map((item) => {
          const state =
            this.states.get(item);

          return state
            ? this.buildMetrics(
                item,
                state,
                scannerWindow,
              )
            : null;
        })
        .filter(
          (
            metric,
          ): metric is
          MarketScannerMetrics =>
            metric !== null,
        );

    const btcState =
      this.states.get(
        'BTCUSDT',
      );

    const btcMetric =
      btcState
        ? this.buildMetrics(
            'BTCUSDT',
            btcState,
            scannerWindow,
          )
        : null;

    const btcSamples =
      btcState
        ? this.getPriceSamples(
            btcState,
            scannerWindow,
          )
        : [];

    return baseMetrics.map(
      (metric) => {
        const metricState =
          this.states.get(
            metric.symbol,
          );

        const btcCorrelation =
          metric.symbol === 'BTCUSDT'
          || !metricState
            ? null
            : calculateScannerBtcCorrelation(
                this.getPriceSamples(
                  metricState,
                  scannerWindow,
                ),
                btcSamples,
              );

        return {
          ...metric,
          btcCorrelation,
          relativeStrengthPct:
            calculateScannerRelativeStrengthPct(
              metric.priceChangePct,
              btcMetric
                ?.priceChangePct
              ?? null,
            ),
        };
      },
    );
  }

  getVolumeSpikes(
    symbol?: string,
    options:
      MarketVolumeSpikeOptions =
        DEFAULT_MARKET_VOLUME_SPIKE_OPTIONS,
  ): MarketVolumeSpike[] {
    const symbols =
      symbol
        ? [
            normalizeSymbol(
              symbol,
            ),
          ]
        : this.getSymbols();

    return symbols
      .map((item) => {
        const state =
          this.states.get(item);

        return state
          ? calculateMarketVolumeSpike(
              item,
              state.klines,
              options,
            )
          : null;
      })
      .filter(
        (
          spike,
        ): spike is MarketVolumeSpike =>
          spike !== null,
      )
      .sort(
        (left, right) => {
          const ratioDifference =
            right.volumeRatio
            - left.volumeRatio;

          return ratioDifference !== 0
            ? ratioDifference
            : right.currentQuoteVolume
              - left.currentQuoteVolume;
        },
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

    const latestKline =
      state
        ?.klines
        .at(-1)
      ?? null;

    return state
      ? {
          kline:
            cloneKline(
              latestKline,
            ),
          bookTicker:
            cloneBookTicker(
              state.bookTicker,
            ),
        }
      : null;
  }

  private getWindowKlines(
    state:
      MarketWideSymbolState,
    scannerWindow:
      MarketScannerWindowId,
  ): BinanceOneMinuteKlineUpdate[] {
    const windowMinutes =
      getMarketScannerWindowMs(
        scannerWindow,
      ) / 60_000;

    return state
      .klines
      .slice(
        -windowMinutes,
      );
  }

  private getPriceSamples(
    state:
      MarketWideSymbolState,
    scannerWindow:
      MarketScannerWindowId,
  ): ScannerPriceSample[] {
    return this
      .getWindowKlines(
        state,
        scannerWindow,
      )
      .map((kline) => ({
        timestampMs:
          Date.parse(
            kline.openTime,
          ),
        closePrice:
          kline.close,
      }));
  }

  private buildMetrics(
    symbol: string,
    state:
      MarketWideSymbolState,
    scannerWindow:
      MarketScannerWindowId,
  ): MarketScannerMetrics {
    const klines =
      this.getWindowKlines(
        state,
        scannerWindow,
      );

    const firstKline =
      klines[0]
      ?? null;

    const latestKline =
      klines.at(-1)
      ?? null;

    const bookTicker =
      state.bookTicker;

    const windowMs =
      getMarketScannerWindowMs(
        scannerWindow,
      );

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
      latestKline?.close
      ?? (
        bookTicker
          ? (
              bookTicker.bidPrice
              + bookTicker.askPrice
            ) / 2
          : null
      );

    const priceChangePct =
      firstKline
      && latestKline
        ? (
            (
              latestKline.close
              - firstKline.open
            )
            / firstKline.open
          ) * 100
        : null;

    const highestPrice =
      klines.length > 0
        ? Math.max(
            ...klines.map(
              (kline) =>
                kline.high,
            ),
          )
        : null;

    const lowestPrice =
      klines.length > 0
        ? Math.min(
            ...klines.map(
              (kline) =>
                kline.low,
            ),
          )
        : null;

    const volatilityPct =
      firstKline
      && highestPrice !== null
      && lowestPrice !== null
        ? (
            (
              highestPrice
              - lowestPrice
            )
            / firstKline.open
          ) * 100
        : null;

    const quoteVolume =
      klines.reduce(
        (
          total,
          kline,
        ) =>
          total
          + kline.quoteVolume,
        0,
      );

    const tradesCount =
      klines.reduce(
        (
          total,
          kline,
        ) =>
          total
          + kline.tradesCount,
        0,
      );

    const collectedMinutes =
      Math.max(
        1,
        klines.length,
      );

    const tradesPerMinute =
      tradesCount
      / collectedMinutes;

    const buyQuoteVolume =
      klines.reduce(
        (
          total,
          kline,
        ) =>
          total
          + kline
              .takerBuyQuoteVolume,
        0,
      );

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
        tradesPerMinute,
      );

    return {
      symbol,
      scannerWindow,
      windowMs,
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
      tradesPerMinute,
      buyTradesCount: 0,
      sellTradesCount: 0,
      buyQuoteVolume,
      sellQuoteVolume,
      windowStartedAt:
        firstKline?.openTime
        ?? null,
      updatedAt:
        latestTimestamp([
          latestKline?.eventTime,
          bookTicker?.updatedAt,
        ]),
    };
  }

}
