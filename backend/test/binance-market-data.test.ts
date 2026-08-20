import assert from 'node:assert/strict';
import test from 'node:test';
import { BinanceMarketDataClient } from '../src/modules/market-data/binance-market-data.client.js';
import {
  MarketDataUnavailableError,
  MarketSymbolNotFoundError,
} from '../src/modules/market-data/market-data.provider.js';

function json(payload: unknown, status = 200): Response { return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } }); }

test('Binance USD-M Futures client maps public responses to NEXUS contracts', async () => {
  const requests: string[] = [];
  const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input.toString()); requests.push(`${url.pathname}${url.search}`);
    if (url.pathname === '/fapi/v1/exchangeInfo') return json({ symbols: [
      { symbol: 'BTCUSDT', status: 'TRADING', baseAsset: 'BTC', quoteAsset: 'USDT', contractType: 'PERPETUAL' },
      { symbol: 'SOLUSDT', status: 'TRADING', baseAsset: 'SOL', quoteAsset: 'USDT', contractType: 'PERPETUAL' },
      { symbol: '币安人生USDT', status: 'TRADING', baseAsset: '币安人生', quoteAsset: 'USDT', contractType: 'PERPETUAL' },
      { symbol: 'SOLEUR', status: 'TRADING', baseAsset: 'SOL', quoteAsset: 'EUR', contractType: 'PERPETUAL' },
    ] });
    if (url.pathname === '/fapi/v1/ticker/24hr') return json([
      { symbol: 'BTCUSDT', lastPrice: '100000', priceChangePercent: '2.5', openPrice: '98000', highPrice: '101000', lowPrice: '97000', quoteVolume: '2000000000', count: 1440000, closeTime: 1721275200000 },
      { symbol: 'SOLUSDT', lastPrice: '190.5', priceChangePercent: '5.25', openPrice: '181', highPrice: '192', lowPrice: '178', quoteVolume: '400000000', count: 288000, closeTime: 1721275200000 },
      { symbol: '币安人生USDT', lastPrice: '0.23', priceChangePercent: '8.5', openPrice: '0.21', highPrice: '0.25', lowPrice: '0.2', quoteVolume: '900000000', count: 500000, closeTime: 1721275200000 },
    ]);
    if (url.pathname === '/fapi/v1/klines') return json([[1721275200000,'189.0','191.0','188.5','190.5','12345.6',1721275499999,'2345678.9',845,'6000','1100000','0']]);
    return json({ code: -1000, msg: 'Unexpected request' }, 500);
  };
  const client = new BinanceMarketDataClient({ baseUrl: 'https://fapi.binance.com', requestTimeoutMs: 1000, symbolsLimit: 100, cacheTtlMs: 15000, fetchImpl, now: () => new Date('2026-07-18T14:00:00Z') });
  const symbols = await client.getMarketSymbols(); assert.equal(symbols.length, 2); assert.equal(symbols[0]?.symbol, 'BTCUSDT'); assert.equal(symbols[1]?.btcRelativeStrength, 2.75); assert.equal(symbols[1]?.tradeRate, 200);
  await client.getMarketSymbols(); assert.equal(requests.filter((item) => item === '/fapi/v1/exchangeInfo').length, 1);
  const candles = await client.getCandles('SOLUSDT', '5m'); assert.equal(candles[0]?.open, 189); assert.equal(candles[0]?.tradesCount, 845); assert.ok(requests.includes('/fapi/v1/klines?symbol=SOLUSDT&interval=5m&limit=1000'));
});

test('Binance client maps invalid symbol errors', async () => {
  const client = new BinanceMarketDataClient({ baseUrl: 'https://fapi.binance.com', requestTimeoutMs: 1000, symbolsLimit: 100, cacheTtlMs: 0, fetchImpl: async () => json({ code: -1121, msg: 'Invalid symbol.' }, 400) });
  await assert.rejects(client.getCandles('UNKNOWNUSDT', '5m'), (error: unknown) => error instanceof MarketSymbolNotFoundError && error.symbol === 'UNKNOWNUSDT');
});


