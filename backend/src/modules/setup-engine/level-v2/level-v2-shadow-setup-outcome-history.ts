import type {
  LevelV2ShadowMarketEvidenceHistoryEntry,
  LevelV2ShadowMarketEvidenceHistoryStatus,
} from './level-v2-shadow-market-evidence-history.types.js';
import type {
  LevelV2LifecycleState,
} from './level-v2-lifecycle.types.js';
import {
  buildLevelV2ShadowSetupOutcomeObservationSnapshot,
  cloneLevelV2ShadowSetupOutcomeObservation,
  DEFAULT_LEVEL_V2_SHADOW_SETUP_OUTCOME_OBSERVATION_OPTIONS,
} from './level-v2-shadow-setup-outcome-observation.js';
import type {
  LevelV2ShadowSetupOutcomeObservation,
  LevelV2ShadowSetupOutcomeObservationOptions,
  LevelV2ShadowSetupOutcomeStatusCounts,
} from './level-v2-shadow-setup-outcome-observation.types.js';
import type {
  LevelV2ShadowSetupOutcomeHistoryChanges,
  LevelV2ShadowSetupOutcomeHistoryDiagnostics,
  LevelV2ShadowSetupOutcomeHistoryEntry,
  LevelV2ShadowSetupOutcomeHistoryOptions,
  LevelV2ShadowSetupOutcomeHistoryStatus,
} from './level-v2-shadow-setup-outcome-history.types.js';

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const CLASSIFIER_ID_PATTERN =
  /^[A-Za-z0-9:._-]{1,320}$/;

export const DEFAULT_LEVEL_V2_SHADOW_SETUP_OUTCOME_HISTORY_OPTIONS:
LevelV2ShadowSetupOutcomeHistoryOptions = {
  maxEntriesPerClassifier:
    120,
  maxTotalEntries:
    100_000,
};

interface StoredEntry {
  entry:
    LevelV2ShadowSetupOutcomeHistoryEntry;
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
      `Level v2 shadow setup outcome history ${name} must be a positive integer`,
    );
  }
}

function validateOptions(
  options:
    LevelV2ShadowSetupOutcomeHistoryOptions,
): void {
  validatePositiveInteger(
    options.maxEntriesPerClassifier,
    'maxEntriesPerClassifier',
  );
  validatePositiveInteger(
    options.maxTotalEntries,
    'maxTotalEntries',
  );

  if (
    options.maxTotalEntries
    < options.maxEntriesPerClassifier
  ) {
    throw new Error(
      'Level v2 shadow setup outcome history maxTotalEntries cannot be smaller than maxEntriesPerClassifier',
    );
  }
}

function normalizeSymbol(
  value: string,
): string {
  const symbol =
    value.trim().toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new Error(
      `Invalid Level v2 shadow setup outcome history symbol: ${value}`,
    );
  }

  return symbol;
}

function normalizeClassifierId(
  value: string,
): string {
  const classifierId =
    value.trim();

  if (
    !CLASSIFIER_ID_PATTERN.test(
      classifierId,
    )
  ) {
    throw new Error(
      `Invalid Level v2 shadow setup outcome history classifier id: ${value}`,
    );
  }

  return classifierId;
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
      'Level v2 shadow setup outcome history limit must be an integer from one to ten thousand',
    );
  }
}

function roundMetric(
  value: number,
): number {
  return Number(
    value.toFixed(8),
  );
}

function latestPriceChangePct(
  observation:
    LevelV2ShadowSetupOutcomeObservation,
): number {
  return roundMetric(
    (
      observation.latestPrice
      - observation.entryPrice
    )
    / observation.entryPrice
    * 100,
  );
}

function sameStrings(
  left:
    readonly string[],
  right:
    readonly string[],
): boolean {
  return left.length === right.length
    && left.every(
      (
        value,
        index,
      ) =>
        value === right[index],
    );
}

function cloneChanges(
  changes:
    LevelV2ShadowSetupOutcomeHistoryChanges,
): LevelV2ShadowSetupOutcomeHistoryChanges {
  return {
    ...changes,
  };
}

function cloneEntry(
  entry:
    LevelV2ShadowSetupOutcomeHistoryEntry,
): LevelV2ShadowSetupOutcomeHistoryEntry {
  return {
    ...entry,
    observation:
      cloneLevelV2ShadowSetupOutcomeObservation(
        entry.observation,
      ),
    changes:
      cloneChanges(
        entry.changes,
      ),
  };
}

