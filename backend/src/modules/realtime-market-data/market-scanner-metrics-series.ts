import type {
  RealtimeBookTicker,
  RealtimeTrade,
} from './realtime-market-data.types.js';
import type {
  ScannerPriceSample,
} from './scanner-btc-comparison.js';
import {
  calculateMarketScannerActivityScore,
  calculateMarketScannerLiquidityScore,
  MarketScannerMetricsWindow,
  normalizeMarketScannerSymbol,
  resolveMarketScannerTimestampMs,
  validateMarketScannerTrade,
  type MarketScannerMetrics,
} from './market-scanner-metrics.js';
import {
  DEFAULT_MARKET_SCANNER_WINDOW,
  getMarketScannerWindowMs,
  type MarketScannerWindowId,
} from './scanner-windows.js';

interface MarketScannerMetricsMinuteBucket {
  minuteStartedAtMs: number;
  firstTimestampMs: number;
  lastTimestampMs: number;
  firstTrade: RealtimeTrade;
  lastTrade: RealtimeTrade;
  highPrice: number;
  lowPrice: number;
  quoteVolume: number;
  tradesCount: number;
  buyTradesCount: number;
  sellTradesCount: number;
  buyQuoteVolume: number;
  sellQuoteVolume: number;
}

interface MarketScannerMetricsPriceBucket {
  bucketStartedAtMs: number;
  lastTimestampMs: number;
  closePrice: number;
}

const MARKET_SCANNER_MINUTE_BUCKET_MS = 60_000;

const MARKET_SCANNER_PRICE_BUCKET_MS = 10_000;

const MARKET_SCANNER_SHORT_SAMPLE_RETENTION_MS =
  getMarketScannerWindowMs('3m');

const MAX_MARKET_SCANNER_WINDOW_MS =
  getMarketScannerWindowMs('3d');

const RECENT_TRADE_ID_LIMIT = 50_000;

export class MarketScannerMetricsSeries {
  private readonly symbol: string;

  private readonly oneMinuteWindow:
    MarketScannerMetricsWindow;

  private readonly minuteBuckets:
    MarketScannerMetricsMinuteBucket[] = [];

  private readonly tenSecondPriceBuckets:
    MarketScannerMetricsPriceBucket[] = [];

  private readonly recentTradeIds =
    new Set<string>();

  private readonly recentTradeIdQueue:
    string[] = [];

  private bookTicker:
    | RealtimeBookTicker
    | null = null;

  private latestTimestampMs = 0;

  constructor(symbol: string) {
    this.symbol =
      normalizeMarketScannerSymbol(symbol);

    this.oneMinuteWindow =
      new MarketScannerMetricsWindow(
        this.symbol,
        {
          scannerWindow: '1m',
        },
      );
  }

  updateBookTicker(
    bookTicker: RealtimeBookTicker,
  ): void {
    this.oneMinuteWindow.updateBookTicker(
      bookTicker,
    );

    this.bookTicker = {
      ...bookTicker,
      symbol: this.symbol,
    };
  }

  addTrade(
    trade: RealtimeTrade,
  ): boolean {
    if (this.recentTradeIds.has(trade.id)) {
      return false;
    }

    const added =
      this.oneMinuteWindow.addTrade(trade);

    if (!added) return false;

    const timestampMs =
      validateMarketScannerTrade(trade);

    const normalizedTrade: RealtimeTrade = {
      ...trade,
      symbol:
        normalizeMarketScannerSymbol(
          trade.symbol,
        ),
    };

    this.rememberTradeId(trade.id);

    const minuteStartedAtMs =
      Math.floor(
        timestampMs
        / MARKET_SCANNER_MINUTE_BUCKET_MS,
      )
      * MARKET_SCANNER_MINUTE_BUCKET_MS;

    const existingIndex =
      this.minuteBuckets.findIndex(
        (bucket) =>
          bucket.minuteStartedAtMs
          >= minuteStartedAtMs,
      );

    const existingBucket =
      existingIndex >= 0
        ? this.minuteBuckets[existingIndex]
        : undefined;

    if (
      existingBucket
      && existingBucket.minuteStartedAtMs
        === minuteStartedAtMs
    ) {
      this.updateMinuteBucket(
        existingBucket,
        normalizedTrade,
        timestampMs,
      );
    } else {
      const bucket =
        this.createMinuteBucket(
          normalizedTrade,
          timestampMs,
          minuteStartedAtMs,
        );

      if (existingIndex === -1) {
        this.minuteBuckets.push(bucket);
      } else {
        this.minuteBuckets.splice(
          existingIndex,
          0,
          bucket,
        );
      }
    }

    this.updatePriceBucket(
      normalizedTrade,
      timestampMs,
    );

    this.latestTimestampMs = Math.max(
      this.latestTimestampMs,
      timestampMs,
    );

    this.prune(this.latestTimestampMs);

    return true;
  }

