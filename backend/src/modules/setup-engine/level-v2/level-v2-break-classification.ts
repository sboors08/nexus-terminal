import type {
  LevelV2DetectedZone,
  LevelV2Kind,
} from './level-v2-zones-score.types.js';
import type {
  LevelV2BreakClassificationEvaluation,
  LevelV2BreakClassificationEvent,
  LevelV2BreakClassificationEventType,
  LevelV2BreakClassificationEvidence,
  LevelV2BreakClassificationObservation,
  LevelV2BreakClassificationOptions,
  LevelV2BreakClassificationReason,
  LevelV2BreakClassificationRegistration,
  LevelV2BreakClassificationState,
  LevelV2BreakClassificationStatus,
} from './level-v2-break-classification.types.js';

export const DEFAULT_LEVEL_V2_BREAK_CLASSIFICATION_OPTIONS:
LevelV2BreakClassificationOptions = {
  acceptanceClosesRequired: 2,
  acceptanceBufferPct: 0.05,
  falseBreakoutMaxCandles: 3,
  maxEventsPerLevel: 64,
};

const SYMBOL_PATTERN = /^[A-Z0-9]{5,30}$/;

function normalizeSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new Error(`Invalid Level v2 break classification symbol: ${value}`);
  }
  return symbol;
}

function readTimestamp(value: string, name: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Level v2 break classification ${name} must be a valid ISO date`);
  }
  return timestamp;
}

function validatePositivePrice(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Level v2 break classification ${name} must be a positive finite number`);
  }
}

function validateOptions(options: LevelV2BreakClassificationOptions): void {
  if (!Number.isInteger(options.acceptanceClosesRequired)
    || options.acceptanceClosesRequired <= 0) {
    throw new Error(
      'Level v2 break classification acceptanceClosesRequired must be a positive integer',
    );
  }
  if (!Number.isFinite(options.acceptanceBufferPct)
    || options.acceptanceBufferPct < 0
    || options.acceptanceBufferPct > 10) {
    throw new Error(
      'Level v2 break classification acceptanceBufferPct must be between zero and ten',
    );
  }
  if (!Number.isInteger(options.falseBreakoutMaxCandles)
    || options.falseBreakoutMaxCandles <= 0) {
    throw new Error(
      'Level v2 break classification falseBreakoutMaxCandles must be a positive integer',
    );
  }
  if (!Number.isInteger(options.maxEventsPerLevel)
    || options.maxEventsPerLevel <= 0) {
    throw new Error(
      'Level v2 break classification maxEventsPerLevel must be a positive integer',
    );
  }
}

function validateLevel(level: LevelV2DetectedZone, currentKind: LevelV2Kind): void {
  if (level.version !== 2) {
    throw new Error('Level v2 break classification requires a version two level');
  }
  if (normalizeSymbol(level.symbol) !== level.symbol) {
    throw new Error('Level v2 break classification level symbol must be normalized');
  }
  if (level.timeframe.trim().length === 0 || level.timeframe !== level.timeframe.trim()) {
    throw new Error('Level v2 break classification timeframe must be non-empty and trimmed');
  }
  if (currentKind !== 'support' && currentKind !== 'resistance') {
    throw new Error('Level v2 break classification currentKind is invalid');
  }
  const prices = [
    level.zone.referencePrice,
    level.zone.outerLow,
    level.zone.outerHigh,
  ];
  prices.forEach((price, index) => {
    validatePositivePrice(price, `level price ${index}`);
  });
  if (level.zone.outerLow > level.zone.referencePrice
    || level.zone.referencePrice > level.zone.outerHigh) {
    throw new Error('Level v2 break classification level geometry is invalid');
  }
}

