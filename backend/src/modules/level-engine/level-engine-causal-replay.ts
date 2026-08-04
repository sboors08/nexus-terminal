import {
  isLevelEngineTimeframe,
  normalizeLevelEngineSymbol,
} from './level-engine.contract.js';
import {
  buildLevelLifecycle,
  DEFAULT_LEVEL_LIFECYCLE_OPTIONS,
} from './level-engine-lifecycle.js';
import {
  DEFAULT_MULTI_TIMEFRAME_LEVEL_DETECTION_OPTIONS,
  detectMultiTimeframeLevelCandidates,
} from './level-engine-multi-timeframe-detector.js';
import type {
  LevelAcceptanceReason,
  LevelCandidate,
  LevelEngineKind,
  LevelEngineMaturity,
  LevelRejectionReason,
  TouchEpisode,
} from './level-engine.types.js';
import type {
  LevelEngineCandle,
  TouchEpisodeDetectionOptions,
} from './level-engine-touch-detector.types.js';
import type {
  LevelEngineTimeframeDataset,
  MultiTimeframeLevelDetectionOptions,
} from './level-engine-multi-timeframe-detector.types.js';
import type {
  LevelLifecycleBreakEvidence,
  LevelLifecycleCycle,
  LevelLifecycleOptions,
  LevelLifecycleTransition,
  LevelLifecycleTransitionType,
} from './level-engine-lifecycle.types.js';
import {
  LEVEL_ENGINE_CAUSAL_REPLAY_VERSION,
} from './level-engine-causal-replay.types.js';
import type {
  LevelEngineCausalReplayCandidateTrack,
  LevelEngineCausalReplayCycleTrack,
  LevelEngineCausalReplayDependencies,
  LevelEngineCausalReplayEvent,
  LevelEngineCausalReplayEventType,
  LevelEngineCausalReplayOptions,
  LevelEngineCausalReplayResult,
} from './level-engine-causal-replay.types.js';

interface IndexedClosedCandle {
  readonly originalIndex: number;
  readonly candle: LevelEngineCandle;
}

interface MutableCycleTrack {
  readonly id: string;
  readonly sourceCandidateId: string;
  readonly sequence: number;
  readonly kind: LevelEngineKind;
  readonly transition: LevelLifecycleTransition;
  readonly firstObservedAt: string;
  readonly firstObservedCandleIndex: number;
  firstConfirmedAt: string | null;
  firstConfirmedCandleIndex: number | null;
  readonly marketActiveFrom: string;
  brokenAt: string | null;
  breakObservedAt: string | null;
  breakObservedCandleIndex: number | null;
  breakEvidence: LevelLifecycleBreakEvidence | null;
  maxTouchEpisodeCount: number;
  latestCandidate: LevelCandidate;
}

interface MutableCandidateTrack {
  readonly id: string;
  readonly symbol: string;
  readonly sourceTimeframe: LevelCandidate['sourceTimeframe'];
  readonly kind: LevelEngineKind;
  readonly sourceCandidate: LevelCandidate;
  latestDetectorCandidate: LevelCandidate;
  readonly firstSeenAt: string;
  readonly firstSeenCandleIndex: number;
  firstConfirmedAt: string | null;
  firstConfirmedCandleIndex: number | null;
  lastSeenAt: string;
  lastSeenCandleIndex: number;
  detectorObservationCount: number;
  disappearanceCount: number;
  reappearanceCount: number;
  maxDetectorTouchEpisodeCount: number;
  presentPreviousStep: boolean;
  presentAtEnd: boolean;
  readonly cycles: Map<string, MutableCycleTrack>;
}

function fail(message: string): never {
  throw new Error(`Level Engine Causal Replay: ${message}`);
}

function positiveInteger(
  value: number,
  field: string,
): number {
  if (!Number.isInteger(value) || value <= 0) {
    fail(`${field} must be a positive integer`);
  }
  return value;
}

function positiveFinite(
  value: number,
  field: string,
): number {
  if (!Number.isFinite(value) || value <= 0) {
    fail(`${field} must be a positive finite number`);
  }
  return value;
}

