import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateMarketVolumeSpike,
  type MarketVolumeSpikeKline,
} from '../src/modules/realtime-market-data/market-volume-spikes.js';

const PERIOD_MINUTES = 5;
const BASELINE_PERIODS = 12;
const START_TIME_MS =
  Date.parse('2026-07-23T00:00:00.000Z');

function buildPeriod(
  startMinute: number,
  quoteVolume: number,
  tradesCount: number,
  prices: {
    open?: number;
    close?: number;
  } = {},
): MarketVolumeSpikeKline[] {
  const perMinuteVolume =
    quoteVolume / PERIOD_MINUTES;

  const baseTrades =
    Math.floor(
      tradesCount / PERIOD_MINUTES,
    );

  const tradesRemainder =
    tradesCount
    - baseTrades * PERIOD_MINUTES;

  return Array.from(
    {
      length: PERIOD_MINUTES,
    },
    (_, index) => {
      const openTimeMs =
        START_TIME_MS
        + (
          startMinute + index
        ) * 60_000;

      return {
        openTime:
          new Date(
            openTimeMs,
          ).toISOString(),
        closeTime:
          new Date(
            openTimeMs + 59_999,
          ).toISOString(),
        open:
          prices.open ?? 100,
        close:
          prices.close ?? 100,
        quoteVolume:
          perMinuteVolume,
        tradesCount:
          baseTrades
          + (
            index < tradesRemainder
              ? 1
              : 0
          ),
      };
    },
  );
}

function buildSeries(
  previousQuoteVolume: number,
  currentQuoteVolume: number,
  previousTradesCount: number,
  currentTradesCount: number,
): MarketVolumeSpikeKline[] {
  const baseline =
    Array.from(
      {
        length: BASELINE_PERIODS,
      },
      (_, periodIndex) =>
        buildPeriod(
          periodIndex
          * PERIOD_MINUTES,
          100_000,
          100,
        ),
    ).flat();

  return [
    ...baseline,
    ...buildPeriod(
      BASELINE_PERIODS
      * PERIOD_MINUTES,
      previousQuoteVolume,
      previousTradesCount,
    ),
    ...buildPeriod(
      (
        BASELINE_PERIODS + 1
      ) * PERIOD_MINUTES,
      currentQuoteVolume,
      currentTradesCount,
      {
        open: 100,
        close: 102,
      },
    ),
  ];
}

const options = {
  periodMinutes: PERIOD_MINUTES,
  baselinePeriods: BASELINE_PERIODS,
  minVolumeRatio: 2,
  minTradesRatio: 1.5,
  fadingVolumeRatio: 1.5,
  trendTolerancePct: 10,
  minCurrentQuoteVolume: 50_000,
};

test(
  'returns null when historical data is insufficient',
  () => {
    const klines =
      buildSeries(
        100_000,
        250_000,
        100,
        200,
      ).slice(1);

    const result =
      calculateMarketVolumeSpike(
        'SOLUSDT',
        klines,
        options,
      );

    assert.equal(
      result,
      null,
    );
  },
);

test(
  'detects a new volume spike',
  () => {
    const result =
      calculateMarketVolumeSpike(
        'SOLUSDT',
        buildSeries(
          100_000,
          250_000,
          100,
          200,
        ),
        options,
      );

    assert.ok(result);

    assert.equal(
      result.symbol,
      'SOLUSDT',
    );

    assert.equal(
      result.status,
      'new',
    );

    assert.equal(
      result.currentQuoteVolume,
      250_000,
    );

    assert.equal(
      result.baselineQuoteVolume,
      100_000,
    );

    assert.equal(
      result.volumeRatio,
      2.5,
    );

    assert.equal(
      result.tradesRatio,
      2,
    );

    assert.equal(
      result.priceChangePct,
      2,
    );
  },
);

test(
  'classifies a growing volume spike',
  () => {
    const result =
      calculateMarketVolumeSpike(
        'ETHUSDT',
        buildSeries(
          220_000,
          280_000,
          170,
          220,
        ),
        options,
      );

    assert.ok(result);

    assert.equal(
      result.status,
      'growing',
    );

    assert.equal(
      result.previousVolumeRatio,
      2.2,
    );

    assert.equal(
      result.volumeRatio,
      2.8,
    );
  },
);

test(
  'classifies a stable volume spike',
  () => {
    const result =
      calculateMarketVolumeSpike(
        'BNBUSDT',
        buildSeries(
          230_000,
          235_000,
          180,
          185,
        ),
        options,
      );

    assert.ok(result);

    assert.equal(
      result.status,
      'stable',
    );
  },
);

test(
  'keeps a weakening spike as fading',
  () => {
    const result =
      calculateMarketVolumeSpike(
        'XRPUSDT',
        buildSeries(
          250_000,
          170_000,
          200,
          160,
        ),
        options,
      );

    assert.ok(result);

    assert.equal(
      result.status,
      'fading',
    );

    assert.equal(
      result.volumeRatio,
      1.7,
    );
  },
);

test(
  'does not return ordinary market activity',
  () => {
    const result =
      calculateMarketVolumeSpike(
        'ADAUSDT',
        buildSeries(
          100_000,
          130_000,
          100,
          120,
        ),
        options,
      );

    assert.equal(
      result,
      null,
    );
  },
);

test(
  'rejects a series with a missing minute',
  () => {
    const klines =
      buildSeries(
        100_000,
        250_000,
        100,
        200,
      );

    const currentPeriodStart =
      (
        BASELINE_PERIODS + 1
      ) * PERIOD_MINUTES;

    const klinesWithGap =
      klines.map(
        (
          kline,
          index,
        ) => {
          if (
            index
            < currentPeriodStart
          ) {
            return kline;
          }

          return {
            ...kline,
            openTime:
              new Date(
                Date.parse(
                  kline.openTime,
                ) + 60_000,
              ).toISOString(),
            closeTime:
              new Date(
                Date.parse(
                  kline.closeTime,
                ) + 60_000,
              ).toISOString(),
          };
        },
      );

    const result =
      calculateMarketVolumeSpike(
        'SOLUSDT',
        klinesWithGap,
        options,
      );

    assert.equal(
      result,
      null,
    );
  },
);

test(
  'accepts zero minimum current quote volume',
  () => {
    const result =
      calculateMarketVolumeSpike(
        'DOGEUSDT',
        buildSeries(
          10_000,
          25_000,
          100,
          200,
        ),
        {
          ...options,
          minVolumeRatio: 0.2,
          minCurrentQuoteVolume: 0,
        },
      );

    assert.ok(result);
    assert.equal(
      result.currentQuoteVolume,
      25_000,
    );
  },
);
