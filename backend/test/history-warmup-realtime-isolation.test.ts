import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  BinanceOneMinuteKlineUpdate,
} from '../src/modules/realtime-market-data/market-wide-one-minute-metrics.js';

import {
  SetupDetectionRuntimeService,
} from '../src/modules/setup-engine/setup-detection-runtime.service.js';

import type {
  SetupDetectionKlineChange,
  SetupDetectionRuntimeSource,
} from '../src/modules/setup-engine/setup-detection-runtime.types.js';

import {
  LevelV2ShadowRuntimeService,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-runtime.js';


const BASE_TIME_MS =
  Date.parse(
    '2026-08-18T12:00:00.000Z',
  );


function buildKlines():
BinanceOneMinuteKlineUpdate[] {
  return Array.from(
    {
      length: 24,
    },
    (
      _,
      index,
    ) => {
      const openTimeMs =
        BASE_TIME_MS
        + index * 60_000;

      const closeTimeMs =
        openTimeMs
        + 59_999;

      const basePrice =
        100
        + Math.sin(
          index / 2,
        ) * 2;

      const open =
        basePrice;

      const close =
        basePrice
        + (
          index % 2 === 0
            ? 0.5
            : -0.4
        );

      return {
        symbol:
          'SOLUSDT',

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

        open,

        high:
          Math.max(
            open,
            close,
          ) + 1,

        low:
          Math.min(
            open,
            close,
          ) - 1,

        close,

        volume:
          1_000 + index,

        quoteVolume:
          100_000 + index * 1_000,

        tradesCount:
          1_000 + index,

        takerBuyQuoteVolume:
          50_000 + index * 100,

        isClosed:
          true,
      };
    },
  );
}


class TestHistoryRealtimeSource
implements SetupDetectionRuntimeSource {
  private readonly klines =
    buildKlines();

  private readonly listeners =
    new Set<
      (
        event:
          SetupDetectionKlineChange,
      ) => void
    >();


  getSymbols(): string[] {
    return [
      'SOLUSDT',
    ];
  }


  getKlines(
    symbol: string,
    limit?: number,
  ): BinanceOneMinuteKlineUpdate[] {
    if (
      symbol
        .trim()
        .toUpperCase()
      !== 'SOLUSDT'
    ) {
      return [];
    }

    const source =
      limit === undefined
        ? this.klines
        : this.klines.slice(
            -limit,
          );

    return source.map(
      (item) => ({
        ...item,
      }),
    );
  }


  getState(
    symbol: string,
  ): {
    kline:
      BinanceOneMinuteKlineUpdate
      | null;

    bookTicker:
      null;
  } | null {
    if (
      symbol
        .trim()
        .toUpperCase()
      !== 'SOLUSDT'
    ) {
      return null;
    }

    const latest =
      this.klines.at(-1);

    return {
      kline:
        latest
          ? {
              ...latest,
            }
          : null,

      bookTicker:
        null,
    };
  }


  subscribeKlineChanges(
    listener:
      (
        event:
          SetupDetectionKlineChange,
      ) => void,
  ): () => void {
    this.listeners.add(
      listener,
    );

    return () => {
      this.listeners.delete(
        listener,
      );
    };
  }


  emit(
    source:
      SetupDetectionKlineChange['source'],
  ): void {
    const event:
      SetupDetectionKlineChange = {
        source,

        symbols: [
          'SOLUSDT',
        ],
      };

    for (
      const listener
      of this.listeners
    ) {
      listener(
        event,
      );
    }
  }
}


test(
  'does not run Setup Detection scans for history hydration events but still scans live events',
  () => {
    const source =
      new TestHistoryRealtimeSource();

    const runtime =
      new SetupDetectionRuntimeService(
        source,
      );

    runtime.start();

    const initialScans =
      runtime.getStatus()
        .scansCount;

    /*
     * One initial scan is allowed when the runtime starts.
     */
    assert.equal(
      initialScans,
      1,
    );

    /*
     * History warm-up hydrates storage.
     *
     * It must NOT synchronously launch the expensive
     * realtime setup detection pipeline.
     */
    source.emit(
      'history',
    );

    assert.equal(
      runtime.getStatus()
        .scansCount,
      initialScans,
      'history hydration triggered a Setup Detection scan',
    );

    /*
     * A real closed live kline must still trigger detection.
     */
    source.emit(
      'live',
    );

    assert.equal(
      runtime.getStatus()
        .scansCount,
      initialScans + 1,
    );

    assert.equal(
      runtime.getStatus()
        .lastTriggerSource,
      'live',
    );

    runtime.stop();
  },
);


test(
  'does not run Level v2 shadow scans for history hydration events but still scans live events',
  () => {
    const source =
      new TestHistoryRealtimeSource();

    const runtime =
      new LevelV2ShadowRuntimeService(
        source,
      );

    runtime.start();

    const initialScans =
      runtime.getStatus()
        .scansCount;

    /*
     * One initial shadow scan is allowed.
     */
    assert.equal(
      initialScans,
      1,
    );

    /*
     * Warm-up data must not synchronously run the
     * Level v2 analysis pipeline either.
     */
    source.emit(
      'history',
    );

    assert.equal(
      runtime.getStatus()
        .scansCount,
      initialScans,
      'history hydration triggered a Level v2 shadow scan',
    );

    /*
     * Live market completion still drives the shadow runtime.
     */
    source.emit(
      'live',
    );

    assert.equal(
      runtime.getStatus()
        .scansCount,
      initialScans + 1,
    );

    assert.equal(
      runtime.getStatus()
        .lastTriggerSource,
      'live',
    );

    runtime.stop();
  },
);