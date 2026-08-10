import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  ApproachEvaluationResult,
} from '../src/modules/level-engine/approach-engine.types.js';
import {
  evaluateRealtimeConfirmations,
} from '../src/modules/level-engine/realtime-confirmation-engine.js';
import {
  captureRealtimeConfirmationEvidence,
} from '../src/modules/level-engine/realtime-confirmation-evidence.js';
import type {
  RealtimeConfirmationEvidenceCapture,
  RealtimeConfirmationOrderBookCapture,
} from '../src/modules/level-engine/realtime-confirmation-engine.types.js';
import type {
  LevelEngineCandle,
} from '../src/modules/level-engine/level-engine-touch-detector.types.js';
import type {
  RealtimeTrade,
} from '../src/modules/realtime-market-data/realtime-market-data.types.js';

const CURRENT_OPEN =
  '2026-08-10T11:59:00.000Z';
const OBSERVED_AT =
  '2026-08-10T11:59:59.999Z';
const CAPTURED_AT =
  '2026-08-10T12:00:05.000Z';

type Kind =
  'support'
  | 'resistance';

interface ApproachOptions {
  readonly kind: Kind;
  readonly currentPrice: number;
  readonly stage?:
    'APPROACH'
    | null;
}

function approach(
  options:
    ApproachOptions,
): ApproachEvaluationResult {
  const levelPrice = 100;

  return {
    version:
      'approach-engine-v0.1',
    symbol:
      'BTCUSDT',
    timeframe:
      '5m',
    closedCandlesCount: 10,
    ignoredOpenCandlesCount: 1,
    currentPrice:
      options.currentPrice,
    currentCandleIndex: 9,
    currentCandleOpenTime:
      CURRENT_OPEN,
    observedAt:
      OBSERVED_AT,
    evaluations: [
      {
        lineId:
          `${options.kind}-100`,
        symbol:
          'BTCUSDT',
        timeframe:
          '5m',
        kind:
          options.kind,
        levelPrice,
        currentPrice:
          options.currentPrice,
        currentCandleIndex: 9,
        currentCandleOpenTime:
          CURRENT_OPEN,
        observedAt:
          OBSERVED_AT,
        observationProgress: 0.99,
        observationStage:
          'OBSERVATION',
        distanceToLevelPercent:
          Math.abs(
            options.currentPrice
            - levelPrice,
          )
          / levelPrice
          * 100,
        maxDistanceToLevelPercent:
          0.5,
        stage:
          options.stage
          === undefined
            ? 'APPROACH'
            : options.stage,
      },
    ],
    appliedOptions: {
      maxDistanceToLevelPercent:
        0.5,
    },
    observationalOnly: true,
    evaluatesApproach: true,
    createsRealtimeConfirmation:
      false,
    createsSetup: false,
    createsSignal: false,
    usesFutureCandles: false,
  };
}

function candle(
  options: {
    readonly close: number;
    readonly open?: number;
    readonly high?: number;
    readonly low?: number;
  },
): LevelEngineCandle {
  return {
    openTime:
      CURRENT_OPEN,
    closeTime:
      OBSERVED_AT,
    open:
      options.open
      ?? 100,
    high:
      options.high
      ?? 100.1,
    low:
      options.low
      ?? 99.9,
    close:
      options.close,
    isClosed: true,
  };
}

function trade(
  options: {
    readonly id: string;
    readonly side:
      'buy' | 'sell';
    readonly quoteValue: number;
    readonly offsetMs: number;
  },
): RealtimeTrade {
  const price = 100;

  return {
    id:
      options.id,
    symbol:
      'BTCUSDT',
    timestamp:
      new Date(
        Date.parse(
          CAPTURED_AT,
        )
        + options.offsetMs,
      ).toISOString(),
    price,
    quantity:
      options.quoteValue
      / price,
    quoteValue:
      options.quoteValue,
    tradesCount: 1,
    side:
      options.side,
    isBuyerMaker:
      options.side === 'sell',
  };
}

