import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  BinanceSymbolUniverseService,
} from '../src/modules/realtime-market-data/binance-symbol-universe.service.js';

const testEnv: AppEnv = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 4100,
  apiPrefix: '/api/v1',
  corsOrigins: [
    'http://localhost:5173',
  ],
  logLevel: 'silent',
};

test(
  'symbol universe route exposes all active Binance USDT pairs',
  async () => {
    let requestCount = 0;

    const service =
      new BinanceSymbolUniverseService({
        baseUrl:
          'https://data-api.binance.vision',
        quoteAsset: 'USDT',
        refreshIntervalMs:
          60_000,
        requestTimeoutMs:
          1_000,
        collectingDurationMs:
          15 * 60 * 1000,
        fetchImpl: async () => {
          requestCount += 1;

          return new Response(
            JSON.stringify({
              symbols: [
                {
                  symbol: 'BTCUSDT',
                  status: 'TRADING',
                  baseAsset: 'BTC',
                  quoteAsset: 'USDT',
                  isSpotTradingAllowed:
                    true,
                  permissionSets: [
                    ['SPOT'],
                  ],
                },
                {
                  symbol: 'ETHUSDT',
                  status: 'TRADING',
                  baseAsset: 'ETH',
                  quoteAsset: 'USDT',
                  isSpotTradingAllowed:
                    true,
                  permissionSets: [
                    ['SPOT'],
                  ],
                },
                {
                  symbol: 'SOLFDUSD',
                  status: 'TRADING',
                  baseAsset: 'SOL',
                  quoteAsset: 'FDUSD',
                  isSpotTradingAllowed:
                    true,
                  permissionSets: [
                    ['SPOT'],
                  ],
                },
                {
                  symbol: 'OLDUSDT',
                  status: 'BREAK',
                  baseAsset: 'OLD',
                  quoteAsset: 'USDT',
                  isSpotTradingAllowed:
                    true,
                  permissionSets: [
                    ['SPOT'],
                  ],
                },
              ],
            }),
            {
              status: 200,
              headers: {
                'content-type':
                  'application/json',
              },
            },
          );
        },
        now: () =>
          new Date(
            '2026-07-21T12:00:00.000Z',
          ),
      });

    const app = await buildApp({
      env: testEnv,
      binanceSymbolUniverseService:
        service,
    });

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/symbol-universe',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    const payload =
      response.json();

    assert.equal(
      payload.serviceState,
      'ready',
    );

    assert.equal(
      payload.initialized,
      true,
    );

    assert.equal(
      payload.refreshCount,
      1,
    );

    assert.deepEqual(
      payload.activeSymbols,
      [
        'BTCUSDT',
        'ETHUSDT',
      ],
    );

    assert.deepEqual(
      payload.collectingSymbols,
      [],
    );

    assert.deepEqual(
      payload.addedSymbols,
      [],
    );

    assert.equal(
      payload.entries.length,
      2,
    );

    assert.equal(
      payload.entries[0].status,
      'active',
    );

    assert.equal(
      requestCount,
      1,
    );

    await app.close();

    assert.equal(
      service.getSnapshot()
        .serviceState,
      'stopped',
    );
  },
);