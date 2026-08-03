import type {
  LevelV2ShadowMarketEvidenceHistoryEntry,
  LevelV2ShadowMarketEvidenceHistoryStatus,
} from './level-v2-shadow-market-evidence-history.types.js';
import type {
  LevelV2ShadowMarketEvidence,
  LevelV2ShadowTapeEvidence,
} from './level-v2-shadow-market-evidence.types.js';
import type {
  LevelV2ShadowMarketEvidenceAggressionSide,
  LevelV2ShadowMarketEvidenceBehavior,
  LevelV2ShadowMarketEvidenceBehaviorAnalysis,
  LevelV2ShadowMarketEvidenceBehaviorAnalysisOptions,
  LevelV2ShadowMarketEvidenceBehaviorConfidence,
  LevelV2ShadowMarketEvidenceBehaviorConfidenceCounts,
  LevelV2ShadowMarketEvidenceBehaviorCounts,
  LevelV2ShadowMarketEvidenceBehaviorDiagnostics,
  LevelV2ShadowMarketEvidencePriceDirection,
} from './level-v2-shadow-market-evidence-behavior-analysis.types.js';

export const DEFAULT_LEVEL_V2_SHADOW_MARKET_EVIDENCE_BEHAVIOR_ANALYSIS_OPTIONS:
LevelV2ShadowMarketEvidenceBehaviorAnalysisOptions = {
  minTapeEntries: 2,
  priceMoveThresholdPct: 0.01,
  dominantBuySharePct: 55,
  orderBookImbalanceThresholdPct: 5,
  exhaustionActivityRatio: 0.65,
  exhaustionDeltaRatio: 0.65,
};

interface UsableTapePoint {
  entry:
    LevelV2ShadowMarketEvidenceHistoryEntry;
  tape:
    LevelV2ShadowTapeEvidence;
}

function validateFiniteNonNegative(
  value: number,
  name: string,
): void {
  if (
    !Number.isFinite(value)
    || value < 0
  ) {
    throw new Error(
      `Level v2 shadow market evidence behavior ${name} must be a finite non-negative number`,
    );
  }
}

function validateRatio(
  value: number,
  name: string,
): void {
  if (
    !Number.isFinite(value)
    || value <= 0
    || value > 1
  ) {
    throw new Error(
      `Level v2 shadow market evidence behavior ${name} must be greater than zero and at most one`,
    );
  }
}

function validateOptions(
  options:
    LevelV2ShadowMarketEvidenceBehaviorAnalysisOptions,
): void {
  if (
    !Number.isInteger(
      options.minTapeEntries,
    )
    || options.minTapeEntries < 2
  ) {
    throw new Error(
      'Level v2 shadow market evidence behavior minTapeEntries must be an integer of at least two',
    );
  }

  validateFiniteNonNegative(
    options.priceMoveThresholdPct,
    'priceMoveThresholdPct',
  );

  if (
    !Number.isFinite(
      options.dominantBuySharePct,
    )
    || options.dominantBuySharePct <= 50
    || options.dominantBuySharePct > 100
  ) {
    throw new Error(
      'Level v2 shadow market evidence behavior dominantBuySharePct must be greater than fifty and at most one hundred',
    );
  }

  validateFiniteNonNegative(
    options.orderBookImbalanceThresholdPct,
    'orderBookImbalanceThresholdPct',
  );

  validateRatio(
    options.exhaustionActivityRatio,
    'exhaustionActivityRatio',
  );

  validateRatio(
    options.exhaustionDeltaRatio,
    'exhaustionDeltaRatio',
  );
}

function round(
  value: number,
): number {
  return Number(
    value.toFixed(8),
  );
}

function delta(
  current:
    number
    | null,
  previous:
    number
    | null,
): number | null {
  return current === null
    || previous === null
      ? null
      : round(
          current - previous,
        );
}

function ratio(
  current:
    number
    | null,
  previous:
    number
    | null,
): number | null {
  return current === null
    || previous === null
    || previous === 0
      ? null
      : round(
          current / previous,
        );
}

function priceChangePct(
  first:
    number
    | null,
  latest:
    number
    | null,
): number | null {
  return first === null
    || latest === null
    || first <= 0
      ? null
      : round(
          (
            (
              latest - first
            )
            / first
          )
          * 100,
        );
}

