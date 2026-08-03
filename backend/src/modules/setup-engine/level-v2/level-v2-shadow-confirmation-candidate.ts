import {
  buildLevelV2ShadowMarketEvidenceBehaviorAnalyses,
} from './level-v2-shadow-market-evidence-behavior-analysis.js';
import type {
  LevelV2ShadowMarketEvidenceBehaviorAnalysis,
} from './level-v2-shadow-market-evidence-behavior-analysis.types.js';
import {
  buildLevelV2ShadowMarketEvidenceBehaviorHistoryStore,
} from './level-v2-shadow-market-evidence-behavior-history.js';
import type {
  LevelV2ShadowMarketEvidenceBehaviorHistoryEntry,
} from './level-v2-shadow-market-evidence-behavior-history.types.js';
import type {
  LevelV2ShadowMarketEvidenceHistoryEntry,
} from './level-v2-shadow-market-evidence-history.types.js';
import type {
  LevelV2ShadowConfirmationCandidate,
  LevelV2ShadowConfirmationCandidateAvailabilityCounts,
  LevelV2ShadowConfirmationCandidateConfidence,
  LevelV2ShadowConfirmationCandidateConfidenceCounts,
  LevelV2ShadowConfirmationCandidateDiagnostics,
  LevelV2ShadowConfirmationCandidateVerdict,
  LevelV2ShadowConfirmationCandidateVerdictCounts,
  LevelV2ShadowConfirmationExpectedDirection,
  LevelV2ShadowConfirmationPostEventReaction,
} from './level-v2-shadow-confirmation-candidate.types.js';

const RECENT_HISTORY_WINDOW =
  3;

function expectedDirection(
  analysis:
    LevelV2ShadowMarketEvidenceBehaviorAnalysis,
): LevelV2ShadowConfirmationExpectedDirection {
  return analysis.currentKind
    === 'resistance'
      ? 'up'
      : 'down';
}

function priceAccepted(
  analysis:
    LevelV2ShadowMarketEvidenceBehaviorAnalysis,
): boolean {
  return analysis.latestClassificationStatus
    === 'breakout_pending'
    || analysis.latestClassificationStatus
      === 'breakout_confirmed';
}

function directionAligned(
  analysis:
    LevelV2ShadowMarketEvidenceBehaviorAnalysis,
  expected:
    LevelV2ShadowConfirmationExpectedDirection,
): boolean {
  return analysis.priceDirection
    === expected;
}

function isContradictoryBehavior(
  entry:
    LevelV2ShadowMarketEvidenceBehaviorHistoryEntry,
): boolean {
  return entry.analysis.behavior
    === 'aggressive_buy_absorption'
    || entry.analysis.behavior
      === 'aggressive_sell_absorption'
    || entry.analysis.behavior
      === 'momentum_exhaustion'
    || entry.analysis
      .latestClassificationStatus
      === 'false_breakout';
}

function stableBehaviorEntriesCount(
  history:
    readonly LevelV2ShadowMarketEvidenceBehaviorHistoryEntry[],
  analysis:
    LevelV2ShadowMarketEvidenceBehaviorAnalysis,
): number {
  let count = 0;

  for (
    const entry
    of history
  ) {
    if (
      entry.analysis.behavior
        !== analysis.behavior
      || entry.analysis.confidence
        !== analysis.confidence
      || entry.analysis.priceDirection
        !== analysis.priceDirection
    ) {
      break;
    }

    count += 1;
  }

  return count;
}

function postEventReaction(
  analysis:
    LevelV2ShadowMarketEvidenceBehaviorAnalysis,
  expected:
    LevelV2ShadowConfirmationExpectedDirection,
): LevelV2ShadowConfirmationPostEventReaction {
  if (
    analysis.latestClassificationStatus
      === 'false_breakout'
    || (
      analysis.priceDirection !== 'unknown'
      && analysis.priceDirection !== 'flat'
      && analysis.priceDirection !== expected
    )
  ) {
    return 'rejection';
  }

  if (
    analysis.priceDirection
      === 'flat'
  ) {
    return 'stall';
  }

  if (
    priceAccepted(
      analysis,
    )
    && analysis.priceDirection
      === expected
  ) {
    return 'continuation';
  }

  return 'unknown';
}

