import {
  DEFAULT_LEVEL_V2_BREAK_CLASSIFICATION_OPTIONS,
  evaluateLevelV2BreakClassification,
  registerLevelV2BreakClassification,
} from './level-v2-break-classification.js';
import type {
  LevelV2BreakClassificationEvent,
  LevelV2BreakClassificationObservation,
  LevelV2BreakClassificationOptions,
  LevelV2BreakClassificationState,
} from './level-v2-break-classification.types.js';
import type {
  LevelV2LifecycleState,
} from './level-v2-lifecycle.types.js';
import type {
  LevelV2Candle,
} from './level-v2.types.js';
import type {
  LevelV2Kind,
} from './level-v2-zones-score.types.js';

export interface LevelV2ShadowBreakClassificationResult {
  states: readonly LevelV2BreakClassificationState[];
  events: readonly LevelV2BreakClassificationEvent[];
}

interface LevelV2ShadowBreakClassificationSegment {
  kind: LevelV2Kind;
  registeredCandleIndex: number;
  registeredAt: string;
  firstObservationCandleIndex: number;
  endObservationCandleIndexExclusive: number;
}

export function cloneLevelV2ShadowBreakClassificationEvent(
  event: LevelV2BreakClassificationEvent,
): LevelV2BreakClassificationEvent {
  return {
    ...event,
    evidence: event.evidence === null
      ? null
      : { ...event.evidence },
  };
}

export function cloneLevelV2ShadowBreakClassificationState(
  state: LevelV2BreakClassificationState,
): LevelV2BreakClassificationState {
  return {
    ...state,
    level: {
      ...state.level,
      zone: { ...state.level.zone },
      touches: state.level.touches.map((touch) => ({
        ...touch,
        extremumIds: [...touch.extremumIds],
      })),
      cleanliness: { ...state.level.cleanliness },
      score: { ...state.level.score },
    },
    events: state.events.map(
      cloneLevelV2ShadowBreakClassificationEvent,
    ),
  };
}

function toObservation(
  lifecycle: LevelV2LifecycleState,
  candle: LevelV2Candle,
  candleIndex: number,
): LevelV2BreakClassificationObservation {
  return {
    symbol: lifecycle.level.symbol,
    timeframe: lifecycle.level.timeframe,
    candleIndex,
    openTime: candle.openTime,
    closeTime: candle.closeTime,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    isClosed: candle.isClosed,
  };
}

function buildSegments(
  lifecycle: LevelV2LifecycleState,
  closedCandlesCount: number,
): LevelV2ShadowBreakClassificationSegment[] {
  const flipped = lifecycle.currentKind !== lifecycle.originalKind
    && lifecycle.flippedCandleIndex !== null
    && lifecycle.flippedAt !== null;

  if (!flipped) {
    return [{
      kind: lifecycle.currentKind,
      registeredCandleIndex: lifecycle.level.lastTouchCandleIndex,
      registeredAt: lifecycle.level.lastTouchAt,
      firstObservationCandleIndex: lifecycle.level.lastTouchCandleIndex + 1,
      endObservationCandleIndexExclusive: closedCandlesCount,
    }];
  }

  const flippedCandleIndex = lifecycle.flippedCandleIndex;
  const flippedAt = lifecycle.flippedAt;

  if (flippedCandleIndex === null || flippedAt === null) {
    throw new Error('Level v2 shadow break classification flip metadata is incomplete');
  }

  return [
    {
      kind: lifecycle.originalKind,
      registeredCandleIndex: lifecycle.level.lastTouchCandleIndex,
      registeredAt: lifecycle.level.lastTouchAt,
      firstObservationCandleIndex: lifecycle.level.lastTouchCandleIndex + 1,
      endObservationCandleIndexExclusive: flippedCandleIndex,
    },
    {
      kind: lifecycle.currentKind,
      registeredCandleIndex: flippedCandleIndex,
      registeredAt: flippedAt,
      firstObservationCandleIndex: flippedCandleIndex + 1,
      endObservationCandleIndexExclusive: closedCandlesCount,
    },
  ];
}

function classifySegment(
  lifecycle: LevelV2LifecycleState,
  segment: LevelV2ShadowBreakClassificationSegment,
  closedCandles: readonly LevelV2Candle[],
  options: LevelV2BreakClassificationOptions,
): LevelV2ShadowBreakClassificationResult {
  const registration = registerLevelV2BreakClassification(
    lifecycle.level,
    segment.registeredCandleIndex,
    segment.registeredAt,
    segment.kind,
    options,
  );

  let state = registration.state;
  const events: LevelV2BreakClassificationEvent[] = [
    registration.event,
  ];

  for (
    let candleIndex = segment.firstObservationCandleIndex;
    candleIndex < segment.endObservationCandleIndexExclusive;
    candleIndex += 1
  ) {
    const candle = closedCandles[candleIndex];

    if (!candle) {
      continue;
    }

    const evaluation = evaluateLevelV2BreakClassification(
      state,
      toObservation(
        lifecycle,
        candle,
        candleIndex,
      ),
      options,
    );

    if (!evaluation) {
      continue;
    }

    state = evaluation.state;

    if (evaluation.event) {
      events.push(
        evaluation.event,
      );
    }
  }

  return {
    states: [
      cloneLevelV2ShadowBreakClassificationState(
        state,
      ),
    ],
    events: events.map(
      cloneLevelV2ShadowBreakClassificationEvent,
    ),
  };
}

export function buildLevelV2ShadowBreakClassifications(
  lifecycleStates: readonly LevelV2LifecycleState[],
  closedCandles: readonly LevelV2Candle[],
  options: LevelV2BreakClassificationOptions =
    DEFAULT_LEVEL_V2_BREAK_CLASSIFICATION_OPTIONS,
): LevelV2ShadowBreakClassificationResult {
  const states: LevelV2BreakClassificationState[] = [];
  const events: LevelV2BreakClassificationEvent[] = [];

  for (const lifecycle of lifecycleStates) {
    for (const segment of buildSegments(
      lifecycle,
      closedCandles.length,
    )) {
      const result = classifySegment(
        lifecycle,
        segment,
        closedCandles,
        options,
      );

      states.push(
        ...result.states,
      );
      events.push(
        ...result.events,
      );
    }
  }

  return {
    states: states.map(
      cloneLevelV2ShadowBreakClassificationState,
    ),
    events: events
      .sort((left, right) =>
        left.candleIndex - right.candleIndex
        || left.classifierId.localeCompare(right.classifierId)
        || left.sequence - right.sequence)
      .map(
        cloneLevelV2ShadowBreakClassificationEvent,
      ),
  };
}
