import type {
  RealtimeBookTicker,
  RealtimeTrade,
} from './realtime-market-data.types.js';
import {
  DEFAULT_MARKET_SCANNER_WINDOW,
  getMarketScannerWindowMs,
  type MarketScannerWindowId,
} from './scanner-windows.js';

export interface MarketScannerMetrics {
  symbol: string;
  scannerWindow: MarketScannerWindowId;
  windowMs: number;
  price: number | null;
  priceChangePct: number | null;
  volatilityPct: number | null;
  spreadPct: number | null;
  topBookQuoteValue: number | null;
  orderBookImbalancePct: number | null;
  liquidityScore: number | null;
  activityScore: number | null;
  quoteVolume: number;
  tradesCount: number;
  tradesPerMinute: number;
  buyTradesCount: number;
  sellTradesCount: number;
  buyQuoteVolume: number;
  sellQuoteVolume: number;
  windowStartedAt: string | null;
  updatedAt: string | null;
}

export interface MarketScannerMetricsWindowOptions {
  scannerWindow?: MarketScannerWindowId;
}

interface StoredTrade {
  trade: RealtimeTrade;
  timestampMs: number;
}

const SYMBOL_PATTERN = /^[A-Z0-9]{5,20}$/;

export function normalizeMarketScannerSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();

  if (!SYMBOL_PATTERN.test(normalized)) {
    throw new Error(
      `Invalid market scanner symbol: ${symbol}`,
    );
  }

  return normalized;
}

export function resolveMarketScannerTimestampMs(
  value: Date | number,
): number {
  const timestampMs =
    value instanceof Date
      ? value.getTime()
      : value;

  if (!Number.isFinite(timestampMs)) {
    throw new Error(
      'Invalid market scanner reference time',
    );
  }

  return timestampMs;
}

function clamp01(value: number): number {
  return Math.min(
    1,
    Math.max(0, value),
  );
}

export function calculateMarketScannerLiquidityScore(
  spreadPct: number,
  topBookQuoteValue: number,
): number {
  const spreadQuality = clamp01(
    1 - spreadPct / 0.1,
  );

  const depthQuality = clamp01(
    Math.log10(
      topBookQuoteValue + 1,
    ) / 6,
  );

  const combinedQuality =
    spreadQuality * 0.65
    + depthQuality * 0.35;

  return Math.min(
    9,
    Math.max(
      1,
      Math.round(
        combinedQuality * 8,
      ) + 1,
    ),
  );
}

export function calculateMarketScannerActivityScore(
  quoteVolume: number,
  tradesPerMinute: number,
  volatilityPct: number | null,
  liquidityScore: number | null,
  tradesCount: number,
): number | null {
  if (tradesCount === 0) {
    return null;
  }

  const volumeActivity = clamp01(
    Math.log10(
      quoteVolume + 1,
    ) / 5,
  );

  const speedActivity = clamp01(
    Math.log10(
      tradesPerMinute + 1,
    ) / Math.log10(301),
  );

  const volatilityActivity =
    volatilityPct === null
      ? 0
      : clamp01(
          volatilityPct / 0.25,
        );

  const liquidityActivity =
    liquidityScore === null
      ? 0
      : clamp01(
          (liquidityScore - 1) / 8,
        );

  return Math.round(
    (
      volumeActivity * 0.35
      + speedActivity * 0.30
      + volatilityActivity * 0.20
      + liquidityActivity * 0.15
    ) * 100,
  );
}

export function validateMarketScannerTrade(
  trade: RealtimeTrade,
): number {
  const timestampMs = Date.parse(trade.timestamp);

  if (!Number.isFinite(timestampMs)) {
    throw new Error(
      `Invalid realtime trade timestamp: ${trade.timestamp}`,
    );
  }

  if (
    !Number.isFinite(trade.price)
    || trade.price <= 0
    || !Number.isFinite(trade.quantity)
    || trade.quantity <= 0
    || !Number.isFinite(trade.quoteValue)
    || trade.quoteValue < 0
  ) {
    throw new Error(
      `Invalid realtime trade values: ${trade.id}`,
    );
  }

  return timestampMs;
}

