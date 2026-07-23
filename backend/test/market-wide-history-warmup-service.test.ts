import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MarketWideHistoryWarmupService,
} from '../src/modules/realtime-market-data/market-wide-history-warmup.service.js';
import type {
  BinanceOneMinuteKlineUpdate,
} from '../src/modules/realtime-market-data/market-wide-one-minute-metrics.js';

const latestOpenTime =
  Date.parse(
    '2024-07-20T12:59:00.000Z',
  );

function kline(
  symbol: string,
  openTime: number,
): BinanceOneMinuteKlineUpdate {
  const closeTime =
    openTime + 59_999;

  return {
    symbol,
    eventTime:
      new Date(
        closeTime,
      ).toISOString(),
    openTime:
      new Date(
        openTime,
      ).toISOString(),
    closeTime:
      new Date(
        closeTime,
      ).toISOString(),
    open: 100,
    high: 102,
    low: 99,
    close: 101,
    quoteVolume: 1_000,
    tradesCount: 10,
    takerBuyQuoteVolume: 500,
    isClosed: true,
  };
}

function createPage(
  symbol: string,
  limit: number,
  endTime?: number,
): BinanceOneMinuteKlineUpdate[] {
  const pageLatestOpenTime =
    endTime === undefined
      ? latestOpenTime
      : Math.floor(
          endTime / 60_000,
        ) * 60_000;

  const firstOpenTime =
    pageLatestOpenTime
    - (
      limit - 1
    ) * 60_000;

  return Array.from(
    {
      length: limit,
    },
    (
      _,
      index,
    ) =>
      kline(
        symbol,
        firstOpenTime
        + index * 60_000,
      ),
  );
}

test(
  'warms every symbol stage by stage',
  async () => {
    const requests:
      Array<{
        symbol: string;
        limit: number;
        endTime?: number;
      }> = [];

    const service =
      new MarketWideHistoryWarmupService({
        minutesPerSymbol:
          4 * 60,
        requestDelayMs: 0,
        historySource: {
          fetchOneMinuteKlines:
            async (request) => {
              requests.push({
                symbol:
                  request.symbol,
                limit:
                  request.limit,
                ...(
                  request.endTime
                  !== undefined
                    ? {
                        endTime:
                          request.endTime,
                      }
                    : {}
                ),
              });

              return createPage(
                request.symbol,
                request.limit,
                request.endTime,
              );
            },
        },
        target: {
          applyHistoricalKlines:
            (updates) =>
              updates.length,
        },
      });

    await service.start([
      ' solusdt ',
      'BTCUSDT',
      'SOLUSDT',
    ]);

    assert.deepEqual(
      requests.map(
        (request) => ({
          symbol:
            request.symbol,
          limit:
            request.limit,
          hasEndTime:
            request.endTime
            !== undefined,
        }),
      ),
      [
        {
          symbol: 'BTCUSDT',
          limit: 60,
          hasEndTime: false,
        },
        {
          symbol: 'SOLUSDT',
          limit: 60,
          hasEndTime: false,
        },
        {
          symbol: 'BTCUSDT',
          limit: 180,
          hasEndTime: true,
        },
        {
          symbol: 'SOLUSDT',
          limit: 180,
          hasEndTime: true,
        },
      ],
    );

    assert.deepEqual(
      service.getStatus(),
      {
        state: 'completed',
        totalSymbols: 2,
        processedSymbols: 2,
        successfulSymbols: 2,
        failedSymbols: 0,
        appliedKlines: 480,
        currentSymbol: null,
        lastError: null,
        currentStageIndex: 2,
        totalStages: 2,
        completedStages: 2,
        currentStageTargetMinutes:
          240,
      },
    );
  },
);

test(
  'paginates the three-day stage without repeating newer history',
  async () => {
    const limits:
      number[] = [];

    const endTimes:
      Array<
        number | undefined
      > = [];

    const service =
      new MarketWideHistoryWarmupService({
        minutesPerSymbol:
          3 * 24 * 60,
        requestDelayMs: 0,
        historySource: {
          fetchOneMinuteKlines:
            async (request) => {
              limits.push(
                request.limit,
              );

              endTimes.push(
                request.endTime,
              );

              return createPage(
                request.symbol,
                request.limit,
                request.endTime,
              );
            },
        },
        target: {
          applyHistoricalKlines:
            (updates) =>
              updates.length,
        },
      });

    await service.start([
      'BTCUSDT',
    ]);

    assert.deepEqual(
      limits,
      [
        60,
        180,
        480,
        720,
        1_500,
        1_380,
      ],
    );

    assert.equal(
      endTimes[0],
      undefined,
    );

    assert.ok(
      endTimes
        .slice(1)
        .every(
          (value) =>
            value !== undefined,
        ),
    );

    assert.equal(
      service.getStatus()
        .appliedKlines,
      4_320,
    );

    assert.equal(
      service.getStatus()
        .completedStages,
      5,
    );
  },
);

test(
  'continues a stage when one symbol fails',
  async () => {
    const appliedSymbols:
      string[] = [];

    const service =
      new MarketWideHistoryWarmupService({
        minutesPerSymbol: 60,
        requestDelayMs: 0,
        historySource: {
          fetchOneMinuteKlines:
            async (request) => {
              if (
                request.symbol
                === 'BTCUSDT'
              ) {
                throw new Error(
                  'temporary Binance failure',
                );
              }

              return createPage(
                request.symbol,
                request.limit,
                request.endTime,
              );
            },
        },
        target: {
          applyHistoricalKlines:
            (updates) => {
              appliedSymbols.push(
                ...updates.map(
                  (update) =>
                    update.symbol,
                ),
              );

              return updates.length;
            },
        },
      });

    await service.start([
      'BTCUSDT',
      'SOLUSDT',
    ]);

    assert.equal(
      appliedSymbols.length,
      60,
    );

    assert.ok(
      appliedSymbols.every(
        (symbol) =>
          symbol === 'SOLUSDT',
      ),
    );

    assert.deepEqual(
      service.getStatus(),
      {
        state: 'completed',
        totalSymbols: 2,
        processedSymbols: 2,
        successfulSymbols: 1,
        failedSymbols: 1,
        appliedKlines: 60,
        currentSymbol: null,
        lastError:
          'temporary Binance failure',
        currentStageIndex: 1,
        totalStages: 1,
        completedStages: 1,
        currentStageTargetMinutes:
          60,
      },
    );
  },
);