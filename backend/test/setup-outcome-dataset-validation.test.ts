import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  BinanceOneMinuteKlineUpdate,
} from '../src/modules/realtime-market-data/market-wide-one-minute-metrics.js';
import type {
  SetupDirection,
  SetupEngineOutcome,
  SetupEngineStage,
  SetupEngineState,
} from '../src/modules/setup-engine/setup-engine.types.js';
import type {
  SetupLifecycleEvent,
} from '../src/modules/setup-engine/setup-lifecycle-events.types.js';
import {
  buildSetupOutcomeDatasetValidation,
} from '../src/modules/setup-engine/setup-outcome-dataset-validation.js';
import type {
  SetupOutcomeMarketHistorySource,
} from '../src/modules/setup-engine/setup-outcome-dataset-validation.types.js';

const CANDIDATE_ID =
  'setup-test-level-level_breakout-episode-1';

const CREATED_AT =
  '2026-08-23T09:59:00.000Z';

const ANCHOR_AT =
  '2026-08-23T10:00:30.000Z';

const TERMINAL_AT =
  '2026-08-23T10:01:10.000Z';

function candidate(
  stage:
    SetupEngineStage,

  outcome:
    SetupEngineOutcome,

  updatedAt: string,

  currentPrice: number,

  direction:
    SetupDirection = 'long',
): SetupEngineState {
  return {
    id:
      CANDIDATE_ID,

    symbol:
      'BTCUSDT',

    timeframe:
      '1m',

    setupType:
      'level_breakout',

    direction,

    stage,
    outcome,

    level: {
      kind:
        'resistance',

      centerPrice:
        100,

      zoneLow:
        100,

      zoneHigh:
        100,

      touches:
        3,

      confirmedAt:
        '2026-08-23T09:50:00.000Z',
    },

    currentPrice,

    distanceToLevelPct:
      Math.abs(
        currentPrice - 100,
      ),

    createdAt:
      CREATED_AT,

    updatedAt,

    expiresAt:
      '2026-08-23T12:00:00.000Z',
  };
}

function lifecycle():
SetupLifecycleEvent[] {
  return [
    {
      eventId:
        1,

      type:
        'candidate_created',

      occurredAt:
        CREATED_AT,

      candidateId:
        CANDIDATE_ID,

      symbol:
        'BTCUSDT',

      setupType:
        'level_breakout',

      direction:
        'long',

      previousStage:
        null,

      currentStage:
        'LEVEL_CONFIRMED',

      outcome:
        null,

      candidate:
        candidate(
          'LEVEL_CONFIRMED',
          null,
          CREATED_AT,
          99,
        ),
    },

    {
      eventId:
        2,

      type:
        'stage_transition',

      occurredAt:
        ANCHOR_AT,

      candidateId:
        CANDIDATE_ID,

      symbol:
        'BTCUSDT',

      setupType:
        'level_breakout',

      direction:
        'long',

      previousStage:
        'APPROACHING_THIRD_TOUCH',

      currentStage:
        'THIRD_TOUCH_CONFIRMED',

      outcome:
        null,

      candidate:
        candidate(
          'THIRD_TOUCH_CONFIRMED',
          null,
          ANCHOR_AT,
          100,
        ),
    },

    {
      eventId:
        3,

      type:
        'breakout_confirmed',

      occurredAt:
        TERMINAL_AT,

      candidateId:
        CANDIDATE_ID,

      symbol:
        'BTCUSDT',

      setupType:
        'level_breakout',

      direction:
        'long',

      previousStage:
        'THIRD_TOUCH_CONFIRMED',

      currentStage:
        'BREAKOUT_CONFIRMED',

      outcome:
        'breakout',

      candidate:
        candidate(
          'BREAKOUT_CONFIRMED',
          'breakout',
          TERMINAL_AT,
          100.5,
        ),
    },
  ];
}

function oneMinuteCandles(
  direction:
    SetupDirection,
): BinanceOneMinuteKlineUpdate[] {
  const start =
    Date.parse(
      '2026-08-23T10:01:00.000Z',
    );

  return Array.from(
    {
      length:
        59,
    },
    (
      _,
      index,
    ) => {
      const openTime =
        start
        + index * 60_000;

      const isLast =
        index === 58;

      const close =
        direction === 'long'
          ? (
              isLast
                ? 101
                : 100
            )
          : (
              isLast
                ? 99
                : 100
            );

      return {
        symbol:
          'BTCUSDT',

        eventTime:
          new Date(
            openTime + 59_999,
          ).toISOString(),

        openTime:
          new Date(
            openTime,
          ).toISOString(),

        closeTime:
          new Date(
            openTime + 59_999,
          ).toISOString(),

        open:
          100,

        high:
          direction === 'long'
            ? 102
            : 101,

        low:
          direction === 'long'
            ? 99
            : 98,

        close,

        volume:
          10,

        quoteVolume:
          1_000,

        tradesCount:
          20,

        takerBuyQuoteVolume:
          500,

        isClosed:
          true,
      };
    },
  );
}