function nonNegativeInteger(
  value: number,
  field: string,
): number {
  if (!Number.isInteger(value) || value < 0) {
    fail(`${field} must be a non-negative integer`);
  }
  return value;
}

function canonicalTimestamp(
  value: string,
  field: string,
): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    fail(`${field} must be a valid timestamp`);
  }
  return new Date(timestamp).toISOString();
}

function notAfter(
  value: string,
  maximum: string,
  field: string,
): void {
  const timestamp = Date.parse(canonicalTimestamp(value, field));
  const maximumTimestamp = Date.parse(maximum);
  if (timestamp > maximumTimestamp) {
    fail(`${field} cannot depend on a future candle`);
  }
}

function freezeTouchOptions(
  value: TouchEpisodeDetectionOptions,
): TouchEpisodeDetectionOptions {
  return Object.freeze({
    atrPeriod: positiveInteger(value.atrPeriod, 'touchEpisodes.atrPeriod'),
    minDepartureAtr: positiveFinite(
      value.minDepartureAtr,
      'touchEpisodes.minDepartureAtr',
    ),
    maxDepartureCandles: positiveInteger(
      value.maxDepartureCandles,
      'touchEpisodes.maxDepartureCandles',
    ),
    minBarsBetweenEpisodes: nonNegativeInteger(
      value.minBarsBetweenEpisodes,
      'touchEpisodes.minBarsBetweenEpisodes',
    ),
    maxEpisodeSpanCandles: positiveInteger(
      value.maxEpisodeSpanCandles,
      'touchEpisodes.maxEpisodeSpanCandles',
    ),
  });
}

function freezeDetectorOptions(
  value: MultiTimeframeLevelDetectionOptions,
): MultiTimeframeLevelDetectionOptions {
  const atrPeriod = positiveInteger(value.atrPeriod, 'detector.atrPeriod');
  const touchEpisodes = freezeTouchOptions(value.touchEpisodes);
  if (touchEpisodes.atrPeriod !== atrPeriod) {
    fail('detector.touchEpisodes.atrPeriod must equal detector.atrPeriod');
  }
  return Object.freeze({
    atrPeriod,
    pivotLeftBars: positiveInteger(
      value.pivotLeftBars,
      'detector.pivotLeftBars',
    ),
    pivotRightBars: positiveInteger(
      value.pivotRightBars,
      'detector.pivotRightBars',
    ),
    zoneHalfWidthAtr: positiveFinite(
      value.zoneHalfWidthAtr,
      'detector.zoneHalfWidthAtr',
    ),
    clusterDistanceAtr: positiveFinite(
      value.clusterDistanceAtr,
      'detector.clusterDistanceAtr',
    ),
    touchEpisodes,
  });
}

function freezeLifecycleOptions(
  value: LevelLifecycleOptions,
): LevelLifecycleOptions {
  return Object.freeze({
    atrPeriod: positiveInteger(value.atrPeriod, 'lifecycle.atrPeriod'),
    decisiveBreakAtr: positiveFinite(
      value.decisiveBreakAtr,
      'lifecycle.decisiveBreakAtr',
    ),
    consecutiveBreakCloses: positiveInteger(
      value.consecutiveBreakCloses,
      'lifecycle.consecutiveBreakCloses',
    ),
    touchEpisodes: freezeTouchOptions(value.touchEpisodes),
  });
}

function validateOptions(
  value: LevelEngineCausalReplayOptions,
): {
  readonly detector: MultiTimeframeLevelDetectionOptions;
  readonly lifecycle: LevelLifecycleOptions;
  readonly startAtClosedCandleCount: number;
} {
  const detector = freezeDetectorOptions(
    value.detector
    ?? DEFAULT_MULTI_TIMEFRAME_LEVEL_DETECTION_OPTIONS,
  );
  const lifecycle = freezeLifecycleOptions(
    value.lifecycle
    ?? DEFAULT_LEVEL_LIFECYCLE_OPTIONS,
  );
  const fallbackStart =
    detector.atrPeriod
    + detector.pivotLeftBars
    + detector.pivotRightBars;
  const startAtClosedCandleCount = positiveInteger(
    value.startAtClosedCandleCount ?? fallbackStart,
    'startAtClosedCandleCount',
  );
  return Object.freeze({
    detector,
    lifecycle,
    startAtClosedCandleCount,
  });
}

