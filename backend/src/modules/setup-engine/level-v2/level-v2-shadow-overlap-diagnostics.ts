import type {
  LevelV2LifecycleState,
} from './level-v2-lifecycle.types.js';
import type {
  LevelV2ShadowHistoryEntry,
} from './level-v2-shadow-history.types.js';
import type {
  LevelV2ShadowRuntimeReader,
  LevelV2ShadowSnapshot,
} from './level-v2-shadow-runtime.types.js';
import type {
  LevelV2ShadowOverlapDiagnostics,
  LevelV2ShadowOverlapDiagnosticsOptions,
  LevelV2ShadowOverlapHistoryEvidence,
  LevelV2ShadowOverlapLevelSummary,
  LevelV2ShadowOverlapPair,
  LevelV2ShadowOverlapRelationship,
} from './level-v2-shadow-overlap-diagnostics.types.js';

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

export const DEFAULT_LEVEL_V2_SHADOW_OVERLAP_DIAGNOSTICS_OPTIONS:
LevelV2ShadowOverlapDiagnosticsOptions = {
  symbol:
    null,
  maxReferenceDistancePct:
    0.2,
  minOverlapPct:
    50,
  includeOppositeKind:
    true,
  onlyReviewCandidates:
    false,
  limit:
    100,
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

function normalizeOptions(
  values:
    Partial<
      LevelV2ShadowOverlapDiagnosticsOptions
    >,
):
LevelV2ShadowOverlapDiagnosticsOptions {
  const options = {
    ...DEFAULT_LEVEL_V2_SHADOW_OVERLAP_DIAGNOSTICS_OPTIONS,
    ...values,
  };

  if (
    options.symbol !== null
    && !SYMBOL_PATTERN.test(
      options.symbol,
    )
  ) {
    throw new Error(
      `Invalid Level v2 shadow overlap diagnostics symbol: ${options.symbol}`,
    );
  }

  if (
    !Number.isFinite(
      options.maxReferenceDistancePct,
    )
    || options.maxReferenceDistancePct < 0
    || options.maxReferenceDistancePct > 5
  ) {
    throw new Error(
      'Level v2 shadow overlap maxReferenceDistancePct must be between zero and five',
    );
  }

  if (
    !Number.isFinite(
      options.minOverlapPct,
    )
    || options.minOverlapPct < 0
    || options.minOverlapPct > 100
  ) {
    throw new Error(
      'Level v2 shadow overlap minOverlapPct must be between zero and one hundred',
    );
  }

  if (
    typeof options.includeOppositeKind
    !== 'boolean'
  ) {
    throw new Error(
      'Level v2 shadow overlap includeOppositeKind must be boolean',
    );
  }

  if (
    typeof options.onlyReviewCandidates
    !== 'boolean'
  ) {
    throw new Error(
      'Level v2 shadow overlap onlyReviewCandidates must be boolean',
    );
  }

  if (
    !Number.isInteger(
      options.limit,
    )
    || options.limit < 1
    || options.limit > 500
  ) {
    throw new Error(
      'Level v2 shadow overlap limit must be an integer from one to five hundred',
    );
  }

  return options;
}

function summarizeLevel(
  state:
    LevelV2LifecycleState,
):
LevelV2ShadowOverlapLevelSummary {
  return {
    id:
      state.level.id,
    originalKind:
      state.originalKind,
    currentKind:
      state.currentKind,
    status:
      state.status,
    eligibleForSetups:
      state.eligibleForSetups,
    referencePrice:
      state.level.zone
        .referencePrice,
    coreLow:
      state.level.zone.coreLow,
    coreHigh:
      state.level.zone.coreHigh,
    outerLow:
      state.level.zone.outerLow,
    outerHigh:
      state.level.zone.outerHigh,
    liquidityLow:
      state.level.zone.liquidityLow,
    liquidityHigh:
      state.level.zone.liquidityHigh,
    score:
      state.level.score.total,
    touchesCount:
      state.level.touchesCount,
    qualifiedTouchesCount:
      state.qualifiedTouchesCount,
  };
}

function referenceDistancePct(
  left: number,
  right: number,
): number {
  const denominator =
    Math.max(
      (
        Math.abs(left)
        + Math.abs(right)
      ) / 2,
      Number.EPSILON,
    );

  return round(
    Math.abs(
      left - right,
    ) / denominator * 100,
  );
}

function overlapPct(
  leftLow: number,
  leftHigh: number,
  rightLow: number,
  rightHigh: number,
): number {
  const intersection =
    Math.max(
      0,
      Math.min(
        leftHigh,
        rightHigh,
      )
      - Math.max(
          leftLow,
          rightLow,
        ),
    );

  const leftWidth =
    Math.max(
      0,
      leftHigh - leftLow,
    );

  const rightWidth =
    Math.max(
      0,
      rightHigh - rightLow,
    );

  const denominator =
    Math.min(
      leftWidth,
      rightWidth,
    );

  if (denominator <= 0) {
    return intersection === 0
      && leftLow === rightLow
      && leftHigh === rightHigh
        ? 100
        : 0;
  }

  return round(
    Math.min(
      100,
      intersection
      / denominator
      * 100,
    ),
  );
}

function gapPct(
  left:
    LevelV2ShadowOverlapLevelSummary,
  right:
    LevelV2ShadowOverlapLevelSummary,
): number {
  if (
    left.outerLow <= right.outerHigh
    && right.outerLow <= left.outerHigh
  ) {
    return 0;
  }

  const gap =
    left.outerHigh < right.outerLow
      ? right.outerLow
        - left.outerHigh
      : left.outerLow
        - right.outerHigh;

  const denominator =
    Math.max(
      (
        Math.abs(
          left.referencePrice,
        )
        + Math.abs(
            right.referencePrice,
          )
      ) / 2,
      Number.EPSILON,
    );

  return round(
    gap / denominator * 100,
  );
}

function relationship(
  sameKind: boolean,
  coreOverlapPct: number,
  outerOverlapPct: number,
):
LevelV2ShadowOverlapRelationship {
  if (sameKind) {
    if (coreOverlapPct > 0) {
      return 'same_kind_core_overlap';
    }

    if (outerOverlapPct > 0) {
      return 'same_kind_outer_overlap';
    }

    return 'same_kind_nearby';
  }

  if (coreOverlapPct > 0) {
    return 'opposite_kind_core_overlap';
  }

  if (outerOverlapPct > 0) {
    return 'opposite_kind_outer_overlap';
  }

  return 'opposite_kind_nearby';
}

function emptyRelationshipCounts():
Record<
  LevelV2ShadowOverlapRelationship,
  number
> {
  return {
    same_kind_core_overlap: 0,
    same_kind_outer_overlap: 0,
    same_kind_nearby: 0,
    opposite_kind_core_overlap: 0,
    opposite_kind_outer_overlap: 0,
    opposite_kind_nearby: 0,
  };
}

function historyEvidence(
  entries:
    readonly LevelV2ShadowHistoryEntry[],
  leftId: string,
  rightId: string,
  available: boolean,
):
LevelV2ShadowOverlapHistoryEvidence {
  if (!available) {
    return {
      available:
        false,
      entriesChecked:
        0,
      occurrencesCount:
        0,
      persistencePct:
        null,
      firstSeenAt:
        null,
      lastSeenAt:
        null,
    };
  }

  const matching =
    entries.filter(
      (entry) => {
        const ids =
          new Set(
            entry.levels.map(
              (level) =>
                level.id,
            ),
          );

        return ids.has(
          leftId,
        )
        && ids.has(
          rightId,
        );
      },
    );

  const timestamps =
    matching
      .map(
        (entry) =>
          entry.generatedAt,
      )
      .sort(
        (
          left,
          right,
        ) =>
          Date.parse(left)
          - Date.parse(right),
      );

  return {
    available:
      true,
    entriesChecked:
      entries.length,
    occurrencesCount:
      matching.length,
    persistencePct:
      entries.length > 0
        ? round(
            matching.length
            / entries.length
            * 100,
          )
        : 0,
    firstSeenAt:
      timestamps[0]
      ?? null,
    lastSeenAt:
      timestamps.at(-1)
      ?? null,
  };
}

function reviewPriority(
  values: {
    duplicateCandidate: boolean;
    conflictCandidate: boolean;
    sameKind: boolean;
    bothEligibleForSetups: boolean;
    sameStatus: boolean;
    referenceDistancePct: number;
    coreOverlapPct: number;
    outerOverlapPct: number;
    maxReferenceDistancePct: number;
  },
): number {
  const proximityRatio =
    values.maxReferenceDistancePct === 0
      ? (
          values.referenceDistancePct
            === 0
            ? 1
            : 0
        )
      : Math.max(
          0,
          1
          - values.referenceDistancePct
            / values.maxReferenceDistancePct,
        );

  const overlapRatio =
    Math.max(
      values.coreOverlapPct,
      values.outerOverlapPct,
    ) / 100;

  const score =
    (
      values.duplicateCandidate
        ? 40
        : 0
    )
    + (
      values.conflictCandidate
        ? 35
        : 0
    )
    + (
      values.sameKind
        ? 10
        : 0
    )
    + (
      values.bothEligibleForSetups
        ? 10
        : 0
    )
    + (
      values.sameStatus
        ? 5
        : 0
    )
    + proximityRatio * 15
    + overlapRatio * 20;

  return round(
    Math.min(
      100,
      score,
    ),
  );
}

function latestGeneratedAt(
  snapshots:
    readonly LevelV2ShadowSnapshot[],
):
string
| null {
  return snapshots
    .map(
      (snapshot) =>
        snapshot.generatedAt,
    )
    .sort(
      (
        left,
        right,
      ) =>
        Date.parse(left)
        - Date.parse(right),
    )
    .at(-1)
    ?? null;
}

export function buildLevelV2ShadowOverlapDiagnostics(
  runtime:
    LevelV2ShadowRuntimeReader,
  values:
    Partial<
      LevelV2ShadowOverlapDiagnosticsOptions
    > = {},
):
LevelV2ShadowOverlapDiagnostics {
  const options =
    normalizeOptions(
      values,
    );

  const snapshots =
    runtime.getSnapshots()
      .filter(
        (snapshot) =>
          options.symbol === null
          || snapshot.symbol
            === options.symbol,
      )
      .sort(
        (
          left,
          right,
        ) =>
          left.symbol.localeCompare(
            right.symbol,
          ),
      );

  const historyReader =
    runtime.getEvaluationHistory
      ?.bind(runtime);

  const historyStatusReader =
    runtime.getEvaluationHistoryStatus
      ?.bind(runtime);

  const historyAvailable =
    typeof historyReader
      === 'function';

  const historyLimit =
    historyAvailable
      ? (
          historyStatusReader
            ?.()
            .maxEntriesPerSymbol
          ?? 100
        )
      : 0;

  const historyBySymbol =
    new Map<
      string,
      LevelV2ShadowHistoryEntry[]
    >();

  let historyEntriesChecked = 0;

  if (historyReader) {
    for (
      const snapshot
      of snapshots
    ) {
      const entries =
        historyReader(
          snapshot.symbol,
          historyLimit,
        );

      historyBySymbol.set(
        snapshot.symbol,
        entries,
      );

      historyEntriesChecked +=
        entries.length;
    }
  }

  const relationshipCounts =
    emptyRelationshipCounts();

  const symbolsWithQualifyingPairs =
    new Set<string>();

  const pairs:
    LevelV2ShadowOverlapPair[] = [];

  let levelsAnalyzed = 0;
  let pairsEvaluated = 0;
  let sameKindPairsCount = 0;
  let oppositeKindPairsCount = 0;
  let bothEligiblePairsCount = 0;
  let duplicateCandidatesCount = 0;
  let conflictCandidatesCount = 0;

  for (
    const snapshot
    of snapshots
  ) {
    const levels =
      snapshot.levels
        .map(
          summarizeLevel,
        )
        .sort(
          (
            left,
            right,
          ) =>
            left.referencePrice
            - right.referencePrice
            || left.id.localeCompare(
              right.id,
            ),
        );

    levelsAnalyzed +=
      levels.length;

    const history =
      historyBySymbol.get(
        snapshot.symbol,
      )
      ?? [];

    for (
      let leftIndex = 0;
      leftIndex < levels.length;
      leftIndex += 1
    ) {
      const left =
        levels[leftIndex];

      if (!left) {
        continue;
      }

      for (
        let rightIndex =
          leftIndex + 1;
        rightIndex < levels.length;
        rightIndex += 1
      ) {
        const right =
          levels[rightIndex];

        if (!right) {
          continue;
        }

        const sameKind =
          left.currentKind
          === right.currentKind;

        if (
          !sameKind
          && !options
            .includeOppositeKind
        ) {
          continue;
        }

        pairsEvaluated += 1;

        const distance =
          referenceDistancePct(
            left.referencePrice,
            right.referencePrice,
          );

        const coreOverlap =
          overlapPct(
            left.coreLow,
            left.coreHigh,
            right.coreLow,
            right.coreHigh,
          );

        const outerOverlap =
          overlapPct(
            left.outerLow,
            left.outerHigh,
            right.outerLow,
            right.outerHigh,
          );

        if (
          distance
            > options
              .maxReferenceDistancePct
          && outerOverlap === 0
        ) {
          continue;
        }

        const bothEligibleForSetups =
          left.eligibleForSetups
          && right.eligibleForSetups;

        const overlapAtThreshold =
          coreOverlap
            >= options.minOverlapPct
          || outerOverlap
            >= options.minOverlapPct;

        const duplicateCandidate =
          sameKind
          && overlapAtThreshold;

        const conflictCandidate =
          !sameKind
          && bothEligibleForSetups
          && overlapAtThreshold;

        if (
          options.onlyReviewCandidates
          && !duplicateCandidate
          && !conflictCandidate
        ) {
          continue;
        }

        const pairRelationship =
          relationship(
            sameKind,
            coreOverlap,
            outerOverlap,
          );

        relationshipCounts[
          pairRelationship
        ] += 1;

        if (sameKind) {
          sameKindPairsCount += 1;
        } else {
          oppositeKindPairsCount += 1;
        }

        if (bothEligibleForSetups) {
          bothEligiblePairsCount += 1;
        }

        if (duplicateCandidate) {
          duplicateCandidatesCount += 1;
        }

        if (conflictCandidate) {
          conflictCandidatesCount += 1;
        }

        symbolsWithQualifyingPairs.add(
          snapshot.symbol,
        );

        const orderedIds = [
          left.id,
          right.id,
        ].sort();

        pairs.push({
          id:
            `${snapshot.symbol}:level-v2-overlap:${orderedIds[0]}|${orderedIds[1]}`,
          symbol:
            snapshot.symbol,
          relationship:
            pairRelationship,
          sameKind,
          bothEligibleForSetups,
          duplicateCandidate,
          conflictCandidate,
          reviewPriority:
            reviewPriority({
              duplicateCandidate,
              conflictCandidate,
              sameKind,
              bothEligibleForSetups,
              sameStatus:
                left.status
                === right.status,
              referenceDistancePct:
                distance,
              coreOverlapPct:
                coreOverlap,
              outerOverlapPct:
                outerOverlap,
              maxReferenceDistancePct:
                options
                  .maxReferenceDistancePct,
            }),
          referenceDistancePct:
            distance,
          coreOverlapPct:
            coreOverlap,
          outerOverlapPct:
            outerOverlap,
          outerGapPct:
            gapPct(
              left,
              right,
            ),
          left,
          right,
          history:
            historyEvidence(
              history,
              left.id,
              right.id,
              historyAvailable,
            ),
        });
      }
    }
  }

  pairs.sort(
    (
      left,
      right,
    ) =>
      right.reviewPriority
      - left.reviewPriority
      || right.history
        .occurrencesCount
        - left.history
          .occurrencesCount
      || left.referenceDistancePct
        - right.referenceDistancePct
      || left.symbol.localeCompare(
        right.symbol,
      )
      || left.id.localeCompare(
        right.id,
      ),
  );

  const items =
    pairs.slice(
      0,
      options.limit,
    );

  return {
    generatedAt:
      latestGeneratedAt(
        snapshots,
      ),
    options,
    summary: {
      snapshotsAnalyzed:
        snapshots.length,
      levelsAnalyzed,
      pairsEvaluated,
      qualifyingPairsCount:
        pairs.length,
      returnedPairsCount:
        items.length,
      symbolsWithQualifyingPairsCount:
        symbolsWithQualifyingPairs.size,
      sameKindPairsCount,
      oppositeKindPairsCount,
      bothEligiblePairsCount,
      duplicateCandidatesCount,
      conflictCandidatesCount,
      historyAvailable,
      historyEntriesChecked,
      relationshipCounts,
    },
    items,
  };
}
