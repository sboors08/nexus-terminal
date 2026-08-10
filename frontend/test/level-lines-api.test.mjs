import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLevelLinesUrl,
  fetchLevelLines,
  LEVEL_LINES_PATH,
  parseLevelLinesSnapshot,
} from '../node_modules/.tmp/realtime-test/api/runtime/levelLinesApi.js';

function candle(
  index,
) {
  return {
    openTime:
      `2026-08-07T12:0${index}:00.000Z`,
    closeTime:
      `2026-08-07T12:0${index}:59.999Z`,
    open:
      100 + index,
    high:
      102 + index,
    low:
      99 + index,
    close:
      101 + index,
    volume:
      1_000 + index,
    tradesCount:
      100 + index,
    isClosed:
      true,
  };
}

function candidateLine() {
  return {
    id:
      'BTCUSDT-5m-line-resistance-1',
    symbol:
      'BTCUSDT',
    timeframe:
      '5m',
    price:
      102,
    kind:
      'resistance',
    originCandleIndex:
      0,
    originExtremumAt:
      '2026-08-07T12:00:00.000Z',
    originExtremumPrice:
      102,
    activeFrom:
      '2026-08-07T12:01:59.999Z',
    confirmedAt:
      null,
    touchCount:
      1,
    status:
      'candidate',
    workedAt:
      null,
    supersededAt:
      null,
    supersessionEvidence:
      null,
    brokenAt:
      null,
    breakEvidence:
      null,
  };
}

function realtimeConfirmation(
  evaluations = [],
) {
  return {
    version:
      'realtime-confirmation-engine-v0.1',
    symbol:
      'BTCUSDT',
    timeframe:
      '5m',
    evaluatedAt:
      '2026-08-07T12:02:00.000Z',
    evaluations,
    evidence: {
      symbol:
        'BTCUSDT',
      capturedAt:
        '2026-08-07T12:02:00.000Z',
      availability:
        'unavailable',
      tape: {
        state:
          'collecting',
        snapshotUpdatedAt:
          null,
        lastTradeAt:
          null,
        ageMs:
          null,
        windowMs:
          10_000,
        tradesCount:
          0,
        ignoredFutureTradesCount:
          0,
        ignoredOutsideWindowTradesCount:
          0,
        executionsCount:
          0,
        buyQuoteValue:
          0,
        sellQuoteValue:
          0,
        totalQuoteValue:
          0,
        quoteDelta:
          0,
        pressurePct:
          null,
      },
      orderBook: {
        state:
          'collecting',
        synchronized:
          false,
        updatedAt:
          null,
        updatedAfterCapture:
          false,
        ageMs:
          null,
        staleAfterMs:
          null,
        bestBid:
          null,
        bestAsk:
          null,
        spreadPct:
          null,
        bidDepthQuote:
          null,
        askDepthQuote:
          null,
        totalDepthQuote:
          null,
        imbalancePct:
          null,
      },
      sourceErrors: [],
    },
    appliedOptions: {
      interactionTolerancePercent:
        0.15,
      tapeWindowMs:
        10_000,
      tapeStaleAfterMs:
        5_000,
      minimumTapeTradesCount:
        3,
      directionalPressureThresholdPercent:
        8,
    },
    observationalOnly:
      true,
    evaluatesRealtimeConfirmation:
      true,
    evaluatesBreakout:
      false,
    evaluatesBounce:
      false,
    createsSetup:
      false,
    createsSignal:
      false,
    createsScore:
      false,
    learnsFromOutcome:
      false,
    usesFutureCandles:
      false,
    usesFutureRealtimeEvidence:
      false,
  };
}

function confirmationEvaluation(
  line,
  overrides = {},
) {
  return {
    lineId:
      line.id,
    symbol:
      line.symbol,
    timeframe:
      line.timeframe,
    kind:
      line.kind,
    levelPrice:
      line.price,
    currentPrice:
      102.4,
    currentCandleIndex:
      1,
    currentCandleOpenTime:
      '2026-08-07T12:01:00.000Z',
    observedAt:
      '2026-08-07T12:01:59.999Z',
    approachStage:
      'APPROACH',
    interactionDirection:
      'up',
    approachSideValid:
      true,
    candleIntersectsLevelZone:
      true,
    tapePressurePercent:
      12,
    directionalTapePressurePercent:
      12,
    tapeState:
      'supports',
    orderBookImbalancePercent:
      9,
    directionalOrderBookPressurePercent:
      9,
    orderBookState:
      'supports',
    status:
      'confirmed',
    stage:
      'CONFIRMATION',
    reasons: [
      'trade_flow_and_order_book_support_interaction',
    ],
    ...overrides,
  };
}

