import assert from 'node:assert/strict';
import test from 'node:test';
import { BinanceMarketDataClient } from '../src/modules/market-data/binance-market-data.client.js';
import { MarketSymbolNotFoundError } from '../src/modules/market-data/market-data.provider.js';

function json(payload: unknown, status = 200): Response { return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } }); }

test('Binance client maps public responses to NEXUS contracts', async () => {
  const requests: string[] = [];
  const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input.toString()); requests.push(`${url.pathname}${url.search}`);
    if (url.pathname === '/api/v3/exchangeInfo') return json({ symbols: [
      { symbol: 'BTCUSDT', status: 'TRADING', baseAsset: 'BTC', quoteAsset: 'USDT', isSpotTradingAllowed: true },
      { symbol: 'SOLUSDT', status: 'TRADING', baseAsset: 'SOL', quoteAsset: 'USDT', isSpotTradingAllowed: true },
      { symbol: 'SOLEUR', status: 'TRADING', baseAsset: 'SOL', quoteAsset: 'EUR', isSpotTradingAllowed: true },
    ] });
    if (url.pathname === '/api/v3/ticker/24hr') return json([
      { symbol: 'BTCUSDT', lastPrice: '100000', priceChangePercent: '2.5', openPrice: '98000', highPrice: '101000', lowPrice: '97000', quoteVolume: '2000000000', count: 1440000, closeTime: 1721275200000 },
      { symbol: 'SOLUSDT', lastPrice: '190.5', priceChangePercent: '5.25', openPrice: '181', highPrice: '192', lowPrice: '178', quoteVolume: '400000000', count: 288000, closeTime: 1721275200000 },
    ]);
    if (url.pathname === '/api/v3/klines') return json([[1721275200000,'189.0','191.0','188.5','190.5','12345.6',1721275499999,'2345678.9',845,'6000','1100000','0']]);
    return json({ code: -1000, msg: 'Unexpected request' }, 500);
  };
  const client = new BinanceMarketDataClient({ baseUrl: 'https://data-api.binance.vision', requestTimeoutMs: 1000, symbolsLimit: 100, cacheTtlMs: 15000, fetchImpl, now: () => new Date('2026-07-18T14:00:00Z') });
  const symbols = await client.getMarketSymbols(); assert.equal(symbols.length, 2); assert.equal(symbols[0]?.symbol, 'BTCUSDT'); assert.equal(symbols[1]?.btcRelativeStrength, 2.75); assert.equal(symbols[1]?.tradeRate, 200);
  await client.getMarketSymbols(); assert.equal(requests.filter((item) => item === '/api/v3/exchangeInfo').length, 1);
  const candles = await client.getCandles('SOLUSDT', '5m'); assert.equal(candles[0]?.open, 189); assert.equal(candles[0]?.tradesCount, 845); assert.ok(requests.includes('/api/v3/klines?symbol=SOLUSDT&interval=5m&limit=200'));
});

test('Binance client maps invalid symbol errors', async () => {
  const client = new BinanceMarketDataClient({ baseUrl: 'https://data-api.binance.vision', requestTimeoutMs: 1000, symbolsLimit: 100, cacheTtlMs: 0, fetchImpl: async () => json({ code: -1121, msg: 'Invalid symbol.' }, 400) });
  await assert.rejects(client.getCandles('UNKNOWNUSDT', '5m'), (error: unknown) => error instanceof MarketSymbolNotFoundError && error.symbol === 'UNKNOWNUSDT');
});
