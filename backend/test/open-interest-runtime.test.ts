import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BinanceOpenInterestClient,
  BinanceOpenInterestError,
} from '../src/modules/realtime-market-data/binance-open-interest.client.js';

import {
  MarketWideOneMinuteMetricsStore,
} from '../src/modules/realtime-market-data/market-wide-one-minute-metrics.js';

import {
  MarketWideOpenInterestPoller,
  runMarketWideOpenInterestSweep,
  type MarketWideOpenInterestReader,
  type MarketWideOpenInterestTarget,
} from '../src/modules/realtime-market-data/market-wide-open-interest-poller.js';

import type {
  RealtimeOpenInterest,
  ReconnectScheduler,
} from '../src/modules/realtime-market-data/realtime-market-data.types.js';

function json(
  payload: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(
      payload,
    ),
    {
      status,
      headers: {
        'content-type':
          'application/json',
      },
    },
  );
}

function flushAsync():
Promise<void> {
  return new Promise(
    (resolve) => {
      setImmediate(
        resolve,
      );
    },
  );
}

test(
  'Binance Open Interest client maps the official current OI response',
  async () => {
    const requests:
      string[] = [];

    const time =
      1_784_390_400_000;

    const client =
      new BinanceOpenInterestClient({
        baseUrl:
          'https://fapi.binance.com/',
        requestTimeoutMs:
          1_000,

        fetchImpl:
          async (input) => {
            const url =
              new URL(
                input
                  instanceof Request
                  ? input.url
                  : input.toString(),
              );

            requests.push(
              url.pathname
              + url.search,
            );

            return json({
              openInterest:
                '10659.509',
              symbol:
                'BTCUSDT',
              time,
            });
          },
      });

    const value =
      await client
        .fetchOpenInterest(
          'btcusdt',
        );

    assert.deepEqual(
      requests,
      [
        '/fapi/v1/openInterest?symbol=BTCUSDT',
      ],
    );

    assert.deepEqual(
      value,
      {
        symbol:
          'BTCUSDT',
        openInterest:
          10659.509,
        updatedAt:
          new Date(
            time,
          ).toISOString(),
      },
    );
  },
);

test(
  'Binance Open Interest client rejects a mismatched symbol',
  async () => {
    const client =
      new BinanceOpenInterestClient({
        baseUrl:
          'https://fapi.binance.com',
        requestTimeoutMs:
          1_000,

        fetchImpl:
          async () =>
            json({
              openInterest:
                '100',
              symbol:
                'ETHUSDT',
              time:
                1_784_390_400_000,
            }),
      });

    await assert.rejects(
      () =>
        client.fetchOpenInterest(
          'BTCUSDT',
        ),
      (
        error: unknown,
      ) =>
        error
          instanceof
            BinanceOpenInterestError
        && /symbol mismatch/
          .test(
            error.message,
          ),
    );
  },
);

test(
  'market-wide store retains current OI, rejects stale OI and exposes it in scanner metrics',
  () => {
    const store =
      new MarketWideOneMinuteMetricsStore([
        'BTCUSDT',
      ]);

    const current:
      RealtimeOpenInterest = {
        symbol:
          'BTCUSDT',
        openInterest:
          10659.509,
        updatedAt:
          '2026-08-23T12:00:00.000Z',
      };

    assert.equal(
      store.applyOpenInterest(
        current,
      ),
      true,
    );

    assert.equal(
      store.applyOpenInterest({
        ...current,
        openInterest:
          9000,
        updatedAt:
          '2026-08-23T11:59:59.000Z',
      }),
      false,
    );

    assert.deepEqual(
      store.getState(
        'BTCUSDT',
      )?.openInterest,
      current,
    );

    const metric =
      store.getMetrics(
        'BTCUSDT',
      )[0];

    assert.ok(metric);

    assert.equal(
      metric.openInterest,
      10659.509,
    );

    assert.equal(
      metric
        .openInterestUpdatedAt,
      '2026-08-23T12:00:00.000Z',
    );

    assert.equal(
      metric.updatedAt,
      '2026-08-23T12:00:00.000Z',
    );

    assert.throws(
      () =>
        store.applyOpenInterest({
          symbol:
            'BTCUSDT',
          openInterest:
            -1,
          updatedAt:
            '2026-08-23T12:01:00.000Z',
        }),
      /Invalid market-wide open interest/,
    );
  },
);