function resolveVerdict(
  analysis:
    LevelV2ShadowMarketEvidenceBehaviorAnalysis,
  latestAvailability:
    LevelV2ShadowMarketEvidenceHistoryEntry['evidence']['availability'],
  expected:
    LevelV2ShadowConfirmationExpectedDirection,
  contradictoryEntriesCount: number,
): LevelV2ShadowConfirmationCandidateVerdict {
  if (
    analysis.latestClassificationStatus
      === 'false_breakout'
  ) {
    return 'contradicted';
  }

  if (
    analysis.behavior
      === 'insufficient_data'
    || analysis.metrics
      .usableTapeEntriesCount < 2
    || latestAvailability
      === 'unavailable'
    || latestAvailability
      === 'order_book_only'
  ) {
    return 'insufficient_data';
  }

  if (
    analysis.behavior
      === 'aggressive_buy_absorption'
    || analysis.behavior
      === 'aggressive_sell_absorption'
    || analysis.behavior
      === 'momentum_exhaustion'
  ) {
    return 'contradicted';
  }

  if (
    analysis.behavior
      === 'directional_continuation'
  ) {
    if (
      !directionAligned(
        analysis,
        expected,
      )
    ) {
      return 'contradicted';
    }

    if (
      !priceAccepted(
        analysis,
      )
      || analysis.latestClassificationStatus
        === 'breakout_pending'
      || analysis.confidence
        === 'low'
      || contradictoryEntriesCount > 0
    ) {
      return 'mixed';
    }

    return 'supported';
  }

  return 'mixed';
}

function resolveConfidence(
  verdict:
    LevelV2ShadowConfirmationCandidateVerdict,
  analysis:
    LevelV2ShadowMarketEvidenceBehaviorAnalysis,
  latestAvailability:
    LevelV2ShadowMarketEvidenceHistoryEntry['evidence']['availability'],
  stableEntriesCount: number,
): LevelV2ShadowConfirmationCandidateConfidence {
  if (
    verdict === 'insufficient_data'
  ) {
    return 'low';
  }

  if (
    verdict === 'supported'
  ) {
    return analysis.confidence === 'high'
      && latestAvailability === 'complete'
      && stableEntriesCount >= 2
        ? 'high'
        : 'medium';
  }

  if (
    verdict === 'contradicted'
  ) {
    return analysis.latestClassificationStatus
      === 'false_breakout'
      || analysis.confidence
        === 'high'
        ? 'high'
        : 'medium';
  }

  return analysis.confidence
    === 'low'
      ? 'low'
      : 'medium';
}

function buildReasons(
  analysis:
    LevelV2ShadowMarketEvidenceBehaviorAnalysis,
  latestAvailability:
    LevelV2ShadowMarketEvidenceHistoryEntry['evidence']['availability'],
  expected:
    LevelV2ShadowConfirmationExpectedDirection,
  contradictoryEntriesCount: number,
): string[] {
  const reasons: string[] = [];

  switch (
    analysis.latestClassificationStatus
  ) {
    case 'breakout_confirmed':
      reasons.push(
        'price_acceptance_confirmed',
      );
      break;

    case 'breakout_pending':
      reasons.push(
        'price_acceptance_pending',
      );
      break;

    case 'false_breakout':
      reasons.push(
        'false_breakout_classification',
      );
      break;

    case 'pierce':
      reasons.push(
        'wick_pierce_without_price_acceptance',
      );
      break;

    case 'idle':
      reasons.push(
        'price_acceptance_missing',
      );
      break;
  }

  switch (
    analysis.behavior
  ) {
    case 'directional_continuation':
      reasons.push(
        directionAligned(
          analysis,
          expected,
        )
          ? 'directional_continuation_aligned'
          : 'directional_continuation_misaligned',
      );
      break;

    case 'aggressive_buy_absorption':
      reasons.push(
        'aggressive_buy_absorption',
      );
      break;

    case 'aggressive_sell_absorption':
      reasons.push(
        'aggressive_sell_absorption',
      );
      break;

    case 'momentum_exhaustion':
      reasons.push(
        'momentum_exhaustion',
      );
      break;

    case 'mixed':
      reasons.push(
        'mixed_market_evidence',
      );
      break;

    case 'insufficient_data':
      reasons.push(
        'insufficient_behavior_data',
      );
      break;
  }

  reasons.push(
    `latest_evidence_${latestAvailability}`,
  );

  if (
    latestAvailability === 'order_book_only'
  ) {
    reasons.push(
      'order_book_without_tape_cannot_support',
    );
  }

  if (
    analysis.metrics
      .usableTapeEntriesCount < 2
  ) {
    reasons.push(
      'insufficient_temporal_tape_evidence',
    );
  }

  if (
    contradictoryEntriesCount > 0
  ) {
    reasons.push(
      'recent_contradictory_behavior',
    );
  }

  return reasons;
}

