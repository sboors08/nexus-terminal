import type {
  LevelV2ShadowEvaluationSummary,
} from './level-v2-shadow-evaluation.types.js';
import type {
  LevelV2LifecycleStatus,
} from './level-v2-lifecycle.types.js';
import type {
  LevelV2ShadowSnapshot,
} from './level-v2-shadow-runtime.types.js';
import type {
  LevelV2ShadowHistoryChanges,
  LevelV2ShadowHistoryEntry,
  LevelV2ShadowHistoryLevelState,
  LevelV2ShadowHistoryLifecycleTransition,
  LevelV2ShadowHistoryOptions,
  LevelV2ShadowHistoryStatus,
} from './level-v2-shadow-history.types.js';

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

export const DEFAULT_LEVEL_V2_SHADOW_HISTORY_OPTIONS:
LevelV2ShadowHistoryOptions = {
  maxEntriesPerSymbol:
    60,
  maxTotalEntries:
    30_000,
};

interface StoredHistoryEntry {
  entry:
    LevelV2ShadowHistoryEntry;
  fingerprint: string;
}

function validatePositiveInteger(
  value: number,
  name: string,
): void {
  if (
    !Number.isInteger(value)
    || value <= 0
  ) {
    throw new Error(
      `Level v2 shadow history ${name} must be a positive integer`,
    );
  }
}

function validateOptions(
  options:
    LevelV2ShadowHistoryOptions,
): void {
  validatePositiveInteger(
    options.maxEntriesPerSymbol,
    'maxEntriesPerSymbol',
  );

  validatePositiveInteger(
    options.maxTotalEntries,
    'maxTotalEntries',
  );

  if (
    options.maxTotalEntries
    < options.maxEntriesPerSymbol
  ) {
    throw new Error(
      'Level v2 shadow history maxTotalEntries cannot be smaller than maxEntriesPerSymbol',
    );
  }
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
      `Invalid Level v2 shadow history symbol: ${value}`,
    );
  }

  return symbol;
}

function validateLimit(
  value: number,
): void {
  if (
    !Number.isInteger(value)
    || value <= 0
    || value > 10_000
  ) {
    throw new Error(
      'Level v2 shadow history limit must be an integer from one to ten thousand',
    );
  }
}

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

function emptyStatusCounts():
Record<
  LevelV2LifecycleStatus,
  number
> {
  return {
    forming: 0,
    active: 0,
    testing: 0,
    broken: 0,
    retest_pending: 0,
    flipped: 0,
    expired: 0,
  };
}

function cloneEvaluationSummary(
  summary:
    LevelV2ShadowEvaluationSummary,
): LevelV2ShadowEvaluationSummary {
  return {
    ...summary,
    lifecycleStatuses: {
      ...summary.lifecycleStatuses,
    },
  };
}

function cloneLevelState(
  level:
    LevelV2ShadowHistoryLevelState,
): LevelV2ShadowHistoryLevelState {
  return {
    ...level,
  };
}

function cloneTransition(
  transition:
    LevelV2ShadowHistoryLifecycleTransition,
): LevelV2ShadowHistoryLifecycleTransition {
  return {
    ...transition,
  };
}

function cloneChanges(
  changes:
    LevelV2ShadowHistoryChanges,
): LevelV2ShadowHistoryChanges {
  return {
    ...changes,
    addedLevelIds: [
      ...changes.addedLevelIds,
    ],
    removedLevelIds: [
      ...changes.removedLevelIds,
    ],
    lifecycleTransitions:
      changes.lifecycleTransitions.map(
        cloneTransition,
      ),
  };
}

function cloneEntry(
  entry:
    LevelV2ShadowHistoryEntry,
): LevelV2ShadowHistoryEntry {
  return {
    ...entry,
    evaluationSummary:
      cloneEvaluationSummary(
        entry.evaluationSummary,
      ),
    lifecycleStatusCounts: {
      ...entry.lifecycleStatusCounts,
    },
    levels:
      entry.levels.map(
        cloneLevelState,
      ),
    changes:
      cloneChanges(
        entry.changes,
      ),
  };
}

function toLifecycleStatusCounts(
  snapshot:
    LevelV2ShadowSnapshot,
):
Record<
  LevelV2LifecycleStatus,
  number
> {
  const counts =
    emptyStatusCounts();

  for (
    const level
    of snapshot.levels
  ) {
    counts[
      level.status
    ] += 1;
  }

  return counts;
}