function snapshot() {
  const line =
    candidateLine();

  return {
    version:
      'level-lines-v0.1',
    symbol:
      'BTCUSDT',
    timeframe:
      '5m',
    generatedAt:
      '2026-08-07T12:02:00.000Z',
    closedCandlesCount:
      2,
    ignoredOpenCandlesCount:
      0,
    candles: [
      candle(0),
      candle(1),
    ],
    lines: [
      line,
    ],
    activeLevels: [],
    observationTracking: {
      version:
        'observation-tracker-v0.1',
      symbol:
        'BTCUSDT',
      timeframe:
        '5m',
      closedCandlesCount:
        2,
      ignoredOpenCandlesCount:
        0,
      currentPrice:
        102,
      currentCandleIndex:
        1,
      currentCandleOpenTime:
        '2026-08-07T12:01:00.000Z',
      observedAt:
        '2026-08-07T12:01:59.999Z',
      activeProgress: [],
      appliedOptions: {
        observationPathProgressThreshold:
          0.5,
      },
      observationalOnly:
        true,
      computesObservationProgress:
        true,
      createsApproachEvaluation:
        false,
      createsSetup:
        false,
      createsSignal:
        false,
      usesFutureCandles:
        false,
    },
    approachEvaluation: {
      version:
        'approach-engine-v0.1',
      symbol:
        'BTCUSDT',
      timeframe:
        '5m',
      closedCandlesCount:
        2,
      ignoredOpenCandlesCount:
        0,
      currentPrice:
        102,
      currentCandleIndex:
        1,
      currentCandleOpenTime:
        '2026-08-07T12:01:00.000Z',
      observedAt:
        '2026-08-07T12:01:59.999Z',
      evaluations: [],
      appliedOptions: {
        maxDistanceToLevelPercent:
          0.5,
      },
      observationalOnly:
        true,
      evaluatesApproach:
        true,
      createsRealtimeConfirmation:
        false,
      createsSetup:
        false,
      createsSignal:
        false,
      usesFutureCandles:
        false,
    },
    realtimeConfirmation:
      realtimeConfirmation(),
    appliedOptions: {
      atrPeriod:
        14,
      pivotLeftBars:
        2,
      pivotRightBars:
        1,
      originDepartureAtr:
        0.8,
      originDepartureMaxCandles:
        8,
      candidateVisibilityMinDepartureAtr:
        3,
      candidateVisibilityMaxAgeBars:
        48,
      persistentCandidateMinDepartureAtr:
        2.5,
      persistentCandidateLookbackBars:
        48,
      originEpisodeMaxSpanCandles:
        6,
      workedEpisodeMaxSpanCandles:
        24,
      touchTolerancePercent:
        0.15,
      minBarsBetweenTouchEpisodes:
        0,
      decisiveBreakAtr:
        0.35,
      consecutiveBreakCloses:
        2,
    },
    observationalOnly:
      true,
    createsSetup:
      false,
    mergesNearbyExtrema:
      false,
    usesFutureCandles:
      false,
  };
}

test(
  'builds the canonical Level Lines URL',
  () => {
    assert.equal(
      buildLevelLinesUrl({
        baseUrl:
          'http://localhost:4100/',
        symbol:
          ' btcusdt ',
        timeframe:
          '5m',
        limit:
          500,
      }),
      'http://localhost:4100'
      + LEVEL_LINES_PATH
      + '?symbol=BTCUSDT'
      + '&timeframe=5m'
      + '&limit=500',
    );

    assert.throws(
      () =>
        buildLevelLinesUrl({
          symbol:
            'BTCUSDT',
          timeframe:
            '5m',
          limit:
            10,
        }),
      /between 50 and 1000/,
    );
  },
);

test(
  'fetches and validates an origin-based Level Lines snapshot',
  async () => {
    let requestedUrl = '';

    const result =
      await fetchLevelLines({
        symbol:
          'BTCUSDT',
        timeframe:
          '5m',
        limit:
          500,
        fetcher:
          async (
            input,
            init,
          ) => {
            requestedUrl =
              String(input);

            assert.equal(
              init?.method,
              'GET',
            );
            assert.equal(
              new Headers(
                init?.headers,
              ).get('accept'),
              'application/json',
            );

            return new Response(
              JSON.stringify(
                snapshot(),
              ),
              {
                status: 200,
              },
            );
          },
      });

    assert.equal(
      requestedUrl,
      LEVEL_LINES_PATH
      + '?symbol=BTCUSDT'
      + '&timeframe=5m'
      + '&limit=500',
    );
    assert.equal(
      result.lines.length,
      1,
    );
    assert.equal(
      result.lines[0]
        ?.originExtremumAt,
      '2026-08-07T12:00:00.000Z',
    );
    assert.equal(
      result.lines[0]
        ?.price,
      result.lines[0]
        ?.originExtremumPrice,
    );
    assert.equal(
      result.lines[0]
        ?.status,
      'candidate',
    );
    assert.equal(
      result.activeLevels.length,
      0,
    );
    assert.equal(
      result.mergesNearbyExtrema,
      false,
    );
  },
);