function validateCandles(
  values: readonly LevelEngineCandle[],
): {
  readonly closed: readonly IndexedClosedCandle[];
  readonly ignoredOpenCandlesCount: number;
} {
  let previousOpenMs = Number.NEGATIVE_INFINITY;
  let openCandleSeen = false;
  let ignoredOpenCandlesCount = 0;
  const closed: IndexedClosedCandle[] = [];

  values.forEach((value, originalIndex) => {
    const openTime = canonicalTimestamp(
      value.openTime,
      `candles[${originalIndex}].openTime`,
    );
    const closeTime = canonicalTimestamp(
      value.closeTime,
      `candles[${originalIndex}].closeTime`,
    );
    const openMs = Date.parse(openTime);
    const closeMs = Date.parse(closeTime);
    if (openMs <= previousOpenMs) {
      fail('candles must be strictly ordered and unique');
    }
    if (closeMs < openMs) {
      fail(`candles[${originalIndex}].closeTime cannot precede openTime`);
    }

    const open = positiveFinite(value.open, `candles[${originalIndex}].open`);
    const high = positiveFinite(value.high, `candles[${originalIndex}].high`);
    const low = positiveFinite(value.low, `candles[${originalIndex}].low`);
    const close = positiveFinite(value.close, `candles[${originalIndex}].close`);
    if (
      low > high
      || open < low
      || open > high
      || close < low
      || close > high
    ) {
      fail(`candles[${originalIndex}] contains invalid OHLC values`);
    }

    const candle = Object.freeze({
      openTime,
      closeTime,
      open,
      high,
      low,
      close,
      isClosed: value.isClosed,
    });

    if (!value.isClosed) {
      openCandleSeen = true;
      ignoredOpenCandlesCount += 1;
    } else {
      if (openCandleSeen) {
        fail('closed candles cannot appear after an open candle');
      }
      closed.push(Object.freeze({ originalIndex, candle }));
    }
    previousOpenMs = openMs;
  });

  return Object.freeze({
    closed: Object.freeze(closed),
    ignoredOpenCandlesCount,
  });
}

function freezeEpisode(value: TouchEpisode): TouchEpisode {
  return Object.freeze({ ...value });
}

function freezeCandidate(value: LevelCandidate): LevelCandidate {
  const acceptanceReasons: readonly LevelAcceptanceReason[] =
    Object.freeze([...value.acceptanceReasons]);
  const rejectionReasons: readonly LevelRejectionReason[] =
    Object.freeze([...value.rejectionReasons]);
  return Object.freeze({
    ...value,
    zone: Object.freeze({ ...value.zone }),
    touchEpisodes: Object.freeze(
      value.touchEpisodes.map(freezeEpisode),
    ),
    acceptanceReasons,
    rejectionReasons,
  });
}

function freezeTransition(
  value: LevelLifecycleTransition,
): LevelLifecycleTransition {
  return Object.freeze({ ...value });
}

function freezeBreakEvidence(
  value: LevelLifecycleBreakEvidence | null,
): LevelLifecycleBreakEvidence | null {
  return value === null
    ? null
    : Object.freeze({ ...value });
}

function event(
  events: LevelEngineCausalReplayEvent[],
  type: LevelEngineCausalReplayEventType,
  observedAt: string,
  observedCandleIndex: number,
  marketOccurredAt: string | null,
  sourceCandidateId: string,
  cycleId: string | null,
  kind: LevelEngineKind,
  transition: LevelLifecycleTransitionType | null,
  maturity: LevelEngineMaturity | null,
  touchEpisodeCount: number,
): void {
  events.push(Object.freeze({
    eventIndex: events.length + 1,
    type,
    observedAt,
    observedCandleIndex,
    marketOccurredAt,
    sourceCandidateId,
    cycleId,
    kind,
    transition,
    maturity,
    touchEpisodeCount,
  }));
}

