import type {
  LevelV2DetectedZone,
  LevelV2Kind,
} from './level-v2-zones-score.types.js';
import type {
  LevelV2LifecycleEvaluation,
  LevelV2LifecycleEvent,
  LevelV2LifecycleEventType,
  LevelV2LifecycleObservation,
  LevelV2LifecycleOptions,
  LevelV2LifecycleReason,
  LevelV2LifecycleRegistration,
  LevelV2LifecycleState,
  LevelV2LifecycleStatus,
} from './level-v2-lifecycle.types.js';

export const DEFAULT_LEVEL_V2_LIFECYCLE_OPTIONS:
LevelV2LifecycleOptions = {
  minActiveTouches: 3,
  minTouchSpacingCandles: 3,
  breakoutClosesRequired: 2,
  breakoutConfirmationPct: 0.05,
  reactionConfirmationPct: 0.05,
  maxTestingCandles: 12,
  maxActiveAgeCandles: 720,
  maxRetestWaitCandles: 240,
};

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

function validatePositiveInteger(
  value: number,
  name: string,
): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Level v2 lifecycle ${name} must be a positive integer`);
  }
}

function validateNonNegativeFinite(
  value: number,
  name: string,
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Level v2 lifecycle ${name} must be a non-negative finite number`);
  }
}

function validateOptions(
  options: LevelV2LifecycleOptions,
): void {
  validatePositiveInteger(options.minActiveTouches, 'minActiveTouches');
  validatePositiveInteger(options.minTouchSpacingCandles, 'minTouchSpacingCandles');
  validatePositiveInteger(options.breakoutClosesRequired, 'breakoutClosesRequired');
  validatePositiveInteger(options.maxTestingCandles, 'maxTestingCandles');
  validatePositiveInteger(options.maxActiveAgeCandles, 'maxActiveAgeCandles');
  validatePositiveInteger(options.maxRetestWaitCandles, 'maxRetestWaitCandles');
  validateNonNegativeFinite(
    options.breakoutConfirmationPct,
    'breakoutConfirmationPct',
  );
  validateNonNegativeFinite(
    options.reactionConfirmationPct,
    'reactionConfirmationPct',
  );
  if (options.minActiveTouches < 3) {
    throw new Error('Level v2 lifecycle minActiveTouches must be at least three');
  }
  if (options.breakoutConfirmationPct > 10) {
    throw new Error('Level v2 lifecycle breakoutConfirmationPct cannot exceed ten');
  }
  if (options.reactionConfirmationPct > 10) {
    throw new Error('Level v2 lifecycle reactionConfirmationPct cannot exceed ten');
  }
}

function readTimestamp(
  value: string,
  name: string,
): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Level v2 lifecycle ${name} must be a valid ISO date`);
  }
  return timestamp;
}

function validatePositivePrice(
  value: number,
  name: string,
): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Level v2 lifecycle ${name} must be a positive finite number`);
  }
}

function normalizeSymbol(
  value: string,
): string {
  const symbol = value.trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new Error(`Invalid Level v2 lifecycle symbol: ${value}`);
  }
  return symbol;
}

function cloneLevel(
  level: LevelV2DetectedZone,
): LevelV2DetectedZone {
  return {
    ...level,
    zone: {
      ...level.zone,
    },
    touches: level.touches.map((touch) => ({
      ...touch,
      extremumIds: [...touch.extremumIds],
    })),
    cleanliness: {
      ...level.cleanliness,
    },
    score: {
      ...level.score,
    },
  };
}

function cloneState(
  state: LevelV2LifecycleState,
): LevelV2LifecycleState {
  return {
    ...state,
    level: cloneLevel(state.level),
  };
}

function cloneEvent(
  event: LevelV2LifecycleEvent,
): LevelV2LifecycleEvent {
  return {
    ...event,
  };
}

