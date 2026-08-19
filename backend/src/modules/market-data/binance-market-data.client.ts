import type { Candle, MarketSymbol } from '../../contracts/nexus-api.js';
import { MarketDataUnavailableError, MarketSymbolNotFoundError, type GetCandlesOptions, type MarketDataProvider } from './market-data.provider.js';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface BinanceMarketDataClientOptions {
  baseUrl: string;
  requestTimeoutMs: number;
  symbolsLimit: number;
  cacheTtlMs: number;
  fetchImpl?: FetchLike;
  now?: () => Date;
}

interface ExchangeInfo { symbols?: ExchangeSymbol[]; }
interface ExchangeSymbol { symbol?: string; status?: string; baseAsset?: string; quoteAsset?: string; contractType?: string; }
interface Ticker24h { symbol?: string; lastPrice?: string; priceChangePercent?: string; openPrice?: string; highPrice?: string; lowPrice?: string; quoteVolume?: string; count?: number; closeTime?: number; }
type Kline = [number, string, string, string, string, string, number, string, number, ...unknown[]];
interface ErrorPayload { code?: number; msg?: string; }

interface CandleCacheEntry {
  value: Candle[];
  safeFallbackValue: Candle[];
  freshUntilMs: number;
  staleUntilMs: number;
}

const CANDLE_LIVE_CACHE_TTL_MS =
  5_000;

const CANDLE_CACHE_MAX_ENTRIES =
  64;

const CANDLE_TIMEFRAME_DURATION_MS:
Readonly<Record<string, number>> = {
  '1m': 60_000,
  '3m': 3 * 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '2h': 2 * 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '8h': 8 * 60 * 60_000,
  '12h': 12 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
};

function cloneCandles(
  candles: readonly Candle[],
): Candle[] {
  return candles.map(
    (candle) => ({
      ...candle,
    }),
  );
}

const MARKET_SYMBOL_PATTERN = /^[A-Z0-9]{5,20}$/;
const MARKET_ASSET_PATTERN = /^[A-Z0-9]{1,20}$/;

