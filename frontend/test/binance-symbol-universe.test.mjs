import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBinanceSymbolUniverseUrl,
  fetchBinanceSymbolUniverse,
  parseBinanceSymbolUniverseSnapshot,
} from '../node_modules/.tmp/realtime-test/realtime/binanceSymbolUniverse.js';

const payload = {
  entries: [
    {
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      status: 'active',
      firstSeenAt:
        '2026-07-21T19:00:00.000Z',
      lastSeenAt:
        '2026-07-21T19:01:00.000Z',
    },
    {
      symbol: 'NEWUSDT',
      baseAsset: 'NEW',
      quoteAsset: 'USDT',
      status: 'collecting',
      firstSeenAt:
        '2026-07-21T19:01:00.000Z',
      lastSeenAt:
        '2026-07-21T19:01:00.000Z',
    },
  ],
  activeSymbols: [
    'BTCUSDT',
  ],
  collectingSymbols: [
    'NEWUSDT',
  ],
  addedSymbols: [
    'NEWUSDT',
  ],
  removedSymbols: [],
  updatedAt:
    '2026-07-21T19:01:00.000Z',
  serviceState: 'ready',
  initialized: true,
  refreshCount: 2,
  lastSuccessfulRefreshAt:
    '2026-07-21T19:01:00.000Z',
  lastError: null,
};

test(
  'builds Binance Symbol Universe API URL',
  () => {
    assert.equal(
      buildBinanceSymbolUniverseUrl(
        'http://localhost:4100/',
      ),
      'http://localhost:4100/api/v1/market/symbol-universe',
    );

    assert.equal(
      buildBinanceSymbolUniverseUrl(),
      '/api/v1/market/symbol-universe',
    );
  },
);

test(
  'parses Binance Symbol Universe snapshot',
  () => {
    const snapshot =
      parseBinanceSymbolUniverseSnapshot(
        payload,
      );

    assert.equal(
      snapshot.entries.length,
      2,
    );

    assert.equal(
      snapshot.entries[1]?.status,
      'collecting',
    );

    assert.deepEqual(
      snapshot.addedSymbols,
      ['NEWUSDT'],
    );

    assert.equal(
      snapshot.refreshCount,
      2,
    );
  },
);

test(
  'fetches Binance Symbol Universe snapshot',
  async () => {
    let requestedUrl = '';

    const snapshot =
      await fetchBinanceSymbolUniverse({
        baseUrl:
          'http://localhost:4100',
        fetcher: async (url) => {
          requestedUrl = url;

          return new Response(
            JSON.stringify(payload),
            {
              status: 200,
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
      'http://localhost:4100/api/v1/market/symbol-universe',
    );

    assert.equal(
      snapshot.serviceState,
      'ready',
    );

    assert.deepEqual(
      snapshot.collectingSymbols,
      ['NEWUSDT'],
    );
  },
);

test(
  'rejects invalid Binance Symbol Universe payload',
  () => {
    assert.throws(
      () =>
        parseBinanceSymbolUniverseSnapshot({
          serviceState: 'ready',
        }),
      /entries/,
    );
  },
);

test(
  'reports Binance Symbol Universe HTTP errors',
  async () => {
    await assert.rejects(
      fetchBinanceSymbolUniverse({
        fetcher: async () =>
          new Response(
            JSON.stringify({
              error: 'unavailable',
            }),
            {
              status: 503,
            },
          ),
      }),
      /status 503/,
    );
  },
);