function validateLevel(
  level: LevelV2DetectedZone,
): void {
  const symbol = normalizeSymbol(level.symbol);
  if (symbol !== level.symbol) {
    throw new Error('Level v2 lifecycle level symbol must be normalized');
  }
  if (level.timeframe.trim().length === 0 || level.timeframe !== level.timeframe.trim()) {
    throw new Error('Level v2 lifecycle timeframe must be non-empty and trimmed');
  }
  if (level.version !== 2) {
    throw new Error('Level v2 lifecycle requires a version two level');
  }
  if (level.kind !== 'support' && level.kind !== 'resistance') {
    throw new Error('Level v2 lifecycle level kind is invalid');
  }
  if (!Number.isInteger(level.firstTouchCandleIndex)
    || !Number.isInteger(level.lastTouchCandleIndex)
    || level.firstTouchCandleIndex < 0
    || level.lastTouchCandleIndex < level.firstTouchCandleIndex) {
    throw new Error('Level v2 lifecycle touch candle indexes are invalid');
  }
  if (!Number.isInteger(level.touchesCount)
    || level.touchesCount !== level.touches.length
    || level.touchesCount < 2) {
    throw new Error('Level v2 lifecycle touchesCount must match at least two touches');
  }
  readTimestamp(level.firstTouchAt, 'firstTouchAt');
  readTimestamp(level.lastTouchAt, 'lastTouchAt');
  const zonePrices = [
    level.zone.referencePrice,
    level.zone.coreLow,
    level.zone.coreHigh,
    level.zone.outerLow,
    level.zone.outerHigh,
    level.zone.liquidityLow,
    level.zone.liquidityHigh,
  ];
  zonePrices.forEach((price, index) => {
    validatePositivePrice(price, `zone price ${index}`);
  });
  if (level.zone.outerLow > level.zone.coreLow
    || level.zone.coreLow > level.zone.referencePrice
    || level.zone.referencePrice > level.zone.coreHigh
    || level.zone.coreHigh > level.zone.outerHigh) {
    throw new Error('Level v2 lifecycle level geometry is invalid');
  }
  if (level.kind === 'resistance'
    && (level.zone.liquidityLow < level.zone.outerHigh
      || level.zone.liquidityHigh < level.zone.liquidityLow)) {
    throw new Error('Level v2 lifecycle resistance liquidity geometry is invalid');
  }
  if (level.kind === 'support'
    && (level.zone.liquidityHigh > level.zone.outerLow
      || level.zone.liquidityLow > level.zone.liquidityHigh)) {
    throw new Error('Level v2 lifecycle support liquidity geometry is invalid');
  }
}

function validateRegistration(
  level: LevelV2DetectedZone,
  registeredCandleIndex: number,
  registeredAt: string,
  options: LevelV2LifecycleOptions,
): void {
  validateOptions(options);
  validateLevel(level);
  validatePositiveInteger(registeredCandleIndex + 1, 'registeredCandleIndex');
  const registeredAtMs = readTimestamp(registeredAt, 'registeredAt');
  const lastTouchAtMs = readTimestamp(level.lastTouchAt, 'lastTouchAt');
  if (registeredCandleIndex < level.lastTouchCandleIndex) {
    throw new Error('Level v2 lifecycle registration cannot precede the last touch');
  }
  if (registeredAtMs < lastTouchAtMs) {
    throw new Error('Level v2 lifecycle registeredAt cannot precede lastTouchAt');
  }
}

function validateObservation(
  state: LevelV2LifecycleState,
  observation: LevelV2LifecycleObservation,
  options: LevelV2LifecycleOptions,
): void {
  validateOptions(options);
  const symbol = normalizeSymbol(observation.symbol);
  if (symbol !== state.level.symbol) {
    throw new Error('Level v2 lifecycle observation symbol must match level symbol');
  }
  if (observation.timeframe !== state.level.timeframe) {
    throw new Error('Level v2 lifecycle observation timeframe must match level timeframe');
  }
  if (!Number.isInteger(observation.candleIndex) || observation.candleIndex < 0) {
    throw new Error('Level v2 lifecycle candleIndex must be a non-negative integer');
  }
  const openTime = readTimestamp(observation.openTime, 'observation openTime');
  const closeTime = readTimestamp(observation.closeTime, 'observation closeTime');
  if (closeTime < openTime) {
    throw new Error('Level v2 lifecycle closeTime cannot precede openTime');
  }
  const prices = [
    observation.open,
    observation.high,
    observation.low,
    observation.close,
  ];
  prices.forEach((price, index) => {
    validatePositivePrice(price, `observation price ${index}`);
  });
  if (observation.low > observation.high
    || observation.open < observation.low
    || observation.open > observation.high
    || observation.close < observation.low
    || observation.close > observation.high) {
    throw new Error('Level v2 lifecycle observation contains invalid OHLC values');
  }
}

function setupEligibility(
  status: LevelV2LifecycleStatus,
  qualifiedTouchesCount: number,
  minActiveTouches: number,
  testOriginStatus: 'forming' | 'active' | null,
): boolean {
  if (status === 'active') {
    return qualifiedTouchesCount >= minActiveTouches;
  }
  if (status === 'testing') {
    return testOriginStatus === 'active'
      && qualifiedTouchesCount >= minActiveTouches;
  }
  if (status === 'flipped') {
    return true;
  }
  return false;
}