test('Binance client supports candle pagination parameters', async () => {
  const requests:
    string[] = [];

  const client =
    new BinanceMarketDataClient({
      baseUrl:
        'https://fapi.binance.com',
      requestTimeoutMs:
        1000,
      symbolsLimit:
        100,
      cacheTtlMs:
        0,
      fetchImpl:
        async (input) => {
          const url =
            new URL(
              input instanceof Request
                ? input.url
                : input.toString(),
            );

          requests.push(
            `${url.pathname}${url.search}`,
          );

          return json([
            [
              1721275200000,
              '189.0',
              '191.0',
              '188.5',
              '190.5',
              '12345.6',
              1721275499999,
              '2345678.9',
              845,
              '6000',
              '1100000',
              '0',
            ],
          ]);
        },
    });

  await client.getCandles(
    'SOLUSDT',
    '5m',
    {
      limit:
        500,
      endTime:
        1721275199999,
    },
  );

  assert.ok(
    requests.includes(
      '/fapi/v1/klines'
      + '?symbol=SOLUSDT'
      + '&interval=5m'
      + '&limit=500'
      + '&endTime=1721275199999',
    ),
  );
});


test(
  'retries one transient cold candle timeout and succeeds',
  async () => {
    let requests =
      0;

    const client =
      new BinanceMarketDataClient({
        baseUrl:
          'https://fapi.binance.com',

        requestTimeoutMs:
          1_000,

        symbolsLimit:
          100,

        cacheTtlMs:
          0,

        fetchImpl:
          async () => {
            requests +=
              1;

            if (
              requests === 1
            ) {
              const timeoutError =
                new Error(
                  'synthetic timeout',
                );

              timeoutError.name =
                'AbortError';

              throw timeoutError;
            }

            return json([
              [
                1721275200000,
                '189.0',
                '191.0',
                '188.5',
                '190.5',
                '12345.6',
                1721275499999,
                '2345678.9',
                845,
                '6000',
                '1100000',
                '0',
              ],
            ]);
          },
      });

    const candles =
      await client.getCandles(
        'SOLUSDT',
        '15m',
        {
          limit:
            1000,
        },
      );

    assert.equal(
      requests,
      2,
    );

    assert.equal(
      candles.length,
      1,
    );

    assert.equal(
      candles[0]?.close,
      190.5,
    );
  },
);


test(
  'bounds cold candle retry to two attempts',
  async () => {
    let requests =
      0;

    const client =
      new BinanceMarketDataClient({
        baseUrl:
          'https://fapi.binance.com',

        requestTimeoutMs:
          1_000,

        symbolsLimit:
          100,

        cacheTtlMs:
          0,

        fetchImpl:
          async () => {
            requests +=
              1;

            return json(
              {
                code:
                  -1000,

                msg:
                  'temporary failure',
              },
              500,
            );
          },
      });

    await assert.rejects(
      client.getCandles(
        'SOLUSDT',
        '15m',
        {
          limit:
            1000,
        },
      ),
      (
        error:
          unknown,
      ) =>
        error
        instanceof
          MarketDataUnavailableError,
    );

    assert.equal(
      requests,
      2,
    );
  },
);


test(
  'does not retry paginated candle history',
  async () => {
    let requests =
      0;

    const client =
      new BinanceMarketDataClient({
        baseUrl:
          'https://fapi.binance.com',

        requestTimeoutMs:
          1_000,

        symbolsLimit:
          100,

        cacheTtlMs:
          0,

        fetchImpl:
          async () => {
            requests +=
              1;

            return json(
              {
                code:
                  -1000,

                msg:
                  'temporary failure',
              },
              500,
            );
          },
      });

    await assert.rejects(
      client.getCandles(
        'SOLUSDT',
        '15m',
        {
          limit:
            500,

          endTime:
            1721275199999,
        },
      ),
      (
        error:
          unknown,
      ) =>
        error
        instanceof
          MarketDataUnavailableError,
    );

    assert.equal(
      requests,
      1,
    );
  },
);