test(
  'accepts a confirmed line in Active Levels',
  () => {
    const valid =
      snapshot();
    const confirmed = {
      ...candidateLine(),
      confirmedAt:
        '2026-08-07T12:01:59.999Z',
      touchCount:
        2,
      status:
        'confirmed',
    };

    valid.lines = [
      confirmed,
    ];
    valid.activeLevels = [
      confirmed,
    ];

    const result =
      parseLevelLinesSnapshot(
        valid,
      );

    assert.equal(
      result.activeLevels[0]
        ?.status,
      'confirmed',
    );
  },
);

test(
  'accepts a backend-qualified candidate in Active Levels',
  () => {
    const valid =
      snapshot();

    valid.activeLevels = [
      candidateLine(),
    ];

    const result =
      parseLevelLinesSnapshot(
        valid,
      );

    assert.equal(
      result.activeLevels[0]
        ?.status,
      'candidate',
    );
  },
);

test(
  'accepts a worked line that remains in Active Levels',
  () => {
    const valid =
      snapshot();
    const worked = {
      ...candidateLine(),
      confirmedAt:
        '2026-08-07T12:01:59.999Z',
      touchCount:
        3,
      status:
        'worked',
      workedAt:
        '2026-08-07T12:02:59.999Z',
    };

    valid.lines = [
      worked,
    ];
    valid.activeLevels = [
      worked,
    ];

    const result =
      parseLevelLinesSnapshot(
        valid,
      );

    assert.equal(
      result.activeLevels[0]
        ?.status,
      'worked',
    );
  },
);

test(
  'parses Observation, Approach, and backend Realtime Confirmation without creating downstream decisions',
  () => {
    const valid =
      snapshot();
    const line =
      candidateLine();

    valid.activeLevels = [line];
    valid.observationTracking.activeProgress = [
      {
        lineId:
          line.id,
        symbol:
          line.symbol,
        timeframe:
          line.timeframe,
        kind:
          line.kind,
        levelPrice:
          line.price,
        departureExtremumPrice:
          108,
        departureExtremumObservedAt:
          '2026-08-07T12:00:59.999Z',
        currentPrice:
          102.4,
        currentCandleIndex:
          1,
        currentCandleOpenTime:
          '2026-08-07T12:01:00.000Z',
        observedAt:
          '2026-08-07T12:01:59.999Z',
        progress:
          1.04,
        observationPathProgressThreshold:
          0.5,
        stage:
          'OBSERVATION',
      },
    ];
    valid.approachEvaluation.evaluations = [
      {
        lineId:
          line.id,
        symbol:
          line.symbol,
        timeframe:
          line.timeframe,
        kind:
          line.kind,
        levelPrice:
          line.price,
        currentPrice:
          102.4,
        currentCandleIndex:
          1,
        currentCandleOpenTime:
          '2026-08-07T12:01:00.000Z',
        observedAt:
          '2026-08-07T12:01:59.999Z',
        observationProgress:
          1.04,
        observationStage:
          'OBSERVATION',
        distanceToLevelPercent:
          0.3921568627,
        maxDistanceToLevelPercent:
          0.5,
        stage:
          'APPROACH',
      },
    ];
    valid.realtimeConfirmation =
      realtimeConfirmation([
        confirmationEvaluation(
          line,
        ),
      ]);

    const result =
      parseLevelLinesSnapshot(valid);

    assert.equal(
      result.observationTracking.activeProgress[0]?.stage,
      'OBSERVATION',
    );
    assert.equal(
      result.observationTracking.activeProgress[0]?.progress,
      1.04,
    );
    assert.equal(
      result.approachEvaluation.evaluations[0]?.stage,
      'APPROACH',
    );
    assert.equal(
      result.approachEvaluation.createsSetup,
      false,
    );
    assert.equal(
      result.approachEvaluation.createsRealtimeConfirmation,
      false,
    );
    assert.equal(
      result.realtimeConfirmation.evaluations[0]?.status,
      'confirmed',
    );
    assert.equal(
      result.realtimeConfirmation.evaluations[0]?.stage,
      'CONFIRMATION',
    );
    assert.equal(
      result.realtimeConfirmation.createsSignal,
      false,
    );
    assert.equal(
      result.realtimeConfirmation.createsScore,
      false,
    );
    assert.equal(
      result.realtimeConfirmation.evaluatesBreakout,
      false,
    );
    assert.equal(
      result.realtimeConfirmation.evaluatesBounce,
      false,
    );
  },
);