  getPriceSamples(
    scannerWindow:
      MarketScannerWindowId =
        DEFAULT_MARKET_SCANNER_WINDOW,
    at: Date | number = Date.now(),
  ): ScannerPriceSample[] {
    const referenceTimeMs =
      resolveMarketScannerTimestampMs(at);

    this.prune(referenceTimeMs);

    const windowMs =
      getMarketScannerWindowMs(
        scannerWindow,
      );

    const cutoff =
      referenceTimeMs - windowMs;

    const samples =
      windowMs <=
        MARKET_SCANNER_SHORT_SAMPLE_RETENTION_MS
        ? this.tenSecondPriceBuckets.map(
            (bucket) => ({
              timestampMs:
                bucket.bucketStartedAtMs,
              lastTimestampMs:
                bucket.lastTimestampMs,
              closePrice:
                bucket.closePrice,
            }),
          )
        : this.minuteBuckets.map(
            (bucket) => ({
              timestampMs:
                bucket.minuteStartedAtMs,
              lastTimestampMs:
                bucket.lastTimestampMs,
              closePrice:
                bucket.lastTrade.price,
            }),
          );

    return samples
      .filter(
        (sample) =>
          sample.lastTimestampMs >= cutoff
          && sample.timestampMs
            <= referenceTimeMs,
      )
      .map(
        (sample) => ({
          timestampMs:
            sample.timestampMs,
          closePrice:
            sample.closePrice,
        }),
      );
  }

  getMetrics(
    scannerWindow:
      MarketScannerWindowId =
        DEFAULT_MARKET_SCANNER_WINDOW,
    at: Date | number = Date.now(),
  ): MarketScannerMetrics {
    if (scannerWindow === '1m') {
      return this.oneMinuteWindow.getMetrics(
        at,
      );
    }

    const referenceTimeMs =
      resolveMarketScannerTimestampMs(at);

    this.prune(referenceTimeMs);

    const windowMs =
      getMarketScannerWindowMs(
        scannerWindow,
      );

    const cutoff =
      referenceTimeMs - windowMs;

    const buckets =
      this.minuteBuckets.filter(
        (bucket) =>
          bucket.lastTimestampMs >= cutoff
          && bucket.firstTimestampMs
            <= referenceTimeMs,
      );

    const firstBucket = buckets[0];
    const lastBucket = buckets.at(-1);

    let quoteVolume = 0;
    let tradesCount = 0;
    let buyTradesCount = 0;
    let sellTradesCount = 0;
    let buyQuoteVolume = 0;
    let sellQuoteVolume = 0;
    let highPrice =
      Number.NEGATIVE_INFINITY;
    let lowPrice =
      Number.POSITIVE_INFINITY;

    for (const bucket of buckets) {
      quoteVolume += bucket.quoteVolume;
      tradesCount += bucket.tradesCount;

      buyTradesCount +=
        bucket.buyTradesCount;

      sellTradesCount +=
        bucket.sellTradesCount;

      buyQuoteVolume +=
        bucket.buyQuoteVolume;

      sellQuoteVolume +=
        bucket.sellQuoteVolume;

      highPrice = Math.max(
        highPrice,
        bucket.highPrice,
      );

      lowPrice = Math.min(
        lowPrice,
        bucket.lowPrice,
      );
    }

    const firstTrade =
      firstBucket?.firstTrade;

    const lastTrade =
      lastBucket?.lastTrade;

    const priceChangePct =
      firstTrade
      && lastTrade
      && tradesCount >= 2
      && firstTrade.price > 0
        ? (
            (
              lastTrade.price
              - firstTrade.price
            )
            / firstTrade.price
          ) * 100
        : null;

    const volatilityPct =
      tradesCount >= 2
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
        ? bidQuoteValue
          + askQuoteValue
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
      tradesCount
      * (
        MARKET_SCANNER_MINUTE_BUCKET_MS
        / windowMs
      );

    const quoteVolumePerMinute =
      quoteVolume
      * (
        MARKET_SCANNER_MINUTE_BUCKET_MS
        / windowMs
      );

    const activityScore =
      calculateMarketScannerActivityScore(
        quoteVolumePerMinute,
        tradesPerMinute,
        volatilityPct,
        liquidityScore,
        tradesCount,
      );

    return {
      symbol: this.symbol,
      scannerWindow,
      windowMs,
      price: lastTrade?.price ?? null,
      priceChangePct,
      btcCorrelation: null,
      relativeStrengthPct: null,
      volatilityPct,
      spreadPct:
        this.bookTicker?.spreadPct
        ?? null,
      topBookQuoteValue,
      orderBookImbalancePct,
      liquidityScore,
      activityScore,
      quoteVolume,
      tradesCount,
      tradesPerMinute,
      buyTradesCount,
      sellTradesCount,
      buyQuoteVolume,
      sellQuoteVolume,
      windowStartedAt:
        firstTrade?.timestamp ?? null,
      updatedAt:
        lastTrade?.timestamp ?? null,
    };
  }

  clear(): void {
    this.oneMinuteWindow.clear();
    this.minuteBuckets.length = 0;
    this.tenSecondPriceBuckets.length = 0;
    this.recentTradeIds.clear();
    this.recentTradeIdQueue.length = 0;
    this.bookTicker = null;
    this.latestTimestampMs = 0;
  }

