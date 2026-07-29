import {
  DEFAULT_SETUP_LEVEL_DETECTOR_OPTIONS,
  detectSetupLevels,
} from '../setup-level-detector.js';
import type {
  DetectedSetupLevel,
  SetupLevelDetectorCandle,
} from '../setup-level-detector.types.js';
import type {
  LevelV2LifecycleStatus,
} from './level-v2-lifecycle.types.js';
import type {
  LevelV2ShadowComparableLevel,
  LevelV2ShadowEvaluation,
  LevelV2ShadowEvaluationOptions,
  LevelV2ShadowLevelMatch,
  LevelV2ShadowLifecycleStatusCounts,
  LevelV2ShadowUnmatchedV1Level,
  LevelV2ShadowUnmatchedV2Level,
} from './level-v2-shadow-evaluation.types.js';

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const LIFECYCLE_STATUSES:
readonly LevelV2LifecycleStatus[] = [
  'forming',
  'active',
  'testing',
  'broken',
  'retest_pending',
  'flipped',
  'expired',
];

export const DEFAULT_LEVEL_V2_SHADOW_EVALUATION_OPTIONS:
LevelV2ShadowEvaluationOptions = {
  v1DetectorOptions: {
    ...DEFAULT_SETUP_LEVEL_DETECTOR_OPTIONS,
  },
  maxMatchDistancePct:
    0.35,
};

function round(
  value: number,
  digits = 8,
): number {
  const factor =
    10 ** digits;

  return Math.round(
    value * factor,
  ) / factor;
}

function normalizeSymbol(
  value: string,
): string {
  const symbol =
    value.trim().toUpperCase();

  if (
    !SYMBOL_PATTERN.test(
      symbol,
    )
  ) {
    throw new Error(
      `Invalid Level v2 shadow evaluation symbol: ${value}`,
    );
  }

  return symbol;
}

function normalizeTimeframe(
  value: string,
): string {
  const timeframe =
    value.trim();

  if (
    timeframe.length === 0
    || timeframe !== value
  ) {
    throw new Error(
      'Level v2 shadow evaluation timeframe must be non-empty and trimmed',
    );
  }

  return timeframe;
}

function validateOptions(
  options:
    LevelV2ShadowEvaluationOptions,
): void {
  if (
    !Number.isFinite(
      options.maxMatchDistancePct,
    )
    || options.maxMatchDistancePct < 0
    || options.maxMatchDistancePct > 10
  ) {
    throw new Error(
      'Level v2 shadow evaluation maxMatchDistancePct must be from zero to ten',
    );
  }
}

function validateComparableLevels(
  symbol: string,
  timeframe: string,
  levels:
    readonly LevelV2ShadowComparableLevel[],
): void {
  const ids =
    new Set<string>();

  for (
    const level
    of levels
  ) {
    if (
      level.id.trim().length === 0
      || ids.has(level.id)
    ) {
      throw new Error(
        'Level v2 shadow evaluation comparable level ids must be unique and non-empty',
      );
    }

    ids.add(
      level.id,
    );

    if (
      level.symbol !== symbol
      || level.timeframe !== timeframe
    ) {
      throw new Error(
        'Level v2 shadow evaluation comparable level context does not match',
      );
    }

    if (
      level.kind !== 'support'
      && level.kind !== 'resistance'
    ) {
      throw new Error(
        'Level v2 shadow evaluation comparable level kind is invalid',
      );
    }

    if (
      !Number.isFinite(
        level.referencePrice,
      )
      || level.referencePrice <= 0
      || !Number.isFinite(
        level.zoneLow,
      )
      || !Number.isFinite(
        level.zoneHigh,
      )
      || level.zoneLow <= 0
      || level.zoneHigh < level.zoneLow
      || level.referencePrice
        < level.zoneLow
      || level.referencePrice
        > level.zoneHigh
    ) {
      throw new Error(
        'Level v2 shadow evaluation comparable level geometry is invalid',
      );
    }

    if (
      !Number.isInteger(
        level.touchesCount,
      )
      || level.touchesCount < 1
      || !Number.isFinite(
        level.score,
      )
      || level.score < 0
      || !LIFECYCLE_STATUSES.includes(
        level.status,
      )
    ) {
      throw new Error(
        'Level v2 shadow evaluation comparable level metrics are invalid',
      );
    }
  }
}