function toLevelStates(
  snapshot:
    LevelV2ShadowSnapshot,
):
LevelV2ShadowHistoryLevelState[] {
  return snapshot.levels
    .map(
      (state) => ({
        id:
          state.level.id,
        kind:
          state.currentKind,
        status:
          state.status,
        eligibleForSetups:
          state.eligibleForSetups,
        referencePrice:
          state.level.zone
            .referencePrice,
        score:
          state.level.score.total,
        touchesCount:
          state.level.touchesCount,
        qualifiedTouchesCount:
          state.qualifiedTouchesCount,
      }),
    )
    .sort(
      (
        left,
        right,
      ) =>
        left.id.localeCompare(
          right.id,
        ),
    );
}

function toFingerprint(
  snapshot:
    LevelV2ShadowSnapshot,
  levelStates:
    readonly LevelV2ShadowHistoryLevelState[],
): string {
  return JSON.stringify({
    closedCandlesCount:
      snapshot.closedCandlesCount,
    detectedZonesCount:
      snapshot.detectedZonesCount,
    rejectedZonesCount:
      snapshot.rejectedZonesCount,
    rejectionCounts:
      snapshot.rejectionCounts,
    evaluationSummary:
      snapshot.evaluation.summary,
    levels:
      levelStates,
  });
}

function buildChanges(
  previous:
    LevelV2ShadowHistoryEntry
    | null,
  levelStates:
    readonly LevelV2ShadowHistoryLevelState[],
  matchRatePct: number,
  eligibleLevelsCount: number,
):
LevelV2ShadowHistoryChanges {
  if (!previous) {
    return {
      previousEntryId:
        null,
      addedLevelIds:
        levelStates.map(
          (level) =>
            level.id,
        ),
      removedLevelIds: [],
      lifecycleTransitions: [],
      matchRateDeltaPct:
        null,
      eligibleLevelsDelta:
        null,
    };
  }

  const previousLevels =
    new Map(
      previous.levels.map(
        (level) => [
          level.id,
          level,
        ] as const,
      ),
    );

  const currentLevels =
    new Map(
      levelStates.map(
        (level) => [
          level.id,
          level,
        ] as const,
      ),
    );

  const addedLevelIds =
    levelStates
      .filter(
        (level) =>
          !previousLevels.has(
            level.id,
          ),
      )
      .map(
        (level) =>
          level.id,
      );

  const removedLevelIds =
    previous.levels
      .filter(
        (level) =>
          !currentLevels.has(
            level.id,
          ),
      )
      .map(
        (level) =>
          level.id,
      );

  const lifecycleTransitions:
    LevelV2ShadowHistoryLifecycleTransition[] = [];

  for (
    const level
    of levelStates
  ) {
    const before =
      previousLevels.get(
        level.id,
      );

    if (
      !before
      || (
        before.status
          === level.status
        && before.eligibleForSetups
          === level.eligibleForSetups
      )
    ) {
      continue;
    }

    lifecycleTransitions.push({
      levelId:
        level.id,
      fromStatus:
        before.status,
      toStatus:
        level.status,
      eligibleBefore:
        before.eligibleForSetups,
      eligibleAfter:
        level.eligibleForSetups,
    });
  }

  return {
    previousEntryId:
      previous.id,
    addedLevelIds,
    removedLevelIds,
    lifecycleTransitions,
    matchRateDeltaPct:
      round(
        matchRatePct
        - previous
          .evaluationSummary
          .matchRatePct,
      ),
    eligibleLevelsDelta:
      eligibleLevelsCount
      - previous
        .eligibleLevelsCount,
  };
}

function toEvaluationSummary(
  snapshot:
    LevelV2ShadowSnapshot,
):
LevelV2ShadowEvaluationSummary {
  return cloneEvaluationSummary(
    snapshot.evaluation.summary,
  );
}

export class LevelV2ShadowHistoryStore {
  private readonly entriesBySymbol =
    new Map<
      string,
      StoredHistoryEntry[]
    >();

  private sequence = 0;
  private entriesCount = 0;
  private droppedEntriesCount = 0;
  private deduplicatedEntriesCount = 0;

  constructor(
    private readonly options:
      LevelV2ShadowHistoryOptions =
        DEFAULT_LEVEL_V2_SHADOW_HISTORY_OPTIONS,
  ) {
    validateOptions(
      options,
    );
  }

