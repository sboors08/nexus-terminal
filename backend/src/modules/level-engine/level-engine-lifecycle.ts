import {
  createLevelCandidate,
  normalizeLevelEngineSymbol,
} from './level-engine.contract.js';
import {
  DEFAULT_TOUCH_EPISODE_DETECTION_OPTIONS,
  detectTouchEpisodes,
} from './level-engine-touch-detector.js';
import type {
  LevelAcceptanceReason,
  LevelCandidate,
  LevelEngineKind,
  LevelEngineZone,
  TouchEpisode,
} from './level-engine.types.js';
import type {
  LevelEngineCandle,
  TouchEpisodeDetectionOptions,
  TouchEpisodeDetectionResult,
  TouchEpisodeDetectionTarget,
} from './level-engine-touch-detector.types.js';
import type {
  LevelEngineTimeframeDataset,
} from './level-engine-multi-timeframe-detector.types.js';
import type {
  IgnoredLevelLifecycleEpisode,
  IgnoredLevelLifecycleEpisodeReason,
  LevelLifecycleBreakEvidence,
  LevelLifecycleCycle,
  LevelLifecycleEpisodeEvent,
  LevelLifecycleOptions,
  LevelLifecycleResult,
  LevelLifecycleTransition,
  LevelLifecycleTransitionType,
} from './level-engine-lifecycle.types.js';

export const DEFAULT_LEVEL_LIFECYCLE_OPTIONS:
LevelLifecycleOptions = Object.freeze({
  atrPeriod: 14,
  decisiveBreakAtr: 0.35,
  consecutiveBreakCloses: 2,
  touchEpisodes: DEFAULT_TOUCH_EPISODE_DETECTION_OPTIONS,
});

type DetectTouchEpisodesLike = (
  target: TouchEpisodeDetectionTarget,
  candles: readonly LevelEngineCandle[],
  options: TouchEpisodeDetectionOptions,
) => TouchEpisodeDetectionResult;

export interface BuildLevelLifecycleDependencies {
  readonly detectTouchEpisodes?: DetectTouchEpisodesLike;
}

interface IndexedClosedCandle {
  readonly originalIndex: number;
  readonly candle: LevelEngineCandle;
  readonly atr: number | null;
}

interface WorkingCycle {
  readonly sequence: number;
  readonly kind: LevelEngineKind;
  readonly transition: LevelLifecycleTransition;
  readonly episodes: TouchEpisode[];
}

interface BrokenPredecessor {
  readonly cycleId: string;
  readonly kind: LevelEngineKind;
  readonly brokenAtMs: number;
}