export class MarketScannerMetricsWindow {
  private readonly symbol: string;
  private readonly scannerWindow: MarketScannerWindowId;
  private readonly windowMs: number;
  private readonly trades: StoredTrade[] = [];
  private readonly tradeIds = new Set<string>();
  private bookTicker:
    | RealtimeBookTicker
    | null = null;
  private latestTimestampMs = 0;

  constructor(
    symbol: string,
    options: MarketScannerMetricsWindowOptions = {},
  ) {
    this.symbol = normalizeMarketScannerSymbol(symbol);
    this.scannerWindow =
      options.scannerWindow
      ?? DEFAULT_MARKET_SCANNER_WINDOW;
    this.windowMs = getMarketScannerWindowMs(
      this.scannerWindow,
    );

    if (
      !Number.isFinite(this.windowMs)
      || this.windowMs <= 0
    ) {
      throw new Error(
        'Market scanner window must be greater than zero',
      );
    }
  }

  updateBookTicker(
    bookTicker: RealtimeBookTicker,
  ): void {
    const tickerSymbol = normalizeMarketScannerSymbol(
      bookTicker.symbol,
    );

    if (tickerSymbol !== this.symbol) {
      throw new Error(
        `Book ticker belongs to ${tickerSymbol}, expected ${this.symbol}`,
      );
    }

    const updatedAtMs = Date.parse(
      bookTicker.updatedAt,
    );

    if (
      !Number.isFinite(updatedAtMs)
      || !Number.isFinite(bookTicker.bidPrice)
      || bookTicker.bidPrice <= 0
      || !Number.isFinite(bookTicker.askPrice)
      || bookTicker.askPrice <= 0
      || !Number.isFinite(bookTicker.bidQuantity)
      || bookTicker.bidQuantity < 0
      || !Number.isFinite(bookTicker.askQuantity)
      || bookTicker.askQuantity < 0
      || !Number.isFinite(bookTicker.spread)
      || bookTicker.spread < 0
      || !Number.isFinite(bookTicker.spreadPct)
      || bookTicker.spreadPct < 0
    ) {
      throw new Error(
        `Invalid realtime book ticker: ${tickerSymbol}`,
      );
    }

    this.bookTicker = {
      ...bookTicker,
      symbol: tickerSymbol,
    };
  }

  addTrade(trade: RealtimeTrade): boolean {
    const tradeSymbol = normalizeMarketScannerSymbol(
      trade.symbol,
    );

    if (tradeSymbol !== this.symbol) {
      throw new Error(
        `Trade ${trade.id} belongs to ${tradeSymbol}, expected ${this.symbol}`,
      );
    }

    if (this.tradeIds.has(trade.id)) {
      return false;
    }

    const timestampMs = validateMarketScannerTrade(trade);
    const storedTrade: StoredTrade = {
      trade: { ...trade, symbol: tradeSymbol },
      timestampMs,
    };

    const insertionIndex = this.trades.findIndex(
      (item) => item.timestampMs > timestampMs,
    );

    if (insertionIndex === -1) {
      this.trades.push(storedTrade);
    } else {
      this.trades.splice(
        insertionIndex,
        0,
        storedTrade,
      );
    }

    this.tradeIds.add(trade.id);
    this.latestTimestampMs = Math.max(
      this.latestTimestampMs,
      timestampMs,
    );

    this.prune(this.latestTimestampMs);

    return true;
  }