function validateObservation(
  state: LevelV2BreakClassificationState,
  observation: LevelV2BreakClassificationObservation,
  options: LevelV2BreakClassificationOptions,
): void {
  validateOptions(options);
  if (normalizeSymbol(observation.symbol) !== state.level.symbol) {
    throw new Error(
      'Level v2 break classification observation symbol must match level symbol',
    );
  }
  if (observation.timeframe !== state.level.timeframe) {
    throw new Error(
      'Level v2 break classification observation timeframe must match level timeframe',
    );
  }
  if (!Number.isInteger(observation.candleIndex) || observation.candleIndex < 0) {
    throw new Error(
      'Level v2 break classification candleIndex must be a non-negative integer',
    );
  }
  const openTime = readTimestamp(observation.openTime, 'observation openTime');
  const closeTime = readTimestamp(observation.closeTime, 'observation closeTime');
  if (closeTime < openTime) {
    throw new Error(
      'Level v2 break classification closeTime cannot precede openTime',
    );
  }
  const prices = [observation.open, observation.high, observation.low, observation.close];
  prices.forEach((price, index) => {
    validatePositivePrice(price, `observation price ${index}`);
  });
  if (observation.low > observation.high
    || observation.open < observation.low
    || observation.open > observation.high
    || observation.close < observation.low
    || observation.close > observation.high) {
    throw new Error('Level v2 break classification observation contains invalid OHLC values');
  }
}

function cloneLevel(level: LevelV2DetectedZone): LevelV2DetectedZone {
  return {
    ...level,
    zone: { ...level.zone },
    touches: level.touches.map((touch) => ({
      ...touch,
      extremumIds: [...touch.extremumIds],
    })),
    cleanliness: { ...level.cleanliness },
    score: { ...level.score },
  };
}

function cloneEvent(
  event: LevelV2BreakClassificationEvent,
): LevelV2BreakClassificationEvent {
  return {
    ...event,
    evidence: event.evidence === null
      ? null
      : { ...event.evidence },
  };
}

function cloneState(
  state: LevelV2BreakClassificationState,
): LevelV2BreakClassificationState {
  return {
    ...state,
    level: cloneLevel(state.level),
    events: state.events.map(cloneEvent),
  };
}

function boundaryPrice(level: LevelV2DetectedZone, kind: LevelV2Kind): number {
  return kind === 'resistance'
    ? level.zone.outerHigh
    : level.zone.outerLow;
}

function acceptanceThresholdPrice(
  level: LevelV2DetectedZone,
  kind: LevelV2Kind,
  options: LevelV2BreakClassificationOptions,
): number {
  const buffer = level.zone.referencePrice * options.acceptanceBufferPct / 100;
  return kind === 'resistance'
    ? level.zone.outerHigh + buffer
    : level.zone.outerLow - buffer;
}

function penetrationPrice(
  kind: LevelV2Kind,
  observation: LevelV2BreakClassificationObservation,
): number {
  return kind === 'resistance'
    ? observation.high
    : observation.low;
}

function penetrationDepthPct(
  level: LevelV2DetectedZone,
  kind: LevelV2Kind,
  observation: LevelV2BreakClassificationObservation,
): number {
  const boundary = boundaryPrice(level, kind);
  const price = penetrationPrice(kind, observation);
  const depth = kind === 'resistance'
    ? Math.max(0, price - boundary)
    : Math.max(0, boundary - price);
  return depth / level.zone.referencePrice * 100;
}

function hasPenetrated(
  level: LevelV2DetectedZone,
  kind: LevelV2Kind,
  observation: LevelV2BreakClassificationObservation,
): boolean {
  return kind === 'resistance'
    ? observation.high > level.zone.outerHigh
    : observation.low < level.zone.outerLow;
}

function isAcceptanceClose(
  level: LevelV2DetectedZone,
  kind: LevelV2Kind,
  observation: LevelV2BreakClassificationObservation,
  options: LevelV2BreakClassificationOptions,
): boolean {
  const threshold = acceptanceThresholdPrice(level, kind, options);
  return kind === 'resistance'
    ? observation.close >= threshold
    : observation.close <= threshold;
}

function returnedInsideZone(
  level: LevelV2DetectedZone,
  kind: LevelV2Kind,
  observation: LevelV2BreakClassificationObservation,
): boolean {
  return kind === 'resistance'
    ? observation.close <= level.zone.outerHigh
    : observation.close >= level.zone.outerLow;
}