function createEvent(
  state: LevelV2LifecycleState,
  type: LevelV2LifecycleEventType,
  reason: LevelV2LifecycleReason,
  fromStatus: LevelV2LifecycleStatus | null,
  toStatus: LevelV2LifecycleStatus,
  occurredAt: string,
  candleIndex: number,
): LevelV2LifecycleEvent {
  const sequence = state.transitionSequence + 1;
  return {
    id: `${state.level.id}:lifecycle:${sequence}:${type}:${candleIndex}`,
    levelId: state.level.id,
    type,
    reason,
    fromStatus,
    toStatus,
    occurredAt,
    candleIndex,
    sequence,
    eligibleForSetups: state.eligibleForSetups,
  };
}

function percentageBuffer(
  level: LevelV2DetectedZone,
  percentage: number,
): number {
  return level.zone.referencePrice * percentage / 100;
}

function touchesZone(
  level: LevelV2DetectedZone,
  observation: LevelV2LifecycleObservation,
): boolean {
  return observation.high >= level.zone.outerLow
    && observation.low <= level.zone.outerHigh;
}

function isAcceptanceClose(
  level: LevelV2DetectedZone,
  kind: LevelV2Kind,
  observation: LevelV2LifecycleObservation,
  options: LevelV2LifecycleOptions,
): boolean {
  const buffer = percentageBuffer(level, options.breakoutConfirmationPct);
  return kind === 'resistance'
    ? observation.close >= level.zone.outerHigh + buffer
    : observation.close <= level.zone.outerLow - buffer;
}

function isReactionClose(
  level: LevelV2DetectedZone,
  kind: LevelV2Kind,
  observation: LevelV2LifecycleObservation,
  options: LevelV2LifecycleOptions,
): boolean {
  const buffer = percentageBuffer(level, options.reactionConfirmationPct);
  return kind === 'resistance'
    ? observation.close <= level.zone.outerLow - buffer
    : observation.close >= level.zone.outerHigh + buffer;
}

function movedAwayAfterBreak(
  state: LevelV2LifecycleState,
  observation: LevelV2LifecycleObservation,
  options: LevelV2LifecycleOptions,
): boolean {
  const buffer = percentageBuffer(state.level, options.reactionConfirmationPct);
  return state.originalKind === 'resistance'
    ? observation.low > state.level.zone.outerHigh + buffer
    : observation.high < state.level.zone.outerLow - buffer;
}

function retestReactionConfirmed(
  state: LevelV2LifecycleState,
  observation: LevelV2LifecycleObservation,
  options: LevelV2LifecycleOptions,
): boolean {
  const buffer = percentageBuffer(state.level, options.reactionConfirmationPct);
  return state.originalKind === 'resistance'
    ? observation.close >= state.level.zone.outerHigh + buffer
    : observation.close <= state.level.zone.outerLow - buffer;
}

function processedState(
  state: LevelV2LifecycleState,
  observation: LevelV2LifecycleObservation,
): LevelV2LifecycleState {
  return {
    ...cloneState(state),
    lastProcessedCandleIndex: observation.candleIndex,
    lastProcessedCloseTime: observation.closeTime,
  };
}

function finalizeEvent(
  state: LevelV2LifecycleState,
  type: LevelV2LifecycleEventType,
  reason: LevelV2LifecycleReason,
  fromStatus: LevelV2LifecycleStatus | null,
  observation: LevelV2LifecycleObservation,
): LevelV2LifecycleEvaluation {
  const next = {
    ...state,
    transitionSequence: state.transitionSequence + 1,
  };
  const event = createEvent(
    state,
    type,
    reason,
    fromStatus,
    next.status,
    observation.closeTime,
    observation.candleIndex,
  );
  return {
    state: next,
    event: {
      ...event,
      eligibleForSetups: next.eligibleForSetups,
    },
  };
}

function resetBreakProgress(
  state: LevelV2LifecycleState,
): LevelV2LifecycleState {
  return {
    ...state,
    breakClosesCount: 0,
    breakFirstCandleIndex: null,
    breakFirstAt: null,
  };
}

function clearTesting(
  state: LevelV2LifecycleState,
): LevelV2LifecycleState {
  return {
    ...state,
    testOriginStatus: null,
    testingStartedCandleIndex: null,
    testingStartedAt: null,
    testingTouchCandleIndex: null,
  };
}