test(
  'reuses a short live candle cache defensively',
  async () => {
    let now =
      new Date(
        '2026-08-19T18:00:58.000Z',
      );

    let requests =
      0;

    const previousOpen =
      Date.parse(
        '2026-08-19T17:59:00.000Z',
      );

    const previousClose =
      Date.parse(
        '2026-08-19T17:59:59.999Z',
      );

    const currentOpen =
      Date.parse(
        '2026-08-19T18:00:00.000Z',
      );

    const currentClose =
      Date.parse(
        '2026-08-19T18:00:59.999Z',
      );

    const client =
      new BinanceMarketDataClient({
        baseUrl:
          'https://fapi.binance.com',

        requestTimeoutMs:
          1_000,

        symbolsLimit:
          100,

        cacheTtlMs:
          0,

        now: () =>
          now,

        fetchImpl:
          async () => {
            requests += 1;

            return json([
              [
                previousOpen,
                '99',
                '101',
                '98',
                '100',
                '20',
                previousClose,
                '2000',
                20,
                '10',
                '1000',
                '0',
              ],
              [
                currentOpen,
                '100',
                '102',
                '99',
                '101',
                '10',
                currentClose,
                '1010',
                10,
                '5',
                '505',
                '0',
              ],
            ]);
          },
      });

    const first =
      await client.getCandles(
        'INJUSDT',
        '1m',
        {
          limit: 500,
        },
      );

    assert.equal(
      requests,
      1,
    );

    assert.equal(
      first.length,
      2,
    );

    const current =
      first[1];

    assert.ok(
      current,
    );

    current.close =
      1;

    now =
      new Date(
        '2026-08-19T18:00:59.000Z',
      );

    const second =
      await client.getCandles(
        'INJUSDT',
        '1m',
        {
          limit: 500,
        },
      );

    assert.equal(
      requests,
      1,
    );

    assert.equal(
      second[1]?.close,
      101,
    );
  },
);


test(
  'does not let a cached open candle cross its close boundary',
  async () => {
    let now =
      new Date(
        '2026-08-19T18:00:58.000Z',
      );

    let requests =
      0;

    const previousOpen =
      Date.parse(
        '2026-08-19T17:59:00.000Z',
      );

    const previousClose =
      Date.parse(
        '2026-08-19T17:59:59.999Z',
      );

    const currentOpen =
      Date.parse(
        '2026-08-19T18:00:00.000Z',
      );

    const currentClose =
      Date.parse(
        '2026-08-19T18:00:59.999Z',
      );

    const client =
      new BinanceMarketDataClient({
        baseUrl:
          'https://fapi.binance.com',

        requestTimeoutMs:
          1_000,

        symbolsLimit:
          100,

        cacheTtlMs:
          0,

        now: () =>
          now,

        fetchImpl:
          async () => {
            requests += 1;

            return json([
              [
                previousOpen,
                '99',
                '101',
                '98',
                '100',
                '20',
                previousClose,
                '2000',
                20,
                '10',
                '1000',
                '0',
              ],
              [
                currentOpen,
                '100',
                '102',
                '99',
                '101',
                '10',
                currentClose,
                '1010',
                10,
                '5',
                '505',
                '0',
              ],
            ]);
          },
      });

    await client.getCandles(
      'INJUSDT',
      '1m',
      {
        limit: 500,
      },
    );

    assert.equal(
      requests,
      1,
    );

    now =
      new Date(
        '2026-08-19T18:01:00.100Z',
      );

    await client.getCandles(
      'INJUSDT',
      '1m',
      {
        limit: 500,
      },
    );

    assert.equal(
      requests,
      2,
    );
  },
);


