import type {
  LevelV2BreakClassificationStatus,
} from './level-v2-break-classification.types.js';
import type {
  LevelV2ShadowMarketEvidenceAggressionSide,
  LevelV2ShadowMarketEvidenceBehavior,
  LevelV2ShadowMarketEvidenceBehaviorConfidence,
  LevelV2ShadowMarketEvidencePriceDirection,
} from './level-v2-shadow-market-evidence-behavior-analysis.types.js';
import type {
  LevelV2ShadowMarketEvidenceAvailability,
} from './level-v2-shadow-market-evidence.types.js';
import type {
  LevelV2Kind,
} from './level-v2-zones-score.types.js';

export type LevelV2ShadowConfirmationCandidateVerdict =
  | 'supported'
  | 'contradicted'
  | 'mixed'
  | 'insufficient_data';

export type LevelV2ShadowConfirmationCandidateConfidence =
  | 'low'
  | 'medium'
  | 'high';

export type LevelV2ShadowConfirmationExpectedDirection =
  | 'up'
  | 'down';

export type LevelV2ShadowConfirmationPostEventReaction =
  | 'continuation'
  | 'rejection'
  | 'stall'
  | 'unknown';

export interface LevelV2ShadowConfirmationCandidateEvidence {
  latestAvailability:
    LevelV2ShadowMarketEvidenceAvailability;
  latestEvidenceCapturedAt: string;
  marketEvidenceEntriesCount: number;
  usableTapeEntriesCount: number;
  completeEntriesCount: number;
  behaviorHistoryEntriesCount: number;
  stableBehaviorEntriesCount: number;
  contradictoryBehaviorEntriesCount: number;
  netPriceChangePct:
    number
    | null;
  latestOrderBookImbalancePct:
    number
    | null;
}

export interface LevelV2ShadowConfirmationCandidate {
  id: string;
  classifierId: string;
  levelId: string;
  symbol: string;
  timeframe: string;
  currentKind: LevelV2Kind;
  latestSequence: number;
  capturedAt: string;
  latestClassificationStatus:
    LevelV2BreakClassificationStatus;
  expectedDirection:
    LevelV2ShadowConfirmationExpectedDirection;
  priceAcceptance: boolean;
  behavior:
    LevelV2ShadowMarketEvidenceBehavior;
  behaviorConfidence:
    LevelV2ShadowMarketEvidenceBehaviorConfidence;
  aggressionSide:
    LevelV2ShadowMarketEvidenceAggressionSide;
  priceDirection:
    LevelV2ShadowMarketEvidencePriceDirection;
  postEventReaction:
    LevelV2ShadowConfirmationPostEventReaction;
  verdict:
    LevelV2ShadowConfirmationCandidateVerdict;
  confidence:
    LevelV2ShadowConfirmationCandidateConfidence;
  reasons: readonly string[];
  evidence:
    LevelV2ShadowConfirmationCandidateEvidence;
  observationalOnly: true;
  changesBreakClassification: false;
  tradeConfirmation: false;
}

export interface LevelV2ShadowConfirmationCandidateVerdictCounts {
  supported: number;
  contradicted: number;
  mixed: number;
  insufficient_data: number;
}

export interface LevelV2ShadowConfirmationCandidateConfidenceCounts {
  low: number;
  medium: number;
  high: number;
}

export interface LevelV2ShadowConfirmationCandidateAvailabilityCounts {
  complete: number;
  tape_only: number;
  order_book_only: number;
  unavailable: number;
}

export interface LevelV2ShadowConfirmationCandidateDiagnostics {
  candidatesCount: number;
  symbolsCount: number;
  priceAcceptedCount: number;
  verdictCounts:
    LevelV2ShadowConfirmationCandidateVerdictCounts;
  confidenceCounts:
    LevelV2ShadowConfirmationCandidateConfidenceCounts;
  availabilityCounts:
    LevelV2ShadowConfirmationCandidateAvailabilityCounts;
  latestCapturedAt:
    string
    | null;
  observationalOnly: true;
  changesBreakClassification: false;
  tradeConfirmation: false;
}

export interface LevelV2ShadowConfirmationCandidateFilters {
  symbol: string | null;
  classifierId: string | null;
  verdict:
    LevelV2ShadowConfirmationCandidateVerdict
    | null;
  confidence:
    LevelV2ShadowConfirmationCandidateConfidence
    | null;
  limit: number;
}

export interface LevelV2ShadowConfirmationCandidateListResponse {
  items:
    readonly LevelV2ShadowConfirmationCandidate[];
  count: number;
  totalCandidates: number;
  diagnostics:
    LevelV2ShadowConfirmationCandidateDiagnostics;
  filters:
    LevelV2ShadowConfirmationCandidateFilters;
}