export function registerLevelV2Lifecycle(
  levelValue: LevelV2DetectedZone,
  registeredCandleIndex: number,
  registeredAt: string,
  options: LevelV2LifecycleOptions = DEFAULT_LEVEL_V2_LIFECYCLE_OPTIONS,
): LevelV2LifecycleRegistration {
  validateRegistration(levelValue, registeredCandleIndex, registeredAt, options);
  const level = cloneLevel(levelValue);
  const status: LevelV2LifecycleStatus = level.touchesCount >= options.minActiveTouches
    ? 'active'
    : 'forming';
  const state: LevelV2LifecycleState = {
    id: `${level.id}:lifecycle`,
    level,
    originalKind: level.kind,
    currentKind: level.kind,
    status,
    qualifiedTouchesCount: level.touchesCount,
    lastQualifiedTouchCandleIndex: level.lastTouchCandleIndex,
    eligibleForSetups: status === 'active',
    registeredAt,
    registeredCandleIndex,
    lineStartCandleIndex: level.firstTouchCandleIndex,
    lineEndCandleIndex: null,
    lineEndAt: null,
    testOriginStatus: null,
    testingStartedCandleIndex: null,
    testingStartedAt: null,
    testingTouchCandleIndex: null,
    breakClosesCount: 0,
    breakFirstCandleIndex: null,
    breakFirstAt: null,
    brokenCandleIndex: null,
    brokenAt: null,
    breakConfirmedAt: null,
    retestStartedCandleIndex: null,
    retestStartedAt: null,
    flippedCandleIndex: null,
    flippedAt: null,
    flippedLineStartCandleIndex: null,
    expiredCandleIndex: null,
    expiredAt: null,
    lastProcessedCandleIndex: registeredCandleIndex,
    lastProcessedCloseTime: registeredAt,
    transitionSequence: 1,
  };
  const event: LevelV2LifecycleEvent = {
    id: `${level.id}:lifecycle:1:registered:${registeredCandleIndex}`,
    levelId: level.id,
    type: 'registered',
    reason: status === 'active' ? 'initial_active' : 'initial_forming',
    fromStatus: null,
    toStatus: status,
    occurredAt: registeredAt,
    candleIndex: registeredCandleIndex,
    sequence: 1,
    eligibleForSetups: state.eligibleForSetups,
  };
  return {
    state: cloneState(state),
    event: cloneEvent(event),
  };
}

