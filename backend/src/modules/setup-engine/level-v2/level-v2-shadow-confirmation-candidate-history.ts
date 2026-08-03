import {
  buildLevelV2ShadowConfirmationCandidates,
  cloneLevelV2ShadowConfirmationCandidate,
} from './level-v2-shadow-confirmation-candidate.js';
import type {
  LevelV2ShadowConfirmationCandidate,
  LevelV2ShadowConfirmationCandidateConfidenceCounts,
  LevelV2ShadowConfirmationCandidateVerdictCounts,
} from './level-v2-shadow-confirmation-candidate.types.js';
import type {
  LevelV2ShadowMarketEvidenceHistoryEntry,
  LevelV2ShadowMarketEvidenceHistoryStatus,
} from './level-v2-shadow-market-evidence-history.types.js';
import type {
  LevelV2ShadowConfirmationCandidateHistoryChanges,
  LevelV2ShadowConfirmationCandidateHistoryDiagnostics,
  LevelV2ShadowConfirmationCandidateHistoryEntry,
  LevelV2ShadowConfirmationCandidateHistoryOptions,
  LevelV2ShadowConfirmationCandidateHistoryStatus,
} from './level-v2-shadow-confirmation-candidate-history.types.js';

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const CLASSIFIER_ID_PATTERN =
  /^[A-Za-z0-9:._-]{1,320}$/;

export const DEFAULT_LEVEL_V2_SHADOW_CONFIRMATION_CANDIDATE_HISTORY_OPTIONS:
LevelV2ShadowConfirmationCandidateHistoryOptions = {
  maxEntriesPerClassifier:
    120,
  maxTotalEntries:
    100_000,
};

interface StoredEntry {
  entry:
    LevelV2ShadowConfirmationCandidateHistoryEntry;
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
      `Level v2 shadow confirmation candidate history ${name} must be a positive integer`,
    );
  }
}