function buildEvidence(
  state: LevelV2BreakClassificationState,
  observation: LevelV2BreakClassificationObservation,
  options: LevelV2BreakClassificationOptions,
  acceptanceClosesCount: number,
): LevelV2BreakClassificationEvidence {
  const depth = penetrationDepthPct(
    state.level,
    state.currentKind,
    observation,
  );
  return {
    open: observation.open,
    high: observation.high,
    low: observation.low,
    close: observation.close,
    boundaryPrice: boundaryPrice(state.level, state.currentKind),
    acceptanceThresholdPrice: acceptanceThresholdPrice(
      state.level,
      state.currentKind,
      options,
    ),
    penetrationPrice: penetrationPrice(state.currentKind, observation),
    penetrationDepthPct: depth,
    maxPenetrationDepthPct: Math.max(state.maxPenetrationDepthPct, depth),
    penetrated: hasPenetrated(state.level, state.currentKind, observation),
    acceptanceClose: isAcceptanceClose(
      state.level,
      state.currentKind,
      observation,
      options,
    ),
    returnedInsideZone: returnedInsideZone(
      state.level,
      state.currentKind,
      observation,
    ),
    acceptanceClosesCount,
    acceptanceClosesRequired: options.acceptanceClosesRequired,
  };
}

function createEvent(
  state: LevelV2BreakClassificationState,
  type: LevelV2BreakClassificationEventType,
  reason: LevelV2BreakClassificationReason,
  fromStatus: LevelV2BreakClassificationStatus | null,
  toStatus: LevelV2BreakClassificationStatus,
  occurredAt: string,
  candleIndex: number,
  evidence: LevelV2BreakClassificationEvidence | null,
): LevelV2BreakClassificationEvent {
  const sequence = state.transitionSequence + 1;
  return {
    id: `${state.id}:event:${sequence}:${type}:${candleIndex}`,
    classifierId: state.id,
    levelId: state.level.id,
    type,
    reason,
    fromStatus,
    toStatus,
    occurredAt,
    candleIndex,
    sequence,
    evidence,
  };
}

function appendEvent(
  state: LevelV2BreakClassificationState,
  event: LevelV2BreakClassificationEvent,
  options: LevelV2BreakClassificationOptions,
): LevelV2BreakClassificationState {
  return {
    ...state,
    transitionSequence: event.sequence,
    events: [...state.events, event]
      .slice(-options.maxEventsPerLevel)
      .map(cloneEvent),
  };
}

function finalize(
  stateValue: LevelV2BreakClassificationState,
  observation: LevelV2BreakClassificationObservation,
  options: LevelV2BreakClassificationOptions,
  type: LevelV2BreakClassificationEventType,
  reason: LevelV2BreakClassificationReason,
  fromStatus: LevelV2BreakClassificationStatus,
  evidence: LevelV2BreakClassificationEvidence,
): LevelV2BreakClassificationEvaluation {
  const event = createEvent(
    stateValue,
    type,
    reason,
    fromStatus,
    stateValue.status,
    observation.closeTime,
    observation.candleIndex,
    evidence,
  );
  return {
    state: appendEvent(stateValue, event, options),
    event: cloneEvent(event),
  };
}

