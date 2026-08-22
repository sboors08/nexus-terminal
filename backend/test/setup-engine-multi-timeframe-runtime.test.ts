import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateRealtimeCandles,
} from '../src/modules/realtime-market-data/market-wide-realtime.service.js';
import type {
  BinanceOneMinuteKlineUpdate,
} from '../src/modules/realtime-market-data/market-wide-one-minute-metrics.js';
import {
  SetupDetectionPipeline,
} from '../src/modules/setup-engine/setup-detection-pipeline.js';
import type {
  SetupDetectionCandle,
  SetupDetectionMarketStore,
} from '../src/modules/setup-engine/setup-detection-pipeline.types.js';
import {
  DEFAULT_SETUP_DETECTION_RUNTIME_OPTIONS,
  SetupDetectionRuntimeService,
} from '../src/modules/setup-engine/setup-detection-runtime.service.js';
import {
  SETUP_ENGINE_MULTI_TIMEFRAME_RUNTIME_SAFETY,
  SETUP_ENGINE_MULTI_TIMEFRAME_RUNTIME_VERSION,
  SETUP_ENGINE_RUNTIME_TIMEFRAMES,
} from '../src/modules/setup-engine/setup-engine-multi-timeframe-runtime.js';
import type {
  LevelEngineTimeframe,
} from '../src/modules/level-engine/level-engine.types.js';

const START =
  Date.parse('2026-08-22T12:00:00.000Z');

function minute(
  index: number,
  isClosed = true,
): BinanceOneMinuteKlineUpdate {
  const openTime =
    START + index * 60_000;

  return {
    symbol: 'BTCUSDT',
    eventTime:
      new Date(openTime + 59_999)
        .toISOString(),
    openTime:
      new Date(openTime)
        .toISOString(),
    closeTime:
      new Date(openTime + 59_999)
        .toISOString(),
    open: 100 + index,
    high: 101 + index,
    low: 99 + index,
    close: 100.5 + index,
    volume: 10,
    quoteVolume: 1_000,
    tradesCount: 5,
    takerBuyQuoteVolume: 500,
    isClosed,
  };
}

class MultiTimeframeSource
implements SetupDetectionMarketStore {
  readonly requested:
    LevelEngineTimeframe[] = [];

  readonly listeners =
    new Set<
      (
        event: {
          source: 'live' | 'history';
          symbols: string[];
        },
      ) => void
    >();

  getSymbols(): string[] {
    return ['BTCUSDT'];
  }

  getKlines():
  BinanceOneMinuteKlineUpdate[] {
    this.requested.push('1m');
    return [];
  }

  getSetupCandles(
    _symbol: string,
    timeframe:
      LevelEngineTimeframe,
  ): SetupDetectionCandle[] {
    this.requested.push(timeframe);
    return [];
  }

  getState(): null {
    return null;
  }

  subscribeKlineChanges(
    listener:
      (
        event: {
          source: 'live' | 'history';
          symbols: string[];
        },
      ) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

test(
  'declares the five production setup timeframes without changing safety rules',
  () => {
    assert.equal(
      SETUP_ENGINE_MULTI_TIMEFRAME_RUNTIME_VERSION,
      'setup-engine-multi-timeframe-runtime-v0.1',
    );
    assert.deepEqual(
      SETUP_ENGINE_RUNTIME_TIMEFRAMES,
      ['1m', '5m', '15m', '1h', '4h'],
    );
    assert.deepEqual(
      SETUP_ENGINE_MULTI_TIMEFRAME_RUNTIME_SAFETY,
      {
        independentTimeframeIdentity:
          true,
        reusesOneMinuteSource:
          true,
        usesClosedCandlesOnly:
          true,
        changesDetectionThresholds:
          false,
        createsTradeOrders:
          false,
      },
    );
  },
);

test(
  'aggregates aligned closed candles and retains an open current bucket',
  () => {
    const source = [
      ...Array.from(
        { length: 10 },
        (_, index) =>
          minute(index),
      ),
      minute(10, false),
    ];

    const candles =
      aggregateRealtimeCandles(
        source,
        '5m',
      );

    assert.equal(candles.length, 3);
    assert.equal(candles[0]?.isClosed, true);
    assert.equal(candles[1]?.isClosed, true);
    assert.equal(candles[2]?.isClosed, false);
    assert.equal(candles[0]?.open, 100);
    assert.equal(candles[0]?.close, 104.5);
    assert.equal(candles[0]?.volume, 50);
    assert.equal(candles[0]?.tradesCount, 25);
  },
);

test(
  'does not close an aggregate when one source minute is missing',
  () => {
    const candles =
      aggregateRealtimeCandles(
        [
          minute(0),
          minute(1),
          minute(3),
          minute(4),
        ],
        '5m',
      );

    assert.equal(candles.length, 1);
    assert.equal(candles[0]?.isClosed, false);
  },
);

test(
  'drops an incomplete historical bucket before later closed aggregates',
  () => {
    const candles =
      aggregateRealtimeCandles(
        [
          minute(0),
          minute(1),
          minute(3),
          minute(4),
          ...Array.from(
            { length: 5 },
            (_, index) =>
              minute(index + 5),
          ),
          minute(10, false),
        ],
        '5m',
      );

    assert.equal(candles.length, 2);
    assert.equal(candles[0]?.isClosed, true);
    assert.equal(
      candles[0]?.openTime,
      minute(5).openTime,
    );
    assert.equal(candles[1]?.isClosed, false);
    assert.equal(
      candles[1]?.openTime,
      minute(10, false).openTime,
    );
  },
);

test(
  'runs one independent production pipeline for every configured timeframe',
  () => {
    const source =
      new MultiTimeframeSource();
    const runtime =
      new SetupDetectionRuntimeService(
        source,
        DEFAULT_SETUP_DETECTION_RUNTIME_OPTIONS,
      );

    runtime.start();

    assert.deepEqual(
      runtime.getStatus().timeframes,
      ['1m', '5m', '15m', '1h', '4h'],
    );
    assert.equal(
      runtime.getStatus().scansCount,
      5,
    );
    assert.equal(
      runtime.getStatus().failedScans,
      0,
    );
    assert.deepEqual(
      [
        ...new Set(
          source.requested,
        ),
      ],
      ['1m', '5m', '15m', '1h', '4h'],
    );

    for (const listener of source.listeners) {
      listener({
        source: 'live',
        symbols: ['BTCUSDT'],
      });
    }

    assert.equal(
      runtime.getStatus().scansCount,
      5,
    );
  },
);

test(
  'pipeline result keeps its own timeframe identity',
  () => {
    const source =
      new MultiTimeframeSource();

    for (
      const timeframe
      of SETUP_ENGINE_RUNTIME_TIMEFRAMES
    ) {
      const pipeline =
        new SetupDetectionPipeline(
          source,
          undefined,
          { timeframe },
        );

      assert.equal(
        pipeline.scanSymbol('BTCUSDT')
          .timeframe,
        timeframe,
      );
    }
  },
);
