import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MarketWideOneMinuteMetricsStore,
  type BinanceOneMinuteKlineUpdate,
} from '../src/modules/realtime-market-data/market-wide-one-minute-metrics.js';
import {
  SetupDetectionPipeline,
} from '../src/modules/setup-engine/setup-detection-pipeline.js';
import type {
  SetupDetectionPipelineOptions,
} from '../src/modules/setup-engine/setup-detection-pipeline.types.js';

const START_TIME_MS =
  Date.parse(
    '2026-07-26T12:00:00.000Z',
  );

const PIPELINE_OPTIONS:
  SetupDetectionPipelineOptions = {
    maxCandles: 100,
    detectorOptions: {
      pivotWindow: 1,
      minTouches: 2,
      minTouchSpacingCandles: 2,
      maxDistancePct: 0.25,
      zonePaddingPct: 0.05,
    },
    candidateOptions: {
      expiresAfterSec: 3_600,
    },
    setupTypes: [
      'level_breakout',
      'level_bounce',
    ],
  };

function buildKline(
  index: number,
  values: {
    open: number;
    high: number;
    low: number;
    close: number;
    isClosed?: boolean;
  },
): BinanceOneMinuteKlineUpdate {
  const openTimeMs =
    START_TIME_MS
    + index * 60_000;

  const closeTimeMs =
    openTimeMs
    + 59_999;

  return {
    symbol: 'SOLUSDT',
    eventTime:
      new Date(
        closeTimeMs,
      ).toISOString(),
    openTime:
      new Date(
        openTimeMs,
      ).toISOString(),
    closeTime:
      new Date(
        closeTimeMs,
      ).toISOString(),
    open: values.open,
    high: values.high,
    low: values.low,
    close: values.close,
    quoteVolume:
      10_000 + index,
    tradesCount:
      100 + index,
    takerBuyQuoteVolume:
      5_000,
    isClosed:
      values.isClosed
      ?? true,
  };
}

function buildResistanceHistory():
  BinanceOneMinuteKlineUpdate[] {
  return [
    buildKline(0, {
      open: 96,
      high: 98,
      low: 95,
      close: 97,
    }),
    buildKline(1, {
      open: 97,
      high: 100,
      low: 96,
      close: 98,
    }),
    buildKline(2, {
      open: 96,
      high: 98,
      low: 95,
      close: 97,
    }),
    buildKline(3, {
      open: 95,
      high: 97,
      low: 94,
      close: 96,
    }),
    buildKline(4, {
      open: 97,
      high: 100.1,
      low: 96,
      close: 98,
    }),
    buildKline(5, {
      open: 96,
      high: 98.5,
      low: 95,
      close: 97,
    }),
    buildKline(6, {
      open: 98,
      high: 99,
      low: 97,
      close: 98.5,
    }),
  ];
}

function createStore():
  MarketWideOneMinuteMetricsStore {
  const store =
    new MarketWideOneMinuteMetricsStore(
      ['SOLUSDT'],
    );

  store.applyHistoricalKlines(
    buildResistanceHistory(),
  );

  return store;
}

test(
  'returns defensive retained kline copies',
  () => {
    const store =
      createStore();

    const firstRead =
      store.getKlines(
        'SOLUSDT',
      );

    assert.equal(
      firstRead.length,
      7,
    );

    const firstKline =
      firstRead[0];

    assert.ok(firstKline);

    firstKline.close = 1;

    const secondRead =
      store.getKlines(
        'SOLUSDT',
      );

    assert.notEqual(
      secondRead[0]?.close,
      1,
    );

    assert.equal(
      store.getKlines(
        'SOLUSDT',
        2,
      ).length,
      2,
    );
  },
);