function validateCandidate(
  candidate: LevelCandidate,
  symbol: string,
  sourceTimeframe: LevelCandidate['sourceTimeframe'],
  observedAt: string,
  observedCandleIndex: number,
): void {
  if (normalizeLevelEngineSymbol(candidate.symbol) !== symbol) {
    fail(`candidate ${candidate.id} symbol must match replay symbol`);
  }
  if (candidate.sourceTimeframe !== sourceTimeframe) {
    fail(`candidate ${candidate.id} timeframe must match replay timeframe`);
  }
  if (candidate.decision !== 'accepted') {
    fail(`candidate ${candidate.id} must be accepted`);
  }
  if (candidate.touchEpisodes.length === 0) {
    fail(`candidate ${candidate.id} must contain a touch episode`);
  }
  notAfter(candidate.activeFrom, observedAt, `candidate ${candidate.id} activeFrom`);
  notAfter(candidate.detectedAt, observedAt, `candidate ${candidate.id} detectedAt`);
  candidate.touchEpisodes.forEach((episode, index) => {
    if (normalizeLevelEngineSymbol(episode.symbol) !== symbol) {
      fail(`candidate ${candidate.id} episode ${index} symbol must match replay symbol`);
    }
    if (episode.sourceTimeframe !== sourceTimeframe) {
      fail(`candidate ${candidate.id} episode ${index} timeframe must match replay timeframe`);
    }
    if (episode.kind !== candidate.kind) {
      fail(`candidate ${candidate.id} episode ${index} kind must match candidate kind`);
    }
    if (
      episode.startCandleIndex > observedCandleIndex
      || episode.endCandleIndex > observedCandleIndex
      || episode.anchorCandleIndex > observedCandleIndex
    ) {
      fail(`candidate ${candidate.id} episode ${index} cannot use a future candle index`);
    }
    notAfter(episode.startedAt, observedAt, `candidate ${candidate.id} episode ${index} startedAt`);
    notAfter(episode.endedAt, observedAt, `candidate ${candidate.id} episode ${index} endedAt`);
    notAfter(episode.anchorAt, observedAt, `candidate ${candidate.id} episode ${index} anchorAt`);
    notAfter(episode.confirmedAt, observedAt, `candidate ${candidate.id} episode ${index} confirmedAt`);
  });
}

function createMutableCandidateTrack(
  candidateValue: LevelCandidate,
  observedAt: string,
  observedCandleIndex: number,
): MutableCandidateTrack {
  const candidate = freezeCandidate(candidateValue);
  const confirmed = candidate.maturity === 'confirmed';
  return {
    id: candidate.id,
    symbol: candidate.symbol,
    sourceTimeframe: candidate.sourceTimeframe,
    kind: candidate.kind,
    sourceCandidate: candidate,
    latestDetectorCandidate: candidate,
    firstSeenAt: observedAt,
    firstSeenCandleIndex: observedCandleIndex,
    firstConfirmedAt: confirmed ? observedAt : null,
    firstConfirmedCandleIndex: confirmed
      ? observedCandleIndex
      : null,
    lastSeenAt: observedAt,
    lastSeenCandleIndex: observedCandleIndex,
    detectorObservationCount: 1,
    disappearanceCount: 0,
    reappearanceCount: 0,
    maxDetectorTouchEpisodeCount: candidate.touchEpisodes.length,
    presentPreviousStep: true,
    presentAtEnd: true,
    cycles: new Map<string, MutableCycleTrack>(),
  };
}

