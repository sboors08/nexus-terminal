import {
  buildLevelV2ShadowMarketEvidenceBehaviorAnalyses,
  DEFAULT_LEVEL_V2_SHADOW_MARKET_EVIDENCE_BEHAVIOR_ANALYSIS_OPTIONS,
} from './level-v2-shadow-market-evidence-behavior-analysis.js';
import type {
  LevelV2ShadowMarketEvidenceBehaviorAnalysis,
  LevelV2ShadowMarketEvidenceBehaviorAnalysisOptions,
  LevelV2ShadowMarketEvidenceBehaviorConfidenceCounts,
  LevelV2ShadowMarketEvidenceBehaviorCounts,
} from './level-v2-shadow-market-evidence-behavior-analysis.types.js';
import type {
  LevelV2ShadowMarketEvidenceHistoryEntry,
  LevelV2ShadowMarketEvidenceHistoryStatus,
} from './level-v2-shadow-market-evidence-history.types.js';
import type {
  LevelV2ShadowMarketEvidenceBehaviorHistoryChanges,
  LevelV2ShadowMarketEvidenceBehaviorHistoryDiagnostics,
  LevelV2ShadowMarketEvidenceBehaviorHistoryEntry,
  LevelV2ShadowMarketEvidenceBehaviorHistoryOptions,
  LevelV2ShadowMarketEvidenceBehaviorHistoryStatus,
} from './level-v2-shadow-market-evidence-behavior-history.types.js';

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const CLASSIFIER_ID_PATTERN =
  /^[A-Za-z0-9:._-]{1,320}$/;

export const DEFAULT_LEVEL_V2_SHADOW_MARKET_EVIDENCE_BEHAVIOR_HISTORY_OPTIONS:
LevelV2ShadowMarketEvidenceBehaviorHistoryOptions = {
  maxEntriesPerClassifier:
    120,
  maxTotalEntries:
    100_000,
};

interface StoredEntry {
  entry:
    LevelV2ShadowMarketEvidenceBehaviorHistoryEntry;
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
      `Level v2 shadow market evidence behavior history ${name} must be a positive integer`,
    );
  }
}

function validateOptions(
  options:
    LevelV2ShadowMarketEvidenceBehaviorHistoryOptions,
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
      'Level v2 shadow market evidence behavior history maxTotalEntries cannot be smaller than maxEntriesPerClassifier',
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
      `Invalid Level v2 shadow market evidence behavior history symbol: ${value}`,
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
      `Invalid Level v2 shadow market evidence behavior history classifier id: ${value}`,
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
      'Level v2 shadow market evidence behavior history limit must be an integer from one to ten thousand',
    );
  }
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

export function cloneLevelV2ShadowMarketEvidenceBehaviorAnalysis(
  analysis:
    LevelV2ShadowMarketEvidenceBehaviorAnalysis,
): LevelV2ShadowMarketEvidenceBehaviorAnalysis {
  return {
    ...analysis,
    reasons: [
      ...analysis.reasons,
    ],
    metrics: {
      ...analysis.metrics,
    },
  };
}

function cloneChanges(
  changes:
    LevelV2ShadowMarketEvidenceBehaviorHistoryChanges,
): LevelV2ShadowMarketEvidenceBehaviorHistoryChanges {
  return {
    ...changes,
  };
}

function cloneEntry(
  entry:
    LevelV2ShadowMarketEvidenceBehaviorHistoryEntry,
): LevelV2ShadowMarketEvidenceBehaviorHistoryEntry {
  return {
    ...entry,
    analysis:
      cloneLevelV2ShadowMarketEvidenceBehaviorAnalysis(
        entry.analysis,
      ),
    changes:
      cloneChanges(
        entry.changes,
      ),
  };
}

function fingerprint(
  analysis:
    LevelV2ShadowMarketEvidenceBehaviorAnalysis,
): string {
  return JSON.stringify({
    classifierId:
      analysis.classifierId,
    levelId:
      analysis.levelId,
    symbol:
      analysis.symbol,
    timeframe:
      analysis.timeframe,
    currentKind:
      analysis.currentKind,
    latestClassificationStatus:
      analysis.latestClassificationStatus,
    behavior:
      analysis.behavior,
    confidence:
      analysis.confidence,
    aggressionSide:
      analysis.aggressionSide,
    priceDirection:
      analysis.priceDirection,
    reasons:
      analysis.reasons,
  });
}

