import {
  createLevelCandidate,
  isLevelEngineTimeframe,
  normalizeLevelEngineSymbol,
} from './level-engine.contract.js';
import {
  detectTouchEpisodes,
} from './level-engine-touch-detector.js';
import {
  LEVEL_ENGINE_TIMEFRAMES,
} from './level-engine.types.js';
import type {
  LevelAcceptanceReason,
  LevelCandidate,
  LevelEngineKind,
  LevelEngineTimeframe,
  LevelEngineZone,
  TouchEpisode,
} from './level-engine.types.js';
import type {
  LevelEngineCandle,
  TouchEpisodeDetectionOptions,
} from './level-engine-touch-detector.types.js';
import type {
  LevelClusterRejectionReason,
  LevelEngineTimeframeDataset,
  LevelPivotSeed,
  MultiTimeframeLevelDetectionOptions,
  MultiTimeframeLevelDetectionResult,
  RejectedLevelCluster,
  TimeframeLevelDetectionResult,
} from './level-engine-multi-timeframe-detector.types.js';

export const DEFAULT_MULTI_TIMEFRAME_LEVEL_DETECTION_OPTIONS:
MultiTimeframeLevelDetectionOptions = Object.freeze({
  atrPeriod: 14,
  pivotLeftBars: 2,
  pivotRightBars: 1,
  zoneHalfWidthAtr: 0.35,
  clusterDistanceAtr: 0.75,
  touchEpisodes: Object.freeze({
    atrPeriod: 14,
    minDepartureAtr: 0.8,
    maxDepartureCandles: 8,
    minBarsBetweenEpisodes: 3,
    maxEpisodeSpanCandles: 6,
  }),
});

interface IndexedClosedCandle {
  readonly originalIndex: number;
  readonly closedIndex: number;
  readonly candle: LevelEngineCandle;
  readonly atr: number | null;
}

interface PivotCluster {
  readonly origin: LevelPivotSeed;
  readonly seeds: readonly LevelPivotSeed[];
  readonly zone: LevelEngineZone;
}

interface MutablePivotCluster {
  readonly origin: LevelPivotSeed;
  readonly seeds: LevelPivotSeed[];
  readonly zone: LevelEngineZone;
}

function fail(message: string): never {
  throw new Error(`Multi-Timeframe Level Detector: ${message}`);
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    fail(`${field} must be a positive integer`);
  }
  return value;
}

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    fail(`${field} must be a non-negative integer`);
  }
  return value;
}

function positiveFinite(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    fail(`${field} must be a positive finite number`);
  }
  return value;
}

function canonicalTimestamp(value: string, field: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    fail(`${field} must be a valid timestamp`);
  }
  return new Date(timestamp).toISOString();
}

function validateTouchOptions(
  options: TouchEpisodeDetectionOptions,
  atrPeriod: number,
): TouchEpisodeDetectionOptions {
  const validated = Object.freeze({
    atrPeriod: positiveInteger(options.atrPeriod, 'touchEpisodes.atrPeriod'),
    minDepartureAtr: positiveFinite(
      options.minDepartureAtr,
      'touchEpisodes.minDepartureAtr',
    ),
    maxDepartureCandles: positiveInteger(
      options.maxDepartureCandles,
      'touchEpisodes.maxDepartureCandles',
    ),
    minBarsBetweenEpisodes: nonNegativeInteger(
      options.minBarsBetweenEpisodes,
      'touchEpisodes.minBarsBetweenEpisodes',
    ),
    maxEpisodeSpanCandles: positiveInteger(
      options.maxEpisodeSpanCandles,
      'touchEpisodes.maxEpisodeSpanCandles',
    ),
  });
  if (validated.atrPeriod !== atrPeriod) {
    fail('touchEpisodes.atrPeriod must equal atrPeriod');
  }
  return validated;
}