function aggressionSide(
  tape:
    LevelV2ShadowTapeEvidence
    | null,
  options:
    LevelV2ShadowMarketEvidenceBehaviorAnalysisOptions,
): LevelV2ShadowMarketEvidenceAggressionSide {
  if (!tape) {
    return 'unknown';
  }

  const buyShare =
    tape.buySharePct;

  if (buyShare !== null) {
    if (
      buyShare
      >= options.dominantBuySharePct
    ) {
      return 'buy';
    }

    if (
      buyShare
      <= 100
        - options.dominantBuySharePct
    ) {
      return 'sell';
    }

    return 'balanced';
  }

  if (tape.quoteDelta > 0) {
    return 'buy';
  }

  if (tape.quoteDelta < 0) {
    return 'sell';
  }

  return 'balanced';
}

function priceDirection(
  changePct:
    number
    | null,
  thresholdPct: number,
): LevelV2ShadowMarketEvidencePriceDirection {
  if (changePct === null) {
    return 'unknown';
  }

  if (changePct > thresholdPct) {
    return 'up';
  }

  if (changePct < -thresholdPct) {
    return 'down';
  }

  return 'flat';
}

function isUsableTape(
  evidence:
    LevelV2ShadowMarketEvidence,
): evidence is
  LevelV2ShadowMarketEvidence
  & {
    tape: LevelV2ShadowTapeEvidence;
  } {
  return evidence.tape !== null
    && evidence.tape.lastTradePrice !== null
    && evidence.tape.lastTradePrice > 0
    && evidence.tape.totalQuoteValue > 0;
}

function classificationTransitionsCount(
  entries:
    readonly LevelV2ShadowMarketEvidenceHistoryEntry[],
): number {
  let count = 0;

  for (
    let index = 1;
    index < entries.length;
    index += 1
  ) {
    if (
      entries[index - 1]
        ?.evidence
        .classificationStatus
      !== entries[index]
        ?.evidence
        .classificationStatus
    ) {
      count += 1;
    }
  }

  return count;
}

function isExhaustion(
  points:
    readonly UsableTapePoint[],
  options:
    LevelV2ShadowMarketEvidenceBehaviorAnalysisOptions,
): boolean {
  if (points.length < 3) {
    return false;
  }

  const previous =
    points.at(-2);
  const latest =
    points.at(-1);

  if (
    !previous
    || !latest
  ) {
    return false;
  }

  const previousSide =
    aggressionSide(
      previous.tape,
      options,
    );
  const latestSide =
    aggressionSide(
      latest.tape,
      options,
    );

  if (
    previousSide !== 'buy'
    && previousSide !== 'sell'
  ) {
    return false;
  }

  if (
    latestSide !== previousSide
    && latestSide !== 'balanced'
  ) {
    return false;
  }

  const activityRatio =
    ratio(
      latest.tape.totalQuoteValue,
      previous.tape.totalQuoteValue,
    );

  const deltaRatio =
    ratio(
      Math.abs(
        latest.tape.quoteDelta,
      ),
      Math.abs(
        previous.tape.quoteDelta,
      ),
    );

  const recentPriceChange =
    priceChangePct(
      previous.tape.lastTradePrice,
      latest.tape.lastTradePrice,
    );

  const responseNoLongerContinues =
    recentPriceChange !== null
    && (
      previousSide === 'buy'
        ? recentPriceChange
            <= options
              .priceMoveThresholdPct
        : recentPriceChange
            >= -options
              .priceMoveThresholdPct
    );

  return activityRatio !== null
    && deltaRatio !== null
    && activityRatio
      <= options.exhaustionActivityRatio
    && deltaRatio
      <= options.exhaustionDeltaRatio
    && responseNoLongerContinues;
}