export function evaluateLevelV2ShadowConfirmationCandidate(
  analysis:
    LevelV2ShadowMarketEvidenceBehaviorAnalysis,
  behaviorHistory:
    readonly LevelV2ShadowMarketEvidenceBehaviorHistoryEntry[],
  marketEvidenceHistory:
    readonly LevelV2ShadowMarketEvidenceHistoryEntry[],
): LevelV2ShadowConfirmationCandidate {
  const classifierId =
    analysis.classifierId;

  if (
    behaviorHistory.some(
      (entry) =>
        entry.classifierId
          !== classifierId,
    )
    || marketEvidenceHistory.some(
      (entry) =>
        entry.evidence
          .classifierId
          !== classifierId,
    )
  ) {
    throw new Error(
      'Level v2 shadow confirmation candidate requires one classifier history',
    );
  }

  const latestEvidence = [
    ...marketEvidenceHistory,
  ]
    .sort(
      (
        left,
        right,
      ) =>
        right.sequence
        - left.sequence,
    )[0];

  if (!latestEvidence) {
    throw new Error(
      'Level v2 shadow confirmation candidate requires market evidence history',
    );
  }

  const orderedBehaviorHistory = [
    ...behaviorHistory,
  ].sort(
    (
      left,
      right,
    ) =>
      right.sequence
      - left.sequence,
  );
  const expected =
    expectedDirection(
      analysis,
    );
  const recentHistory =
    orderedBehaviorHistory.slice(
      0,
      RECENT_HISTORY_WINDOW,
    );
  const contradictoryEntriesCount =
    recentHistory.filter(
      isContradictoryBehavior,
    ).length;
  const stableEntriesCount =
    stableBehaviorEntriesCount(
      orderedBehaviorHistory,
      analysis,
    );
  const verdict =
    resolveVerdict(
      analysis,
      latestEvidence.evidence
        .availability,
      expected,
      contradictoryEntriesCount,
    );
  const confidence =
    resolveConfidence(
      verdict,
      analysis,
      latestEvidence.evidence
        .availability,
      stableEntriesCount,
    );

  return {
    id:
      `${classifierId}:confirmation-candidate:${analysis.latestSequence}`,
    classifierId,
    levelId:
      analysis.levelId,
    symbol:
      analysis.symbol,
    timeframe:
      analysis.timeframe,
    currentKind:
      analysis.currentKind,
    latestSequence:
      analysis.latestSequence,
    capturedAt:
      analysis.latestCapturedAt,
    latestClassificationStatus:
      analysis.latestClassificationStatus,
    expectedDirection:
      expected,
    priceAcceptance:
      priceAccepted(
        analysis,
      ),
    behavior:
      analysis.behavior,
    behaviorConfidence:
      analysis.confidence,
    aggressionSide:
      analysis.aggressionSide,
    priceDirection:
      analysis.priceDirection,
    postEventReaction:
      postEventReaction(
        analysis,
        expected,
      ),
    verdict,
    confidence,
    reasons:
      buildReasons(
        analysis,
        latestEvidence.evidence
          .availability,
        expected,
        contradictoryEntriesCount,
      ),
    evidence: {
      latestAvailability:
        latestEvidence.evidence
          .availability,
      latestEvidenceCapturedAt:
        latestEvidence.evidence
          .capturedAt,
      marketEvidenceEntriesCount:
        marketEvidenceHistory.length,
      usableTapeEntriesCount:
        analysis.metrics
          .usableTapeEntriesCount,
      completeEntriesCount:
        analysis.metrics
          .completeEntriesCount,
      behaviorHistoryEntriesCount:
        orderedBehaviorHistory.length,
      stableBehaviorEntriesCount:
        stableEntriesCount,
      contradictoryBehaviorEntriesCount:
        contradictoryEntriesCount,
      netPriceChangePct:
        analysis.metrics
          .netPriceChangePct,
      latestOrderBookImbalancePct:
        analysis.metrics
          .latestOrderBookImbalancePct,
    },
    observationalOnly:
      true,
    changesBreakClassification:
      false,
    tradeConfirmation:
      false,
  };
}