function numberValue(value: string | number | undefined, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class BinanceMarketDataClient implements MarketDataProvider {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;
  private cache: { expiresAt: number; value: MarketSymbol[] } | null = null;

  private readonly candleCache =
    new Map<
      string,
      CandleCacheEntry
    >();

  constructor(private readonly options: BinanceMarketDataClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.now = options.now ?? (() => new Date());
  }

  async getMarketSymbols(): Promise<MarketSymbol[]> {
    const nowMs = this.now().getTime();
    if (this.cache && this.cache.expiresAt > nowMs) return this.cache.value.map((item) => ({ ...item }));

    const [exchangeInfo, tickers] = await Promise.all([
      this.requestJson<ExchangeInfo>('/fapi/v1/exchangeInfo'),
      this.requestJson<Ticker24h[]>('/fapi/v1/ticker/24hr'),
    ]);
    if (!Array.isArray(exchangeInfo.symbols) || !Array.isArray(tickers)) {
      throw new MarketDataUnavailableError('Binance returned an unexpected market response');
    }

    const active = new Map(exchangeInfo.symbols.filter((item) =>
      item.status === 'TRADING'
      && item.quoteAsset === 'USDT'
      && item.contractType === 'PERPETUAL'
      && typeof item.symbol === 'string'
      && MARKET_SYMBOL_PATTERN.test(item.symbol)
      && typeof item.baseAsset === 'string'
      && MARKET_ASSET_PATTERN.test(item.baseAsset)
      && MARKET_ASSET_PATTERN.test(item.quoteAsset),
    ).map((item) => [item.symbol as string, item]));
    const btcChange = numberValue(tickers.find((item) => item.symbol === 'BTCUSDT')?.priceChangePercent);

    const symbols = tickers.flatMap((ticker): MarketSymbol[] => {
      const info = ticker.symbol ? active.get(ticker.symbol) : undefined;
      if (!ticker.symbol || !info?.baseAsset || !info.quoteAsset) return [];
      const change = numberValue(ticker.priceChangePercent);
      const open = numberValue(ticker.openPrice);
      const high = numberValue(ticker.highPrice);
      const low = numberValue(ticker.lowPrice);
      const count = Math.max(0, Math.trunc(numberValue(ticker.count)));
      return [{
        symbol: ticker.symbol,
        baseAsset: info.baseAsset,
        quoteAsset: info.quoteAsset,
        exchange: 'binance',
        price: numberValue(ticker.lastPrice),
        priceChangePct: change,
        volumeQuote: numberValue(ticker.quoteVolume),
        tradesCount: count,
        tradeRate: Number((count / 1_440).toFixed(2)),
        volatilityPct: Number((open > 0 ? ((high - low) / open) * 100 : 0).toFixed(4)),
        btcCorrelation: ticker.symbol === 'BTCUSDT' ? 1 : null,
        btcRelativeStrength: ticker.symbol === 'BTCUSDT' ? 0 : Number((change - btcChange).toFixed(4)),
        updatedAt: new Date(numberValue(ticker.closeTime, nowMs)).toISOString(),
      }];
    }).sort((a, b) => b.volumeQuote - a.volumeQuote).slice(0, this.options.symbolsLimit);

    this.cache = { expiresAt: nowMs + this.options.cacheTtlMs, value: symbols.map((item) => ({ ...item })) };
    return symbols;
  }

  async getCandles(
    symbol: string,
    timeframe: string,
    options: GetCandlesOptions = {},
  ): Promise<Candle[]> {
    const limit =
      options.limit
      ?? 1000;

    if (
      !Number.isInteger(limit)
      || limit < 1
      || limit > 1000
    ) {
      throw new MarketDataUnavailableError(
        'Binance candle limit must be between 1 and 1000',
      );
    }

    if (
      options.endTime !== undefined
      && (
        !Number.isSafeInteger(options.endTime)
        || options.endTime < 0
      )
    ) {
      throw new MarketDataUnavailableError(
        'Binance candle endTime must be a non-negative safe integer',
      );
    }

    const timeframeDurationMs =
      CANDLE_TIMEFRAME_DURATION_MS[
        timeframe
      ]
      ?? null;

    const cacheKey =
      options.endTime === undefined
      && timeframeDurationMs !== null
        ? [
            symbol.toUpperCase(),
            timeframe,
            String(limit),
          ].join('|')
        : null;

    const requestNowMs =
      this.now().getTime();

    const cached =
      cacheKey === null
        ? undefined
        : this.candleCache.get(
            cacheKey,
          );

    if (
      cached
      && cached.freshUntilMs
        > requestNowMs
    ) {
      return cloneCandles(
        cached.value,
      );
    }

    const query =
      new URLSearchParams({
        symbol,
        interval:
          timeframe,
        limit:
          String(limit),
      });

    if (
      options.endTime
      !== undefined
    ) {
      query.set(
        'endTime',
        String(options.endTime),
      );
    }

    let payload:
      unknown;

    try {
      payload =
        await this.requestJson<unknown>(
          `/fapi/v1/klines?${query.toString()}`,
          symbol,
        );
    } catch (error) {
      const failureNowMs =
        this.now().getTime();

      if (
        error
          instanceof
            MarketDataUnavailableError
        && cached
        && cached.safeFallbackValue.length
          > 0
        && cached.staleUntilMs
          > failureNowMs
      ) {
        return cloneCandles(
          cached.safeFallbackValue,
        );
      }

      throw error;
    }

    if (!Array.isArray(payload)) throw new MarketDataUnavailableError('Binance returned an unexpected candles response');

    const candles =
      payload.map((row) => {
      if (!Array.isArray(row) || row.length < 9) throw new MarketDataUnavailableError('Binance returned an invalid candle');
      const kline = row as Kline;
      return {
        openTime: new Date(numberValue(kline[0])).toISOString(),
        closeTime: new Date(numberValue(kline[6])).toISOString(),
        open: numberValue(kline[1]), high: numberValue(kline[2]), low: numberValue(kline[3]), close: numberValue(kline[4]),
        volume: numberValue(kline[5]), tradesCount: Math.max(0, Math.trunc(numberValue(kline[8]))),
      };
    });

    if (
      cacheKey !== null
      && timeframeDurationMs
        !== null
      && candles.length > 0
    ) {
      const fetchedAtMs =
        this.now().getTime();

      const safeFallbackValue =
        candles.filter(
          (candle) => {
            const closeTimeMs =
              Date.parse(
                candle.closeTime,
              );

            return (
              Number.isFinite(
                closeTimeMs,
              )
              && closeTimeMs
                <= fetchedAtMs
            );
          },
        );

      const latest =
        candles[
          candles.length - 1
        ];

      const latestCloseMs =
        latest
          ? Date.parse(
              latest.closeTime,
            )
          : Number.NaN;

      let freshUntilMs =
        fetchedAtMs
        + CANDLE_LIVE_CACHE_TTL_MS;

      /*
       * Never allow a cached unfinished candle to cross its
       * own close boundary.
       */
      if (
        Number.isFinite(
          latestCloseMs,
        )
        && latestCloseMs
          >= fetchedAtMs
      ) {
        freshUntilMs =
          Math.min(
            freshUntilMs,
            latestCloseMs + 1,
          );
      }

      const staleUntilMs =
        Math.max(
          freshUntilMs,
          fetchedAtMs,
        )
        + timeframeDurationMs;

      if (
        !this.candleCache.has(
          cacheKey,
        )
        && this.candleCache.size
          >= CANDLE_CACHE_MAX_ENTRIES
      ) {
        const oldestKey =
          this.candleCache
            .keys()
            .next()
            .value;

        if (
          typeof oldestKey
          === 'string'
        ) {
          this.candleCache.delete(
            oldestKey,
          );
        }
      }

      this.candleCache.set(
        cacheKey,
        {
          value:
            cloneCandles(
              candles,
            ),

          safeFallbackValue:
            cloneCandles(
              safeFallbackValue,
            ),

          freshUntilMs,

          staleUntilMs,
        },
      );
    }

    return candles;
  }

  private async requestJson<T>(path: string, symbol?: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.requestTimeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, { headers: { accept: 'application/json' }, signal: controller.signal });
      const text = await response.text();
      let payload: unknown = null;
      if (text) {
        try { payload = JSON.parse(text); } catch { throw new MarketDataUnavailableError('Binance returned invalid JSON'); }
      }
      if (!response.ok) {
        const apiError = payload as ErrorPayload | null;
        if (response.status === 400 && apiError?.code === -1121 && symbol) throw new MarketSymbolNotFoundError(symbol);
        throw new MarketDataUnavailableError(`Binance request failed with status ${response.status}`);
      }
      return payload as T;
    } catch (error) {
      if (error instanceof MarketDataUnavailableError || error instanceof MarketSymbolNotFoundError) throw error;
      const message = error instanceof Error && error.name === 'AbortError' ? 'Binance request timed out' : 'Binance request failed';
      throw new MarketDataUnavailableError(message);
    } finally { clearTimeout(timeout); }
  }
}