function distancePct(
  left: number,
  right: number,
): number {
  return (
    Math.abs(
      left - right,
    )
    / right
  ) * 100;
}

function zoneOverlapPct(
  v1:
    DetectedSetupLevel,
  v2:
    LevelV2ShadowComparableLevel,
): number {
  const intersection =
    Math.max(
      0,
      Math.min(
        v1.zoneHigh,
        v2.zoneHigh,
      )
      - Math.max(
          v1.zoneLow,
          v2.zoneLow,
        ),
    );

  const smallerWidth =
    Math.min(
      v1.zoneHigh
        - v1.zoneLow,
      v2.zoneHigh
        - v2.zoneLow,
    );

  if (
    smallerWidth <= 0
  ) {
    return intersection > 0
      ? 100
      : 0;
  }

  return round(
    Math.min(
      100,
      (
        intersection
        / smallerWidth
      ) * 100,
    ),
    6,
  );
}

function emptyLifecycleCounts():
LevelV2ShadowLifecycleStatusCounts {
  return {
    forming: 0,
    active: 0,
    testing: 0,
    broken: 0,
    retestPending: 0,
    flipped: 0,
    expired: 0,
  };
}

function incrementLifecycleCount(
  counts:
    LevelV2ShadowLifecycleStatusCounts,
  status:
    LevelV2LifecycleStatus,
): void {
  switch (status) {
    case 'forming':
      counts.forming += 1;
      return;

    case 'active':
      counts.active += 1;
      return;

    case 'testing':
      counts.testing += 1;
      return;

    case 'broken':
      counts.broken += 1;
      return;

    case 'retest_pending':
      counts.retestPending += 1;
      return;

    case 'flipped':
      counts.flipped += 1;
      return;

    case 'expired':
      counts.expired += 1;
      return;
  }
}

export function cloneLevelV2ShadowEvaluation(
  evaluation:
    LevelV2ShadowEvaluation,
): LevelV2ShadowEvaluation {
  return {
    summary: {
      ...evaluation.summary,
      lifecycleStatuses: {
        ...evaluation.summary
          .lifecycleStatuses,
      },
    },
    matches:
      evaluation.matches.map(
        (match) => ({
          ...match,
        }),
      ),
    v1OnlyLevels:
      evaluation.v1OnlyLevels.map(
        (level) => ({
          ...level,
        }),
      ),
    v2OnlyLevels:
      evaluation.v2OnlyLevels.map(
        (level) => ({
          ...level,
        }),
      ),
  };
}