export function cloneLevelV2ShadowConfirmationCandidate(
  candidate:
    LevelV2ShadowConfirmationCandidate,
): LevelV2ShadowConfirmationCandidate {
  return {
    ...candidate,
    reasons: [
      ...candidate.reasons,
    ],
    evidence: {
      ...candidate.evidence,
    },
  };
}

export function buildLevelV2ShadowConfirmationCandidates(
  sourceEntries:
    readonly LevelV2ShadowMarketEvidenceHistoryEntry[],
): LevelV2ShadowConfirmationCandidate[] {
  const analyses =
    buildLevelV2ShadowMarketEvidenceBehaviorAnalyses(
      sourceEntries,
    );
  const behaviorHistoryStore =
    buildLevelV2ShadowMarketEvidenceBehaviorHistoryStore(
      sourceEntries,
    );

  return analyses
    .map(
      (analysis) => {
        const marketHistory =
          sourceEntries.filter(
            (entry) =>
              entry.evidence
                .classifierId
                === analysis.classifierId,
          );
        const behaviorHistory =
          behaviorHistoryStore.getHistory(
            undefined,
            analysis.classifierId,
            10_000,
          );

        return evaluateLevelV2ShadowConfirmationCandidate(
          analysis,
          behaviorHistory,
          marketHistory,
        );
      },
    )
    .sort(
      (
        left,
        right,
      ) =>
        right.latestSequence
        - left.latestSequence,
    )
    .map(
      cloneLevelV2ShadowConfirmationCandidate,
    );
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

function emptyAvailabilityCounts():
LevelV2ShadowConfirmationCandidateAvailabilityCounts {
  return {
    complete: 0,
    tape_only: 0,
    order_book_only: 0,
    unavailable: 0,
  };
}

export function buildLevelV2ShadowConfirmationCandidateDiagnostics(
  candidates:
    readonly LevelV2ShadowConfirmationCandidate[],
): LevelV2ShadowConfirmationCandidateDiagnostics {
  const verdictCounts =
    emptyVerdictCounts();
  const confidenceCounts =
    emptyConfidenceCounts();
  const availabilityCounts =
    emptyAvailabilityCounts();

  for (
    const candidate
    of candidates
  ) {
    verdictCounts[
      candidate.verdict
    ] += 1;
    confidenceCounts[
      candidate.confidence
    ] += 1;
    availabilityCounts[
      candidate.evidence
        .latestAvailability
    ] += 1;
  }

  return {
    candidatesCount:
      candidates.length,
    symbolsCount:
      new Set(
        candidates.map(
          (candidate) =>
            candidate.symbol,
        ),
      ).size,
    priceAcceptedCount:
      candidates.filter(
        (candidate) =>
          candidate.priceAcceptance,
      ).length,
    verdictCounts,
    confidenceCounts,
    availabilityCounts,
    latestCapturedAt:
      candidates[0]
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