function fingerprint(
  observation:
    LevelV2ShadowSetupOutcomeObservation,
  priceChangePct: number,
): string {
  return JSON.stringify({
    classifierId:
      observation.classifierId,
    anchorCandidateHistoryEntryId:
      observation
        .anchorCandidateHistoryEntryId,
    status:
      observation.status,
    latestPrice:
      observation.latestPrice,
    latestPriceAt:
      observation.latestPriceAt,
    latestPriceChangePct:
      priceChangePct,
    observedPricesCount:
      observation.observedPricesCount,
    observationWindowElapsed:
      observation.observationWindowElapsed,
    maxFavorableExcursionPct:
      observation
        .maxFavorableExcursionPct,
    maxAdverseExcursionPct:
      observation
        .maxAdverseExcursionPct,
    maxFavorablePrice:
      observation.maxFavorablePrice,
    maxAdversePrice:
      observation.maxAdversePrice,
    continuationReached:
      observation.continuationReached,
    continuationReachedAt:
      observation.continuationReachedAt,
    adverseThresholdReached:
      observation.adverseThresholdReached,
    adverseThresholdReachedAt:
      observation.adverseThresholdReachedAt,
    returnedInsideLevel:
      observation.returnedInsideLevel,
    returnedInsideLevelAt:
      observation.returnedInsideLevelAt,
    failureConditionReached:
      observation.failureConditionReached,
    failureConditionReachedAt:
      observation.failureConditionReachedAt,
    resolvedAt:
      observation.resolvedAt,
    timeToOutcomeMs:
      observation.timeToOutcomeMs,
    reasons:
      observation.reasons,
  });
}

function buildChanges(
  previous:
    LevelV2ShadowSetupOutcomeHistoryEntry
    | null,
  observation:
    LevelV2ShadowSetupOutcomeObservation,
  priceChangePct: number,
): LevelV2ShadowSetupOutcomeHistoryChanges {
  const previousObservation =
    previous?.observation
    ?? null;

  return {
    previousEntryId:
      previous?.id
      ?? null,
    statusBefore:
      previousObservation?.status
      ?? null,
    statusAfter:
      observation.status,
    latestPriceBefore:
      previousObservation?.latestPrice
      ?? null,
    latestPriceAfter:
      observation.latestPrice,
    latestPriceChangePctBefore:
      previous?.latestPriceChangePct
      ?? null,
    latestPriceChangePctAfter:
      priceChangePct,
    maxFavorableExcursionPctBefore:
      previousObservation
        ?.maxFavorableExcursionPct
      ?? null,
    maxFavorableExcursionPctAfter:
      observation
        .maxFavorableExcursionPct,
    maxAdverseExcursionPctBefore:
      previousObservation
        ?.maxAdverseExcursionPct
      ?? null,
    maxAdverseExcursionPctAfter:
      observation
        .maxAdverseExcursionPct,
    observedPricesCountBefore:
      previousObservation
        ?.observedPricesCount
      ?? null,
    observedPricesCountAfter:
      observation.observedPricesCount,
    durationMsBefore:
      previousObservation?.durationMs
      ?? null,
    durationMsAfter:
      observation.durationMs,
    continuationReachedBefore:
      previousObservation
        ?.continuationReached
      ?? null,
    continuationReachedAfter:
      observation.continuationReached,
    failureConditionReachedBefore:
      previousObservation
        ?.failureConditionReached
      ?? null,
    failureConditionReachedAfter:
      observation
        .failureConditionReached,
    returnedInsideLevelBefore:
      previousObservation
        ?.returnedInsideLevel
      ?? null,
    returnedInsideLevelAfter:
      observation.returnedInsideLevel,
    resolvedAtBefore:
      previousObservation?.resolvedAt
      ?? null,
    resolvedAtAfter:
      observation.resolvedAt,
    timeToOutcomeMsBefore:
      previousObservation?.timeToOutcomeMs
      ?? null,
    timeToOutcomeMsAfter:
      observation.timeToOutcomeMs,
    statusChanged:
      previousObservation !== null
      && previousObservation.status
        !== observation.status,
    latestPriceChanged:
      previousObservation !== null
      && previousObservation.latestPrice
        !== observation.latestPrice,
    latestPriceChangePctChanged:
      previous !== null
      && previous.latestPriceChangePct
        !== priceChangePct,
    maxFavorableExcursionPctChanged:
      previousObservation !== null
      && previousObservation
        .maxFavorableExcursionPct
        !== observation
          .maxFavorableExcursionPct,
    maxAdverseExcursionPctChanged:
      previousObservation !== null
      && previousObservation
        .maxAdverseExcursionPct
        !== observation
          .maxAdverseExcursionPct,
    observedPricesCountChanged:
      previousObservation !== null
      && previousObservation
        .observedPricesCount
        !== observation
          .observedPricesCount,
    durationMsChanged:
      previousObservation !== null
      && previousObservation.durationMs
        !== observation.durationMs,
    continuationReachedChanged:
      previousObservation !== null
      && previousObservation
        .continuationReached
        !== observation
          .continuationReached,
    failureConditionReachedChanged:
      previousObservation !== null
      && previousObservation
        .failureConditionReached
        !== observation
          .failureConditionReached,
    returnedInsideLevelChanged:
      previousObservation !== null
      && previousObservation
        .returnedInsideLevel
        !== observation
          .returnedInsideLevel,
    resolvedAtChanged:
      previousObservation !== null
      && previousObservation.resolvedAt
        !== observation.resolvedAt,
    timeToOutcomeMsChanged:
      previousObservation !== null
      && previousObservation
        .timeToOutcomeMs
        !== observation.timeToOutcomeMs,
    reasonsChanged:
      previousObservation !== null
      && !sameStrings(
        previousObservation.reasons,
        observation.reasons,
      ),
  };
}

