import {
  cloneLevelV2ShadowMarketEvidence,
} from './level-v2-shadow-market-evidence.js';
import type {
  LevelV2ShadowMarketEvidence,
} from './level-v2-shadow-market-evidence.types.js';
import type {
  LevelV2ShadowSnapshot,
} from './level-v2-shadow-runtime.types.js';
import type {
  LevelV2ShadowMarketEvidenceHistoryChanges,
  LevelV2ShadowMarketEvidenceHistoryEntry,
  LevelV2ShadowMarketEvidenceHistoryOptions,
  LevelV2ShadowMarketEvidenceHistoryStatus,
} from './level-v2-shadow-market-evidence-history.types.js';

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const CLASSIFIER_ID_PATTERN =
  /^[A-Za-z0-9:._-]{1,320}$/;

export const DEFAULT_LEVEL_V2_SHADOW_MARKET_EVIDENCE_HISTORY_OPTIONS:
LevelV2ShadowMarketEvidenceHistoryOptions = {
  maxEntriesPerClassifier:
    120,
  maxTotalEntries:
    10_000,
};

interface StoredEntry {
  entry:
    LevelV2ShadowMarketEvidenceHistoryEntry;
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
      `Level v2 shadow market evidence history ${name} must be a positive integer`,
    );
  }
}

function validateOptions(
  options:
    LevelV2ShadowMarketEvidenceHistoryOptions,
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
      'Level v2 shadow market evidence history maxTotalEntries cannot be smaller than maxEntriesPerClassifier',
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
      `Invalid Level v2 shadow market evidence history symbol: ${value}`,
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
      `Invalid Level v2 shadow market evidence history classifier id: ${value}`,
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
      'Level v2 shadow market evidence history limit must be an integer from one to ten thousand',
    );
  }
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

function cloneChanges(
  changes:
    LevelV2ShadowMarketEvidenceHistoryChanges,
): LevelV2ShadowMarketEvidenceHistoryChanges {
  return {
    ...changes,
  };
}