function validateOptions(
  value: MultiTimeframeLevelDetectionOptions,
): MultiTimeframeLevelDetectionOptions {
  const atrPeriod = positiveInteger(value.atrPeriod, 'atrPeriod');
  return Object.freeze({
    atrPeriod,
    pivotLeftBars: positiveInteger(value.pivotLeftBars, 'pivotLeftBars'),
    pivotRightBars: positiveInteger(value.pivotRightBars, 'pivotRightBars'),
    zoneHalfWidthAtr: positiveFinite(
      value.zoneHalfWidthAtr,
      'zoneHalfWidthAtr',
    ),
    clusterDistanceAtr: positiveFinite(
      value.clusterDistanceAtr,
      'clusterDistanceAtr',
    ),
    touchEpisodes: validateTouchOptions(value.touchEpisodes, atrPeriod),
  });
}

function validateCandles(
  values: readonly LevelEngineCandle[],
): readonly LevelEngineCandle[] {
  let previousOpenMs = Number.NEGATIVE_INFINITY;
  let openCandleSeen = false;

  return Object.freeze(values.map((value, index) => {
    const openTime = canonicalTimestamp(
      value.openTime,
      `candles[${index}].openTime`,
    );
    const closeTime = canonicalTimestamp(
      value.closeTime,
      `candles[${index}].closeTime`,
    );
    const openMs = Date.parse(openTime);
    const closeMs = Date.parse(closeTime);
    if (openMs <= previousOpenMs) {
      fail('candles must be strictly ordered and unique');
    }
    if (closeMs < openMs) {
      fail(`candles[${index}].closeTime cannot precede openTime`);
    }

    const open = positiveFinite(value.open, `candles[${index}].open`);
    const high = positiveFinite(value.high, `candles[${index}].high`);
    const low = positiveFinite(value.low, `candles[${index}].low`);
    const close = positiveFinite(value.close, `candles[${index}].close`);
    if (
      low > high
      || open < low
      || open > high
      || close < low
      || close > high
    ) {
      fail(`candles[${index}] contains invalid OHLC values`);
    }

    if (!value.isClosed) {
      openCandleSeen = true;
    } else if (openCandleSeen) {
      fail('closed candles cannot appear after an open candle');
    }

    previousOpenMs = openMs;
    return Object.freeze({
      openTime,
      closeTime,
      open,
      high,
      low,
      close,
      isClosed: value.isClosed,
    });
  }));
}

function indexClosedCandles(
  candles: readonly LevelEngineCandle[],
  atrPeriod: number,
): readonly IndexedClosedCandle[] {
  const closed: Array<{
    readonly originalIndex: number;
    readonly candle: LevelEngineCandle;
  }> = [];

  candles.forEach((candle, originalIndex) => {
    if (candle.isClosed) {
      closed.push({ originalIndex, candle });
    }
  });

  const trueRanges: number[] = [];
  return Object.freeze(closed.map((item, closedIndex) => {
    const previous = closed[closedIndex - 1]?.candle;
    const trueRange = previous
      ? Math.max(
          item.candle.high - item.candle.low,
          Math.abs(item.candle.high - previous.close),
          Math.abs(item.candle.low - previous.close),
        )
      : item.candle.high - item.candle.low;
    trueRanges.push(trueRange);

    const atr = trueRanges.length >= atrPeriod
      ? trueRanges
          .slice(trueRanges.length - atrPeriod)
          .reduce((sum, range) => sum + range, 0) / atrPeriod
      : null;

    return Object.freeze({
      originalIndex: item.originalIndex,
      closedIndex,
      candle: item.candle,
      atr,
    });
  }));
}

function stableSeedId(
  symbol: string,
  timeframe: LevelEngineTimeframe,
  kind: LevelEngineKind,
  candle: IndexedClosedCandle,
): string {
  return `${symbol}-${timeframe}-pivot-${kind}-${Date.parse(
    candle.candle.closeTime,
  )}`;
}

function freezeSeed(
  symbol: string,
  timeframe: LevelEngineTimeframe,
  kind: LevelEngineKind,
  candle: IndexedClosedCandle,
  confirmation: IndexedClosedCandle,
): LevelPivotSeed {
  if (candle.atr === null || candle.atr <= 0) {
    fail('pivot seed requires ATR');
  }
  return Object.freeze({
    id: stableSeedId(symbol, timeframe, kind, candle),
    sourceTimeframe: timeframe,
    kind,
    candleIndex: candle.originalIndex,
    anchorAt: candle.candle.closeTime,
    confirmedAt: confirmation.candle.closeTime,
    price: kind === 'support' ? candle.candle.low : candle.candle.high,
    atrAtPivot: candle.atr,
  });
}