  getMetrics(
    at: Date | number = Date.now(),
  ): MarketScannerMetrics {
    const referenceTimeMs =
      resolveMarketScannerTimestampMs(at);

    this.prune(referenceTimeMs);

    const first = this.trades[0];
    const last = this.trades.at(-1);

    let quoteVolume = 0;
    let highPrice = Number.NEGATIVE_INFINITY;
    let lowPrice = Number.POSITIVE_INFINITY;
    let buyTradesCount = 0;
    let sellTradesCount = 0;
    let buyQuoteVolume = 0;
    let sellQuoteVolume = 0;

    for (const item of this.trades) {
      quoteVolume += item.trade.quoteValue;
      highPrice = Math.max(
        highPrice,
        item.trade.price,
      );
      lowPrice = Math.min(
        lowPrice,
        item.trade.price,
      );

      if (item.trade.side === 'buy') {
        buyTradesCount += 1;
        buyQuoteVolume += item.trade.quoteValue;
      } else {
        sellTradesCount += 1;
        sellQuoteVolume += item.trade.quoteValue;
      }
    }

    const priceChangePct =
      first
      && last
      && this.trades.length >= 2
      && first.trade.price > 0
        ? (
            (
              last.trade.price
              - first.trade.price
            )
            / first.trade.price
          ) * 100
        : null;

    const volatilityPct =
      this.trades.length >= 2
      && Number.isFinite(highPrice)
      && Number.isFinite(lowPrice)
      && lowPrice > 0
        ? (
            (highPrice - lowPrice)
            / lowPrice
          ) * 100
        : null;

    const bidQuoteValue =
      this.bookTicker
        ? (
            this.bookTicker.bidPrice
            * this.bookTicker.bidQuantity
          )
        : null;

    const askQuoteValue =
      this.bookTicker
        ? (
            this.bookTicker.askPrice
            * this.bookTicker.askQuantity
          )
        : null;

    const topBookQuoteValue =
      bidQuoteValue !== null
      && askQuoteValue !== null
        ? bidQuoteValue + askQuoteValue
        : null;

    const orderBookImbalancePct =
      bidQuoteValue !== null
      && askQuoteValue !== null
      && topBookQuoteValue !== null
      && topBookQuoteValue > 0
        ? (
            (
              bidQuoteValue
              - askQuoteValue
            )
            / topBookQuoteValue
          ) * 100
        : null;

    const liquidityScore =
      this.bookTicker
      && topBookQuoteValue !== null
      && topBookQuoteValue > 0
        ? calculateMarketScannerLiquidityScore(
            this.bookTicker.spreadPct,
            topBookQuoteValue,
          )
        : null;

    const tradesPerMinute =
      this.trades.length
      * (60_000 / this.windowMs);

    const activityScore =
      calculateMarketScannerActivityScore(
        quoteVolume,
        tradesPerMinute,
        volatilityPct,
        liquidityScore,
        this.trades.length,
      );

    return {
      symbol: this.symbol,
      scannerWindow: this.scannerWindow,
      windowMs: this.windowMs,
      price: last?.trade.price ?? null,
      priceChangePct,
      volatilityPct,
      spreadPct:
        this.bookTicker?.spreadPct
        ?? null,
      topBookQuoteValue,
      orderBookImbalancePct,
      liquidityScore,
      activityScore,
      quoteVolume,
      tradesCount: this.trades.length,
      tradesPerMinute,
      buyTradesCount,
      sellTradesCount,
      buyQuoteVolume,
      sellQuoteVolume,
      windowStartedAt:
        first?.trade.timestamp ?? null,
      updatedAt:
        last?.trade.timestamp ?? null,
    };
  }

  clear(): void {
    this.trades.length = 0;
    this.tradeIds.clear();
    this.bookTicker = null;
    this.latestTimestampMs = 0;
  }

  private prune(
    referenceTimeMs: number,
  ): void {
    const cutoff =
      referenceTimeMs - this.windowMs;

    let removeCount = 0;

    while (
      removeCount < this.trades.length
      && this.trades[removeCount]!.timestampMs
        < cutoff
    ) {
      removeCount += 1;
    }

    if (removeCount === 0) return;

    const removed = this.trades.splice(
      0,
      removeCount,
    );

    for (const item of removed) {
      this.tradeIds.delete(item.trade.id);
    }
  }
}
