import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BinanceMarketHistoryClient,
  BinanceMarketHistoryError,
  BinanceMarketHistorySymbolNotFoundError,
} from '../src/modules/realtime-market-data/binance-market-history.client.js';

function json(
  payload: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(payload),
    {
      status,
      headers: {
        'content-type':
          'application/json',
      },
    },
  );
}

test(
  'loads, maps and sorts Binance one-minute history',
  async () => {
    const earlyOpenTime =
      1_721_275_200_000;

    const lateOpenTime =
      earlyOpenTime + 60_000;

    const earlyCloseTime =
      earlyOpenTime + 59_999;

    const lateCloseTime =
      lateOpenTime + 59_999;

    const endTime =
      lateCloseTime;

    const requests:
      string[] = [];

    const client =
      new BinanceMarketHistoryClient({
        baseUrl:
          'https://fapi.binance.com/',
        requestTimeoutMs: 1_000,
        now: () =>
          new Date(
            lateCloseTime + 1_000,
          ),
        fetchImpl: async (input) => {
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
              lateOpenTime,
              '20',
              '21',
              '19',
              '20.5',
              '100',
              lateCloseTime,
              '2050',
              15,
              '50',
              '1000',
              '0',
            ],
            [
              earlyOpenTime,
              '10',
              '11',
              '9',
              '10.5',
              '200',
              earlyCloseTime,
              '2100',
              10,
              '100',
              '900',
              '0',
            ],
          ]);
        },
      });

    const klines =
      await client.fetchOneMinuteKlines({
        symbol: ' solusdt ',
        limit: 2,
        endTime,
      });

    assert.deepEqual(
      requests,
      [
        '/fapi/v1/klines'
        + '?symbol=SOLUSDT'
        + '&interval=1m'
        + '&limit=2'
        + `&endTime=${endTime}`,
      ],
    );

    assert.equal(
      klines.length,
      2,
    );

    assert.equal(
      klines[0]?.symbol,
      'SOLUSDT',
    );

    assert.equal(
      klines[0]?.openTime,
      new Date(
        earlyOpenTime,
      ).toISOString(),
    );

    assert.equal(
      klines[0]?.close,
      10.5,
    );

    assert.equal(
      klines[0]?.quoteVolume,
      2100,
    );

    assert.equal(
      klines[0]?.tradesCount,
      10,
    );

    assert.equal(
      klines[0]?.takerBuyQuoteVolume,
      900,
    );

    assert.equal(
      klines[0]?.isClosed,
      true,
    );

    assert.equal(
      klines[1]?.openTime,
      new Date(
        lateOpenTime,
      ).toISOString(),
    );
  },
);

test(
  'maps Binance invalid-symbol history errors',
  async () => {
    const client =
      new BinanceMarketHistoryClient({
        baseUrl:
          'https://fapi.binance.com',
        requestTimeoutMs: 1_000,
        fetchImpl: async () =>
          json(
            {
              code: -1121,
              msg: 'Invalid symbol.',
            },
            400,
          ),
      });

    await assert.rejects(
      client.fetchOneMinuteKlines({
        symbol: 'UNKNOWNUSDT',
        limit: 60,
      }),
      (
        error: unknown,
      ) =>
        error
          instanceof
            BinanceMarketHistorySymbolNotFoundError
        && error.symbol
          === 'UNKNOWNUSDT',
    );
  },
);

test(
  'rejects an unsafe Binance history request limit',
  async () => {
    let fetchCalled =
      false;

    const client =
      new BinanceMarketHistoryClient({
        baseUrl:
          'https://fapi.binance.com',
        requestTimeoutMs: 1_000,
        fetchImpl: async () => {
          fetchCalled = true;
          return json([]);
        },
      });

    await assert.rejects(
      client.fetchOneMinuteKlines({
        symbol: 'BTCUSDT',
        limit: 1_501,
      }),
      BinanceMarketHistoryError,
    );

    assert.equal(
      fetchCalled,
      false,
    );
  },
);