export function evaluateLevelV2Lifecycle(
  stateValue: LevelV2LifecycleState,
  observation: LevelV2LifecycleObservation,
  options: LevelV2LifecycleOptions = DEFAULT_LEVEL_V2_LIFECYCLE_OPTIONS,
): LevelV2LifecycleEvaluation | null {
  validateObservation(stateValue, observation, options);
  if (!observation.isClosed
    || observation.candleIndex <= stateValue.lastProcessedCandleIndex) {
    return null;
  }

  const previousStatus = stateValue.status;
  let state = processedState(stateValue, observation);

  if (state.status === 'expired' || state.status === 'flipped') {
    return {
      state,
      event: null,
    };
  }

  if (state.status === 'retest_pending') {
    const brokenIndex = state.brokenCandleIndex ?? state.registeredCandleIndex;
    if (observation.candleIndex - brokenIndex >= options.maxRetestWaitCandles) {
      state = {
        ...state,
        status: 'expired',
        eligibleForSetups: false,
        expiredCandleIndex: observation.candleIndex,
        expiredAt: observation.closeTime,
      };
      return finalizeEvent(
        state,
        'expired',
        'retest_age_exceeded',
        previousStatus,
        observation,
      );
    }

    const touched = touchesZone(state.level, observation);
    if (state.retestStartedCandleIndex !== null
      && retestReactionConfirmed(state, observation, options)) {
      state = {
        ...state,
        status: 'flipped',
        currentKind: state.originalKind === 'resistance' ? 'support' : 'resistance',
        eligibleForSetups: true,
        flippedCandleIndex: observation.candleIndex,
        flippedAt: observation.closeTime,
        flippedLineStartCandleIndex: state.retestStartedCandleIndex,
      };
      return finalizeEvent(
        state,
        'flipped',
        'retest_reaction_confirmed',
        previousStatus,
        observation,
      );
    }

    if (touched) {
      state = {
        ...state,
        retestStartedCandleIndex: observation.candleIndex,
        retestStartedAt: observation.closeTime,
      };
      if (retestReactionConfirmed(state, observation, options)) {
        state = {
          ...state,
          status: 'flipped',
          currentKind: state.originalKind === 'resistance' ? 'support' : 'resistance',
          eligibleForSetups: true,
          flippedCandleIndex: observation.candleIndex,
          flippedAt: observation.closeTime,
          flippedLineStartCandleIndex: observation.candleIndex,
        };
        return finalizeEvent(
          state,
          'flipped',
          'retest_reaction_confirmed',
          previousStatus,
          observation,
        );
      }
      return finalizeEvent(
        state,
        'retest_started',
        'retest_touch',
        previousStatus,
        observation,
      );
    }

    return {
      state,
      event: null,
    };
  }

  if (state.status === 'broken') {
    if (movedAwayAfterBreak(state, observation, options)) {
      state = {
        ...state,
        status: 'retest_pending',
        eligibleForSetups: false,
      };
      return finalizeEvent(
        state,
        'retest_pending',
        'moved_away_after_break',
        previousStatus,
        observation,
      );
    }
    return {
      state,
      event: null,
    };
  }

  if (observation.candleIndex - state.registeredCandleIndex
    >= options.maxActiveAgeCandles) {
    state = {
      ...state,
      status: 'expired',
      eligibleForSetups: false,
      expiredCandleIndex: observation.candleIndex,
      expiredAt: observation.closeTime,
    };
    return finalizeEvent(
      state,
      'expired',
      'active_age_exceeded',
      previousStatus,
      observation,
    );
  }

  if (isAcceptanceClose(state.level, state.currentKind, observation, options)) {
    const isConsecutive = state.breakClosesCount > 0
      && observation.candleIndex === stateValue.lastProcessedCandleIndex + 1;
    const breakClosesCount = isConsecutive
      ? state.breakClosesCount + 1
      : 1;
    const firstIndex = isConsecutive
      ? state.breakFirstCandleIndex
      : observation.candleIndex;
    const firstAt = isConsecutive
      ? state.breakFirstAt
      : observation.closeTime;
    state = {
      ...state,
      breakClosesCount,
      breakFirstCandleIndex: firstIndex,
      breakFirstAt: firstAt,
    };
    if (breakClosesCount >= options.breakoutClosesRequired) {
      const lineEndCandleIndex = firstIndex ?? observation.candleIndex;
      const lineEndAt = firstAt ?? observation.closeTime;
      state = clearTesting({
        ...state,
        status: 'broken',
        eligibleForSetups: false,
        lineEndCandleIndex,
        lineEndAt,
        brokenCandleIndex: lineEndCandleIndex,
        brokenAt: lineEndAt,
        breakConfirmedAt: observation.closeTime,
      });
      return finalizeEvent(
        state,
        'broken',
        'acceptance_confirmed',
        previousStatus,
        observation,
      );
    }
    return finalizeEvent(
      state,
      'break_progress',
      'acceptance_close',
      previousStatus,
      observation,
    );
  }

  state = resetBreakProgress(state);

  if (state.status === 'testing') {
    const testingStarted = state.testingStartedCandleIndex
      ?? observation.candleIndex;
    if (isReactionClose(state.level, state.currentKind, observation, options)) {
      const touchIndex = state.testingTouchCandleIndex ?? testingStarted;
      const independent = touchIndex - state.lastQualifiedTouchCandleIndex
        >= options.minTouchSpacingCandles;
      const qualifiedTouchesCount = independent
        ? state.qualifiedTouchesCount + 1
        : state.qualifiedTouchesCount;
      const nextStatus: LevelV2LifecycleStatus = qualifiedTouchesCount
        >= options.minActiveTouches
        ? 'active'
        : 'forming';
      const origin = state.testOriginStatus;
      state = clearTesting({
        ...state,
        status: nextStatus,
        qualifiedTouchesCount,
        lastQualifiedTouchCandleIndex: independent
          ? touchIndex
          : state.lastQualifiedTouchCandleIndex,
        eligibleForSetups: nextStatus === 'active',
      });
      return finalizeEvent(
        state,
        origin === 'forming' && nextStatus === 'active'
          ? 'activated'
          : 'test_rejected',
        'reaction_confirmed',
        previousStatus,
        observation,
      );
    }
    if (observation.candleIndex - testingStarted >= options.maxTestingCandles) {
      const returnStatus = state.testOriginStatus ?? 'forming';
      state = clearTesting({
        ...state,
        status: returnStatus,
        eligibleForSetups: setupEligibility(
          returnStatus,
          state.qualifiedTouchesCount,
          options.minActiveTouches,
          null,
        ),
      });
      return finalizeEvent(
        state,
        'test_timeout',
        'testing_window_elapsed',
        previousStatus,
        observation,
      );
    }
    return {
      state,
      event: null,
    };
  }

  if (touchesZone(state.level, observation)) {
    const originStatus = state.status === 'active' ? 'active' : 'forming';
    const independent = observation.candleIndex - state.lastQualifiedTouchCandleIndex
      >= options.minTouchSpacingCandles;
    if (isReactionClose(state.level, state.currentKind, observation, options)) {
      const qualifiedTouchesCount = independent
        ? state.qualifiedTouchesCount + 1
        : state.qualifiedTouchesCount;
      const nextStatus: LevelV2LifecycleStatus = qualifiedTouchesCount
        >= options.minActiveTouches
        ? 'active'
        : originStatus;
      state = {
        ...state,
        status: nextStatus,
        qualifiedTouchesCount,
        lastQualifiedTouchCandleIndex: independent
          ? observation.candleIndex
          : state.lastQualifiedTouchCandleIndex,
        eligibleForSetups: nextStatus === 'active',
      };
      return finalizeEvent(
        state,
        originStatus === 'forming' && nextStatus === 'active'
          ? 'activated'
          : 'test_rejected',
        'reaction_confirmed',
        previousStatus,
        observation,
      );
    }
    state = {
      ...state,
      status: 'testing',
      testOriginStatus: originStatus,
      testingStartedCandleIndex: observation.candleIndex,
      testingStartedAt: observation.closeTime,
      testingTouchCandleIndex: observation.candleIndex,
      eligibleForSetups: setupEligibility(
        'testing',
        state.qualifiedTouchesCount,
        options.minActiveTouches,
        originStatus,
      ),
    };
    return finalizeEvent(
      state,
      'test_started',
      'zone_touched',
      previousStatus,
      observation,
    );
  }

  return {
    state,
    event: null,
  };
}