function createMutableCycleTrack(
  cycle: LevelLifecycleCycle,
  observedAt: string,
  observedCandleIndex: number,
): MutableCycleTrack {
  const candidate = freezeCandidate(cycle.candidate);
  const confirmed = candidate.maturity === 'confirmed';
  const breakEvidence = freezeBreakEvidence(cycle.breakEvidence);
  return {
    id: cycle.id,
    sourceCandidateId: cycle.sourceCandidateId,
    sequence: cycle.sequence,
    kind: cycle.kind,
    transition: freezeTransition(cycle.transition),
    firstObservedAt: observedAt,
    firstObservedCandleIndex: observedCandleIndex,
    firstConfirmedAt: confirmed ? observedAt : null,
    firstConfirmedCandleIndex: confirmed
      ? observedCandleIndex
      : null,
    marketActiveFrom: candidate.activeFrom,
    brokenAt: breakEvidence?.brokenAt ?? null,
    breakObservedAt: breakEvidence === null ? null : observedAt,
    breakObservedCandleIndex: breakEvidence === null
      ? null
      : observedCandleIndex,
    breakEvidence,
    maxTouchEpisodeCount: candidate.touchEpisodes.length,
    latestCandidate: candidate,
  };
}

function freezeCycleTrack(
  value: MutableCycleTrack,
): LevelEngineCausalReplayCycleTrack {
  return Object.freeze({
    id: value.id,
    sourceCandidateId: value.sourceCandidateId,
    sequence: value.sequence,
    kind: value.kind,
    transition: value.transition,
    firstObservedAt: value.firstObservedAt,
    firstObservedCandleIndex: value.firstObservedCandleIndex,
    firstConfirmedAt: value.firstConfirmedAt,
    firstConfirmedCandleIndex: value.firstConfirmedCandleIndex,
    marketActiveFrom: value.marketActiveFrom,
    brokenAt: value.brokenAt,
    breakObservedAt: value.breakObservedAt,
    breakObservedCandleIndex: value.breakObservedCandleIndex,
    breakEvidence: value.breakEvidence,
    maxTouchEpisodeCount: value.maxTouchEpisodeCount,
    latestCandidate: value.latestCandidate,
  });
}

function freezeCandidateTrack(
  value: MutableCandidateTrack,
): LevelEngineCausalReplayCandidateTrack {
  const cycles = [...value.cycles.values()]
    .sort((left, right) => left.sequence - right.sequence)
    .map(freezeCycleTrack);
  return Object.freeze({
    id: value.id,
    symbol: value.symbol,
    sourceTimeframe: value.sourceTimeframe,
    kind: value.kind,
    sourceCandidate: value.sourceCandidate,
    latestDetectorCandidate: value.latestDetectorCandidate,
    firstSeenAt: value.firstSeenAt,
    firstSeenCandleIndex: value.firstSeenCandleIndex,
    firstConfirmedAt: value.firstConfirmedAt,
    firstConfirmedCandleIndex: value.firstConfirmedCandleIndex,
    lastSeenAt: value.lastSeenAt,
    lastSeenCandleIndex: value.lastSeenCandleIndex,
    detectorObservationCount: value.detectorObservationCount,
    disappearanceCount: value.disappearanceCount,
    reappearanceCount: value.reappearanceCount,
    maxDetectorTouchEpisodeCount: value.maxDetectorTouchEpisodeCount,
    presentAtEnd: value.presentAtEnd,
    cycles: Object.freeze(cycles),
  });
}