function isSupportPivot(
  current: IndexedClosedCandle,
  neighbours: readonly IndexedClosedCandle[],
): boolean {
  return neighbours.every(
    (neighbour) => current.candle.low < neighbour.candle.low,
  );
}

function isResistancePivot(
  current: IndexedClosedCandle,
  neighbours: readonly IndexedClosedCandle[],
): boolean {
  return neighbours.every(
    (neighbour) => current.candle.high > neighbour.candle.high,
  );
}

function detectPivotSeeds(
  symbol: string,
  timeframe: LevelEngineTimeframe,
  closed: readonly IndexedClosedCandle[],
  options: MultiTimeframeLevelDetectionOptions,
): readonly LevelPivotSeed[] {
  const seeds: LevelPivotSeed[] = [];
  const firstIndex = Math.max(options.pivotLeftBars, options.atrPeriod - 1);
  const lastIndexExclusive = closed.length - options.pivotRightBars;

  for (let index = firstIndex; index < lastIndexExclusive; index += 1) {
    const current = closed[index];
    const confirmation = closed[index + options.pivotRightBars];
    if (!current || !confirmation || current.atr === null) {
      continue;
    }

    const left = closed.slice(index - options.pivotLeftBars, index);
    const right = closed.slice(index + 1, index + options.pivotRightBars + 1);
    const neighbours = [...left, ...right];

    if (isSupportPivot(current, neighbours)) {
      seeds.push(freezeSeed(
        symbol,
        timeframe,
        'support',
        current,
        confirmation,
      ));
    }
    if (isResistancePivot(current, neighbours)) {
      seeds.push(freezeSeed(
        symbol,
        timeframe,
        'resistance',
        current,
        confirmation,
      ));
    }
  }

  return Object.freeze(seeds);
}

function zoneFromOrigin(
  origin: LevelPivotSeed,
  halfWidthAtr: number,
): LevelEngineZone {
  const halfWidth = origin.atrAtPivot * halfWidthAtr;
  return Object.freeze({
    low: origin.price - halfWidth,
    reference: origin.price,
    high: origin.price + halfWidth,
  });
}

function clusterContains(
  cluster: PivotCluster,
  seed: LevelPivotSeed,
  distanceAtr: number,
): boolean {
  const normalizer = Math.max(
    cluster.origin.atrAtPivot,
    seed.atrAtPivot,
  );
  return Math.abs(seed.price - cluster.origin.price) / normalizer
    <= distanceAtr;
}

function clusterPivotSeeds(
  seeds: readonly LevelPivotSeed[],
  options: MultiTimeframeLevelDetectionOptions,
): readonly PivotCluster[] {
  const clusters: MutablePivotCluster[] = [];

  for (const kind of ['support', 'resistance'] as const) {
    const kindSeeds = seeds
      .filter((seed) => seed.kind === kind)
      .sort((left, right) => left.candleIndex - right.candleIndex);

    for (const seed of kindSeeds) {
      const cluster = clusters.find(
        (candidate) => candidate.origin.kind === kind
          && clusterContains(candidate, seed, options.clusterDistanceAtr),
      );
      if (cluster) {
        cluster.seeds.push(seed);
      } else {
        clusters.push({
          origin: seed,
          seeds: [seed],
          zone: zoneFromOrigin(seed, options.zoneHalfWidthAtr),
        });
      }
    }
  }

  return Object.freeze(clusters.map((cluster) => Object.freeze({
    origin: cluster.origin,
    seeds: Object.freeze([...cluster.seeds]),
    zone: cluster.zone,
  })));
}

function causalEpisodes(
  episodes: readonly TouchEpisode[],
  origin: LevelPivotSeed,
): readonly TouchEpisode[] {
  const originConfirmationMs = Date.parse(origin.confirmedAt);
  return Object.freeze(episodes.filter(
    (episode) => episode.startCandleIndex >= origin.candleIndex
      && Date.parse(episode.confirmedAt) >= originConfirmationMs,
  ));
}

function stableCandidateId(
  symbol: string,
  timeframe: LevelEngineTimeframe,
  kind: LevelEngineKind,
  origin: LevelPivotSeed,
): string {
  return `${symbol}-${timeframe}-level-${kind}-${Date.parse(origin.anchorAt)}`;
}