test(
  'one OI sweep bounds concurrency and isolates per-symbol failures',
  async () => {
    let activeRequests = 0;
    let maximumActiveRequests = 0;

    const applied:
      RealtimeOpenInterest[] = [];

    const reader:
      MarketWideOpenInterestReader = {
        fetchOpenInterest:
          async (symbol) => {
            activeRequests +=
              1;

            maximumActiveRequests =
              Math.max(
                maximumActiveRequests,
                activeRequests,
              );

            await flushAsync();

            activeRequests -=
              1;

            if (
              symbol
              === 'BADUSDT'
            ) {
              throw new Error(
                'simulated request failure',
              );
            }

            return {
              symbol,
              openInterest:
                symbol.length,
              updatedAt:
                '2026-08-23T12:00:00.000Z',
            };
          },
      };

    const target:
      MarketWideOpenInterestTarget = {
        applyOpenInterest:
          (value) => {
            applied.push(
              value,
            );

            return true;
          },
      };

    const result =
      await runMarketWideOpenInterestSweep(
        [
          'BTCUSDT',
          'ETHUSDT',
          'SOLUSDT',
          'BADUSDT',
        ],
        reader,
        target,
        2,
      );

    assert.equal(
      result.symbolsCount,
      4,
    );

    assert.equal(
      result.successfulRequests,
      3,
    );

    assert.equal(
      result.failedRequests,
      1,
    );

    assert.equal(
      applied.length,
      3,
    );

    assert.equal(
      maximumActiveRequests,
      2,
    );
  },
);

test(
  'OI poller schedules the next sweep only after the current sweep completes and cancels on stop',
  async () => {
    type ScheduledEntry = {
      callback: () => void;
      delayMs: number;
      handle: number;
    };

    const scheduled:
      ScheduledEntry[] = [];

    const cancelled:
      unknown[] = [];

    let nextHandle = 0;

    const scheduler:
      ReconnectScheduler = {
        schedule:
          (
            callback,
            delayMs,
          ) => {
            nextHandle +=
              1;

            scheduled.push({
              callback,
              delayMs,
              handle:
                nextHandle,
            });

            return nextHandle;
          },

        cancel:
          (handle) => {
            cancelled.push(
              handle,
            );
          },
      };

    const applied:
      RealtimeOpenInterest[] = [];

    const poller =
      new MarketWideOpenInterestPoller({
        reader: {
          fetchOpenInterest:
            async (symbol) => ({
              symbol,
              openInterest:
                123.45,
              updatedAt:
                '2026-08-23T12:00:00.000Z',
            }),
        },

        symbolSource: {
          getSymbols:
            () => [
              'BTCUSDT',
            ],
        },

        target: {
          applyOpenInterest:
            (value) => {
              applied.push(
                value,
              );

              return true;
            },
        },

        intervalMs:
          60_000,

        maxConcurrency:
          2,

        scheduler,

        now:
          () =>
            new Date(
              '2026-08-23T12:00:00.000Z',
            ),
      });

    poller.start();

    assert.equal(
      scheduled.length,
      1,
    );

    assert.equal(
      scheduled[0]
        ?.delayMs,
      0,
    );

    const first =
      scheduled.shift();

    assert.ok(first);

    first.callback();

    assert.equal(
      scheduled.length,
      0,
    );

    await flushAsync();

    assert.equal(
      applied.length,
      1,
    );

    assert.equal(
      scheduled.length,
      1,
    );

    assert.equal(
      scheduled[0]
        ?.delayMs,
      60_000,
    );

    const status =
      poller.getStatus();

    assert.equal(
      status.started,
      true,
    );

    assert.equal(
      status.inFlight,
      false,
    );

    assert.equal(
      status.successfulRequests,
      1,
    );

    assert.equal(
      status.failedRequests,
      0,
    );

    poller.stop();

    assert.deepEqual(
      cancelled,
      [
        scheduled[0]
          ?.handle,
      ],
    );

    assert.equal(
      poller.getStatus()
        .started,
      false,
    );
  },
);