test(
  'falls back only to candles that were already closed when the successful response was captured',
  async () => {
    let now =
      new Date(
        '2026-08-19T18:00:58.000Z',
      );

    let requests =
      0;

    let fail =
      false;

    const previousOpen =
      Date.parse(
        '2026-08-19T17:59:00.000Z',
      );

    const previousClose =
      Date.parse(
        '2026-08-19T17:59:59.999Z',
      );

    const currentOpen =
      Date.parse(
        '2026-08-19T18:00:00.000Z',
      );

    const currentClose =
      Date.parse(
        '2026-08-19T18:00:59.999Z',
      );

    const client =
      new BinanceMarketDataClient({
        baseUrl:
          'https://fapi.binance.com',

        requestTimeoutMs:
          1_000,

        symbolsLimit:
          100,

        cacheTtlMs:
          0,

        now: () =>
          now,

        fetchImpl:
          async () => {
            requests += 1;

            if (fail) {
              return json(
                {
                  code: -1000,
                  msg: 'temporary failure',
                },
                500,
              );
            }

            return json([
              [
                previousOpen,
                '99',
                '101',
                '98',
                '100',
                '20',
                previousClose,
                '2000',
                20,
                '10',
                '1000',
                '0',
              ],
              [
                currentOpen,
                '100',
                '102',
                '99',
                '101',
                '10',
                currentClose,
                '1010',
                10,
                '5',
                '505',
                '0',
              ],
            ]);
          },
      });

    const initial =
      await client.getCandles(
        'INJUSDT',
        '1m',
        {
          limit: 500,
        },
      );

    assert.equal(
      initial.length,
      2,
    );

    fail =
      true;

    now =
      new Date(
        '2026-08-19T18:01:00.100Z',
      );

    const fallback =
      await client.getCandles(
        'INJUSDT',
        '1m',
        {
          limit: 500,
        },
      );

    assert.equal(
      requests,
      2,
    );

    /*
     * The 18:00 candle was still open when cached.
     * It MUST NOT appear in the stale fallback after 18:01.
     */
    assert.equal(
      fallback.length,
      1,
    );

    assert.equal(
      fallback[0]?.closeTime,
      new Date(
        previousClose,
      ).toISOString(),
    );

    assert.equal(
      fallback[0]?.close,
      100,
    );

    now =
      new Date(
        '2026-08-19T18:02:00.100Z',
      );

    await assert.rejects(
      client.getCandles(
        'INJUSDT',
        '1m',
        {
          limit: 500,
        },
      ),
      (
        error:
          unknown,
      ) =>
        error
        instanceof
          MarketDataUnavailableError,
    );

    assert.equal(
      requests,
      3,
    );
  },
);


test(
  'does not hide an invalid symbol behind a stale candle fallback',
  async () => {
    let now =
      new Date(
        '2026-08-19T18:00:58.000Z',
      );

    let invalidSymbol =
      false;

    const previousOpen =
      Date.parse(
        '2026-08-19T17:59:00.000Z',
      );

    const previousClose =
      Date.parse(
        '2026-08-19T17:59:59.999Z',
      );

    const currentOpen =
      Date.parse(
        '2026-08-19T18:00:00.000Z',
      );

    const currentClose =
      Date.parse(
        '2026-08-19T18:00:59.999Z',
      );

    const client =
      new BinanceMarketDataClient({
        baseUrl:
          'https://fapi.binance.com',

        requestTimeoutMs:
          1_000,

        symbolsLimit:
          100,

        cacheTtlMs:
          0,

        now: () =>
          now,

        fetchImpl:
          async () => {
            if (invalidSymbol) {
              return json(
                {
                  code: -1121,
                  msg: 'Invalid symbol.',
                },
                400,
              );
            }

            return json([
              [
                previousOpen,
                '99',
                '101',
                '98',
                '100',
                '20',
                previousClose,
                '2000',
                20,
                '10',
                '1000',
                '0',
              ],
              [
                currentOpen,
                '100',
                '102',
                '99',
                '101',
                '10',
                currentClose,
                '1010',
                10,
                '5',
                '505',
                '0',
              ],
            ]);
          },
      });

    await client.getCandles(
      'INJUSDT',
      '1m',
      {
        limit: 500,
      },
    );

    invalidSymbol =
      true;

    now =
      new Date(
        '2026-08-19T18:01:00.100Z',
      );

    await assert.rejects(
      client.getCandles(
        'INJUSDT',
        '1m',
        {
          limit: 500,
        },
      ),
      (
        error:
          unknown,
      ) =>
        error
        instanceof
          MarketSymbolNotFoundError,
    );
  },
);


test(
  'never caches paginated candle history',
  async () => {
    let requests =
      0;

    const client =
      new BinanceMarketDataClient({
        baseUrl:
          'https://fapi.binance.com',

        requestTimeoutMs:
          1_000,

        symbolsLimit:
          100,

        cacheTtlMs:
          0,

        fetchImpl:
          async () => {
            requests += 1;

            return json([
              [
                1_721_275_200_000,
                '100',
                '101',
                '99',
                '100.5',
                '10',
                1_721_275_259_999,
                '1005',
                42,
                '5',
                '502',
                '0',
              ],
            ]);
          },
      });

    const options = {
      limit: 500,
      endTime:
        1_721_275_199_999,
    };

    await client.getCandles(
      'INJUSDT',
      '1m',
      options,
    );

    await client.getCandles(
      'INJUSDT',
      '1m',
      options,
    );

    assert.equal(
      requests,
      2,
    );
  },
);