function behaviorAndReasons(
  points:
    readonly UsableTapePoint[],
  side:
    LevelV2ShadowMarketEvidenceAggressionSide,
  direction:
    LevelV2ShadowMarketEvidencePriceDirection,
  latestImbalance:
    number
    | null,
  options:
    LevelV2ShadowMarketEvidenceBehaviorAnalysisOptions,
): {
  behavior:
    LevelV2ShadowMarketEvidenceBehavior;
  reasons: string[];
} {
  if (
    points.length
    < options.minTapeEntries
  ) {
    return {
      behavior:
        'insufficient_data',
      reasons: [
        'insufficient_temporal_tape',
      ],
    };
  }

  if (
    isExhaustion(
      points,
      options,
    )
  ) {
    return {
      behavior:
        'momentum_exhaustion',
      reasons: [
        'aggression_and_activity_contracted',
        'latest_price_response_stalled_or_reversed',
      ],
    };
  }

  if (
    side === 'buy'
    && direction === 'up'
  ) {
    return {
      behavior:
        'directional_continuation',
      reasons: [
        'buy_aggression_with_upward_price_response',
      ],
    };
  }

  if (
    side === 'sell'
    && direction === 'down'
  ) {
    return {
      behavior:
        'directional_continuation',
      reasons: [
        'sell_aggression_with_downward_price_response',
      ],
    };
  }

  if (
    side === 'buy'
    && (
      direction === 'down'
      || (
        direction === 'flat'
        && latestImbalance !== null
        && latestImbalance
          <= -options
            .orderBookImbalanceThresholdPct
      )
    )
  ) {
    return {
      behavior:
        'aggressive_buy_absorption',
      reasons: [
        direction === 'down'
          ? 'buy_aggression_with_downward_price_response'
          : 'buy_aggression_stalled_against_ask_heavy_book',
      ],
    };
  }

  if (
    side === 'sell'
    && (
      direction === 'up'
      || (
        direction === 'flat'
        && latestImbalance !== null
        && latestImbalance
          >= options
            .orderBookImbalanceThresholdPct
      )
    )
  ) {
    return {
      behavior:
        'aggressive_sell_absorption',
      reasons: [
        direction === 'up'
          ? 'sell_aggression_with_upward_price_response'
          : 'sell_aggression_stalled_against_bid_heavy_book',
      ],
    };
  }

  return {
    behavior:
      'mixed',
    reasons: [
      'conflicting_or_neutral_market_evidence',
    ],
  };
}

function confidence(
  behavior:
    LevelV2ShadowMarketEvidenceBehavior,
  points:
    readonly UsableTapePoint[],
  entries:
    readonly LevelV2ShadowMarketEvidenceHistoryEntry[],
  direction:
    LevelV2ShadowMarketEvidencePriceDirection,
  latestImbalance:
    number
    | null,
  activityRatio:
    number
    | null,
  deltaRatio:
    number
    | null,
  options:
    LevelV2ShadowMarketEvidenceBehaviorAnalysisOptions,
): LevelV2ShadowMarketEvidenceBehaviorConfidence {
  if (
    behavior === 'insufficient_data'
    || behavior === 'mixed'
  ) {
    return 'low';
  }

  const latest =
    entries.at(-1)
      ?.evidence;

  if (
    !latest
    || latest.sourceErrors.length > 0
  ) {
    return 'low';
  }

  const completeRatio =
    entries.filter(
      (entry) =>
        entry.evidence.availability
          === 'complete',
    ).length
    / entries.length;

  const bookCorroborates =
    latestImbalance !== null
    && (
      (
        behavior
          === 'directional_continuation'
        && (
          direction === 'up'
            ? latestImbalance
                >= options
                  .orderBookImbalanceThresholdPct
            : direction === 'down'
              && latestImbalance
                <= -options
                  .orderBookImbalanceThresholdPct
        )
      )
      || (
        behavior
          === 'aggressive_buy_absorption'
        && latestImbalance
          <= -options
            .orderBookImbalanceThresholdPct
      )
      || (
        behavior
          === 'aggressive_sell_absorption'
        && latestImbalance
          >= options
            .orderBookImbalanceThresholdPct
      )
    );

  const strongExhaustion =
    behavior === 'momentum_exhaustion'
    && activityRatio !== null
    && deltaRatio !== null
    && activityRatio <= 0.5
    && deltaRatio <= 0.5;

  if (
    points.length >= 3
    && completeRatio >= 0.75
    && (
      bookCorroborates
      || strongExhaustion
    )
  ) {
    return 'high';
  }

  return latest.availability
    === 'unavailable'
      ? 'low'
      : 'medium';
}