test(
  'accepts structural supersession and keeps it out of Active Levels',
  () => {
    const valid =
      snapshot();
    const superseded = {
      ...candidateLine(),
      status:
        'superseded',
      supersededAt:
        '2026-08-07T12:02:59.999Z',
      supersessionEvidence: {
        mode:
          'more_extreme_right_candle',
        fromKind:
          'resistance',
        candleIndex:
          1,
        supersededAt:
          '2026-08-07T12:02:59.999Z',
        originPrice:
          102,
        extremePrice:
          103,
      },
    };

    valid.lines = [
      superseded,
    ];

    const result =
      parseLevelLinesSnapshot(
        valid,
      );

    assert.equal(
      result.lines[0]
        ?.status,
      'superseded',
    );
    assert.equal(
      result.activeLevels.length,
      0,
    );

    valid.activeLevels = [
      superseded,
    ];

    assert.throws(
      () =>
        parseLevelLinesSnapshot(
          valid,
        ),
      /active registry/,
    );
  },
);

test(
  'rejects a broken line left in Active Levels',
  () => {
    const invalid =
      snapshot();
    const broken = {
      ...candidateLine(),
      status:
        'broken',
      brokenAt:
        '2026-08-07T12:01:59.999Z',
      breakEvidence: {
        mode:
          'consecutive_closes',
        fromKind:
          'resistance',
        candleIndex:
          1,
        brokenAt:
          '2026-08-07T12:01:59.999Z',
        boundary:
          102,
        close:
          103,
        distanceBeyondBoundary:
          1,
        distanceBeyondBoundaryAtr:
          0.5,
      },
    };

    invalid.lines = [
      broken,
    ];
    invalid.activeLevels = [
      broken,
    ];

    assert.throws(
      () =>
        parseLevelLinesSnapshot(
          invalid,
        ),
      /active registry/,
    );
  },
);

test(
  'accepts worked evidence retained on a later broken line',
  () => {
    const valid =
      snapshot();
    const broken = {
      ...candidateLine(),
      touchCount:
        3,
      status:
        'broken',
      workedAt:
        '2026-08-07T12:01:29.999Z',
      brokenAt:
        '2026-08-07T12:01:59.999Z',
      breakEvidence: {
        mode:
          'consecutive_closes',
        fromKind:
          'resistance',
        candleIndex:
          1,
        brokenAt:
          '2026-08-07T12:01:59.999Z',
        boundary:
          102,
        close:
          103,
        distanceBeyondBoundary:
          1,
        distanceBeyondBoundaryAtr:
          0.5,
      },
    };

    valid.lines = [
      broken,
    ];

    const result =
      parseLevelLinesSnapshot(
        valid,
      );

    assert.equal(
      result.lines[0]
        ?.workedAt,
      broken.workedAt,
    );
  },
);

test(
  'rejects unsafe or frontend-invented Realtime Confirmation contracts',
  () => {
    const unsafe =
      snapshot();

    unsafe.realtimeConfirmation.createsScore =
      true;

    assert.throws(
      () =>
        parseLevelLinesSnapshot(
          unsafe,
        ),
      /Realtime Confirmation Engine contract/u,
    );

    const mismatched =
      snapshot();
    const line =
      candidateLine();

    mismatched.activeLevels = [
      line,
    ];
    mismatched.approachEvaluation.evaluations = [
      {
        lineId:
          line.id,
        symbol:
          line.symbol,
        timeframe:
          line.timeframe,
        kind:
          line.kind,
        levelPrice:
          line.price,
        currentPrice:
          102.4,
        currentCandleIndex:
          1,
        currentCandleOpenTime:
          '2026-08-07T12:01:00.000Z',
        observedAt:
          '2026-08-07T12:01:59.999Z',
        observationProgress:
          1,
        observationStage:
          'OBSERVATION',
        distanceToLevelPercent:
          0.4,
        maxDistanceToLevelPercent:
          0.5,
        stage:
          'APPROACH',
      },
    ];
    mismatched.realtimeConfirmation =
      realtimeConfirmation([
        confirmationEvaluation(
          line,
          {
            levelPrice:
              103,
          },
        ),
      ]);

    assert.throws(
      () =>
        parseLevelLinesSnapshot(
          mismatched,
        ),
      /causal linkage/u,
    );
  },
);
