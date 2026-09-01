import assert from 'node:assert/strict';
import test from 'node:test';
import type { MarketSymbol } from '../src/contracts/nexus-api.js';
import { BinanceTokenLogoMetadataService } from '../src/modules/market-data/binance-token-logo-metadata.service.js';

function createSymbol(
  symbol: string,
  baseAsset: string,
): MarketSymbol {
  return {
    symbol,
    baseAsset,
    quoteAsset: 'USDT',
    exchange: 'binance',
    price: 1,
    priceChangePct: 0,
    volumeQuote: 1,
    tradesCount: 1,
    tradeRate: 1,
    volatilityPct: 0,
    btcCorrelation: null,
    btcRelativeStrength: null,
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

function createResponse(
  data: unknown[],
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    },
  );
}

test(
  'enriches new Binance listings and normalizes multiplier symbols',
  async () => {
    let requestedUrl = '';

    const service =
      new BinanceTokenLogoMetadataService({
        fetchImpl: async (input) => {
          requestedUrl = String(input);

          return createResponse([
            {
              symbol: 'USELESS',
              cexCoinName: 'USELESS',
              iconUrl: 'https://bin.bnbstatic.com/images/useless.png',
              listingCex: true,
              offline: false,
            },
            {
              symbol: 'PEPE',
              cexCoinName: 'PEPE',
              iconUrl: 'https://bin.bnbstatic.com/images/pepe.png',
              listingCex: true,
              offline: false,
            },
          ]);
        },
      });

    const enriched =
      await service.enrichMarketSymbols([
        createSymbol('USELESSUSDT', 'USELESS'),
        createSymbol('1000PEPEUSDT', '1000PEPE'),
        createSymbol('UNKNOWNUSDT', 'UNKNOWN'),
      ]);

    assert.match(
      requestedUrl,
      /alpha\/all\/token\/list$/u,
    );
    assert.equal(
      enriched[0].logoUrl,
      'https://bin.bnbstatic.com/images/useless.png',
    );
    assert.equal(
      enriched[1].logoUrl,
      'https://bin.bnbstatic.com/images/pepe.png',
    );
    assert.equal(
      enriched[2].logoUrl,
      null,
    );
  },
);

test(
  'coalesces concurrent refreshes and reuses the shared cache',
  async () => {
    let fetches = 0;
    let releaseFetch:
      (() => void)
      | undefined;

    const gate =
      new Promise<void>((resolve) => {
        releaseFetch = resolve;
      });

    const service =
      new BinanceTokenLogoMetadataService({
        fetchImpl: async () => {
          fetches += 1;
          await gate;

          return createResponse([
            {
              symbol: 'SOL',
              iconUrl: 'https://bin.bnbstatic.com/images/sol.png',
              listingCex: true,
            },
          ]);
        },
      });

    const first =
      service.enrichMarketSymbols([
        createSymbol('SOLUSDT', 'SOL'),
      ]);
    const second =
      service.enrichMarketSymbols([
        createSymbol('SOLUSDT', 'SOL'),
      ]);

    releaseFetch?.();

    await Promise.all([
      first,
      second,
    ]);

    await service.enrichMarketSymbols([
      createSymbol('SOLUSDT', 'SOL'),
    ]);

    assert.equal(fetches, 1);
  },
);

test(
  'rejects untrusted image hosts and falls back to stale cache on refresh failure',
  async () => {
    let nowMs =
      Date.parse('2026-09-01T00:00:00.000Z');
    let request = 0;

    const service =
      new BinanceTokenLogoMetadataService({
        cacheTtlMs: 1,
        now: () => new Date(nowMs),
        fetchImpl: async () => {
          request += 1;

          if (request === 1) {
            return createResponse([
              {
                symbol: 'SOL',
                iconUrl: 'https://bin.bnbstatic.com/images/sol.png',
              },
              {
                symbol: 'BAD',
                iconUrl: 'https://example.com/bad.png',
              },
            ]);
          }

          throw new Error('metadata offline');
        },
      });

    const first =
      await service.enrichMarketSymbols([
        createSymbol('SOLUSDT', 'SOL'),
        createSymbol('BADUSDT', 'BAD'),
      ]);

    assert.equal(
      first[0].logoUrl,
      'https://bin.bnbstatic.com/images/sol.png',
    );
    assert.equal(first[1].logoUrl, null);

    nowMs += 2;

    const stale =
      await service.enrichMarketSymbols([
        createSymbol('SOLUSDT', 'SOL'),
      ]);

    assert.equal(
      stale[0].logoUrl,
      'https://bin.bnbstatic.com/images/sol.png',
    );
    assert.equal(request, 2);
  },
);
