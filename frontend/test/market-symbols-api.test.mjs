import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RUNTIME_MARKET_SYMBOLS_PATH,
  fetchRuntimeMarketSymbols,
  parseRuntimeMarketSymbols,
} from '../node_modules/.tmp/realtime-test/api/runtime/marketSymbolsApi.js';

function createMarketSymbol() {
  return {
    symbol: 'SOLUSDT',
    baseAsset: 'SOL',
    quoteAsset: 'USDT',
    exchange: 'binance',
    price: 187.42,
    priceChangePct: 2.81,
    volumeQuote: 148000000,
    tradesCount: 84500,
    tradeRate: 1408.33,
    volatilityPct: 3.42,
    btcCorrelation: 0.64,
    btcRelativeStrength: 1.27,
    updatedAt: '2026-08-01T15:30:00.000Z',
  };
}

test('fetches and validates runtime Market symbols', async () => {
  let requestedUrl = '';

  const symbols =
    await fetchRuntimeMarketSymbols({
      baseUrl:
        'http://localhost:4100/',

      fetcher:
        async (
          input,
          init,
        ) => {
          requestedUrl =
            String(input);

          assert.equal(
            init?.method,
            'GET',
          );

          assert.equal(
            new Headers(
              init?.headers,
            ).get('accept'),
            'application/json',
          );

          return new Response(
            JSON.stringify([
              createMarketSymbol(),
            ]),
            {
              status:
                200,

              headers: {
                'content-type':
                  'application/json',
              },
            },
          );
        },
    });

  assert.equal(
    requestedUrl,
    'http://localhost:4100'
      + RUNTIME_MARKET_SYMBOLS_PATH,
  );

  assert.equal(
    symbols.length,
    1,
  );

  assert.equal(
    symbols[0].symbol,
    'SOLUSDT',
  );

  assert.equal(
    symbols[0].volumeQuote,
    148000000,
  );
});

test('rejects an invalid runtime Market symbol contract', () => {
  const invalid = {
    ...createMarketSymbol(),
    exchange:
      'coinbase',
  };

  assert.throws(
    () =>
      parseRuntimeMarketSymbols([
        invalid,
      ]),
    /exchange/u,
  );
});

test('rejects a Market symbol that realtime cannot subscribe to', () => {
  const invalid = {
    ...createMarketSymbol(),
    symbol: '币安人生USDT',
    baseAsset: '币安人生',
  };

  assert.throws(
    () =>
      parseRuntimeMarketSymbols([
        invalid,
      ]),
    /symbol/u,
  );
});

test('rejects a non-array Market symbols response', () => {
  assert.throws(
    () =>
      parseRuntimeMarketSymbols({
        items: [
          createMarketSymbol(),
        ],
      }),
    /Invalid market symbols response/u,
  );
});