test(
  'detects a real retained level and creates both setup candidates',
  () => {
    const store =
      createStore();

    store.applyBookTicker({
      symbol: 'SOLUSDT',
      bidPrice: 99,
      bidQuantity: 200,
      askPrice: 99.2,
      askQuantity: 210,
      spread: 0.2,
      spreadPct: 0.2,
      updatedAt:
        '2026-07-26T12:07:00.000Z',
    });

    const pipeline =
      new SetupDetectionPipeline(
        store,
        PIPELINE_OPTIONS,
      );

    const result =
      pipeline.scanSymbol(
        'solusdt',
      );

    assert.equal(
      result.symbol,
      'SOLUSDT',
    );

    assert.equal(
      result.timeframe,
      '1m',
    );

    assert.equal(
      result.scannedCandlesCount,
      7,
    );

    assert.equal(
      result.currentPrice,
      99.1,
    );

    assert.equal(
      result.levels.length,
      1,
    );

    assert.equal(
      result.levels[0]?.kind,
      'resistance',
    );

    assert.equal(
      result.levels[0]
        ?.touchesCount,
      2,
    );

    assert.equal(
      result.candidates.length,
      2,
    );

    const breakout =
      result.candidates.find(
        (candidate) =>
          candidate.setupType
          === 'level_breakout',
      );

    const bounce =
      result.candidates.find(
        (candidate) =>
          candidate.setupType
          === 'level_bounce',
      );

    assert.ok(breakout);
    assert.ok(bounce);

    assert.equal(
      breakout.direction,
      'long',
    );

    assert.equal(
      bounce.direction,
      'short',
    );

    assert.equal(
      breakout.stage,
      'LEVEL_CONFIRMED',
    );
  },
);

test(
  'does not emit duplicate candidates on a repeated scan',
  () => {
    const pipeline =
      new SetupDetectionPipeline(
        createStore(),
        PIPELINE_OPTIONS,
      );

    const first =
      pipeline.scanSymbol(
        'SOLUSDT',
      );

    const second =
      pipeline.scanSymbol(
        'SOLUSDT',
      );

    assert.equal(
      first.candidates.length,
      2,
    );

    assert.equal(
      second.candidates.length,
      0,
    );

    assert.equal(
      second
        .duplicateCandidateIds
        .length,
      2,
    );
  },
);

test(
  'uses the latest retained close when book ticker is unavailable',
  () => {
    const pipeline =
      new SetupDetectionPipeline(
        createStore(),
        PIPELINE_OPTIONS,
      );

    const result =
      pipeline.scanSymbol(
        'SOLUSDT',
      );

    assert.equal(
      result.currentPrice,
      98.5,
    );

    assert.equal(
      result.candidates.length,
      2,
    );
  },
);

test(
  'supports scanning only breakout candidates',
  () => {
    const pipeline =
      new SetupDetectionPipeline(
        createStore(),
        {
          ...PIPELINE_OPTIONS,
          setupTypes: [
            'level_breakout',
          ],
        },
      );

    const result =
      pipeline.scanSymbol(
        'SOLUSDT',
      );

    assert.equal(
      result.candidates.length,
      1,
    );

    assert.equal(
      result.candidates[0]
        ?.setupType,
      'level_breakout',
    );
  },
);

test(
  'returns an empty result for a symbol without retained data',
  () => {
    const store =
      new MarketWideOneMinuteMetricsStore(
        ['ETHUSDT'],
      );

    const pipeline =
      new SetupDetectionPipeline(
        store,
        PIPELINE_OPTIONS,
      );

    const result =
      pipeline.scanSymbol(
        'ETHUSDT',
      );

    assert.equal(
      result.scannedCandlesCount,
      0,
    );

    assert.equal(
      result.currentPrice,
      null,
    );

    assert.deepEqual(
      result.levels,
      [],
    );

    assert.deepEqual(
      result.candidates,
      [],
    );
  },
);

test(
  'rejects invalid pipeline and kline limits',
  () => {
    const store =
      createStore();

    assert.throws(
      () =>
        store.getKlines(
          'SOLUSDT',
          0,
        ),
      /limit must be a positive integer/,
    );

    assert.throws(
      () =>
        new SetupDetectionPipeline(
          store,
          {
            ...PIPELINE_OPTIONS,
            maxCandles: 0,
          },
        ),
      /maxCandles must be a positive integer/,
    );
  },
);