export function evaluateLevelV2ShadowComparison(
  symbolValue: string,
  timeframeValue: string,
  candles:
    readonly SetupLevelDetectorCandle[],
  v2Levels:
    readonly LevelV2ShadowComparableLevel[],
  options:
    LevelV2ShadowEvaluationOptions =
      DEFAULT_LEVEL_V2_SHADOW_EVALUATION_OPTIONS,
): LevelV2ShadowEvaluation {
  const symbol =
    normalizeSymbol(
      symbolValue,
    );

  const timeframe =
    normalizeTimeframe(
      timeframeValue,
    );

  validateOptions(
    options,
  );

  validateComparableLevels(
    symbol,
    timeframe,
    v2Levels,
  );

  const v1Levels =
    detectSetupLevels(
      symbol,
      timeframe,
      candles,
      options.v1DetectorOptions,
    );

  const candidates:
  Array<{
    v1:
      DetectedSetupLevel;
    v2:
      LevelV2ShadowComparableLevel;
    distance: number;
  }> = [];

  for (
    const v1
    of v1Levels
  ) {
    for (
      const v2
      of v2Levels
    ) {
      if (
        v1.kind !== v2.kind
      ) {
        continue;
      }

      const distance =
        distancePct(
          v1.centerPrice,
          v2.referencePrice,
        );

      if (
        distance
        <= options
          .maxMatchDistancePct
      ) {
        candidates.push({
          v1,
          v2,
          distance,
        });
      }
    }
  }

  candidates.sort(
    (
      left,
      right,
    ) =>
      left.distance
      - right.distance
      || left.v1.id.localeCompare(
        right.v1.id,
      )
      || left.v2.id.localeCompare(
        right.v2.id,
      ),
  );

  const usedV1 =
    new Set<string>();

  const usedV2 =
    new Set<string>();

  const matches:
    LevelV2ShadowLevelMatch[] = [];

  for (
    const candidate
    of candidates
  ) {
    if (
      usedV1.has(
        candidate.v1.id,
      )
      || usedV2.has(
        candidate.v2.id,
      )
    ) {
      continue;
    }

    usedV1.add(
      candidate.v1.id,
    );

    usedV2.add(
      candidate.v2.id,
    );

    matches.push({
      v1LevelId:
        candidate.v1.id,
      v2LevelId:
        candidate.v2.id,
      kind:
        candidate.v1.kind,
      v1CenterPrice:
        candidate.v1
          .centerPrice,
      v2ReferencePrice:
        candidate.v2
          .referencePrice,
      distancePct:
        round(
          candidate.distance,
          8,
        ),
      zoneOverlapPct:
        zoneOverlapPct(
          candidate.v1,
          candidate.v2,
        ),
      v1TouchesCount:
        candidate.v1
          .touchesCount,
      v2TouchesCount:
        candidate.v2
          .touchesCount,
      v2Status:
        candidate.v2.status,
      v2EligibleForSetups:
        candidate.v2
          .eligibleForSetups,
      v2Score:
        candidate.v2.score,
    });
  }

  const v1OnlyLevels:
    LevelV2ShadowUnmatchedV1Level[] =
      v1Levels
        .filter(
          (level) =>
            !usedV1.has(
              level.id,
            ),
        )
        .map(
          (level) => ({
            id:
              level.id,
            kind:
              level.kind,
            centerPrice:
              level.centerPrice,
            touchesCount:
              level.touchesCount,
          }),
        );

  const v2OnlyLevels:
    LevelV2ShadowUnmatchedV2Level[] =
      v2Levels
        .filter(
          (level) =>
            !usedV2.has(
              level.id,
            ),
        )
        .map(
          (level) => ({
            id:
              level.id,
            kind:
              level.kind,
            referencePrice:
              level.referencePrice,
            touchesCount:
              level.touchesCount,
            status:
              level.status,
            eligibleForSetups:
              level
                .eligibleForSetups,
            score:
              level.score,
          }),
        );

  const lifecycleStatuses =
    emptyLifecycleCounts();

  for (
    const level
    of v2Levels
  ) {
    incrementLifecycleCount(
      lifecycleStatuses,
      level.status,
    );
  }

  const denominator =
    Math.max(
      v1Levels.length,
      v2Levels.length,
    );

  const meanMatchedDistancePct =
    matches.length === 0
      ? null
      : round(
          matches.reduce(
            (
              total,
              match,
            ) =>
              total
              + match.distancePct,
            0,
          )
          / matches.length,
          8,
        );

  return {
    summary: {
      v1LevelsCount:
        v1Levels.length,
      v2LevelsCount:
        v2Levels.length,
      matchedLevelsCount:
        matches.length,
      v1OnlyLevelsCount:
        v1OnlyLevels.length,
      v2OnlyLevelsCount:
        v2OnlyLevels.length,
      setupEligibleV2LevelsCount:
        v2Levels.filter(
          (level) =>
            level.eligibleForSetups,
        ).length,
      matchRatePct:
        denominator === 0
          ? 100
          : round(
              (
                matches.length
                / denominator
              ) * 100,
              6,
            ),
      meanMatchedDistancePct,
      lifecycleStatuses,
    },
    matches,
    v1OnlyLevels,
    v2OnlyLevels,
  };
}