class FakeHistory
implements SetupOutcomeMarketHistorySource {
  calls =
    0;

  constructor(
    private readonly candles:
      BinanceOneMinuteKlineUpdate[],
  ) {}

  async fetchOneMinuteKlines():
  Promise<
    BinanceOneMinuteKlineUpdate[]
  > {
    this.calls +=
      1;

    return this.candles;
  }
}

test(
  'reports insufficient_sample without inventing events or labels',
  async () => {
    const source =
      new FakeHistory(
        [],
      );

    const report =
      await buildSetupOutcomeDatasetValidation({
        events:
          [],

        historySnapshotFound:
          false,

        droppedEventsCount:
          0,

        marketHistorySource:
          source,

        now:
          new Date(
            '2026-08-23T12:00:00.000Z',
          ),
      });

    assert.equal(
      report.status,
      'insufficient_sample',
    );

    assert.equal(
      report.items.length,
      0,
    );

    assert.equal(
      report
        .diagnostics
        .measuredCandidatesCount,
      0,
    );

    assert.equal(
      source.calls,
      0,
    );

    assert.equal(
      report.profitabilityLabelApplied,
      false,
    );

    assert.equal(
      report.changesTradingRules,
      false,
    );

    assert.equal(
      report.trainingApplied,
      false,
    );
  },
);

test(
  'measures long post-anchor movement from complete closed one-minute candles',
  async () => {
    const source =
      new FakeHistory(
        oneMinuteCandles(
          'long',
        ),
      );

    const report =
      await buildSetupOutcomeDatasetValidation({
        events:
          lifecycle(),

        historySnapshotFound:
          true,

        snapshotSavedAt:
          '2026-08-23T11:30:00.000Z',

        marketHistorySource:
          source,

        now:
          new Date(
            '2026-08-23T11:02:00.000Z',
          ),
      });

    assert.equal(
      report.status,
      'sample_available',
    );

    assert.equal(
      source.calls,
      1,
    );

    assert.equal(
      report.items.length,
      1,
    );

    const item =
      report.items[0];

    assert.ok(
      item,
    );

    assert.equal(
      item.measurementStatus,
      'measured',
    );

    assert.equal(
      item.anchor?.occurredAt,
      ANCHOR_AT,
    );

    assert.equal(
      item
        .anchor
        ?.measurementStartsAt,
      '2026-08-23T10:01:00.000Z',
    );

    assert.equal(
      item.anchor?.anchorGapMs,
      30_000,
    );

    assert.equal(
      item.metrics?.candlesCount,
      59,
    );

    assert.equal(
      item
        .metrics
        ?.maxFavorableExcursionPct,
      2,
    );

    assert.equal(
      item
        .metrics
        ?.maxAdverseExcursionPct,
      1,
    );

    const sixty =
      item
        .metrics
        ?.checkpoints
        .find(
          (checkpoint) =>
            checkpoint.horizonMinutes
              === 60,
        );

    assert.equal(
      sixty?.signedReturnPct,
      1,
    );

    assert.equal(
      report
        .futureMarketDataUsedForDetection,
      false,
    );

    assert.equal(
      report
        .postEventMarketDataUsedForMeasurement,
      true,
    );
  },
);

test(
  'keeps terminal lifecycle without fabricating a result when third-touch anchor is absent',
  async () => {
    const source =
      new FakeHistory(
        oneMinuteCandles(
          'long',
        ),
      );

    const terminal =
      lifecycle()[2];

    assert.ok(
      terminal,
    );

    const report =
      await buildSetupOutcomeDatasetValidation({
        events: [
          terminal,
        ],

        historySnapshotFound:
          true,

        marketHistorySource:
          source,

        now:
          new Date(
            '2026-08-23T12:00:00.000Z',
          ),
      });

    assert.equal(
      report.status,
      'insufficient_sample',
    );

    assert.equal(
      report.items[0]
        ?.measurementStatus,
      'missing_third_touch_anchor',
    );

    assert.equal(
      report.items[0]
        ?.terminal
        .type,
      'breakout_confirmed',
    );

    assert.equal(
      report.items[0]
        ?.metrics,
      null,
    );

    assert.equal(
      source.calls,
      0,
    );
  },
);

test(
  'calculates favorable and adverse excursion in short direction',
  async () => {
    const events =
      lifecycle()
        .map(
          (event) => ({
            ...event,

            direction:
              'short' as const,

            candidate: {
              ...event.candidate,

              direction:
                'short' as const,
            },
          }),
        );

    const source =
      new FakeHistory(
        oneMinuteCandles(
          'short',
        ),
      );

    const report =
      await buildSetupOutcomeDatasetValidation({
        events,

        historySnapshotFound:
          true,

        marketHistorySource:
          source,

        now:
          new Date(
            '2026-08-23T11:02:00.000Z',
          ),
      });

    const metrics =
      report.items[0]
        ?.metrics;

    assert.equal(
      metrics
        ?.maxFavorableExcursionPct,
      2,
    );

    assert.equal(
      metrics
        ?.maxAdverseExcursionPct,
      1,
    );

    const sixty =
      metrics
        ?.checkpoints
        .find(
          (checkpoint) =>
            checkpoint.horizonMinutes
              === 60,
        );

    assert.equal(
      sixty?.signedReturnPct,
      1,
    );
  },
);