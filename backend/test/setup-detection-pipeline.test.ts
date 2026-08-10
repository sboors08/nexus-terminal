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
    levelLinesOptions: {
      atrPeriod: 2,
      pivotLeftBars: 1,
      pivotRightBars: 1,
      originDepartureAtr: 0.6,
      originDepartureMaxCandles: 4,
      candidateVisibilityMinDepartureAtr: 2,
      candidateVisibilityMaxAgeBars: 5,
      persistentCandidateMinDepartureAtr: 1.5,
      persistentCandidateLookbackBars: 6,
      originEpisodeMaxSpanCandles: 3,
      workedEpisodeMaxSpanCandles: 8,
      touchTolerancePercent: 0.15,
      minBarsBetweenTouchEpisodes: 0,
      decisiveBreakAtr: 0.5,
      consecutiveBreakCloses: 2,
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
      open: 95,
      high: 96,
      low: 94,
      close: 95,
    }),
    buildKline(1, {
      open: 96,
      high: 100,
      low: 95,
      close: 99,
    }),
    buildKline(2, {
      open: 96.8,
      high: 97,
      low: 96,
      close: 96.5,
    }),
    buildKline(3, {
      open: 96,
      high: 97,
      low: 95,
      close: 96,
    }),
    buildKline(4, {
      open: 97,
      high: 99.9,
      low: 96,
      close: 99,
    }),
    buildKline(5, {
      open: 98,
      high: 98,
      low: 95,
      close: 96,
    }),
    buildKline(6, {
      open: 96,
      high: 97,
      low: 94,
      close: 95,
    }),
    buildKline(7, {
      open: 99.2,
      high: 99.8,
      low: 99.1,
      close: 99.7,
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
      8,
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
      2,
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
      result.source,
      'level_lines',
    );

    assert.equal(
      result.sourceCreatesSetup,
      false,
    );

    assert.equal(
      result.evaluatesBreakout,
      false,
    );

    assert.equal(
      result.evaluatesBounce,
      false,
    );

    assert.equal(
      result.scannedCandlesCount,
      8,
    );

    assert.equal(
      result.currentPrice,
      99.7,
    );

    assert.equal(
      result.levels.length,
      2,
    );

    const resistanceLevel =
      result.levels.find(
        (level) =>
          level.kind === 'resistance',
      );

    assert.ok(resistanceLevel);
    assert.equal(
      resistanceLevel.touchCount,
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
          === 'level_breakout'
          && candidate.level.kind
          === 'resistance',
      );

    const bounce =
      result.candidates.find(
        (candidate) =>
          candidate.setupType
          === 'level_bounce'
          && candidate.level.kind
          === 'resistance',
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

    assert.equal(
      breakout.causal?.lineId,
      resistanceLevel.id,
    );

    assert.equal(
      breakout.causal?.stage,
      'OBSERVATION',
    );

    assert.equal(
      breakout.createdAt,
      breakout.causal?.observedAt,
    );

    assert.equal(
      breakout.causal
        ?.observationProgressThreshold,
      0.5,
    );

    assert.equal(
      breakout.causal
        ?.maxDistanceToLevelPercent,
      0.5,
    );

    assert.equal(
      breakout.causal
        ?.sourceCreatesSetup,
      false,
    );

    const breakoutUpdate =
      result.causalUpdates.find(
        (update) =>
          update.candidateId
          === breakout.id,
      );

    assert.ok(breakoutUpdate);
    assert.equal(
      breakoutUpdate.context.lineId,
      resistanceLevel.id,
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
  'does not create a setup before canonical observation progress reaches 0.50',
  () => {
    const store =
      new MarketWideOneMinuteMetricsStore(
        ['SOLUSDT'],
      );

    store.applyHistoricalKlines(
      buildResistanceHistory()
        .slice(0, 7),
    );

    const result =
      new SetupDetectionPipeline(
        store,
        PIPELINE_OPTIONS,
      ).scanSymbol(
        'SOLUSDT',
      );

    assert.equal(
      result.levels.some(
        (line) =>
          line.status === 'confirmed',
      ),
      true,
    );
    assert.deepEqual(
      result.candidates,
      [],
    );
    assert.deepEqual(
      result.causalUpdates,
      [],
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
      99.7,
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