function buildChanges(
  previous:
    LevelV2ShadowMarketEvidenceBehaviorHistoryEntry
    | null,
  analysis:
    LevelV2ShadowMarketEvidenceBehaviorAnalysis,
): LevelV2ShadowMarketEvidenceBehaviorHistoryChanges {
  const previousAnalysis =
    previous?.analysis
    ?? null;

  return {
    previousEntryId:
      previous?.id
      ?? null,
    behaviorBefore:
      previousAnalysis?.behavior
      ?? null,
    behaviorAfter:
      analysis.behavior,
    confidenceBefore:
      previousAnalysis?.confidence
      ?? null,
    confidenceAfter:
      analysis.confidence,
    aggressionSideBefore:
      previousAnalysis?.aggressionSide
      ?? null,
    aggressionSideAfter:
      analysis.aggressionSide,
    priceDirectionBefore:
      previousAnalysis?.priceDirection
      ?? null,
    priceDirectionAfter:
      analysis.priceDirection,
    classificationStatusBefore:
      previousAnalysis
        ?.latestClassificationStatus
      ?? null,
    classificationStatusAfter:
      analysis.latestClassificationStatus,
    behaviorChanged:
      previousAnalysis !== null
      && previousAnalysis.behavior
        !== analysis.behavior,
    confidenceChanged:
      previousAnalysis !== null
      && previousAnalysis.confidence
        !== analysis.confidence,
    aggressionSideChanged:
      previousAnalysis !== null
      && previousAnalysis.aggressionSide
        !== analysis.aggressionSide,
    priceDirectionChanged:
      previousAnalysis !== null
      && previousAnalysis.priceDirection
        !== analysis.priceDirection,
    classificationStatusChanged:
      previousAnalysis !== null
      && previousAnalysis
        .latestClassificationStatus
        !== analysis
          .latestClassificationStatus,
    reasonsChanged:
      previousAnalysis !== null
      && !sameStrings(
        previousAnalysis.reasons,
        analysis.reasons,
      ),
  };
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

export class LevelV2ShadowMarketEvidenceBehaviorHistoryStore {
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
      LevelV2ShadowMarketEvidenceBehaviorHistoryOptions =
        DEFAULT_LEVEL_V2_SHADOW_MARKET_EVIDENCE_BEHAVIOR_HISTORY_OPTIONS,
  ) {
    validateOptions(
      options,
    );
  }

  recordAnalysis(
    analysisValue:
      LevelV2ShadowMarketEvidenceBehaviorAnalysis,
  ):
  LevelV2ShadowMarketEvidenceBehaviorHistoryEntry
  | null {
    const analysis =
      cloneLevelV2ShadowMarketEvidenceBehaviorAnalysis(
        analysisValue,
      );
    const classifierId =
      normalizeClassifierId(
        analysis.classifierId,
      );
    const symbol =
      normalizeSymbol(
        analysis.symbol,
      );
    const entries =
      this.entriesByClassifier.get(
        classifierId,
      )
      ?? [];
    const previousStored =
      entries.at(-1)
      ?? null;
    const normalizedAnalysis = {
      ...analysis,
      classifierId,
      symbol,
    };
    const currentFingerprint =
      fingerprint(
        normalizedAnalysis,
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
    LevelV2ShadowMarketEvidenceBehaviorHistoryEntry = {
      id:
        `${classifierId}:behavior-history:${this.sequence}`,
      sequence:
        this.sequence,
      classifierId,
      levelId:
        normalizedAnalysis.levelId,
      symbol,
      timeframe:
        normalizedAnalysis.timeframe,
      capturedAt:
        normalizedAnalysis.latestCapturedAt,
      analysis:
        normalizedAnalysis,
      changes:
        buildChanges(
          previousStored?.entry
          ?? null,
          normalizedAnalysis,
        ),
      observationalOnly:
        true,
      changesBreakClassification:
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
    analysisOptions:
      LevelV2ShadowMarketEvidenceBehaviorAnalysisOptions =
        DEFAULT_LEVEL_V2_SHADOW_MARKET_EVIDENCE_BEHAVIOR_ANALYSIS_OPTIONS,
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

      const analysis =
        buildLevelV2ShadowMarketEvidenceBehaviorAnalyses(
          values,
          analysisOptions,
        )[0];

      if (analysis) {
        this.recordAnalysis(
          analysis,
        );
      }
    }
  }

  getHistory(
    symbolValue?: string,
    classifierIdValue?: string,
    limit = 100,
    behavior?:
      LevelV2ShadowMarketEvidenceBehaviorAnalysis['behavior'],
    confidence?:
      LevelV2ShadowMarketEvidenceBehaviorAnalysis['confidence'],
  ):
  LevelV2ShadowMarketEvidenceBehaviorHistoryEntry[] {
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
            behavior === undefined
            || stored.entry.analysis
              .behavior
              === behavior
          )
          && (
            confidence === undefined
            || stored.entry.analysis
              .confidence
              === confidence
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
    sourceHistoryStatus:
      LevelV2ShadowMarketEvidenceHistoryStatus
      | null = null,
    sourceLimit = 10_000,
  ):
  LevelV2ShadowMarketEvidenceBehaviorHistoryStatus {
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

  getDiagnostics():
  LevelV2ShadowMarketEvidenceBehaviorHistoryDiagnostics {
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
    const behaviorCounts =
      emptyBehaviorCounts();
    const confidenceCounts =
      emptyConfidenceCounts();
    let behaviorTransitionsCount = 0;
    let confidenceTransitionsCount = 0;
    let aggressionSideTransitionsCount = 0;
    let priceDirectionTransitionsCount = 0;
    let classificationTransitionsCount = 0;

    for (
      const entry
      of entries
    ) {
      behaviorCounts[
        entry.analysis.behavior
      ] += 1;
      confidenceCounts[
        entry.analysis.confidence
      ] += 1;
      behaviorTransitionsCount +=
        entry.changes.behaviorChanged
          ? 1
          : 0;
      confidenceTransitionsCount +=
        entry.changes.confidenceChanged
          ? 1
          : 0;
      aggressionSideTransitionsCount +=
        entry.changes.aggressionSideChanged
          ? 1
          : 0;
      priceDirectionTransitionsCount +=
        entry.changes.priceDirectionChanged
          ? 1
          : 0;
      classificationTransitionsCount +=
        entry.changes
          .classificationStatusChanged
          ? 1
          : 0;
    }

    return {
      entriesCount:
        entries.length,
      behaviorTransitionsCount,
      confidenceTransitionsCount,
      aggressionSideTransitionsCount,
      priceDirectionTransitionsCount,
      classificationTransitionsCount,
      behaviorCounts,
      confidenceCounts,
      latestCapturedAt:
        entries[0]
          ?.capturedAt
        ?? null,
      observationalOnly:
        true,
    };
  }

  private trimGlobalLimit():
  void {
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
          oldestClassifierId =
            classifierId;
        }
      }

      if (!oldestClassifierId) {
        return;
      }

      const entries =
        this.entriesByClassifier.get(
          oldestClassifierId,
        );

      entries?.shift();
      this.entriesCount -= 1;
      this.droppedEntriesCount += 1;

      if (
        entries
        && entries.length === 0
      ) {
        this.entriesByClassifier.delete(
          oldestClassifierId,
        );
      }
    }
  }
}

export function buildLevelV2ShadowMarketEvidenceBehaviorHistoryStore(
  sourceEntries:
    readonly LevelV2ShadowMarketEvidenceHistoryEntry[],
  historyOptions:
    LevelV2ShadowMarketEvidenceBehaviorHistoryOptions =
      DEFAULT_LEVEL_V2_SHADOW_MARKET_EVIDENCE_BEHAVIOR_HISTORY_OPTIONS,
  analysisOptions:
    LevelV2ShadowMarketEvidenceBehaviorAnalysisOptions =
      DEFAULT_LEVEL_V2_SHADOW_MARKET_EVIDENCE_BEHAVIOR_ANALYSIS_OPTIONS,
): LevelV2ShadowMarketEvidenceBehaviorHistoryStore {
  const store =
    new LevelV2ShadowMarketEvidenceBehaviorHistoryStore(
      historyOptions,
    );

  store.rebuild(
    sourceEntries,
    analysisOptions,
  );

  return store;
}