export class LevelV2LifecycleRegistry {
  readonly #options: LevelV2LifecycleOptions;
  readonly #states = new Map<string, LevelV2LifecycleState>();
  readonly #events: LevelV2LifecycleEvent[] = [];

  constructor(
    options: LevelV2LifecycleOptions = DEFAULT_LEVEL_V2_LIFECYCLE_OPTIONS,
  ) {
    validateOptions(options);
    this.#options = {
      ...options,
    };
  }

  register(
    level: LevelV2DetectedZone,
    registeredCandleIndex: number,
    registeredAt: string,
  ): LevelV2LifecycleRegistration {
    if (this.#states.has(level.id)) {
      throw new Error(`Level v2 lifecycle level is already registered: ${level.id}`);
    }
    const registration = registerLevelV2Lifecycle(
      level,
      registeredCandleIndex,
      registeredAt,
      this.#options,
    );
    this.#states.set(level.id, cloneState(registration.state));
    this.#events.push(cloneEvent(registration.event));
    return {
      state: cloneState(registration.state),
      event: cloneEvent(registration.event),
    };
  }

  observe(
    levelId: string,
    observation: LevelV2LifecycleObservation,
  ): LevelV2LifecycleEvent | null {
    const current = this.#states.get(levelId);
    if (!current) {
      throw new Error(`Unknown Level v2 lifecycle level: ${levelId}`);
    }
    const evaluation = evaluateLevelV2Lifecycle(
      current,
      observation,
      this.#options,
    );
    if (!evaluation) {
      return null;
    }
    this.#states.set(levelId, cloneState(evaluation.state));
    if (!evaluation.event) {
      return null;
    }
    this.#events.push(cloneEvent(evaluation.event));
    return cloneEvent(evaluation.event);
  }

  get(
    levelId: string,
  ): LevelV2LifecycleState | null {
    const state = this.#states.get(levelId);
    return state ? cloneState(state) : null;
  }

  list(): LevelV2LifecycleState[] {
    return [...this.#states.values()]
      .map((state) => cloneState(state))
      .sort((left, right) =>
        right.level.score.total - left.level.score.total
        || right.level.lastTouchCandleIndex - left.level.lastTouchCandleIndex);
  }

  events(
    levelId?: string,
  ): LevelV2LifecycleEvent[] {
    return this.#events
      .filter((event) => levelId === undefined || event.levelId === levelId)
      .map((event) => cloneEvent(event));
  }
}
