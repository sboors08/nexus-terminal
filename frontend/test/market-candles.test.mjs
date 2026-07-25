import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMarketCandlesUrl,
  fetchMarketCandles,
  parseMarketCandle,
} from '../node_modules/.tmp/realtime-test/charts/api/marketCandles.js';

function createCandle() {
  return {
    openTime:
      '2026-07-25T12:00:00.000Z',
    closeTime:
      '2026-07-25T12:04:59.999Z',
    open: 188,
    high: 190,
    low: 187,
    close: 189,
    volume: 1250.5,
    tradesCount: 842,
  };
}

test(
  'builds a normalized market candles URL',
  () => {
    assert.equal(
      buildMarketCandlesUrl({
        baseUrl:
          'http://localhost:4100/',
        symbol:
          ' solusdt ',
        timeframe:
          '5m',
      }),
      'http://localhost:4100/api/v1/market/candles'
        + '?symbol=SOLUSDT'
        + '&timeframe=5m',
    );
  },
);

test(
  'fetches and validates market candles',
  async () => {
    let requestedUrl = '';
    let requestedMethod = '';
    let requestedAccept = '';

    const candles =
      await fetchMarketCandles({
        symbol:
          'solusdt',
        timeframe:
          '5m',
        fetcher:
          async (url, init) => {
            requestedUrl =
              String(url);

            requestedMethod =
              init?.method
              ?? '';

            requestedAccept =
              new Headers(
                init?.headers,
              ).get('accept')
              ?? '';

            return new Response(
              JSON.stringify([
                createCandle(),
                {
                  ...createCandle(),
                  openTime:
                    '2026-07-25T12:05:00.000Z',
                  closeTime:
                    '2026-07-25T12:09:59.999Z',
                  open:
                    189,
                  high:
                    191,
                  low:
                    188,
                  close:
                    190.5,
                },
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
      '/api/v1/market/candles'
        + '?symbol=SOLUSDT'
        + '&timeframe=5m',
    );

    assert.equal(
      requestedMethod,
      'GET',
    );

    assert.equal(
      requestedAccept,
      'application/json',
    );

    assert.equal(
      candles.length,
      2,
    );

    assert.equal(
      candles[0]?.tradesCount,
      842,
    );

    assert.equal(
      candles[1]?.close,
      190.5,
    );
  },
);

test(
  'rejects invalid market candle input',
  () => {
    assert.throws(
      () =>
        buildMarketCandlesUrl({
          symbol:
            'SOL/USDT',
          timeframe:
            '5m',
        }),
      /symbol/,
    );

    assert.throws(
      () =>
        buildMarketCandlesUrl({
          symbol:
            'SOLUSDT',
          timeframe:
            '24h',
        }),
      /Unsupported/,
    );

    assert.throws(
      () =>
        parseMarketCandle({
          ...createCandle(),
          high:
            188,
          close:
            189,
        }),
      /OHLC range/,
    );

    assert.throws(
      () =>
        parseMarketCandle({
          ...createCandle(),
          tradesCount:
            1.5,
        }),
      /tradesCount/,
    );
  },
);

test(
  'reports invalid and failed market candle responses',
  async () => {
    await assert.rejects(
      () =>
        fetchMarketCandles({
          symbol:
            'SOLUSDT',
          timeframe:
            '5m',
          fetcher:
            async () =>
              new Response(
                JSON.stringify({
                  symbol:
                    'SOLUSDT',
                }),
                {
                  status:
                    200,
                },
              ),
        }),
      /Invalid market candles response/,
    );

    await assert.rejects(
      () =>
        fetchMarketCandles({
          symbol:
            'SOLUSDT',
          timeframe:
            '5m',
          fetcher:
            async () =>
              new Response(
                JSON.stringify({
                  error:
                    'unavailable',
                }),
                {
                  status:
                    503,
                },
              ),
        }),
      /request failed: 503/,
    );
  },
);