  record(
    snapshot:
      LevelV2ShadowSnapshot,
  ):
  LevelV2ShadowHistoryEntry
  | null {
    const symbol =
      normalizeSymbol(
        snapshot.symbol,
      );

    const levelStates =
      toLevelStates(
        snapshot,
      );

    const fingerprint =
      toFingerprint(
        snapshot,
        levelStates,
      );

    const entries =
      this.entriesBySymbol.get(
        symbol,
      )
      ?? [];

    const previousStored =
      entries.at(-1)
      ?? null;

    if (
      previousStored
      && previousStored
        .fingerprint
        === fingerprint
    ) {
      this.deduplicatedEntriesCount += 1;
      return null;
    }

    const previous =
      previousStored?.entry
      ?? null;

    const eligibleLevelsCount =
      levelStates.filter(
        (level) =>
          level.eligibleForSetups,
      ).length;

    this.sequence += 1;

    const entry:
    LevelV2ShadowHistoryEntry = {
      id:
        `${symbol}:level-v2-shadow-history:${this.sequence}`,
      sequence:
        this.sequence,
      symbol,
      timeframe:
        '1m',
      generatedAt:
        snapshot.generatedAt,
      triggerSource:
        snapshot.triggerSource,
      sourceCandlesCount:
        snapshot.sourceCandlesCount,
      closedCandlesCount:
        snapshot.closedCandlesCount,
      detectedZonesCount:
        snapshot.detectedZonesCount,
      rejectedZonesCount:
        snapshot.rejectedZonesCount,
      levelsCount:
        levelStates.length,
      eligibleLevelsCount,
      evaluationSummary:
        toEvaluationSummary(
          snapshot,
        ),
      lifecycleStatusCounts:
        toLifecycleStatusCounts(
          snapshot,
        ),
      levels:
        levelStates,
      changes:
        buildChanges(
          previous,
          levelStates,
          snapshot.evaluation
            .summary.matchRatePct,
          eligibleLevelsCount,
        ),
    };

    entries.push({
      entry:
        cloneEntry(
          entry,
        ),
      fingerprint,
    });

    this.entriesBySymbol.set(
      symbol,
      entries,
    );

    this.entriesCount += 1;

    while (
      entries.length
      > this.options
        .maxEntriesPerSymbol
    ) {
      entries.shift();
      this.entriesCount -= 1;
      this.droppedEntriesCount += 1;
    }

    this.trimGlobalLimit();

    return cloneEntry(
      entry,
    );
  }

  getHistory(
    symbolValue?: string,
    limit = 100,
  ):
  LevelV2ShadowHistoryEntry[] {
    validateLimit(
      limit,
    );

    const values =
      symbolValue === undefined
        ? [
            ...this.entriesBySymbol
              .values(),
          ].flat()
        : [
            ...(
              this.entriesBySymbol.get(
                normalizeSymbol(
                  symbolValue,
                ),
              )
              ?? []
            ),
          ];

    return values
      .sort(
        (
          left,
          right,
        ) =>
          right.entry.sequence
          - left.entry.sequence,
      )
      .slice(
        0,
        limit,
      )
      .map(
        (stored) =>
          cloneEntry(
            stored.entry,
          ),
      );
  }

  getStatus():
  LevelV2ShadowHistoryStatus {
    const allEntries = [
      ...this.entriesBySymbol
        .values(),
    ]
      .flat()
      .sort(
        (
          left,
          right,
        ) =>
          left.entry.sequence
          - right.entry.sequence,
      );

    return {
      entriesCount:
        this.entriesCount,
      symbolsCount:
        this.entriesBySymbol.size,
      maxEntriesPerSymbol:
        this.options
          .maxEntriesPerSymbol,
      maxTotalEntries:
        this.options
          .maxTotalEntries,
      droppedEntriesCount:
        this.droppedEntriesCount,
      deduplicatedEntriesCount:
        this.deduplicatedEntriesCount,
      oldestGeneratedAt:
        allEntries[0]
          ?.entry.generatedAt
        ?? null,
      latestGeneratedAt:
        allEntries.at(-1)
          ?.entry.generatedAt
        ?? null,
    };
  }

  private trimGlobalLimit():
  void {
    while (
      this.entriesCount
      > this.options
        .maxTotalEntries
    ) {
      let oldestSymbol:
        string
        | null = null;

      let oldestSequence =
        Number.POSITIVE_INFINITY;

      for (
        const [
          symbol,
          entries,
        ]
        of this.entriesBySymbol
      ) {
        const sequence =
          entries[0]
            ?.entry.sequence;

        if (
          sequence !== undefined
          && sequence
            < oldestSequence
        ) {
          oldestSequence =
            sequence;
          oldestSymbol =
            symbol;
        }
      }

      if (!oldestSymbol) {
        return;
      }

      const entries =
        this.entriesBySymbol.get(
          oldestSymbol,
        );

      entries?.shift();
      this.entriesCount -= 1;
      this.droppedEntriesCount += 1;

      if (
        entries
        && entries.length === 0
      ) {
        this.entriesBySymbol.delete(
          oldestSymbol,
        );
      }
    }
  }
}
