import assert from 'node:assert/strict';
import {
  readFileSync,
} from 'node:fs';
import test from 'node:test';

import {
  buildLevelV2ShadowBreakClassifications,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-break-classification.js';
import type {
  LevelV2LifecycleState,
} from '../src/modules/setup-engine/level-v2/level-v2-lifecycle.types.js';
import type {
  LevelV2Candle,
  LevelV2TouchEvent,
} from '../src/modules/setup-engine/level-v2/level-v2.types.js';
import type {
  LevelV2DetectedZone,
  LevelV2Kind,
} from '../src/modules/setup-engine/level-v2/level-v2-zones-score.types.js';

const BASE_TIME =
  Date.parse(
    '2026-08-02T00:00:00.000Z',
  );

function closeTime(
  candleIndex: number,
): string {
  return new Date(
    BASE_TIME
    + candleIndex * 60_000
    + 59_999,
  ).toISOString();
}

function openTime(
  candleIndex: number,
): string {
  return new Date(
    BASE_TIME
    + candleIndex * 60_000,
  ).toISOString();
}

function candle(
  candleIndex: number,
  open: number,
  high: number,
  low: number,
  close: number,
): LevelV2Candle {
  return {
    openTime:
      openTime(
        candleIndex,
      ),
    closeTime:
      closeTime(
        candleIndex,
      ),
    open,
    high,
    low,
    close,
    baseVolume:
      null,
    quoteVolume:
      null,
    tradesCount:
      null,
    isClosed:
      true,
  };
}

function touch(
  candleIndex: number,
): LevelV2TouchEvent {
  return {
    id:
      `touch-${candleIndex}`,
    kind:
      'swing_high',
    extremumIds: [
      `extremum-${candleIndex}`,
    ],
    representativeExtremumId:
      `extremum-${candleIndex}`,
    firstCandleIndex:
      candleIndex,
    lastCandleIndex:
      candleIndex,
    occurredAt:
      closeTime(
        candleIndex,
      ),
    extremePrice:
      100,
    qualityScore:
      80,
  };
}

function level():
LevelV2DetectedZone {
  const touches = [
    touch(2),
    touch(5),
    touch(8),
  ];

  return {
    id:
      'BTCUSDT-1m-level-v2-resistance',
    version:
      2,
    symbol:
      'BTCUSDT',
    timeframe:
      '1m',
    kind:
      'resistance',
    sourceKind:
      'swing_high',
    zone: {
      referencePrice:
        100,
      coreLow:
        99.8,
      coreHigh:
        100.2,
      outerLow:
        99.5,
      outerHigh:
        100.5,
      liquidityLow:
        100.5,
      liquidityHigh:
        101,
      widthPct:
        1,
      widthAtr:
        0.5,
    },
    touches,
    touchesCount:
      touches.length,
    firstTouchAt:
      closeTime(2),
    lastTouchAt:
      closeTime(8),
    firstTouchCandleIndex:
      2,
    lastTouchCandleIndex:
      8,
    cleanliness: {
      closesInsideRatio:
        0.1,
      closesAboveRatio:
        0.05,
      closesBelowRatio:
        0.8,
      crossingsCount:
        1,
      timeInsideCandles:
        2,
      rangeEdgePosition:
        0.9,
      isAcceptanceZone:
        false,
    },
    score: {
      total:
        80,
      touches:
        80,
      reactions:
        80,
      cleanliness:
        80,
      spacing:
        80,
      freshness:
        80,
      precision:
        80,
      structureEdge:
        80,
    },
  };
}

function lifecycle(
  overrides:
    Partial<LevelV2LifecycleState> = {},
): LevelV2LifecycleState {
  const levelValue =
    level();

  return {
    id:
      `${levelValue.id}:lifecycle`,
    level:
      levelValue,
    originalKind:
      'resistance',
    currentKind:
      'resistance',
    status:
      'broken',
    qualifiedTouchesCount:
      3,
    lastQualifiedTouchCandleIndex:
      8,
    eligibleForSetups:
      false,
    registeredAt:
      closeTime(8),
    registeredCandleIndex:
      8,
    lineStartCandleIndex:
      2,
    lineEndCandleIndex:
      9,
    lineEndAt:
      closeTime(9),
    testOriginStatus:
      null,
    testingStartedCandleIndex:
      null,
    testingStartedAt:
      null,
    testingTouchCandleIndex:
      null,
    breakClosesCount:
      2,
    breakFirstCandleIndex:
      9,
    breakFirstAt:
      closeTime(9),
    brokenCandleIndex:
      10,
    brokenAt:
      closeTime(10),
    breakConfirmedAt:
      closeTime(10),
    retestStartedCandleIndex:
      null,
    retestStartedAt:
      null,
    flippedCandleIndex:
      null,
    flippedAt:
      null,
    flippedLineStartCandleIndex:
      null,
    expiredCandleIndex:
      null,
    expiredAt:
      null,
    lastProcessedCandleIndex:
      13,
    lastProcessedCloseTime:
      closeTime(13),
    transitionSequence:
      4,
    ...overrides,
  };
}

function history():
LevelV2Candle[] {
  const candles =
    Array.from(
      {
        length:
          14,
      },
      (
        _,
        candleIndex,
      ) =>
        candle(
          candleIndex,
          99.8,
          100.2,
          99.4,
          99.9,
        ),
    );

  candles[9] =
    candle(
      9,
      100.4,
      100.9,
      100.3,
      100.7,
    );

  candles[10] =
    candle(
      10,
      100.7,
      101,
      100.6,
      100.8,
    );

  candles[11] =
    candle(
      11,
      100.7,
      100.8,
      99.8,
      100.2,
    );

  return candles;
}

function findState(
  states:
    ReturnType<
      typeof buildLevelV2ShadowBreakClassifications
    >['states'],
  kind: LevelV2Kind,
) {
  return states.find(
    (state) =>
      state.currentKind
      === kind,
  );
}

test(
  'replays retained candles into a false-breakout classification',
  () => {
    const result =
      buildLevelV2ShadowBreakClassifications(
        [
          lifecycle(),
        ],
        history(),
      );

    assert.equal(
      result.states.length,
      1,
    );

    assert.equal(
      result.states[0]?.status,
      'false_breakout',
    );

    assert.ok(
      result.events.some(
        (event) =>
          event.type
          === 'breakout_confirmed',
      ),
    );

    assert.ok(
      result.events.some(
        (event) =>
          event.type
          === 'false_breakout',
      ),
    );
  },
);

test(
  'segments original and flipped level roles without crossing the flip candle',
  () => {
    const result =
      buildLevelV2ShadowBreakClassifications(
        [
          lifecycle({
            currentKind:
              'support',
            status:
              'flipped',
            flippedCandleIndex:
              11,
            flippedAt:
              closeTime(11),
            flippedLineStartCandleIndex:
              11,
          }),
        ],
        history(),
      );

    assert.equal(
      result.states.length,
      2,
    );

    const resistance =
      findState(
        result.states,
        'resistance',
      );

    const support =
      findState(
        result.states,
        'support',
      );

    assert.ok(
      resistance,
    );

    assert.ok(
      support,
    );

    assert.equal(
      resistance.lastProcessedCandleIndex,
      10,
    );

    assert.equal(
      support.registeredCandleIndex,
      11,
    );

    assert.equal(
      support.lastProcessedCandleIndex,
      13,
    );

    assert.ok(
      result.events.some(
        (event) =>
          event.type
            === 'registered'
          && event.candleIndex
            === 11
          && event.classifierId
            .endsWith(
              ':support',
            ),
      ),
    );
  },
);

test(
  'keeps one isolated classifier per retained lifecycle level',
  () => {
    const first =
      lifecycle();

    const second =
      lifecycle({
        id:
          'ETHUSDT-level:lifecycle',
        level: {
          ...level(),
          id:
            'ETHUSDT-1m-level-v2-resistance',
          symbol:
            'ETHUSDT',
        },
      });

    const result =
      buildLevelV2ShadowBreakClassifications(
        [
          first,
          second,
        ],
        history(),
      );

    assert.equal(
      result.states.length,
      2,
    );

    assert.ok(
      result.states[0]?.id
      !== result.states[1]?.id,
    );
  },
);

test(
  'returns defensive break-classification state and event copies',
  () => {
    const result =
      buildLevelV2ShadowBreakClassifications(
        [
          lifecycle(),
        ],
        history(),
      );

    const state =
      result.states[0];

    const event =
      result.events.find(
        (item) =>
          item.evidence
          !== null,
      );

    assert.ok(
      state,
    );

    assert.ok(
      event?.evidence,
    );

    state.level.zone.outerHigh =
      999;

    event.evidence.boundaryPrice =
      999;

    const fresh =
      buildLevelV2ShadowBreakClassifications(
        [
          lifecycle(),
        ],
        history(),
      );

    assert.equal(
      fresh.states[0]
        ?.level.zone.outerHigh,
      100.5,
    );

    assert.ok(
      fresh.events.find(
        (item) =>
          item.evidence
          !== null,
      )?.evidence?.boundaryPrice
      !== 999,
    );
  },
);


test(
  'wires break classification into the real shadow runtime snapshot',
  () => {
    const source =
      readFileSync(
        new URL(
          '../src/modules/setup-engine/level-v2/level-v2-shadow-runtime.ts',
          import.meta.url,
        ),
        'utf8',
      );

    assert.match(
      source,
      /buildLevelV2ShadowBreakClassifications/u,
    );

    assert.match(
      source,
      /breakClassifications:\s*\r?\n\s*breakClassification\.states/u,
    );

    assert.match(
      source,
      /breakClassificationEvents:\s*\r?\n\s*breakClassification\.events/u,
    );
  },
);