function cloneEntry(
  entry:
    LevelV2ShadowMarketEvidenceHistoryEntry,
): LevelV2ShadowMarketEvidenceHistoryEntry {
  return {
    ...entry,
    evidence:
      cloneLevelV2ShadowMarketEvidence(
        entry.evidence,
      ),
    changes:
      cloneChanges(
        entry.changes,
      ),
  };
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

function buildChanges(
  previous:
    LevelV2ShadowMarketEvidenceHistoryEntry
    | null,
  evidence:
    LevelV2ShadowMarketEvidence,
): LevelV2ShadowMarketEvidenceHistoryChanges {
  const previousEvidence =
    previous?.evidence
    ?? null;

  return {
    previousEntryId:
      previous?.id
      ?? null,
    classificationStatusBefore:
      previousEvidence
        ?.classificationStatus
      ?? null,
    classificationStatusAfter:
      evidence.classificationStatus,
    availabilityBefore:
      previousEvidence
        ?.availability
      ?? null,
    availabilityAfter:
      evidence.availability,
    tapeQuoteDeltaChange:
      delta(
        evidence.tape?.quoteDelta
        ?? null,
        previousEvidence
          ?.tape?.quoteDelta
        ?? null,
      ),
    tapeBuySharePctChange:
      delta(
        evidence.tape?.buySharePct
        ?? null,
        previousEvidence
          ?.tape?.buySharePct
        ?? null,
      ),
    tapePriceChangePctChange:
      delta(
        evidence.tape?.priceChangePct
        ?? null,
        previousEvidence
          ?.tape?.priceChangePct
        ?? null,
      ),
    tapeDominantSideChanged:
      previousEvidence !== null
      && previousEvidence.tape
        ?.dominantSide
        !== evidence.tape
          ?.dominantSide,
    orderBookImbalancePctChange:
      delta(
        evidence.orderBook
          ?.imbalancePct
        ?? null,
        previousEvidence
          ?.orderBook
          ?.imbalancePct
        ?? null,
      ),
    orderBookBidDepthQuoteChange:
      delta(
        evidence.orderBook
          ?.bidDepthQuote
        ?? null,
        previousEvidence
          ?.orderBook
          ?.bidDepthQuote
        ?? null,
      ),
    orderBookAskDepthQuoteChange:
      delta(
        evidence.orderBook
          ?.askDepthQuote
        ?? null,
        previousEvidence
          ?.orderBook
          ?.askDepthQuote
        ?? null,
      ),
    orderBookSpreadPctChange:
      delta(
        evidence.orderBook
          ?.spreadPct
        ?? null,
        previousEvidence
          ?.orderBook
          ?.spreadPct
        ?? null,
      ),
    orderBookStateChanged:
      previousEvidence !== null
      && previousEvidence.orderBook
        ?.state
        !== evidence.orderBook
          ?.state,
    sourceErrorsChanged:
      previousEvidence !== null
      && !sameStrings(
        previousEvidence
          .sourceErrors,
        evidence.sourceErrors,
      ),
  };
}

function fingerprint(
  evidence:
    LevelV2ShadowMarketEvidence,
): string {
  return JSON.stringify({
    classifierId:
      evidence.classifierId,
    levelId:
      evidence.levelId,
    symbol:
      evidence.symbol,
    timeframe:
      evidence.timeframe,
    currentKind:
      evidence.currentKind,
    classificationStatus:
      evidence.classificationStatus,
    availability:
      evidence.availability,
    tape:
      evidence.tape
        ? {
            tradesCount:
              evidence.tape.tradesCount,
            executionsCount:
              evidence.tape.executionsCount,
            buyQuoteValue:
              evidence.tape.buyQuoteValue,
            sellQuoteValue:
              evidence.tape.sellQuoteValue,
            totalQuoteValue:
              evidence.tape.totalQuoteValue,
            quoteDelta:
              evidence.tape.quoteDelta,
            buySharePct:
              evidence.tape.buySharePct,
            dominantSide:
              evidence.tape.dominantSide,
            largestTradeQuoteValue:
              evidence.tape.largestTradeQuoteValue,
            firstTradePrice:
              evidence.tape.firstTradePrice,
            lastTradePrice:
              evidence.tape.lastTradePrice,
            priceChangePct:
              evidence.tape.priceChangePct,
          }
        : null,
    orderBook:
      evidence.orderBook
        ? {
            state:
              evidence.orderBook.state,
            synchronized:
              evidence.orderBook.synchronized,
            staleAfterMs:
              evidence.orderBook.staleAfterMs,
            bestBid:
              evidence.orderBook.bestBid,
            bestAsk:
              evidence.orderBook.bestAsk,
            spreadPct:
              evidence.orderBook.spreadPct,
            bidDepthQuote:
              evidence.orderBook.bidDepthQuote,
            askDepthQuote:
              evidence.orderBook.askDepthQuote,
            totalDepthQuote:
              evidence.orderBook.totalDepthQuote,
            imbalancePct:
              evidence.orderBook.imbalancePct,
          }
        : null,
    sourceErrors:
      evidence.sourceErrors,
  });
}

export class LevelV2ShadowMarketEvidenceHistoryStore {
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
      LevelV2ShadowMarketEvidenceHistoryOptions =
        DEFAULT_LEVEL_V2_SHADOW_MARKET_EVIDENCE_HISTORY_OPTIONS,
  ) {
    validateOptions(
      options,
    );
  }

  record(
    snapshot:
      LevelV2ShadowSnapshot,
  ):
  LevelV2ShadowMarketEvidenceHistoryEntry[] {
    const recorded:
      LevelV2ShadowMarketEvidenceHistoryEntry[] = [];

    for (
      const evidence
      of snapshot.marketEvidence
      ?? []
    ) {
      const entry =
        this.recordEvidence(
          evidence,
        );

      if (entry) {
        recorded.push(
          entry,
        );
      }
    }

    return recorded;
  }

  recordEvidence(
    evidenceValue:
      LevelV2ShadowMarketEvidence,
  ):
  LevelV2ShadowMarketEvidenceHistoryEntry
  | null {
    const evidence =
      cloneLevelV2ShadowMarketEvidence(
        evidenceValue,
      );

    const symbol =
      normalizeSymbol(
        evidence.symbol,
      );

    const classifierId =
      normalizeClassifierId(
        evidence.classifierId,
      );

    const entries =
      this.entriesByClassifier.get(
        classifierId,
      )
      ?? [];

    const previousStored =
      entries.at(-1)
      ?? null;

    const normalizedEvidence = {
      ...evidence,
      symbol,
      classifierId,
    };

    const currentFingerprint =
      fingerprint(
        normalizedEvidence,
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

    const previous =
      previousStored?.entry
      ?? null;

    const entry:
    LevelV2ShadowMarketEvidenceHistoryEntry = {
      id:
        `${classifierId}:market-history:${this.sequence}`,
      sequence:
        this.sequence,
      evidence:
        normalizedEvidence,
      changes:
        buildChanges(
          previous,
          normalizedEvidence,
        ),
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

  getHistory(
    symbolValue?: string,
    classifierIdValue?: string,
    limit = 100,
  ):
  LevelV2ShadowMarketEvidenceHistoryEntry[] {
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
          symbol === null
          || stored.entry
            .evidence.symbol
            === symbol,
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

  getStatus():
  LevelV2ShadowMarketEvidenceHistoryStatus {
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
              stored.entry
                .evidence.symbol,
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
          ?.entry.evidence
          .capturedAt
        ?? null,
      latestCapturedAt:
        entries.at(-1)
          ?.entry.evidence
          .capturedAt
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