export function registerLevelV2BreakClassification(
  levelValue: LevelV2DetectedZone,
  registeredCandleIndex: number,
  registeredAt: string,
  currentKind: LevelV2Kind = levelValue.kind,
  options: LevelV2BreakClassificationOptions =
    DEFAULT_LEVEL_V2_BREAK_CLASSIFICATION_OPTIONS,
): LevelV2BreakClassificationRegistration {
  validateOptions(options);
  validateLevel(levelValue, currentKind);
  if (!Number.isInteger(registeredCandleIndex) || registeredCandleIndex < 0) {
    throw new Error(
      'Level v2 break classification registeredCandleIndex must be non-negative',
    );
  }
  readTimestamp(registeredAt, 'registeredAt');
  const state: LevelV2BreakClassificationState = {
    id: `${levelValue.id}:break-classification:${currentKind}`,
    level: cloneLevel(levelValue),
    currentKind,
    status: 'idle',
    registeredAt,
    registeredCandleIndex,
    episodeStartedAt: null,
    episodeStartedCandleIndex: null,
    maxPenetrationDepthPct: 0,
    acceptanceClosesCount: 0,
    firstAcceptanceAt: null,
    firstAcceptanceCandleIndex: null,
    lastAcceptanceAt: null,
    lastAcceptanceCandleIndex: null,
    breakoutConfirmedAt: null,
    breakoutConfirmedCandleIndex: null,
    falseBreakoutAt: null,
    falseBreakoutCandleIndex: null,
    lastProcessedCandleIndex: registeredCandleIndex,
    lastProcessedCloseTime: registeredAt,
    transitionSequence: 0,
    events: [],
  };
  const event = createEvent(
    state,
    'registered',
    'initial_idle',
    null,
    'idle',
    registeredAt,
    registeredCandleIndex,
    null,
  );
  return {
    state: appendEvent(state, event, options),
    event: cloneEvent(event),
  };
}