export function analyzeLevelV2ShadowMarketEvidenceBehavior(
  entryValues:
    readonly LevelV2ShadowMarketEvidenceHistoryEntry[],
  options:
    LevelV2ShadowMarketEvidenceBehaviorAnalysisOptions =
      DEFAULT_LEVEL_V2_SHADOW_MARKET_EVIDENCE_BEHAVIOR_ANALYSIS_OPTIONS,
): LevelV2ShadowMarketEvidenceBehaviorAnalysis | null {
  validateOptions(
    options,
  );

  if (entryValues.length === 0) {
    return null;
  }

  const entries = [
    ...entryValues,
  ].sort(
    (
      left,
      right,
    ) =>
      left.sequence
      - right.sequence,
  );

  const first =
    entries[0];
  const latest =
    entries.at(-1);

  if (
    !first
    || !latest
  ) {
    return null;
  }

  const classifierId =
    first.evidence.classifierId;

  if (
    entries.some(
      (entry) =>
        entry.evidence.classifierId
          !== classifierId,
    )
  ) {
    throw new Error(
      'Level v2 shadow market evidence behavior analysis requires one classifier history',
    );
  }

  const points:
    UsableTapePoint[] =
      entries.flatMap(
        (entry) => {
          const evidence =
            entry.evidence;

          if (!isUsableTape(evidence)) {
            return [];
          }

          return [{
            entry,
            tape:
              evidence.tape,
          }];
        },
      );

  const firstPoint =
    points[0]
    ?? null;
  const latestPoint =
    points.at(-1)
    ?? null;
  const previousPoint =
    points.at(-2)
    ?? null;

  const netPriceChangePct =
    priceChangePct(
      firstPoint?.tape
        .lastTradePrice
      ?? null,
      latestPoint?.tape
        .lastTradePrice
      ?? null,
    );

  const side =
    aggressionSide(
      latestPoint?.tape
      ?? null,
      options,
    );

  const direction =
    priceDirection(
      netPriceChangePct,
      options.priceMoveThresholdPct,
    );

  const latestImbalance =
    latest.evidence
      .orderBook
      ?.imbalancePct
    ?? null;

  const resolved =
    behaviorAndReasons(
      points,
      side,
      direction,
      latestImbalance,
      options,
    );

  const activityRatio =
    ratio(
      latestPoint?.tape
        .totalQuoteValue
      ?? null,
      previousPoint?.tape
        .totalQuoteValue
      ?? null,
    );

  const deltaRatio =
    ratio(
      latestPoint
        ? Math.abs(
            latestPoint.tape
              .quoteDelta,
          )
        : null,
      previousPoint
        ? Math.abs(
            previousPoint.tape
              .quoteDelta,
          )
        : null,
    );

  const firstImbalance =
    first.evidence
      .orderBook
      ?.imbalancePct
    ?? null;

  return {
    id:
      `${classifierId}:behavior:${latest.sequence}`,
    classifierId,
    levelId:
      latest.evidence.levelId,
    symbol:
      latest.evidence.symbol,
    timeframe:
      latest.evidence.timeframe,
    currentKind:
      latest.evidence.currentKind,
    latestClassificationStatus:
      latest.evidence
        .classificationStatus,
    firstSequence:
      first.sequence,
    latestSequence:
      latest.sequence,
    firstCapturedAt:
      first.evidence.capturedAt,
    latestCapturedAt:
      latest.evidence.capturedAt,
    behavior:
      resolved.behavior,
    confidence:
      confidence(
        resolved.behavior,
        points,
        entries,
        direction,
        latestImbalance,
        activityRatio,
        deltaRatio,
        options,
      ),
    aggressionSide:
      side,
    priceDirection:
      direction,
    reasons:
      resolved.reasons,
    metrics: {
      sourceEntriesCount:
        entries.length,
      usableTapeEntriesCount:
        points.length,
      completeEntriesCount:
        entries.filter(
          (entry) =>
            entry.evidence
              .availability
              === 'complete',
        ).length,
      classificationTransitionsCount:
        classificationTransitionsCount(
          entries,
        ),
      firstTradePrice:
        firstPoint?.tape
          .lastTradePrice
        ?? null,
      latestTradePrice:
        latestPoint?.tape
          .lastTradePrice
        ?? null,
      netPriceChangePct,
      latestQuoteDelta:
        latestPoint?.tape
          .quoteDelta
        ?? null,
      quoteDeltaChange:
        delta(
          latestPoint?.tape
            .quoteDelta
          ?? null,
          firstPoint?.tape
            .quoteDelta
          ?? null,
        ),
      latestBuySharePct:
        latestPoint?.tape
          .buySharePct
        ?? null,
      buySharePctChange:
        delta(
          latestPoint?.tape
            .buySharePct
          ?? null,
          firstPoint?.tape
            .buySharePct
          ?? null,
        ),
      latestTotalQuoteValue:
        latestPoint?.tape
          .totalQuoteValue
        ?? null,
      activityRatioToPrevious:
        activityRatio,
      deltaRatioToPrevious:
        deltaRatio,
      latestOrderBookImbalancePct:
        latestImbalance,
      orderBookImbalancePctChange:
        delta(
          latestImbalance,
          firstImbalance,
        ),
    },
    observationalOnly:
      true,
    changesBreakClassification:
      false,
  };
}

