import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialBinanceSymbolUniverse,
  parseBinanceSpotSymbolUniverse,
  reconcileBinanceSymbolUniverse,
} from '../src/modules/realtime-market-data/binance-symbol-universe.js';

test(
  'parses active Binance Spot USDT symbols',
  () => {
    const symbols =
      parseBinanceSpotSymbolUniverse({
        symbols: [
          {
            symbol: 'BTCUSDT',
            status: 'TRADING',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
            isSpotTradingAllowed: true,
            permissionSets: [
              ['SPOT'],
            ],
          },
          {
            symbol: 'SOLUSDT',
            status: 'TRADING',
            baseAsset: 'SOL',
            quoteAsset: 'USDT',
            permissions: ['SPOT'],
          },
          {
            symbol: 'ETHUSDT',
            status: 'BREAK',
            baseAsset: 'ETH',
            quoteAsset: 'USDT',
            permissions: ['SPOT'],
          },
          {
            symbol: 'BTCFDUSD',
            status: 'TRADING',
            baseAsset: 'BTC',
            quoteAsset: 'FDUSD',
            permissions: ['SPOT'],
          },
          {
            symbol: 'MARGINUSDT',
            status: 'TRADING',
            baseAsset: 'MARGIN',
            quoteAsset: 'USDT',
            permissions: ['MARGIN'],
          },
          {
            symbol: 'DISABLEDUSDT',
            status: 'TRADING',
            baseAsset: 'DISABLED',
            quoteAsset: 'USDT',
            isSpotTradingAllowed: false,
          },
          {
            symbol: '',
            status: 'TRADING',
            baseAsset: 'BAD',
            quoteAsset: 'USDT',
          },
        ],
      });

    assert.deepEqual(
      symbols.map(
        (symbol) =>
          symbol.symbol,
      ),
      [
        'BTCUSDT',
        'SOLUSDT',
      ],
    );
  },
);

test(
  'creates the initial universe without announcing every existing symbol as new',
  () => {
    const snapshot =
      createInitialBinanceSymbolUniverse(
        [
          {
            symbol: 'BTCUSDT',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
          },
          {
            symbol: 'ETHUSDT',
            baseAsset: 'ETH',
            quoteAsset: 'USDT',
          },
        ],
        '2026-07-21T12:00:00.000Z',
      );

    assert.deepEqual(
      snapshot.activeSymbols,
      [
        'BTCUSDT',
        'ETHUSDT',
      ],
    );

    assert.deepEqual(
      snapshot.collectingSymbols,
      [],
    );

    assert.deepEqual(
      snapshot.addedSymbols,
      [],
    );

    assert.deepEqual(
      snapshot.removedSymbols,
      [],
    );
  },
);

test(
  'detects a new listing and a removed Binance symbol',
  () => {
    const initial =
      createInitialBinanceSymbolUniverse(
        [
          {
            symbol: 'BTCUSDT',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
          },
          {
            symbol: 'DOGEUSDT',
            baseAsset: 'DOGE',
            quoteAsset: 'USDT',
          },
        ],
        '2026-07-21T12:00:00.000Z',
      );

    const next =
      reconcileBinanceSymbolUniverse(
        initial.entries,
        [
          {
            symbol: 'BTCUSDT',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
          },
          {
            symbol: 'NEWUSDT',
            baseAsset: 'NEW',
            quoteAsset: 'USDT',
          },
        ],
        '2026-07-21T12:05:00.000Z',
      );

    assert.deepEqual(
      next.addedSymbols,
      ['NEWUSDT'],
    );

    assert.deepEqual(
      next.removedSymbols,
      ['DOGEUSDT'],
    );

    assert.deepEqual(
      next.collectingSymbols,
      ['NEWUSDT'],
    );

    assert.deepEqual(
      next.activeSymbols,
      ['BTCUSDT'],
    );
  },
);

test(
  'promotes a new listing after its collecting period',
  () => {
    const initial =
      createInitialBinanceSymbolUniverse(
        [
          {
            symbol: 'BTCUSDT',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
          },
        ],
        '2026-07-21T12:00:00.000Z',
      );

    const discovered =
      reconcileBinanceSymbolUniverse(
        initial.entries,
        [
          {
            symbol: 'BTCUSDT',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
          },
          {
            symbol: 'NEWUSDT',
            baseAsset: 'NEW',
            quoteAsset: 'USDT',
          },
        ],
        '2026-07-21T12:01:00.000Z',
        {
          collectingDurationMs:
            10 * 60 * 1000,
        },
      );

    const promoted =
      reconcileBinanceSymbolUniverse(
        discovered.entries,
        [
          {
            symbol: 'BTCUSDT',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
          },
          {
            symbol: 'NEWUSDT',
            baseAsset: 'NEW',
            quoteAsset: 'USDT',
          },
        ],
        '2026-07-21T12:11:00.000Z',
        {
          collectingDurationMs:
            10 * 60 * 1000,
        },
      );

    const newListing =
      promoted.entries.find(
        (entry) =>
          entry.symbol === 'NEWUSDT',
      );

    assert.equal(
      newListing?.status,
      'active',
    );

    assert.equal(
      newListing?.firstSeenAt,
      '2026-07-21T12:01:00.000Z',
    );

    assert.deepEqual(
      promoted.addedSymbols,
      [],
    );

    assert.deepEqual(
      promoted.activeSymbols,
      [
        'BTCUSDT',
        'NEWUSDT',
      ],
    );
  },
);

test(
  'rejects malformed exchangeInfo payloads',
  () => {
    assert.throws(
      () =>
        parseBinanceSpotSymbolUniverse({
          serverTime: 1,
        }),
      /does not contain symbols/,
    );
  },
);