function acceptanceReasons(
  cluster: PivotCluster,
  episodes: readonly TouchEpisode[],
  rejectedInteractionCount: number,
): readonly LevelAcceptanceReason[] {
  const reasons: LevelAcceptanceReason[] = ['confirmed_departure'];
  if (episodes.length >= 2) {
    reasons.push('independent_touch_episode');
  }
  if (cluster.seeds.length >= 2) {
    reasons.push('coherent_price_cluster');
  }
  if (rejectedInteractionCount === 0) {
    reasons.push('clean_reaction');
  }
  return Object.freeze(reasons);
}

function freezeRejection(
  timeframe: LevelEngineTimeframe,
  kind: LevelEngineKind,
  reason: LevelClusterRejectionReason,
  seed: LevelPivotSeed | null,
  zone: LevelEngineZone | null,
  pivotSeedCount: number,
): RejectedLevelCluster {
  return Object.freeze({
    sourceTimeframe: timeframe,
    kind,
    seedId: seed?.id ?? null,
    zone: zone ? Object.freeze({ ...zone }) : null,
    pivotSeedCount,
    reason,
  });
}

function episodeSetKey(
  timeframe: LevelEngineTimeframe,
  kind: LevelEngineKind,
  episodes: readonly TouchEpisode[],
): string {
  return `${timeframe}:${kind}:${episodes.map((episode) => episode.id).join('|')}`;
}

function detectTimeframeLevels(
  symbol: string,
  dataset: LevelEngineTimeframeDataset,
  options: MultiTimeframeLevelDetectionOptions,
): TimeframeLevelDetectionResult {
  const candles = validateCandles(dataset.candles);
  const closed = indexClosedCandles(candles, options.atrPeriod);
  const pivotSeeds = detectPivotSeeds(
    symbol,
    dataset.sourceTimeframe,
    closed,
    options,
  );
  const candidates: LevelCandidate[] = [];
  const rejectedClusters: RejectedLevelCluster[] = [];
  const seenEpisodeSets = new Set<string>();

  if (
    closed.length
    < options.atrPeriod + options.pivotLeftBars + options.pivotRightBars
  ) {
    for (const kind of ['support', 'resistance'] as const) {
      rejectedClusters.push(freezeRejection(
        dataset.sourceTimeframe,
        kind,
        'insufficient_history',
        null,
        null,
        0,
      ));
    }
  } else {
    for (const kind of ['support', 'resistance'] as const) {
      if (!pivotSeeds.some((seed) => seed.kind === kind)) {
        rejectedClusters.push(freezeRejection(
          dataset.sourceTimeframe,
          kind,
          'no_pivot_seed',
          null,
          null,
          0,
        ));
      }
    }

    const clusters = clusterPivotSeeds(pivotSeeds, options);
    for (const cluster of clusters) {
      const touchResult = detectTouchEpisodes(
        {
          symbol,
          sourceTimeframe: dataset.sourceTimeframe,
          kind: cluster.origin.kind,
          zone: cluster.zone,
        },
        candles,
        options.touchEpisodes,
      );

      if (touchResult.episodes.length === 0) {
        rejectedClusters.push(freezeRejection(
          dataset.sourceTimeframe,
          cluster.origin.kind,
          'no_confirmed_touch_episode',
          cluster.origin,
          cluster.zone,
          cluster.seeds.length,
        ));
        continue;
      }

      const episodes = causalEpisodes(touchResult.episodes, cluster.origin);
      if (episodes.length === 0) {
        rejectedClusters.push(freezeRejection(
          dataset.sourceTimeframe,
          cluster.origin.kind,
          'no_causal_touch_episode',
          cluster.origin,
          cluster.zone,
          cluster.seeds.length,
        ));
        continue;
      }

      const key = episodeSetKey(
        dataset.sourceTimeframe,
        cluster.origin.kind,
        episodes,
      );
      if (seenEpisodeSets.has(key)) {
        rejectedClusters.push(freezeRejection(
          dataset.sourceTimeframe,
          cluster.origin.kind,
          'duplicate_episode_set',
          cluster.origin,
          cluster.zone,
          cluster.seeds.length,
        ));
        continue;
      }
      seenEpisodeSets.add(key);

      const firstEpisode = episodes[0];
      const latestEpisode = episodes.at(-1);
      if (!firstEpisode || !latestEpisode) {
        fail('causal touch episodes are unavailable');
      }

      candidates.push(createLevelCandidate({
        id: stableCandidateId(
          symbol,
          dataset.sourceTimeframe,
          cluster.origin.kind,
          cluster.origin,
        ),
        symbol,
        sourceTimeframe: dataset.sourceTimeframe,
        kind: cluster.origin.kind,
        zone: cluster.zone,
        activeFrom: firstEpisode.confirmedAt,
        detectedAt: latestEpisode.confirmedAt,
        maturity: episodes.length >= 2 ? 'confirmed' : 'candidate',
        status: 'active',
        decision: 'accepted',
        touchEpisodes: episodes,
        acceptanceReasons: acceptanceReasons(
          cluster,
          episodes,
          touchResult.rejectedInteractions.length,
        ),
      }));
    }
  }

  candidates.sort((left, right) => {
    const leftKindOrder = left.kind === 'support' ? 0 : 1;
    const rightKindOrder = right.kind === 'support' ? 0 : 1;
    if (leftKindOrder !== rightKindOrder) {
      return leftKindOrder - rightKindOrder;
    }
    return Date.parse(left.activeFrom) - Date.parse(right.activeFrom);
  });

  return Object.freeze({
    symbol,
    sourceTimeframe: dataset.sourceTimeframe,
    closedCandlesCount: closed.length,
    ignoredOpenCandlesCount: candles.length - closed.length,
    pivotSeeds,
    candidates: Object.freeze([...candidates]),
    rejectedClusters: Object.freeze([...rejectedClusters]),
  });
}