  private rememberTradeId(
    tradeId: string,
  ): void {
    this.recentTradeIds.add(tradeId);
    this.recentTradeIdQueue.push(tradeId);

    while (
      this.recentTradeIdQueue.length
      > RECENT_TRADE_ID_LIMIT
    ) {
      const removedId =
        this.recentTradeIdQueue.shift();

      if (removedId) {
        this.recentTradeIds.delete(
          removedId,
        );
      }
    }
  }

  private updatePriceBucket(
    trade: RealtimeTrade,
    timestampMs: number,
  ): void {
    const bucketStartedAtMs =
      Math.floor(
        timestampMs
        / MARKET_SCANNER_PRICE_BUCKET_MS,
      )
      * MARKET_SCANNER_PRICE_BUCKET_MS;

    const existingIndex =
      this.tenSecondPriceBuckets.findIndex(
        (bucket) =>
          bucket.bucketStartedAtMs
          >= bucketStartedAtMs,
      );

    const existingBucket =
      existingIndex >= 0
        ? this.tenSecondPriceBuckets[
            existingIndex
          ]
        : undefined;

    if (
      existingBucket
      && existingBucket.bucketStartedAtMs
        === bucketStartedAtMs
    ) {
      if (
        timestampMs
        >= existingBucket.lastTimestampMs
      ) {
        existingBucket.lastTimestampMs =
          timestampMs;

        existingBucket.closePrice =
          trade.price;
      }

      return;
    }

    const bucket = {
      bucketStartedAtMs,
      lastTimestampMs: timestampMs,
      closePrice: trade.price,
    };

    if (existingIndex === -1) {
      this.tenSecondPriceBuckets.push(
        bucket,
      );
    } else {
      this.tenSecondPriceBuckets.splice(
        existingIndex,
        0,
        bucket,
      );
    }
  }

  private createMinuteBucket(
    trade: RealtimeTrade,
    timestampMs: number,
    minuteStartedAtMs: number,
  ): MarketScannerMetricsMinuteBucket {
    const isBuy = trade.side === 'buy';

    return {
      minuteStartedAtMs,
      firstTimestampMs: timestampMs,
      lastTimestampMs: timestampMs,
      firstTrade: trade,
      lastTrade: trade,
      highPrice: trade.price,
      lowPrice: trade.price,
      quoteVolume: trade.quoteValue,
      tradesCount: 1,
      buyTradesCount: isBuy ? 1 : 0,
      sellTradesCount: isBuy ? 0 : 1,
      buyQuoteVolume:
        isBuy ? trade.quoteValue : 0,
      sellQuoteVolume:
        isBuy ? 0 : trade.quoteValue,
    };
  }

  private updateMinuteBucket(
    bucket:
      MarketScannerMetricsMinuteBucket,
    trade: RealtimeTrade,
    timestampMs: number,
  ): void {
    if (
      timestampMs
      < bucket.firstTimestampMs
    ) {
      bucket.firstTimestampMs =
        timestampMs;
      bucket.firstTrade = trade;
    }

    if (
      timestampMs
      >= bucket.lastTimestampMs
    ) {
      bucket.lastTimestampMs =
        timestampMs;
      bucket.lastTrade = trade;
    }

    bucket.highPrice = Math.max(
      bucket.highPrice,
      trade.price,
    );

    bucket.lowPrice = Math.min(
      bucket.lowPrice,
      trade.price,
    );

    bucket.quoteVolume += trade.quoteValue;
    bucket.tradesCount += 1;

    if (trade.side === 'buy') {
      bucket.buyTradesCount += 1;
      bucket.buyQuoteVolume +=
        trade.quoteValue;
    } else {
      bucket.sellTradesCount += 1;
      bucket.sellQuoteVolume +=
        trade.quoteValue;
    }
  }

  private prune(
    referenceTimeMs: number,
  ): void {
    const cutoff =
      referenceTimeMs
      - MAX_MARKET_SCANNER_WINDOW_MS;

    let removeCount = 0;

    while (
      removeCount
        < this.minuteBuckets.length
      && this.minuteBuckets[
        removeCount
      ]!.lastTimestampMs < cutoff
    ) {
      removeCount += 1;
    }

    if (removeCount > 0) {
      this.minuteBuckets.splice(
        0,
        removeCount,
      );
    }

    const shortSampleCutoff =
      referenceTimeMs
      - MARKET_SCANNER_SHORT_SAMPLE_RETENTION_MS;

    let shortRemoveCount = 0;

    while (
      shortRemoveCount
        < this.tenSecondPriceBuckets.length
      && this.tenSecondPriceBuckets[
        shortRemoveCount
      ]!.lastTimestampMs
        < shortSampleCutoff
    ) {
      shortRemoveCount += 1;
    }

    if (shortRemoveCount > 0) {
      this.tenSecondPriceBuckets.splice(
        0,
        shortRemoveCount,
      );
    }
  }
}