function validateOptions(
  options:
    LevelV2ShadowConfirmationCandidateHistoryOptions,
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
      'Level v2 shadow confirmation candidate history maxTotalEntries cannot be smaller than maxEntriesPerClassifier',
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
      `Invalid Level v2 shadow confirmation candidate history symbol: ${value}`,
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
      `Invalid Level v2 shadow confirmation candidate history classifier id: ${value}`,
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
      'Level v2 shadow confirmation candidate history limit must be an integer from one to ten thousand',
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

function cloneChanges(
  changes:
    LevelV2ShadowConfirmationCandidateHistoryChanges,
): LevelV2ShadowConfirmationCandidateHistoryChanges {
  return {
    ...changes,
  };
}

function cloneEntry(
  entry:
    LevelV2ShadowConfirmationCandidateHistoryEntry,
): LevelV2ShadowConfirmationCandidateHistoryEntry {
  return {
    ...entry,
    candidate:
      cloneLevelV2ShadowConfirmationCandidate(
        entry.candidate,
      ),
    changes:
      cloneChanges(
        entry.changes,
      ),
  };
}

function fingerprint(
  candidate:
    LevelV2ShadowConfirmationCandidate,
): string {
  return JSON.stringify({
    classifierId:
      candidate.classifierId,
    levelId:
      candidate.levelId,
    symbol:
      candidate.symbol,
    timeframe:
      candidate.timeframe,
    currentKind:
      candidate.currentKind,
    latestClassificationStatus:
      candidate.latestClassificationStatus,
    expectedDirection:
      candidate.expectedDirection,
    priceAcceptance:
      candidate.priceAcceptance,
    behavior:
      candidate.behavior,
    behaviorConfidence:
      candidate.behaviorConfidence,
    aggressionSide:
      candidate.aggressionSide,
    priceDirection:
      candidate.priceDirection,
    postEventReaction:
      candidate.postEventReaction,
    verdict:
      candidate.verdict,
    confidence:
      candidate.confidence,
    reasons:
      candidate.reasons,
    latestAvailability:
      candidate.evidence
        .latestAvailability,
  });
}

function buildChanges(
  previous:
    LevelV2ShadowConfirmationCandidateHistoryEntry
    | null,
  candidate:
    LevelV2ShadowConfirmationCandidate,
): LevelV2ShadowConfirmationCandidateHistoryChanges {
  const previousCandidate =
    previous?.candidate
    ?? null;

  return {
    previousEntryId:
      previous?.id
      ?? null,
    verdictBefore:
      previousCandidate?.verdict
      ?? null,
    verdictAfter:
      candidate.verdict,
    confidenceBefore:
      previousCandidate?.confidence
      ?? null,
    confidenceAfter:
      candidate.confidence,
    classificationStatusBefore:
      previousCandidate
        ?.latestClassificationStatus
      ?? null,
    classificationStatusAfter:
      candidate.latestClassificationStatus,
    behaviorBefore:
      previousCandidate?.behavior
      ?? null,
    behaviorAfter:
      candidate.behavior,
    priceAcceptanceBefore:
      previousCandidate?.priceAcceptance
      ?? null,
    priceAcceptanceAfter:
      candidate.priceAcceptance,
    postEventReactionBefore:
      previousCandidate?.postEventReaction
      ?? null,
    postEventReactionAfter:
      candidate.postEventReaction,
    latestAvailabilityBefore:
      previousCandidate?.evidence
        .latestAvailability
      ?? null,
    latestAvailabilityAfter:
      candidate.evidence
        .latestAvailability,
    verdictChanged:
      previousCandidate !== null
      && previousCandidate.verdict
        !== candidate.verdict,
    confidenceChanged:
      previousCandidate !== null
      && previousCandidate.confidence
        !== candidate.confidence,
    classificationStatusChanged:
      previousCandidate !== null
      && previousCandidate
        .latestClassificationStatus
        !== candidate
          .latestClassificationStatus,
    behaviorChanged:
      previousCandidate !== null
      && previousCandidate.behavior
        !== candidate.behavior,
    priceAcceptanceChanged:
      previousCandidate !== null
      && previousCandidate.priceAcceptance
        !== candidate.priceAcceptance,
    postEventReactionChanged:
      previousCandidate !== null
      && previousCandidate.postEventReaction
        !== candidate.postEventReaction,
    latestAvailabilityChanged:
      previousCandidate !== null
      && previousCandidate.evidence
        .latestAvailability
        !== candidate.evidence
          .latestAvailability,
    reasonsChanged:
      previousCandidate !== null
      && !sameStrings(
        previousCandidate.reasons,
        candidate.reasons,
      ),
  };
}

function emptyVerdictCounts():
LevelV2ShadowConfirmationCandidateVerdictCounts {
  return {
    supported: 0,
    contradicted: 0,
    mixed: 0,
    insufficient_data: 0,
  };
}

function emptyConfidenceCounts():
LevelV2ShadowConfirmationCandidateConfidenceCounts {
  return {
    low: 0,
    medium: 0,
    high: 0,
  };
}

export class LevelV2ShadowConfirmationCandidateHistoryStore {
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
      LevelV2ShadowConfirmationCandidateHistoryOptions =
        DEFAULT_LEVEL_V2_SHADOW_CONFIRMATION_CANDIDATE_HISTORY_OPTIONS,
  ) {
    validateOptions(
      options,
    );
  }

  recordCandidate(
    candidateValue:
      LevelV2ShadowConfirmationCandidate,
  ):
  LevelV2ShadowConfirmationCandidateHistoryEntry
  | null {
    const candidate =
      cloneLevelV2ShadowConfirmationCandidate(
        candidateValue,
      );
    const classifierId =
      normalizeClassifierId(
        candidate.classifierId,
      );
    const symbol =
      normalizeSymbol(
        candidate.symbol,
      );
    const entries =
      this.entriesByClassifier.get(
        classifierId,
      )
      ?? [];
    const previousStored =
      entries.at(-1)
      ?? null;
    const normalizedCandidate = {
      ...candidate,
      classifierId,
      symbol,
    };
    const currentFingerprint =
      fingerprint(
        normalizedCandidate,
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
    LevelV2ShadowConfirmationCandidateHistoryEntry = {
      id:
        `${classifierId}:confirmation-history:${this.sequence}`,
      sequence:
        this.sequence,
      classifierId,
      levelId:
        normalizedCandidate.levelId,
      symbol,
      timeframe:
        normalizedCandidate.timeframe,
      capturedAt:
        normalizedCandidate.capturedAt,
      candidate:
        normalizedCandidate,
      changes:
        buildChanges(
          previousStored?.entry
          ?? null,
          normalizedCandidate,
        ),
      observationalOnly:
        true,
      changesBreakClassification:
        false,
      tradeConfirmation:
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

      const candidate =
        buildLevelV2ShadowConfirmationCandidates(
          values,
        )[0];

      if (candidate) {
        this.recordCandidate(
          candidate,
        );
      }
    }
  }

  getHistory(
    symbolValue?: string,
    classifierIdValue?: string,
    limit = 100,
    verdict?:
      LevelV2ShadowConfirmationCandidate['verdict'],
    confidence?:
      LevelV2ShadowConfirmationCandidate['confidence'],
  ):
  LevelV2ShadowConfirmationCandidateHistoryEntry[] {
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
            verdict === undefined
            || stored.entry.candidate
              .verdict
              === verdict
          )
          && (
            confidence === undefined
            || stored.entry.candidate
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
  LevelV2ShadowConfirmationCandidateHistoryStatus {
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
      changesBreakClassification:
        false,
      tradeConfirmation:
        false,
    };
  }

  getDiagnostics():
  LevelV2ShadowConfirmationCandidateHistoryDiagnostics {
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
    const verdictCounts =
      emptyVerdictCounts();
    const confidenceCounts =
      emptyConfidenceCounts();
    let verdictTransitionsCount = 0;
    let confidenceTransitionsCount = 0;
    let classificationTransitionsCount = 0;
    let behaviorTransitionsCount = 0;
    let priceAcceptanceTransitionsCount = 0;
    let postEventReactionTransitionsCount = 0;
    let availabilityTransitionsCount = 0;

    for (
      const entry
      of entries
    ) {
      verdictCounts[
        entry.candidate.verdict
      ] += 1;
      confidenceCounts[
        entry.candidate.confidence
      ] += 1;
      verdictTransitionsCount +=
        entry.changes.verdictChanged
          ? 1
          : 0;
      confidenceTransitionsCount +=
        entry.changes.confidenceChanged
          ? 1
          : 0;
      classificationTransitionsCount +=
        entry.changes
          .classificationStatusChanged
          ? 1
          : 0;
      behaviorTransitionsCount +=
        entry.changes.behaviorChanged
          ? 1
          : 0;
      priceAcceptanceTransitionsCount +=
        entry.changes.priceAcceptanceChanged
          ? 1
          : 0;
      postEventReactionTransitionsCount +=
        entry.changes.postEventReactionChanged
          ? 1
          : 0;
      availabilityTransitionsCount +=
        entry.changes.latestAvailabilityChanged
          ? 1
          : 0;
    }

    return {
      entriesCount:
        entries.length,
      verdictTransitionsCount,
      confidenceTransitionsCount,
      classificationTransitionsCount,
      behaviorTransitionsCount,
      priceAcceptanceTransitionsCount,
      postEventReactionTransitionsCount,
      availabilityTransitionsCount,
      verdictCounts,
      confidenceCounts,
      latestCapturedAt:
        entries[0]
          ?.capturedAt
        ?? null,
      observationalOnly:
        true,
      changesBreakClassification:
        false,
      tradeConfirmation:
        false,
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

export function buildLevelV2ShadowConfirmationCandidateHistoryStore(
  sourceEntries:
    readonly LevelV2ShadowMarketEvidenceHistoryEntry[],
  historyOptions:
    LevelV2ShadowConfirmationCandidateHistoryOptions =
      DEFAULT_LEVEL_V2_SHADOW_CONFIRMATION_CANDIDATE_HISTORY_OPTIONS,
): LevelV2ShadowConfirmationCandidateHistoryStore {
  const store =
    new LevelV2ShadowConfirmationCandidateHistoryStore(
      historyOptions,
    );

  store.rebuild(
    sourceEntries,
  );

  return store;
}