function emptyStatusCounts():
LevelV2ShadowSetupOutcomeStatusCounts {
  return {
    pending: 0,
    successful_continuation: 0,
    failed_reversal: 0,
    mixed: 0,
  };
}

export class LevelV2ShadowSetupOutcomeHistoryStore {
  private readonly entriesByClassifier =
    new Map<
      string,
      StoredEntry[]
    >();

  private sequence = 0;
  private entriesCount = 0;
  private droppedEntriesCount = 0;
  private deduplicatedEntriesCount = 0;

  constructor(
    private readonly options:
      LevelV2ShadowSetupOutcomeHistoryOptions =
        DEFAULT_LEVEL_V2_SHADOW_SETUP_OUTCOME_HISTORY_OPTIONS,
  ) {
    validateOptions(
      options,
    );
  }

  recordObservation(
    observationValue:
      LevelV2ShadowSetupOutcomeObservation,
  ):
  LevelV2ShadowSetupOutcomeHistoryEntry
  | null {
    const observation =
      cloneLevelV2ShadowSetupOutcomeObservation(
        observationValue,
      );
    const classifierId =
      normalizeClassifierId(
        observation.classifierId,
      );
    const symbol =
      normalizeSymbol(
        observation.symbol,
      );
    const entries =
      this.entriesByClassifier.get(
        classifierId,
      )
      ?? [];
    const previousStored =
      entries.at(-1)
      ?? null;
    const normalizedObservation = {
      ...observation,
      classifierId,
      symbol,
    };
    const priceChangePct =
      latestPriceChangePct(
        normalizedObservation,
      );
    const currentFingerprint =
      fingerprint(
        normalizedObservation,
        priceChangePct,
      );

    if (
      previousStored
      && previousStored.fingerprint
        === currentFingerprint
    ) {
      this.deduplicatedEntriesCount += 1;
      return null;
    }

    this.sequence += 1;

    const entry:
    LevelV2ShadowSetupOutcomeHistoryEntry = {
      id:
        `${classifierId}:setup-outcome-history:${this.sequence}`,
      sequence:
        this.sequence,
      classifierId,
      levelId:
        normalizedObservation.levelId,
      symbol,
      timeframe:
        normalizedObservation.timeframe,
      capturedAt:
        normalizedObservation
          .latestSourceObservedAt,
      latestPriceChangePct:
        priceChangePct,
      observation:
        normalizedObservation,
      changes:
        buildChanges(
          previousStored?.entry
          ?? null,
          normalizedObservation,
          priceChangePct,
        ),
      observationalOnly:
        true,
      changesBreakClassification:
        false,
      changesProductionSetup:
        false,
      tradeExecution:
        false,
    };

    entries.push({
      entry:
        cloneEntry(
          entry,
        ),
      fingerprint:
        currentFingerprint,
    });
    this.entriesByClassifier.set(
      classifierId,
      entries,
    );
    this.entriesCount += 1;

    while (
      entries.length
      > this.options
        .maxEntriesPerClassifier
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

  rebuild(
    sourceEntries:
      readonly LevelV2ShadowMarketEvidenceHistoryEntry[],
    levels:
      readonly LevelV2LifecycleState[],
    observationOptions:
      LevelV2ShadowSetupOutcomeObservationOptions =
        DEFAULT_LEVEL_V2_SHADOW_SETUP_OUTCOME_OBSERVATION_OPTIONS,
  ): void {
    const histories =
      new Map<
        string,
        LevelV2ShadowMarketEvidenceHistoryEntry[]
      >();
    const ordered = [
      ...sourceEntries,
    ].sort(
      (
        left,
        right,
      ) =>
        left.sequence
        - right.sequence,
    );

    for (
      const sourceEntry
      of ordered
    ) {
      const classifierId =
        normalizeClassifierId(
          sourceEntry.evidence
            .classifierId,
        );
      const values =
        histories.get(
          classifierId,
        )
        ?? [];

      values.push(
        sourceEntry,
      );
      histories.set(
        classifierId,
        values,
      );

      const observation =
        buildLevelV2ShadowSetupOutcomeObservationSnapshot(
          values,
          levels,
          observationOptions,
        ).observations[0];

      if (observation) {
        this.recordObservation(
          observation,
        );
      }
    }
  }

  getHistory(
    symbolValue?: string,
    classifierIdValue?: string,
    limit = 100,
    status?:
      LevelV2ShadowSetupOutcomeObservation['status'],
    expectedDirection?:
      LevelV2ShadowSetupOutcomeObservation['expectedDirection'],
  ):
  LevelV2ShadowSetupOutcomeHistoryEntry[] {
    validateLimit(
      limit,
    );

    const symbol =
      symbolValue === undefined
        ? null
        : normalizeSymbol(
            symbolValue,
          );
    const classifierId =
      classifierIdValue === undefined
        ? null
        : normalizeClassifierId(
            classifierIdValue,
          );
    const values =
      classifierId === null
        ? [
            ...this.entriesByClassifier
              .values(),
          ].flat()
        : [
            ...(
              this.entriesByClassifier.get(
                classifierId,
              )
              ?? []
            ),
          ];

    return values
      .filter(
        (stored) =>
          (
            symbol === null
            || stored.entry.symbol
              === symbol
          )
          && (
            status === undefined
            || stored.entry.observation
              .status
              === status
          )
          && (
            expectedDirection === undefined
            || stored.entry.observation
              .expectedDirection
              === expectedDirection
          ),
      )
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

  getStatus(
    sourceEntriesCount = 0,
    sourceObservationsCount = 0,
    sourceLevelsCount = 0,
    sourceHistoryStatus:
      LevelV2ShadowMarketEvidenceHistoryStatus
      | null = null,
    sourceLimit = 10_000,
  ):
  LevelV2ShadowSetupOutcomeHistoryStatus {
    const entries = [
      ...this.entriesByClassifier
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
      classifiersCount:
        this.entriesByClassifier.size,
      symbolsCount:
        new Set(
          entries.map(
            (stored) =>
              stored.entry.symbol,
          ),
        ).size,
      maxEntriesPerClassifier:
        this.options
          .maxEntriesPerClassifier,
      maxTotalEntries:
        this.options
          .maxTotalEntries,
      droppedEntriesCount:
        this.droppedEntriesCount,
      deduplicatedEntriesCount:
        this.deduplicatedEntriesCount,
      oldestCapturedAt:
        entries[0]
          ?.entry.capturedAt
        ?? null,
      latestCapturedAt:
        entries.at(-1)
          ?.entry.capturedAt
        ?? null,
      sourceEntriesCount,
      sourceObservationsCount,
      sourceLevelsCount,
      truncatedSourceHistory:
        sourceEntriesCount >= sourceLimit
        && sourceHistoryStatus !== null
        && sourceHistoryStatus
          .entriesCount
          > sourceEntriesCount,
      sourceHistoryStatus,
      observationalOnly:
        true,
      changesBreakClassification:
        false,
      changesProductionSetup:
        false,
      tradeExecution:
        false,
    };
  }

  getDiagnostics():
  LevelV2ShadowSetupOutcomeHistoryDiagnostics {
    const entries = [
      ...this.entriesByClassifier
        .values(),
    ]
      .flat()
      .map(
        (stored) =>
          cloneEntry(
            stored.entry,
          ),
      )
      .sort(
        (
          left,
          right,
        ) =>
          right.sequence
          - left.sequence,
      );
    const statusCounts =
      emptyStatusCounts();
    let statusTransitionsCount = 0;
    let latestPriceTransitionsCount = 0;
    let favorableExcursionTransitionsCount = 0;
    let adverseExcursionTransitionsCount = 0;
    let continuationTransitionsCount = 0;
    let failureTransitionsCount = 0;
    let returnedInsideLevelTransitionsCount = 0;
    let observedPricesTransitionsCount = 0;

    for (
      const entry
      of entries
    ) {
      statusCounts[
        entry.observation.status
      ] += 1;
      statusTransitionsCount +=
        entry.changes.statusChanged
          ? 1
          : 0;
      latestPriceTransitionsCount +=
        entry.changes.latestPriceChanged
          ? 1
          : 0;
      favorableExcursionTransitionsCount +=
        entry.changes
          .maxFavorableExcursionPctChanged
          ? 1
          : 0;
      adverseExcursionTransitionsCount +=
        entry.changes
          .maxAdverseExcursionPctChanged
          ? 1
          : 0;
      continuationTransitionsCount +=
        entry.changes
          .continuationReachedChanged
          ? 1
          : 0;
      failureTransitionsCount +=
        entry.changes
          .failureConditionReachedChanged
          ? 1
          : 0;
      returnedInsideLevelTransitionsCount +=
        entry.changes
          .returnedInsideLevelChanged
          ? 1
          : 0;
      observedPricesTransitionsCount +=
        entry.changes
          .observedPricesCountChanged
          ? 1
          : 0;
    }

    return {
      entriesCount:
        entries.length,
      statusTransitionsCount,
      latestPriceTransitionsCount,
      favorableExcursionTransitionsCount,
      adverseExcursionTransitionsCount,
      continuationTransitionsCount,
      failureTransitionsCount,
      returnedInsideLevelTransitionsCount,
      observedPricesTransitionsCount,
      statusCounts,
      latestCapturedAt:
        entries[0]
          ?.capturedAt
        ?? null,
      observationalOnly:
        true,
      changesBreakClassification:
        false,
      changesProductionSetup:
        false,
      tradeExecution:
        false,
    };
  }

  private trimGlobalLimit(): void {
    while (
      this.entriesCount
      > this.options
        .maxTotalEntries
    ) {
      let oldestClassifierId:
        string
        | null = null;
      let oldestSequence =
        Number.POSITIVE_INFINITY;

      for (
        const [
          classifierId,
          entries,
        ]
        of this.entriesByClassifier
      ) {
        const first =
          entries[0];

        if (
          first
          && first.entry.sequence
            < oldestSequence
        ) {
          oldestClassifierId =
            classifierId;
          oldestSequence =
            first.entry.sequence;
        }
      }

      if (oldestClassifierId === null) {
        return;
      }

      const entries =
        this.entriesByClassifier.get(
          oldestClassifierId,
        );

      if (!entries) {
        return;
      }

      entries.shift();
      this.entriesCount -= 1;
      this.droppedEntriesCount += 1;

      if (entries.length === 0) {
        this.entriesByClassifier.delete(
          oldestClassifierId,
        );
      }
    }
  }
}

export function buildLevelV2ShadowSetupOutcomeHistoryStore(
  sourceEntries:
    readonly LevelV2ShadowMarketEvidenceHistoryEntry[],
  levels:
    readonly LevelV2LifecycleState[],
  options:
    LevelV2ShadowSetupOutcomeHistoryOptions =
      DEFAULT_LEVEL_V2_SHADOW_SETUP_OUTCOME_HISTORY_OPTIONS,
  observationOptions:
    LevelV2ShadowSetupOutcomeObservationOptions =
      DEFAULT_LEVEL_V2_SHADOW_SETUP_OUTCOME_OBSERVATION_OPTIONS,
): LevelV2ShadowSetupOutcomeHistoryStore {
  const store =
    new LevelV2ShadowSetupOutcomeHistoryStore(
      options,
    );

  store.rebuild(
    sourceEntries,
    levels,
    observationOptions,
  );

  return store;
}
