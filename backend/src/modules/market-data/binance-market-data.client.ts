import type { Candle, MarketSymbol } from '../../contracts/nexus-api.js';
import { MarketDataUnavailableError, MarketSymbolNotFoundError, type MarketDataProvider } from './market-data.provider.js';

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
interface ExchangeSymbol { symbol?: string; status?: string; baseAsset?: string; quoteAsset?: string; isSpotTradingAllowed?: boolean; }
interface Ticker24h { symbol?: string; lastPrice?: string; priceChangePercent?: string; openPrice?: string; highPrice?: string; lowPrice?: string; quoteVolume?: string; count?: number; closeTime?: number; }
type Kline = [number, string, string, string, string, string, number, string, number, ...unknown[]];
interface ErrorPayload { code?: number; msg?: string; }

function numberValue(value: string | number | undefined, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class BinanceMarketDataClient implements MarketDataProvider {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;
  private cache: { expiresAt: number; value: MarketSymbol[] } | null = null;

  constructor(private readonly options: BinanceMarketDataClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.now = options.now ?? (() => new Date());
  }

  async getMarketSymbols(): Promise<MarketSymbol[]> {
    const nowMs = this.now().getTime();
    if (this.cache && this.cache.expiresAt > nowMs) return this.cache.value.map((item) => ({ ...item }));

    const [exchangeInfo, tickers] = await Promise.all([
      this.requestJson<ExchangeInfo>('/api/v3/exchangeInfo'),
      this.requestJson<Ticker24h[]>('/api/v3/ticker/24hr'),
    ]);
    if (!Array.isArray(exchangeInfo.symbols) || !Array.isArray(tickers)) {
      throw new MarketDataUnavailableError('Binance returned an unexpected market response');
    }

    const active = new Map(exchangeInfo.symbols.filter((item) => item.status === 'TRADING' && item.quoteAsset === 'USDT' && item.isSpotTradingAllowed !== false && item.symbol && item.baseAsset).map((item) => [item.symbol as string, item]));
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

  async getCandles(symbol: string, timeframe: string): Promise<Candle[]> {
    const query = new URLSearchParams({ symbol, interval: timeframe, limit: '200' });
    const payload = await this.requestJson<unknown>(`/api/v3/klines?${query.toString()}`, symbol);
    if (!Array.isArray(payload)) throw new MarketDataUnavailableError('Binance returned an unexpected candles response');

    return payload.map((row) => {
      if (!Array.isArray(row) || row.length < 9) throw new MarketDataUnavailableError('Binance returned an invalid candle');
      const kline = row as Kline;
      return {
        openTime: new Date(numberValue(kline[0])).toISOString(),
        closeTime: new Date(numberValue(kline[6])).toISOString(),
        open: numberValue(kline[1]), high: numberValue(kline[2]), low: numberValue(kline[3]), close: numberValue(kline[4]),
        volume: numberValue(kline[5]), tradesCount: Math.max(0, Math.trunc(numberValue(kline[8]))),
      };
    });
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