function observeLifecycle(
  track: MutableCandidateTrack,
  dataset: LevelEngineTimeframeDataset,
  options: LevelLifecycleOptions,
  buildLifecycleLike: NonNullable<
    LevelEngineCausalReplayDependencies['buildLifecycle']
  >,
  observedAt: string,
  observedCandleIndex: number,
  events: LevelEngineCausalReplayEvent[],
): void {
  const lifecycle = buildLifecycleLike(
    track.sourceCandidate,
    dataset,
    options,
  );
  if (lifecycle.sourceCandidateId !== track.id) {
    fail(`lifecycle source candidate must match ${track.id}`);
  }
  if (normalizeLevelEngineSymbol(lifecycle.symbol) !== track.symbol) {
    fail(`lifecycle symbol must match ${track.symbol}`);
  }
  if (lifecycle.sourceTimeframe !== track.sourceTimeframe) {
    fail(`lifecycle timeframe must match ${track.sourceTimeframe}`);
  }

  const seenCycleIds = new Set<string>();
  for (const cycle of [...lifecycle.cycles]
    .sort((left, right) => left.sequence - right.sequence)) {
    if (seenCycleIds.has(cycle.id)) {
      fail(`lifecycle contains duplicate cycle id ${cycle.id}`);
    }
    seenCycleIds.add(cycle.id);
    if (cycle.sourceCandidateId !== track.id) {
      fail(`cycle ${cycle.id} source candidate must match ${track.id}`);
    }
    validateCandidate(
      cycle.candidate,
      track.symbol,
      track.sourceTimeframe,
      observedAt,
      observedCandleIndex,
    );
    notAfter(
      cycle.transition.occurredAt,
      observedAt,
      `cycle ${cycle.id} transition.occurredAt`,
    );
    if (cycle.breakEvidence !== null) {
      notAfter(
        cycle.breakEvidence.brokenAt,
        observedAt,
        `cycle ${cycle.id} breakEvidence.brokenAt`,
      );
      if (cycle.breakEvidence.candleIndex > observedCandleIndex) {
        fail(`cycle ${cycle.id} break evidence cannot use a future candle index`);
      }
    }

    const existing = track.cycles.get(cycle.id);
    if (!existing) {
      const created = createMutableCycleTrack(
        cycle,
        observedAt,
        observedCandleIndex,
      );
      track.cycles.set(cycle.id, created);
      event(
        events,
        'cycle_started',
        observedAt,
        observedCandleIndex,
        cycle.transition.occurredAt,
        track.id,
        cycle.id,
        cycle.kind,
        cycle.transition.type,
        cycle.candidate.maturity,
        cycle.candidate.touchEpisodes.length,
      );
      if (created.firstConfirmedAt !== null) {
        event(
          events,
          'cycle_confirmed',
          observedAt,
          observedCandleIndex,
          cycle.candidate.detectedAt,
          track.id,
          cycle.id,
          cycle.kind,
          cycle.transition.type,
          cycle.candidate.maturity,
          cycle.candidate.touchEpisodes.length,
        );
      }
      if (created.breakEvidence !== null) {
        event(
          events,
          'cycle_broken',
          observedAt,
          observedCandleIndex,
          created.breakEvidence.brokenAt,
          track.id,
          cycle.id,
          cycle.kind,
          cycle.transition.type,
          cycle.candidate.maturity,
          cycle.candidate.touchEpisodes.length,
        );
      }
      continue;
    }

    const candidate = freezeCandidate(cycle.candidate);
    const previousTouchCount = existing.maxTouchEpisodeCount;
    const currentTouchCount = candidate.touchEpisodes.length;
    existing.latestCandidate = candidate;
    if (currentTouchCount > previousTouchCount) {
      existing.maxTouchEpisodeCount = currentTouchCount;
      event(
        events,
        'cycle_touch_added',
        observedAt,
        observedCandleIndex,
        candidate.detectedAt,
        track.id,
        cycle.id,
        cycle.kind,
        cycle.transition.type,
        candidate.maturity,
        currentTouchCount,
      );
    }

    if (
      existing.firstConfirmedAt === null
      && candidate.maturity === 'confirmed'
    ) {
      existing.firstConfirmedAt = observedAt;
      existing.firstConfirmedCandleIndex = observedCandleIndex;
      event(
        events,
        'cycle_confirmed',
        observedAt,
        observedCandleIndex,
        candidate.detectedAt,
        track.id,
        cycle.id,
        cycle.kind,
        cycle.transition.type,
        candidate.maturity,
        currentTouchCount,
      );
    }

    if (
      existing.breakEvidence === null
      && cycle.breakEvidence !== null
    ) {
      existing.breakEvidence = freezeBreakEvidence(cycle.breakEvidence);
      existing.brokenAt = cycle.breakEvidence.brokenAt;
      existing.breakObservedAt = observedAt;
      existing.breakObservedCandleIndex = observedCandleIndex;
      event(
        events,
        'cycle_broken',
        observedAt,
        observedCandleIndex,
        cycle.breakEvidence.brokenAt,
        track.id,
        cycle.id,
        cycle.kind,
        cycle.transition.type,
        candidate.maturity,
        currentTouchCount,
      );
    }
  }
}