function timeframeOrder(timeframe: LevelEngineTimeframe): number {
  return LEVEL_ENGINE_TIMEFRAMES.indexOf(timeframe);
}

export function detectMultiTimeframeLevelCandidates(
  datasetsValue: readonly LevelEngineTimeframeDataset[],
  optionsValue: MultiTimeframeLevelDetectionOptions =
    DEFAULT_MULTI_TIMEFRAME_LEVEL_DETECTION_OPTIONS,
): MultiTimeframeLevelDetectionResult {
  if (datasetsValue.length === 0) {
    fail('at least one timeframe dataset is required');
  }

  const options = validateOptions(optionsValue);
  const seenTimeframes = new Set<LevelEngineTimeframe>();
  let symbol: string | null = null;

  const datasets = datasetsValue.map((dataset, index) => {
    if (!isLevelEngineTimeframe(dataset.sourceTimeframe)) {
      fail(`unsupported timeframe: ${dataset.sourceTimeframe}`);
    }
    if (seenTimeframes.has(dataset.sourceTimeframe)) {
      fail(`duplicate timeframe dataset: ${dataset.sourceTimeframe}`);
    }
    seenTimeframes.add(dataset.sourceTimeframe);

    const normalizedSymbol = normalizeLevelEngineSymbol(dataset.symbol);
    if (symbol === null) {
      symbol = normalizedSymbol;
    } else if (symbol !== normalizedSymbol) {
      fail(`datasets[${index}] symbol must match ${symbol}`);
    }

    return Object.freeze({
      symbol: normalizedSymbol,
      sourceTimeframe: dataset.sourceTimeframe,
      candles: Object.freeze([...dataset.candles]),
    });
  }).sort(
    (left, right) => timeframeOrder(left.sourceTimeframe)
      - timeframeOrder(right.sourceTimeframe),
  );

  if (symbol === null) {
    fail('normalized symbol is unavailable');
  }

  const normalizedSymbol = symbol;
  const timeframes = Object.freeze(datasets.map((dataset) =>
    detectTimeframeLevels(normalizedSymbol, dataset, options)));
  const requestedTimeframes = Object.freeze(
    timeframes.map((result) => result.sourceTimeframe),
  );
  const candidates = Object.freeze(
    timeframes.flatMap((result) => result.candidates),
  );

  return Object.freeze({
    symbol,
    requestedTimeframes,
    timeframes,
    candidates,
    observationalOnly: true,
    createsSetup: false,
    mergesAcrossTimeframes: false,
  });
}