function fail(message: string): never {
  throw new Error(`Level Lifecycle: ${message}`);
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

function validateTouchOptions(
  value: TouchEpisodeDetectionOptions,
): TouchEpisodeDetectionOptions {
  if (!Number.isInteger(value.minBarsBetweenEpisodes)
    || value.minBarsBetweenEpisodes < 0) {
    fail('touchEpisodes.minBarsBetweenEpisodes must be a non-negative integer');
  }

  return Object.freeze({
    atrPeriod: positiveInteger(
      value.atrPeriod,
      'touchEpisodes.atrPeriod',
    ),
    minDepartureAtr: positiveFinite(
      value.minDepartureAtr,
      'touchEpisodes.minDepartureAtr',
    ),
    maxDepartureCandles: positiveInteger(
      value.maxDepartureCandles,
      'touchEpisodes.maxDepartureCandles',
    ),
    minBarsBetweenEpisodes: value.minBarsBetweenEpisodes,
    maxEpisodeSpanCandles: positiveInteger(
      value.maxEpisodeSpanCandles,
      'touchEpisodes.maxEpisodeSpanCandles',
    ),
  });
}

function validateOptions(
  value: LevelLifecycleOptions,
): LevelLifecycleOptions {
  return Object.freeze({
    atrPeriod: positiveInteger(value.atrPeriod, 'atrPeriod'),
    decisiveBreakAtr: positiveFinite(
      value.decisiveBreakAtr,
      'decisiveBreakAtr',
    ),
    consecutiveBreakCloses: positiveInteger(
      value.consecutiveBreakCloses,
      'consecutiveBreakCloses',
    ),
    touchEpisodes: validateTouchOptions(value.touchEpisodes),
  });
}

function validateZone(
  value: LevelEngineZone,
): LevelEngineZone {
  const low = positiveFinite(value.low, 'zone.low');
  const reference = positiveFinite(value.reference, 'zone.reference');
  const high = positiveFinite(value.high, 'zone.high');
  if (low > reference || reference > high) {
    fail('zone must satisfy low <= reference <= high');
  }
  return Object.freeze({ low, reference, high });
}

function validateCandles(
  candlesValue: readonly LevelEngineCandle[],
  atrPeriod: number,
): readonly IndexedClosedCandle[] {
  let previousOpenMs = Number.NEGATIVE_INFINITY;
  let openCandleSeen = false;
  const closed: Array<{
    readonly originalIndex: number;
    readonly candle: LevelEngineCandle;
  }> = [];

  candlesValue.forEach((candle, originalIndex) => {
    const openTime = canonicalTimestamp(
      candle.openTime,
      `candles[${originalIndex}].openTime`,
    );
    const closeTime = canonicalTimestamp(
      candle.closeTime,
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

    const open = positiveFinite(candle.open, `candles[${originalIndex}].open`);
    const high = positiveFinite(candle.high, `candles[${originalIndex}].high`);
    const low = positiveFinite(candle.low, `candles[${originalIndex}].low`);
    const close = positiveFinite(candle.close, `candles[${originalIndex}].close`);

    if (
      low > high
      || open < low
      || open > high
      || close < low
      || close > high
    ) {
      fail(`candles[${originalIndex}] contains invalid OHLC values`);
    }

    if (!candle.isClosed) {
      openCandleSeen = true;
    } else if (openCandleSeen) {
      fail('closed candles cannot appear after an open candle');
    }

    const normalized = Object.freeze({
      openTime,
      closeTime,
      open,
      high,
      low,
      close,
      isClosed: candle.isClosed,
    });

    if (normalized.isClosed) {
      closed.push(Object.freeze({
        originalIndex,
        candle: normalized,
      }));
    }

    previousOpenMs = openMs;
  });

  const trueRanges: number[] = [];
  return Object.freeze(closed.map((item, index) => {
    const previousClose = closed[index - 1]?.candle.close;
    const trueRange = previousClose === undefined
      ? item.candle.high - item.candle.low
      : Math.max(
          item.candle.high - item.candle.low,
          Math.abs(item.candle.high - previousClose),
          Math.abs(item.candle.low - previousClose),
        );

    trueRanges.push(trueRange);
    const atr = trueRanges.length < atrPeriod
      ? null
      : trueRanges
          .slice(trueRanges.length - atrPeriod)
          .reduce((sum, value) => sum + value, 0)
          / atrPeriod;

    return Object.freeze({
      originalIndex: item.originalIndex,
      candle: item.candle,
      atr: atr !== null && Number.isFinite(atr) && atr > 0
        ? atr
        : null,
    });
  }));
}

function oppositeKind(
  kind: LevelEngineKind,
): LevelEngineKind {
  return kind === 'support'
    ? 'resistance'
    : 'support';
}

function closesBeyondZone(
  candle: LevelEngineCandle,
  zone: LevelEngineZone,
  kind: LevelEngineKind,
): boolean {
  return kind === 'support'
    ? candle.close < zone.low
    : candle.close > zone.high;
}

function bodyEntirelyBeyondZone(
  candle: LevelEngineCandle,
  zone: LevelEngineZone,
  kind: LevelEngineKind,
): boolean {
  return kind === 'support'
    ? Math.max(candle.open, candle.close) < zone.low
    : Math.min(candle.open, candle.close) > zone.high;
}

function boundaryForKind(
  zone: LevelEngineZone,
  kind: LevelEngineKind,
): number {
  return kind === 'support'
    ? zone.low
    : zone.high;
}

function distanceBeyondBoundary(
  candle: LevelEngineCandle,
  zone: LevelEngineZone,
  kind: LevelEngineKind,
): number {
  return kind === 'support'
    ? zone.low - candle.close
    : candle.close - zone.high;
}

function findConfirmedBreak(
  closedCandles: readonly IndexedClosedCandle[],
  zone: LevelEngineZone,
  kind: LevelEngineKind,
  afterMs: number,
  throughMs: number,
  options: LevelLifecycleOptions,
): LevelLifecycleBreakEvidence | null {
  let consecutiveBeyondCloses = 0;

  for (const indexed of closedCandles) {
    const closedAtMs = Date.parse(indexed.candle.closeTime);
    if (closedAtMs <= afterMs) {
      continue;
    }
    if (closedAtMs > throughMs) {
      break;
    }

    if (!closesBeyondZone(indexed.candle, zone, kind)) {
      consecutiveBeyondCloses = 0;
      continue;
    }

    consecutiveBeyondCloses += 1;
    const distance = distanceBeyondBoundary(
      indexed.candle,
      zone,
      kind,
    );
    const distanceAtr = indexed.atr !== null
      ? distance / indexed.atr
      : null;
    const decisiveBodyBreak = (
      bodyEntirelyBeyondZone(indexed.candle, zone, kind)
      && distanceAtr !== null
      && distanceAtr >= options.decisiveBreakAtr
    );
    const consecutiveBreak = (
      consecutiveBeyondCloses >= options.consecutiveBreakCloses
    );

    if (!decisiveBodyBreak && !consecutiveBreak) {
      continue;
    }

    return Object.freeze({
      mode: decisiveBodyBreak
        ? 'decisive_body_break'
        : 'consecutive_closes',
      fromKind: kind,
      candleIndex: indexed.originalIndex,
      brokenAt: indexed.candle.closeTime,
      boundary: boundaryForKind(zone, kind),
      close: indexed.candle.close,
      distanceBeyondBoundary: distance,
      distanceBeyondBoundaryAtr: distanceAtr,
    });
  }

  return null;
}

function eventKey(event: LevelLifecycleEpisodeEvent): string {
  return `${event.kind}:${event.episode.id}`;
}

function compareEvents(
  left: LevelLifecycleEpisodeEvent,
  right: LevelLifecycleEpisodeEvent,
): number {
  const startedDifference =
    Date.parse(left.episode.startedAt)
    - Date.parse(right.episode.startedAt);
  if (startedDifference !== 0) {
    return startedDifference;
  }

  const confirmedDifference =
    Date.parse(left.episode.confirmedAt)
    - Date.parse(right.episode.confirmedAt);
  if (confirmedDifference !== 0) {
    return confirmedDifference;
  }

  if (left.kind !== right.kind) {
    return left.kind === 'support' ? -1 : 1;
  }

  return left.episode.id.localeCompare(right.episode.id);
}

function freezeIgnored(
  event: LevelLifecycleEpisodeEvent,
  reason: IgnoredLevelLifecycleEpisodeReason,
): IgnoredLevelLifecycleEpisode {
  return Object.freeze({
    episodeId: event.episode.id,
    kind: event.kind,
    startedAt: event.episode.startedAt,
    confirmedAt: event.episode.confirmedAt,
    reason,
  });
}

function stableCycleId(
  sourceCandidateId: string,
  sequence: number,
  kind: LevelEngineKind,
  activeFrom: string,
): string {
  return `${sourceCandidateId}-cycle-${sequence}-${kind}-${Date.parse(activeFrom)}`;
}

function cycleTransition(
  type: LevelLifecycleTransitionType,
  fromCycleId: string | null,
  episode: TouchEpisode,
): LevelLifecycleTransition {
  return Object.freeze({
    type,
    fromCycleId,
    occurredAt: episode.confirmedAt,
    triggerEpisodeId: episode.id,
  });
}

function startWorkingCycle(
  sequence: number,
  event: LevelLifecycleEpisodeEvent,
  type: LevelLifecycleTransitionType,
  fromCycleId: string | null,
): WorkingCycle {
  return {
    sequence,
    kind: event.kind,
    transition: cycleTransition(
      type,
      fromCycleId,
      event.episode,
    ),
    episodes: [event.episode],
  };
}

function acceptanceReasons(
  transition: LevelLifecycleTransitionType,
  episodeCount: number,
): readonly LevelAcceptanceReason[] {
  const reasons: LevelAcceptanceReason[] = [
    'confirmed_departure',
  ];
  if (episodeCount >= 2) {
    reasons.push('independent_touch_episode');
  }
  if (transition === 'flip') {
    reasons.push('role_flip_evidence');
  }
  return Object.freeze(reasons);
}

function finalizeCycle(
  sourceCandidate: LevelCandidate,
  zone: LevelEngineZone,
  working: WorkingCycle,
  breakEvidence: LevelLifecycleBreakEvidence | null,
): LevelLifecycleCycle {
  const firstEpisode = working.episodes[0];
  const latestEpisode = working.episodes.at(-1);
  if (!firstEpisode || !latestEpisode) {
    fail('working cycle must contain at least one episode');
  }

  const id = stableCycleId(
    sourceCandidate.id,
    working.sequence,
    working.kind,
    firstEpisode.confirmedAt,
  );
  const lifecycleCandidate = createLevelCandidate({
    id,
    symbol: sourceCandidate.symbol,
    sourceTimeframe: sourceCandidate.sourceTimeframe,
    kind: working.kind,
    zone,
    activeFrom: firstEpisode.confirmedAt,
    detectedAt: latestEpisode.confirmedAt,
    maturity: working.episodes.length >= 2
      ? 'confirmed'
      : 'candidate',
    status: breakEvidence === null
      ? 'active'
      : 'broken',
    decision: 'accepted',
    touchEpisodes: working.episodes,
    acceptanceReasons: acceptanceReasons(
      working.transition.type,
      working.episodes.length,
    ),
  });

  return Object.freeze({
    id,
    sequence: working.sequence,
    sourceCandidateId: sourceCandidate.id,
    symbol: sourceCandidate.symbol,
    sourceTimeframe: sourceCandidate.sourceTimeframe,
    kind: working.kind,
    zone,
    transition: working.transition,
    candidate: lifecycleCandidate,
    endedAt: breakEvidence?.brokenAt ?? null,
    breakEvidence,
  });
}

function buildEpisodeEvents(
  candidate: LevelCandidate,
  dataset: LevelEngineTimeframeDataset,
  options: LevelLifecycleOptions,
  detectEpisodes: DetectTouchEpisodesLike,
): {
  readonly events: readonly LevelLifecycleEpisodeEvent[];
  readonly ignored: readonly IgnoredLevelLifecycleEpisode[];
} {
  const events: LevelLifecycleEpisodeEvent[] = [];
  const ignored: IgnoredLevelLifecycleEpisode[] = [];
  const seen = new Set<string>();
  const originStartedMs = Date.parse(
    candidate.touchEpisodes[0]?.startedAt
      ?? candidate.activeFrom,
  );

  const add = (
    episode: TouchEpisode,
    kind: LevelEngineKind,
  ): void => {
    const event = Object.freeze({ episode, kind });
    const key = eventKey(event);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    if (Date.parse(episode.startedAt) < originStartedMs) {
      ignored.push(freezeIgnored(event, 'before_origin'));
      return;
    }

    events.push(event);
  };

  candidate.touchEpisodes.forEach((episode) =>
    add(episode, candidate.kind));

  for (const kind of [
    candidate.kind,
    oppositeKind(candidate.kind),
  ] as const) {
    const result = detectEpisodes(
      {
        symbol: candidate.symbol,
        sourceTimeframe: candidate.sourceTimeframe,
        kind,
        zone: candidate.zone,
      },
      dataset.candles,
      options.touchEpisodes,
    );

    result.episodes.forEach((episode) => add(episode, kind));
  }

  events.sort(compareEvents);
  return Object.freeze({
    events: Object.freeze(events),
    ignored: Object.freeze(ignored),
  });
}

function episodesOverlap(
  previous: TouchEpisode,
  next: TouchEpisode,
): boolean {
  return (
    next.startCandleIndex <= previous.endCandleIndex
    || Date.parse(next.startedAt) <= Date.parse(previous.endedAt)
  );
}

export function buildLevelLifecycle(
  candidate: LevelCandidate,
  dataset: LevelEngineTimeframeDataset,
  optionsValue: LevelLifecycleOptions =
    DEFAULT_LEVEL_LIFECYCLE_OPTIONS,
  dependencies: BuildLevelLifecycleDependencies = {},
): LevelLifecycleResult {
  const options = validateOptions(optionsValue);
  const symbol = normalizeLevelEngineSymbol(candidate.symbol);
  const datasetSymbol = normalizeLevelEngineSymbol(dataset.symbol);
  if (symbol !== datasetSymbol) {
    fail('dataset symbol must match candidate symbol');
  }
  if (candidate.sourceTimeframe !== dataset.sourceTimeframe) {
    fail('dataset timeframe must match candidate timeframe');
  }
  if (candidate.decision !== 'accepted') {
    fail('lifecycle requires an accepted candidate');
  }
  if (candidate.touchEpisodes.length === 0) {
    fail('lifecycle requires at least one touch episode');
  }

  const zone = validateZone(candidate.zone);
  const closedCandles = validateCandles(
    dataset.candles,
    options.atrPeriod,
  );
  const detectEpisodes =
    dependencies.detectTouchEpisodes
    ?? detectTouchEpisodes;
  const builtEvents = buildEpisodeEvents(
    candidate,
    dataset,
    options,
    detectEpisodes,
  );
  const ignored: IgnoredLevelLifecycleEpisode[] = [
    ...builtEvents.ignored,
  ];
  const firstEpisode = candidate.touchEpisodes[0];
  if (!firstEpisode) {
    fail('candidate first touch episode is unavailable');
  }

  const firstEventIndex = builtEvents.events.findIndex(
    (event) => (
      event.kind === candidate.kind
      && event.episode.id === firstEpisode.id
    ),
  );
  if (firstEventIndex < 0) {
    fail('candidate origin episode is unavailable');
  }

  let sequence = 1;
  let current: WorkingCycle | null = startWorkingCycle(
    sequence,
    builtEvents.events[firstEventIndex]!,
    'origin',
    null,
  );
  let predecessor: BrokenPredecessor | null = null;
  const cycles: LevelLifecycleCycle[] = [];

  for (
    let eventIndex = firstEventIndex + 1;
    eventIndex < builtEvents.events.length;
    eventIndex += 1
  ) {
    const event = builtEvents.events[eventIndex];
    if (!event) {
      continue;
    }

    if (current === null) {
      if (predecessor === null) {
        fail('broken predecessor is unavailable');
      }
      if (Date.parse(event.episode.startedAt) <= predecessor.brokenAtMs) {
        ignored.push(freezeIgnored(
          event,
          'started_before_break_confirmation',
        ));
        continue;
      }

      sequence += 1;
      const transitionType: LevelLifecycleTransitionType =
        event.kind === predecessor.kind
          ? 'reclaim'
          : 'flip';
      current = startWorkingCycle(
        sequence,
        event,
        transitionType,
        predecessor.cycleId,
      );
      predecessor = null;
      continue;
    }

    const activeFromMs = Date.parse(
      current.episodes[0]!.confirmedAt,
    );
    const breakEvidence = findConfirmedBreak(
      closedCandles,
      zone,
      current.kind,
      activeFromMs,
      Date.parse(event.episode.confirmedAt),
      options,
    );

    if (breakEvidence !== null) {
      const finalized = finalizeCycle(
        candidate,
        zone,
        current,
        breakEvidence,
      );
      cycles.push(finalized);
      predecessor = Object.freeze({
        cycleId: finalized.id,
        kind: finalized.kind,
        brokenAtMs: Date.parse(breakEvidence.brokenAt),
      });
      current = null;

      if (Date.parse(event.episode.startedAt) <= predecessor.brokenAtMs) {
        ignored.push(freezeIgnored(
          event,
          'started_before_break_confirmation',
        ));
        continue;
      }

      sequence += 1;
      const transitionType: LevelLifecycleTransitionType =
        event.kind === predecessor.kind
          ? 'reclaim'
          : 'flip';
      current = startWorkingCycle(
        sequence,
        event,
        transitionType,
        predecessor.cycleId,
      );
      predecessor = null;
      continue;
    }

    if (event.kind !== current.kind) {
      ignored.push(freezeIgnored(
        event,
        'opposite_role_without_break',
      ));
      continue;
    }

    const latestEpisode = current.episodes.at(-1);
    if (!latestEpisode) {
      fail('current cycle latest episode is unavailable');
    }
    if (episodesOverlap(latestEpisode, event.episode)) {
      ignored.push(freezeIgnored(
        event,
        'overlapping_episode',
      ));
      continue;
    }

    current.episodes.push(event.episode);
  }

  if (current !== null) {
    const activeFromMs = Date.parse(
      current.episodes[0]!.confirmedAt,
    );
    const finalBreak = findConfirmedBreak(
      closedCandles,
      zone,
      current.kind,
      activeFromMs,
      Number.POSITIVE_INFINITY,
      options,
    );
    const finalized = finalizeCycle(
      candidate,
      zone,
      current,
      finalBreak,
    );
    cycles.push(finalized);
  }

  const frozenCycles = Object.freeze([...cycles]);
  const currentCycle = frozenCycles.at(-1);
  const currentCycleId = (
    currentCycle !== undefined
    && currentCycle.breakEvidence === null
  )
    ? currentCycle.id
    : null;

  return Object.freeze({
    sourceCandidateId: candidate.id,
    symbol,
    sourceTimeframe: candidate.sourceTimeframe,
    zone,
    cycles: frozenCycles,
    currentCycleId,
    ignoredEpisodes: Object.freeze([...ignored]),
    breakCount: frozenCycles.filter(
      (cycle) => cycle.breakEvidence !== null,
    ).length,
    flipCount: frozenCycles.filter(
      (cycle) => cycle.transition.type === 'flip',
    ).length,
    reclaimCount: frozenCycles.filter(
      (cycle) => cycle.transition.type === 'reclaim',
    ).length,
    observationalOnly: true,
    createsSetup: false,
    usesQualityScore: false,
  });
}