export function evaluateLevelV2BreakClassification(
  stateValue: LevelV2BreakClassificationState,
  observation: LevelV2BreakClassificationObservation,
  options: LevelV2BreakClassificationOptions =
    DEFAULT_LEVEL_V2_BREAK_CLASSIFICATION_OPTIONS,
): LevelV2BreakClassificationEvaluation | null {
  validateObservation(stateValue, observation, options);
  if (!observation.isClosed
    || observation.candleIndex <= stateValue.lastProcessedCandleIndex
    || Date.parse(observation.closeTime) <= Date.parse(stateValue.lastProcessedCloseTime)) {
    return null;
  }

  const fromStatus = stateValue.status;
  let state: LevelV2BreakClassificationState = {
    ...cloneState(stateValue),
    lastProcessedCandleIndex: observation.candleIndex,
    lastProcessedCloseTime: observation.closeTime,
  };
  const penetrated = hasPenetrated(state.level, state.currentKind, observation);
  const acceptance = isAcceptanceClose(
    state.level,
    state.currentKind,
    observation,
    options,
  );
  const returned = returnedInsideZone(
    state.level,
    state.currentKind,
    observation,
  );
  const depth = penetrationDepthPct(state.level, state.currentKind, observation);
  state.maxPenetrationDepthPct = Math.max(state.maxPenetrationDepthPct, depth);

  if (state.status === 'false_breakout') {
    return { state, event: null };
  }

  if (state.status === 'breakout_confirmed') {
    const confirmedIndex = state.breakoutConfirmedCandleIndex;
    const withinWindow = confirmedIndex !== null
      && observation.candleIndex - confirmedIndex <= options.falseBreakoutMaxCandles;
    if (returned && withinWindow) {
      state = {
        ...state,
        status: 'false_breakout',
        falseBreakoutAt: observation.closeTime,
        falseBreakoutCandleIndex: observation.candleIndex,
      };
      const evidence = buildEvidence(
        state,
        observation,
        options,
        state.acceptanceClosesCount,
      );
      return finalize(
        state,
        observation,
        options,
        'false_breakout',
        'quick_return_inside_zone',
        fromStatus,
        evidence,
      );
    }
    return { state, event: null };
  }

  if (state.status === 'breakout_pending') {
    if (acceptance) {
      const isConsecutive = state.lastAcceptanceCandleIndex !== null
        && observation.candleIndex === state.lastAcceptanceCandleIndex + 1;
      const acceptanceClosesCount = isConsecutive
        ? state.acceptanceClosesCount + 1
        : 1;
      state = {
        ...state,
        status: acceptanceClosesCount >= options.acceptanceClosesRequired
          ? 'breakout_confirmed'
          : 'breakout_pending',
        acceptanceClosesCount,
        firstAcceptanceAt: isConsecutive
          ? state.firstAcceptanceAt
          : observation.closeTime,
        firstAcceptanceCandleIndex: isConsecutive
          ? state.firstAcceptanceCandleIndex
          : observation.candleIndex,
        lastAcceptanceAt: observation.closeTime,
        lastAcceptanceCandleIndex: observation.candleIndex,
        breakoutConfirmedAt: acceptanceClosesCount >= options.acceptanceClosesRequired
          ? observation.closeTime
          : null,
        breakoutConfirmedCandleIndex:
          acceptanceClosesCount >= options.acceptanceClosesRequired
            ? observation.candleIndex
            : null,
      };
      const evidence = buildEvidence(
        state,
        observation,
        options,
        acceptanceClosesCount,
      );
      return finalize(
        state,
        observation,
        options,
        state.status === 'breakout_confirmed'
          ? 'breakout_confirmed'
          : 'breakout_pending',
        state.status === 'breakout_confirmed'
          ? 'acceptance_confirmed'
          : 'acceptance_sequence_broken',
        fromStatus,
        evidence,
      );
    }

    const firstIndex = state.firstAcceptanceCandleIndex;
    const withinWindow = firstIndex !== null
      && observation.candleIndex - firstIndex <= options.falseBreakoutMaxCandles;
    if (returned && withinWindow) {
      state = {
        ...state,
        status: 'false_breakout',
        falseBreakoutAt: observation.closeTime,
        falseBreakoutCandleIndex: observation.candleIndex,
      };
      const evidence = buildEvidence(
        state,
        observation,
        options,
        state.acceptanceClosesCount,
      );
      return finalize(
        state,
        observation,
        options,
        'false_breakout',
        'returned_inside_zone',
        fromStatus,
        evidence,
      );
    }

    state = {
      ...state,
      status: penetrated ? 'pierce' : 'idle',
      acceptanceClosesCount: 0,
      firstAcceptanceAt: null,
      firstAcceptanceCandleIndex: null,
      lastAcceptanceAt: null,
      lastAcceptanceCandleIndex: null,
    };
    const evidence = buildEvidence(state, observation, options, 0);
    return finalize(
      state,
      observation,
      options,
      'breakout_reset',
      'acceptance_sequence_broken',
      fromStatus,
      evidence,
    );
  }

  if (acceptance) {
    const acceptanceClosesCount = 1;
    const confirmed = acceptanceClosesCount >= options.acceptanceClosesRequired;
    state = {
      ...state,
      status: confirmed ? 'breakout_confirmed' : 'breakout_pending',
      episodeStartedAt: state.episodeStartedAt ?? observation.closeTime,
      episodeStartedCandleIndex:
        state.episodeStartedCandleIndex ?? observation.candleIndex,
      acceptanceClosesCount,
      firstAcceptanceAt: observation.closeTime,
      firstAcceptanceCandleIndex: observation.candleIndex,
      lastAcceptanceAt: observation.closeTime,
      lastAcceptanceCandleIndex: observation.candleIndex,
      breakoutConfirmedAt: confirmed ? observation.closeTime : null,
      breakoutConfirmedCandleIndex: confirmed ? observation.candleIndex : null,
    };
    const evidence = buildEvidence(
      state,
      observation,
      options,
      acceptanceClosesCount,
    );
    return finalize(
      state,
      observation,
      options,
      confirmed ? 'breakout_confirmed' : 'breakout_pending',
      confirmed ? 'acceptance_confirmed' : 'acceptance_close',
      fromStatus,
      evidence,
    );
  }

  if (penetrated) {
    state = {
      ...state,
      status: 'pierce',
      episodeStartedAt: state.episodeStartedAt ?? observation.closeTime,
      episodeStartedCandleIndex:
        state.episodeStartedCandleIndex ?? observation.candleIndex,
    };
    const evidence = buildEvidence(state, observation, options, 0);
    return finalize(
      state,
      observation,
      options,
      'pierce_detected',
      'wick_beyond_zone',
      fromStatus,
      evidence,
    );
  }

  return { state, event: null };
}