export function buildLevelV2ShadowMarketEvidenceBehaviorAnalyses(
  entries:
    readonly LevelV2ShadowMarketEvidenceHistoryEntry[],
  options:
    LevelV2ShadowMarketEvidenceBehaviorAnalysisOptions =
      DEFAULT_LEVEL_V2_SHADOW_MARKET_EVIDENCE_BEHAVIOR_ANALYSIS_OPTIONS,
): LevelV2ShadowMarketEvidenceBehaviorAnalysis[] {
  validateOptions(
    options,
  );

  const groups =
    new Map<
      string,
      LevelV2ShadowMarketEvidenceHistoryEntry[]
    >();

  for (
    const entry
    of entries
  ) {
    const classifierId =
      entry.evidence.classifierId;

    const values =
      groups.get(
        classifierId,
      )
      ?? [];

    values.push(
      entry,
    );
    groups.set(
      classifierId,
      values,
    );
  }

  return [
    ...groups.values(),
  ]
    .map(
      (values) =>
        analyzeLevelV2ShadowMarketEvidenceBehavior(
          values,
          options,
        ),
    )
    .filter(
      (
        value,
      ): value is
        LevelV2ShadowMarketEvidenceBehaviorAnalysis =>
          value !== null,
    )
    .sort(
      (
        left,
        right,
      ) =>
        right.latestSequence
        - left.latestSequence,
    );
}

function emptyBehaviorCounts():
LevelV2ShadowMarketEvidenceBehaviorCounts {
  return {
    directional_continuation: 0,
    aggressive_buy_absorption: 0,
    aggressive_sell_absorption: 0,
    momentum_exhaustion: 0,
    mixed: 0,
    insufficient_data: 0,
  };
}

function emptyConfidenceCounts():
LevelV2ShadowMarketEvidenceBehaviorConfidenceCounts {
  return {
    low: 0,
    medium: 0,
    high: 0,
  };
}

export function buildLevelV2ShadowMarketEvidenceBehaviorDiagnostics(
  analyses:
    readonly LevelV2ShadowMarketEvidenceBehaviorAnalysis[],
  sourceEntriesCount: number,
  sourceHistoryStatus:
    LevelV2ShadowMarketEvidenceHistoryStatus
    | null,
  sourceLimit = 10_000,
): LevelV2ShadowMarketEvidenceBehaviorDiagnostics {
  const behaviorCounts =
    emptyBehaviorCounts();
  const confidenceCounts =
    emptyConfidenceCounts();

  for (
    const analysis
    of analyses
  ) {
    behaviorCounts[
      analysis.behavior
    ] += 1;
    confidenceCounts[
      analysis.confidence
    ] += 1;
  }

  return {
    sourceEntriesCount,
    analyzedClassifiersCount:
      analyses.length,
    symbolsCount:
      new Set(
        analyses.map(
          (analysis) =>
            analysis.symbol,
        ),
      ).size,
    behaviorCounts,
    confidenceCounts,
    latestCapturedAt:
      analyses[0]
        ?.latestCapturedAt
      ?? null,
    truncatedSourceHistory:
      sourceEntriesCount >= sourceLimit
      && sourceHistoryStatus !== null
      && sourceHistoryStatus
        .entriesCount
        > sourceEntriesCount,
    sourceHistoryStatus,
    observationalOnly:
      true,
  };
}