function directionalTrades(
  side:
    'buy' | 'sell',
): readonly RealtimeTrade[] {
  const opposite =
    side === 'buy'
      ? 'sell'
      : 'buy';

  return [
    trade({
      id: '1',
      side,
      quoteValue: 40,
      offsetMs: -4_000,
    }),
    trade({
      id: '2',
      side,
      quoteValue: 40,
      offsetMs: -3_000,
    }),
    trade({
      id: '3',
      side:
        opposite,
      quoteValue: 20,
      offsetMs: -2_000,
    }),
  ];
}

function neutralTrades():
readonly RealtimeTrade[] {
  return [
    trade({
      id: '1',
      side: 'buy',
      quoteValue: 52,
      offsetMs: -4_000,
    }),
    trade({
      id: '2',
      side: 'sell',
      quoteValue: 24,
      offsetMs: -3_000,
    }),
    trade({
      id: '3',
      side: 'sell',
      quoteValue: 24,
      offsetMs: -2_000,
    }),
  ];
}

function orderBook(
  imbalancePct: number,
  overrides:
    Partial<
      RealtimeConfirmationOrderBookCapture
    > = {},
): RealtimeConfirmationOrderBookCapture {
  return {
    state: 'live',
    synchronized: true,
    updatedAt:
      '2026-08-10T12:00:04.900Z',
    ageMs: 100,
    staleAfterMs: 5_000,
    bestBid: 99.99,
    bestAsk: 100.01,
    spreadPct: 0.02,
    bidDepthQuote: 600,
    askDepthQuote: 400,
    totalDepthQuote: 1_000,
    imbalancePct,
    ...overrides,
  };
}

function evidence(
  options: {
    readonly trades?:
      readonly RealtimeTrade[];
    readonly orderBook?:
      RealtimeConfirmationOrderBookCapture
      | null;
    readonly capturedAt?: string;
    readonly sourceErrors?:
      readonly string[];
  } = {},
): RealtimeConfirmationEvidenceCapture {
  return {
    symbol:
      'BTCUSDT',
    capturedAt:
      options.capturedAt
      ?? CAPTURED_AT,
    tape: {
      snapshotUpdatedAt:
        CAPTURED_AT,
      trades:
        options.trades
        ?? directionalTrades(
          'buy',
        ),
    },
    orderBook:
      options.orderBook
      === undefined
        ? orderBook(20)
        : options.orderBook,
    sourceErrors:
      options.sourceErrors
      ?? [],
  };
}

function evaluate(
  options: {
    readonly approach:
      ApproachEvaluationResult;
    readonly candle:
      LevelEngineCandle;
    readonly evidence:
      RealtimeConfirmationEvidenceCapture;
  },
) {
  return evaluateRealtimeConfirmations({
    symbol:
      'btcusdt',
    timeframe:
      '5m',
    approachEvaluation:
      options.approach,
    currentClosedCandle:
      options.candle,
    evidence:
      options.evidence,
  });
}

