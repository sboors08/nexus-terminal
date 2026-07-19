import type {
  RealtimeTrade,
} from './realtime-market-data.types.js';

export interface MarketScannerMetrics {
  symbol: string;
  windowMs: number;
  price: number | null;
  priceChangePct: number | null;
  volatilityPct: number | null;
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
  windowMs?: number;
}

interface StoredTrade {
  trade: RealtimeTrade;
  timestampMs: number;
}

const DEFAULT_WINDOW_MS = 60_000;
const SYMBOL_PATTERN = /^[A-Z0-9]{5,20}$/;

function normalizeSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();

  if (!SYMBOL_PATTERN.test(normalized)) {
    throw new Error(
      `Invalid market scanner symbol: ${symbol}`,
    );
  }

  return normalized;
}

function resolveTimestampMs(
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

function validateTrade(
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
  private readonly windowMs: number;
  private readonly trades: StoredTrade[] = [];
  private readonly tradeIds = new Set<string>();
  private latestTimestampMs = 0;

  constructor(
    symbol: string,
    options: MarketScannerMetricsWindowOptions = {},
  ) {
    this.symbol = normalizeSymbol(symbol);
    this.windowMs =
      options.windowMs ?? DEFAULT_WINDOW_MS;

    if (
      !Number.isFinite(this.windowMs)
      || this.windowMs <= 0
    ) {
      throw new Error(
        'Market scanner window must be greater than zero',
      );
    }
  }

  addTrade(trade: RealtimeTrade): boolean {
    const tradeSymbol = normalizeSymbol(
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

    const timestampMs = validateTrade(trade);
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
      resolveTimestampMs(at);

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

    return {
      symbol: this.symbol,
      windowMs: this.windowMs,
      price: last?.trade.price ?? null,
      priceChangePct,
      volatilityPct,
      quoteVolume,
      tradesCount: this.trades.length,
      tradesPerMinute:
        this.trades.length
        * (60_000 / this.windowMs),
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