export function replayLevelEngineCausally(
  datasetValue: LevelEngineTimeframeDataset,
  optionsValue: LevelEngineCausalReplayOptions = {},
  dependencies: LevelEngineCausalReplayDependencies = {},
): LevelEngineCausalReplayResult {
  const options = validateOptions(optionsValue);
  const symbol = normalizeLevelEngineSymbol(datasetValue.symbol);
  if (!isLevelEngineTimeframe(datasetValue.sourceTimeframe)) {
    fail(`unsupported timeframe: ${datasetValue.sourceTimeframe}`);
  }
  const sourceTimeframe = datasetValue.sourceTimeframe;
  const validated = validateCandles(datasetValue.candles);
  const detectCandidates = dependencies.detectCandidates
    ?? detectMultiTimeframeLevelCandidates;
  const buildLifecycleLike = dependencies.buildLifecycle
    ?? buildLevelLifecycle;
  const tracks = new Map<string, MutableCandidateTrack>();
  const events: LevelEngineCausalReplayEvent[] = [];
  let replayStepCount = 0;

  for (
    let closedCount = options.startAtClosedCandleCount;
    closedCount <= validated.closed.length;
    closedCount += 1
  ) {
    const indexed = validated.closed[closedCount - 1];
    if (!indexed) {
      continue;
    }
    replayStepCount += 1;
    const observedAt = indexed.candle.closeTime;
    const observedCandleIndex = indexed.originalIndex;
    const prefixCandles = Object.freeze(
      validated.closed
        .slice(0, closedCount)
        .map((value) => value.candle),
    );
    const prefixDataset = Object.freeze({
      symbol,
      sourceTimeframe,
      candles: prefixCandles,
    });
    const detection = detectCandidates(
      Object.freeze([prefixDataset]),
      options.detector,
    );
    if (normalizeLevelEngineSymbol(detection.symbol) !== symbol) {
      fail('detector result symbol must match replay symbol');
    }
    if (
      detection.requestedTimeframes.length !== 1
      || detection.requestedTimeframes[0] !== sourceTimeframe
    ) {
      fail('detector result must contain exactly the replay timeframe');
    }

    const currentIds = new Set<string>();
    const candidates = [...detection.candidates]
      .sort((left, right) => left.id.localeCompare(right.id));
    for (const candidateValue of candidates) {
      validateCandidate(
        candidateValue,
        symbol,
        sourceTimeframe,
        observedAt,
        observedCandleIndex,
      );
      if (currentIds.has(candidateValue.id)) {
        fail(`detector contains duplicate candidate id ${candidateValue.id}`);
      }
      currentIds.add(candidateValue.id);
      const candidate = freezeCandidate(candidateValue);
      const existing = tracks.get(candidate.id);

      if (!existing) {
        const created = createMutableCandidateTrack(
          candidate,
          observedAt,
          observedCandleIndex,
        );
        tracks.set(candidate.id, created);
        event(
          events,
          'candidate_first_seen',
          observedAt,
          observedCandleIndex,
          candidate.detectedAt,
          candidate.id,
          null,
          candidate.kind,
          null,
          candidate.maturity,
          candidate.touchEpisodes.length,
        );
        if (created.firstConfirmedAt !== null) {
          event(
            events,
            'candidate_confirmed',
            observedAt,
            observedCandleIndex,
            candidate.detectedAt,
            candidate.id,
            null,
            candidate.kind,
            null,
            candidate.maturity,
            candidate.touchEpisodes.length,
          );
        }
        continue;
      }

      if (!existing.presentPreviousStep) {
        existing.reappearanceCount += 1;
        event(
          events,
          'candidate_reappeared',
          observedAt,
          observedCandleIndex,
          null,
          candidate.id,
          null,
          candidate.kind,
          null,
          candidate.maturity,
          candidate.touchEpisodes.length,
        );
      }
      existing.presentPreviousStep = true;
      existing.presentAtEnd = true;
      existing.detectorObservationCount += 1;
      existing.lastSeenAt = observedAt;
      existing.lastSeenCandleIndex = observedCandleIndex;
      existing.latestDetectorCandidate = candidate;

      const previousTouchCount = existing.maxDetectorTouchEpisodeCount;
      const currentTouchCount = candidate.touchEpisodes.length;
      if (currentTouchCount > previousTouchCount) {
        existing.maxDetectorTouchEpisodeCount = currentTouchCount;
        event(
          events,
          'candidate_touch_added',
          observedAt,
          observedCandleIndex,
          candidate.detectedAt,
          candidate.id,
          null,
          candidate.kind,
          null,
          candidate.maturity,
          currentTouchCount,
        );
      }
      if (
        existing.firstConfirmedAt === null
        && candidate.maturity === 'confirmed'
      ) {
        existing.firstConfirmedAt = observedAt;
        existing.firstConfirmedCandleIndex = observedCandleIndex;
        event(
          events,
          'candidate_confirmed',
          observedAt,
          observedCandleIndex,
          candidate.detectedAt,
          candidate.id,
          null,
          candidate.kind,
          null,
          candidate.maturity,
          currentTouchCount,
        );
      }
    }

    for (const track of tracks.values()) {
      if (track.presentPreviousStep && !currentIds.has(track.id)) {
        track.presentPreviousStep = false;
        track.presentAtEnd = false;
        track.disappearanceCount += 1;
        event(
          events,
          'candidate_disappeared',
          observedAt,
          observedCandleIndex,
          null,
          track.id,
          null,
          track.kind,
          null,
          track.latestDetectorCandidate.maturity,
          track.latestDetectorCandidate.touchEpisodes.length,
        );
      }
    }

    for (const track of tracks.values()) {
      observeLifecycle(
        track,
        prefixDataset,
        options.lifecycle,
        buildLifecycleLike,
        observedAt,
        observedCandleIndex,
        events,
      );
    }
  }

  const candidateTracks = Object.freeze(
    [...tracks.values()]
      .sort((left, right) => {
        const candleDifference =
          left.firstSeenCandleIndex - right.firstSeenCandleIndex;
        return candleDifference !== 0
          ? candleDifference
          : left.id.localeCompare(right.id);
      })
      .map(freezeCandidateTrack),
  );
  const cycles = candidateTracks.flatMap((track) => track.cycles);
  const totals = Object.freeze({
    replayStepCount,
    candidateTrackCount: candidateTracks.length,
    confirmedCandidateTrackCount: candidateTracks.filter(
      (track) => track.firstConfirmedAt !== null,
    ).length,
    cycleTrackCount: cycles.length,
    confirmedCycleTrackCount: cycles.filter(
      (cycle) => cycle.firstConfirmedAt !== null,
    ).length,
    brokenCycleTrackCount: cycles.filter(
      (cycle) => cycle.breakEvidence !== null,
    ).length,
    originCycleTrackCount: cycles.filter(
      (cycle) => cycle.transition.type === 'origin',
    ).length,
    flipCycleTrackCount: cycles.filter(
      (cycle) => cycle.transition.type === 'flip',
    ).length,
    reclaimCycleTrackCount: cycles.filter(
      (cycle) => cycle.transition.type === 'reclaim',
    ).length,
    candidateDisappearanceCount: candidateTracks.reduce(
      (sum, track) => sum + track.disappearanceCount,
      0,
    ),
    candidateReappearanceCount: candidateTracks.reduce(
      (sum, track) => sum + track.reappearanceCount,
      0,
    ),
  });

  return Object.freeze({
    version: LEVEL_ENGINE_CAUSAL_REPLAY_VERSION,
    symbol,
    sourceTimeframe,
    closedCandlesCount: validated.closed.length,
    ignoredOpenCandlesCount: validated.ignoredOpenCandlesCount,
    startAtClosedCandleCount: options.startAtClosedCandleCount,
    candidateTracks,
    events: Object.freeze([...events]),
    totals,
    observationalOnly: true,
    createsSetup: false,
    usesQualityScore: false,
    usesFutureCandles: false,
    mergesAcrossTimeframes: false,
  });
}