test(
  'confirms a resistance interaction from below when live tape and book both support upward pressure',
  () => {
    const result =
      evaluate({
        approach:
          approach({
            kind:
              'resistance',
            currentPrice: 99.95,
          }),
        candle:
          candle({
            close: 99.95,
          }),
        evidence:
          evidence(),
      });
    const confirmation =
      result.evaluations[0];

    assert.equal(
      result.version,
      'realtime-confirmation-engine-v0.1',
    );
    assert.equal(
      result.evidence.availability,
      'complete',
    );
    assert.equal(
      result.evidence.tape.pressurePct,
      60,
    );
    assert.equal(
      confirmation?.interactionDirection,
      'up',
    );
    assert.equal(
      confirmation?.tapeState,
      'supports',
    );
    assert.equal(
      confirmation?.orderBookState,
      'supports',
    );
    assert.equal(
      confirmation?.status,
      'confirmed',
    );
    assert.equal(
      confirmation?.stage,
      'CONFIRMATION',
    );
    assert.deepEqual(
      confirmation?.reasons,
      [
        'trade_flow_and_order_book_support_interaction',
      ],
    );
    assert.equal(
      result.createsSetup,
      false,
    );
    assert.equal(
      result.createsSignal,
      false,
    );
    assert.equal(
      result.createsScore,
      false,
    );
    assert.equal(
      result.learnsFromOutcome,
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
  },
);

test(
  'confirms a support interaction from above using sell pressure and ask-heavy depth',
  () => {
    const result =
      evaluate({
        approach:
          approach({
            kind:
              'support',
            currentPrice: 100.05,
          }),
        candle:
          candle({
            close: 100.05,
          }),
        evidence:
          evidence({
            trades:
              directionalTrades(
                'sell',
              ),
            orderBook:
              orderBook(-20),
          }),
      });
    const confirmation =
      result.evaluations[0];

    assert.equal(
      result.evidence.tape.pressurePct,
      -60,
    );
    assert.equal(
      confirmation?.interactionDirection,
      'down',
    );
    assert.equal(
      confirmation?.directionalTapePressurePercent,
      60,
    );
    assert.equal(
      confirmation?.directionalOrderBookPressurePercent,
      20,
    );
    assert.equal(
      confirmation?.status,
      'confirmed',
    );
  },
);

test(
  'returns partial when one live source supports the interaction and the other is neutral',
  () => {
    const result =
      evaluate({
        approach:
          approach({
            kind:
              'resistance',
            currentPrice: 99.95,
          }),
        candle:
          candle({
            close: 99.95,
          }),
        evidence:
          evidence({
            trades:
              neutralTrades(),
            orderBook:
              orderBook(20),
          }),
      });
    const confirmation =
      result.evaluations[0];

    assert.equal(
      confirmation?.tapeState,
      'neutral',
    );
    assert.equal(
      confirmation?.orderBookState,
      'supports',
    );
    assert.equal(
      confirmation?.status,
      'partial',
    );
    assert.equal(
      confirmation?.stage,
      null,
    );
  },
);

test(
  'keeps confirmation not ready when live trade flow opposes the interaction',
  () => {
    const result =
      evaluate({
        approach:
          approach({
            kind:
              'resistance',
            currentPrice: 99.95,
          }),
        candle:
          candle({
            close: 99.95,
          }),
        evidence:
          evidence({
            trades:
              directionalTrades(
                'sell',
              ),
            orderBook:
              orderBook(20),
          }),
      });
    const confirmation =
      result.evaluations[0];

    assert.equal(
      confirmation?.tapeState,
      'opposes',
    );
    assert.equal(
      confirmation?.status,
      'not_ready',
    );
    assert.ok(
      confirmation?.reasons.includes(
        'trade_flow_opposes_interaction',
      ),
    );
  },
);

test(
  'collects instead of fabricating confirmation when either required source is not live',
  () => {
    const result =
      evaluate({
        approach:
          approach({
            kind:
              'resistance',
            currentPrice: 99.95,
          }),
        candle:
          candle({
            close: 99.95,
          }),
        evidence:
          evidence({
            orderBook: null,
          }),
      });
    const confirmation =
      result.evaluations[0];

    assert.equal(
      result.evidence.availability,
      'tape_only',
    );
    assert.equal(
      result.evidence.orderBook.state,
      'collecting',
    );
    assert.equal(
      confirmation?.status,
      'collecting',
    );
    assert.equal(
      confirmation?.stage,
      null,
    );
  },
);

test(
  'does not treat an empty or future-dated order book as usable live evidence',
  () => {
    const baseApproach =
      approach({
        kind:
          'resistance',
        currentPrice: 99.95,
      });
    const currentCandle =
      candle({
        close: 99.95,
      });
    const emptyBook =
      evaluate({
        approach:
          baseApproach,
        candle:
          currentCandle,
        evidence:
          evidence({
            orderBook:
              orderBook(0, {
                bidDepthQuote: 0,
                askDepthQuote: 0,
                totalDepthQuote: 0,
                imbalancePct: null,
              }),
          }),
      });
    const futureBook =
      evaluate({
        approach:
          baseApproach,
        candle:
          currentCandle,
        evidence:
          evidence({
            orderBook:
              orderBook(20, {
                updatedAt:
                  '2026-08-10T12:00:05.001Z',
              }),
          }),
      });

    assert.equal(
      emptyBook.evidence
        .availability,
      'tape_only',
    );
    assert.equal(
      emptyBook.evaluations[0]
        ?.status,
      'collecting',
    );
    assert.equal(
      futureBook.evidence
        .orderBook
        .updatedAfterCapture,
      true,
    );
    assert.equal(
      futureBook.evidence
        .orderBook
        .state,
      'stale',
    );
    assert.equal(
      futureBook.evaluations[0]
        ?.status,
      'collecting',
    );
  },
);

test(
  'requires the directional side and a closed-candle level-zone intersection',
  () => {
    const wrongSide =
      evaluate({
        approach:
          approach({
            kind:
              'resistance',
            currentPrice: 100.05,
          }),
        candle:
          candle({
            close: 100.05,
          }),
        evidence:
          evidence(),
      });
    const noIntersection =
      evaluate({
        approach:
          approach({
            kind:
              'resistance',
            currentPrice: 99.5,
          }),
        candle:
          candle({
            close: 99.5,
            open: 99.6,
            high: 99.8,
            low: 99.4,
          }),
        evidence:
          evidence(),
      });

    assert.equal(
      wrongSide.evaluations[0]
        ?.status,
      'not_ready',
    );
    assert.ok(
      wrongSide.evaluations[0]
        ?.reasons.includes(
          'approach_from_wrong_side',
        ),
    );
    assert.equal(
      noIntersection.evaluations[0]
        ?.status,
      'not_ready',
    );
    assert.ok(
      noIntersection.evaluations[0]
        ?.reasons.includes(
          'closed_candle_did_not_intersect_level_zone',
        ),
    );
  },
);

test(
  'does not evaluate confirmation before the line enters APPROACH',
  () => {
    const result =
      evaluate({
        approach:
          approach({
            kind:
              'resistance',
            currentPrice: 99.95,
            stage: null,
          }),
        candle:
          candle({
            close: 99.95,
          }),
        evidence:
          evidence(),
      });

    assert.equal(
      result.evaluations[0]
        ?.status,
      'not_applicable',
    );
    assert.equal(
      result.evaluations[0]
        ?.stage,
      null,
    );
  },
);

test(
  'uses only the causal tape window and ignores future realtime trades',
  () => {
    const causalTrades =
      directionalTrades(
        'buy',
      );
    const result =
      evaluate({
        approach:
          approach({
            kind:
              'resistance',
            currentPrice: 99.95,
          }),
        candle:
          candle({
            close: 99.95,
          }),
        evidence:
          evidence({
            trades: [
              trade({
                id: 'old',
                side: 'sell',
                quoteValue: 1_000,
                offsetMs: -16_000,
              }),
              ...causalTrades,
              trade({
                id: 'future',
                side: 'sell',
                quoteValue: 1_000,
                offsetMs: 1,
              }),
            ],
          }),
      });

    assert.equal(
      result.evidence.tape.tradesCount,
      3,
    );
    assert.equal(
      result.evidence.tape
        .ignoredFutureTradesCount,
      1,
    );
    assert.equal(
      result.evidence.tape
        .ignoredOutsideWindowTradesCount,
      1,
    );
    assert.equal(
      result.evidence.tape.pressurePct,
      60,
    );
    assert.equal(
      result.usesFutureRealtimeEvidence,
      false,
    );
  },
);

test(
  'marks stale tape as unavailable for confirmation even when old buffered trades exist',
  () => {
    const staleTrades = [
      trade({
        id: '1',
        side: 'buy',
        quoteValue: 40,
        offsetMs: -8_000,
      }),
      trade({
        id: '2',
        side: 'buy',
        quoteValue: 40,
        offsetMs: -7_000,
      }),
      trade({
        id: '3',
        side: 'sell',
        quoteValue: 20,
        offsetMs: -6_000,
      }),
    ];
    const result =
      evaluate({
        approach:
          approach({
            kind:
              'resistance',
            currentPrice: 99.95,
          }),
        candle:
          candle({
            close: 99.95,
          }),
        evidence:
          evidence({
            trades:
              staleTrades,
          }),
      });

    assert.equal(
      result.evidence.tape.state,
      'stale',
    );
    assert.equal(
      result.evaluations[0]
        ?.status,
      'collecting',
    );
  },
);

test(
  'rejects evidence captured before the closed-candle observation',
  () => {
    assert.throws(
      () =>
        evaluate({
          approach:
            approach({
              kind:
                'resistance',
              currentPrice: 99.95,
            }),
          candle:
            candle({
              close: 99.95,
            }),
          evidence:
            evidence({
              capturedAt:
                '2026-08-10T11:59:00.000Z',
            }),
        }),
      /realtime evidence cannot precede/u,
    );
  },
);

test(
  'captures and clones the existing realtime tape and depth sources without setup-engine coupling',
  () => {
    const recentTrades = [
      ...directionalTrades(
        'buy',
      ),
    ];
    const captured =
      captureRealtimeConfirmationEvidence(
        'btcusdt',
        {
          tapeReader: {
            getSnapshots:
              () => [
                {
                  symbol:
                    'BTCUSDT',
                  lastTrade:
                    recentTrades.at(-1)
                    ?? null,
                  bookTicker: null,
                  recentTrades,
                  updatedAt:
                    CAPTURED_AT,
                },
              ],
          },
          orderBookReader: {
            getSnapshot:
              () => ({
                symbol:
                  'BTCUSDT',
                state: 'live',
                synchronized: true,
                lastUpdateId: 42,
                bids: [],
                asks: [],
                buckets: null,
                metrics: {
                  bestBid: 99.99,
                  bestAsk: 100.01,
                  spread: 0.02,
                  spreadPct: 0.02,
                  bidDepthQuote: 600,
                  askDepthQuote: 400,
                  totalDepthQuote: 1_000,
                  imbalancePct: 20,
                },
                updatedAt:
                  CAPTURED_AT,
                ageMs: 0,
                staleAfterMs: 5_000,
                lastError: null,
              }),
          },
        },
        () => new Date(
          CAPTURED_AT,
        ),
      );

    recentTrades[0] =
      trade({
        id: 'mutated',
        side: 'sell',
        quoteValue: 999,
        offsetMs: -1,
      });

    assert.equal(
      captured.symbol,
      'BTCUSDT',
    );
    assert.equal(
      captured.capturedAt,
      CAPTURED_AT,
    );
    assert.equal(
      captured.tape?.trades[0]
        ?.id,
      '1',
    );
    assert.equal(
      captured.orderBook
        ?.imbalancePct,
      20,
    );
    assert.deepEqual(
      captured.sourceErrors,
      [],
    );
  },
);

test(
  'isolates realtime source failures and records them as evidence errors',
  () => {
    const captured =
      captureRealtimeConfirmationEvidence(
        'BTCUSDT',
        {
          tapeReader: {
            getSnapshots:
              () => {
                throw new Error(
                  'tape offline',
                );
              },
          },
          orderBookReader: null,
        },
        () => new Date(
          CAPTURED_AT,
        ),
      );

    assert.equal(
      captured.tape,
      null,
    );
    assert.equal(
      captured.orderBook,
      null,
    );
    assert.deepEqual(
      captured.sourceErrors,
      [
        'tape: tape offline',
      ],
    );
  },
);
