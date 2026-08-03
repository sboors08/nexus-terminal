import type {
  LevelV2BreakClassificationStatus,
} from './level-v2-break-classification.types.js';
import type {
  LevelV2ShadowMarketEvidenceBehavior,
} from './level-v2-shadow-market-evidence-behavior-analysis.types.js';
import type {
  LevelV2ShadowMarketEvidenceHistoryStatus,
} from './level-v2-shadow-market-evidence-history.types.js';
import type {
  LevelV2ShadowConfirmationCandidate,
  LevelV2ShadowConfirmationCandidateConfidence,
  LevelV2ShadowConfirmationCandidateConfidenceCounts,
  LevelV2ShadowConfirmationCandidateVerdict,
  LevelV2ShadowConfirmationCandidateVerdictCounts,
  LevelV2ShadowConfirmationPostEventReaction,
} from './level-v2-shadow-confirmation-candidate.types.js';

export interface LevelV2ShadowConfirmationCandidateHistoryOptions {
  maxEntriesPerClassifier: number;
  maxTotalEntries: number;
}

export interface LevelV2ShadowConfirmationCandidateHistoryChanges {
  previousEntryId:
    string
    | null;
  verdictBefore:
    LevelV2ShadowConfirmationCandidateVerdict
    | null;
  verdictAfter:
    LevelV2ShadowConfirmationCandidateVerdict;
  confidenceBefore:
    LevelV2ShadowConfirmationCandidateConfidence
    | null;
  confidenceAfter:
    LevelV2ShadowConfirmationCandidateConfidence;
  classificationStatusBefore:
    LevelV2BreakClassificationStatus
    | null;
  classificationStatusAfter:
    LevelV2BreakClassificationStatus;
  behaviorBefore:
    LevelV2ShadowMarketEvidenceBehavior
    | null;
  behaviorAfter:
    LevelV2ShadowMarketEvidenceBehavior;
  priceAcceptanceBefore:
    boolean
    | null;
  priceAcceptanceAfter: boolean;
  postEventReactionBefore:
    LevelV2ShadowConfirmationPostEventReaction
    | null;
  postEventReactionAfter:
    LevelV2ShadowConfirmationPostEventReaction;
  latestAvailabilityBefore:
    LevelV2ShadowConfirmationCandidate['evidence']['latestAvailability']
    | null;
  latestAvailabilityAfter:
    LevelV2ShadowConfirmationCandidate['evidence']['latestAvailability'];
  verdictChanged: boolean;
  confidenceChanged: boolean;
  classificationStatusChanged: boolean;
  behaviorChanged: boolean;
  priceAcceptanceChanged: boolean;
  postEventReactionChanged: boolean;
  latestAvailabilityChanged: boolean;
  reasonsChanged: boolean;
}

export interface LevelV2ShadowConfirmationCandidateHistoryEntry {
  id: string;
  sequence: number;
  classifierId: string;
  levelId: string;
  symbol: string;
  timeframe: string;
  capturedAt: string;
  candidate:
    LevelV2ShadowConfirmationCandidate;
  changes:
    LevelV2ShadowConfirmationCandidateHistoryChanges;
  observationalOnly: true;
  changesBreakClassification: false;
  tradeConfirmation: false;
}

export interface LevelV2ShadowConfirmationCandidateHistoryStatus {
  entriesCount: number;
  classifiersCount: number;
  symbolsCount: number;
  maxEntriesPerClassifier: number;
  maxTotalEntries: number;
  droppedEntriesCount: number;
  deduplicatedEntriesCount: number;
  oldestCapturedAt:
    string
    | null;
  latestCapturedAt:
    string
    | null;
  sourceEntriesCount: number;
  truncatedSourceHistory: boolean;
  sourceHistoryStatus:
    LevelV2ShadowMarketEvidenceHistoryStatus
    | null;
  observationalOnly: true;
  changesBreakClassification: false;
  tradeConfirmation: false;
}

export interface LevelV2ShadowConfirmationCandidateHistoryDiagnostics {
  entriesCount: number;
  verdictTransitionsCount: number;
  confidenceTransitionsCount: number;
  classificationTransitionsCount: number;
  behaviorTransitionsCount: number;
  priceAcceptanceTransitionsCount: number;
  postEventReactionTransitionsCount: number;
  availabilityTransitionsCount: number;
  verdictCounts:
    LevelV2ShadowConfirmationCandidateVerdictCounts;
  confidenceCounts:
    LevelV2ShadowConfirmationCandidateConfidenceCounts;
  latestCapturedAt:
    string
    | null;
  observationalOnly: true;
  changesBreakClassification: false;
  tradeConfirmation: false;
}

export interface LevelV2ShadowConfirmationCandidateHistoryFilters {
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

export interface LevelV2ShadowConfirmationCandidateHistoryListResponse {
  items:
    readonly LevelV2ShadowConfirmationCandidateHistoryEntry[];
  count: number;
  totalEntries: number;
  status:
    LevelV2ShadowConfirmationCandidateHistoryStatus;
  diagnostics:
    LevelV2ShadowConfirmationCandidateHistoryDiagnostics;
  filters:
    LevelV2ShadowConfirmationCandidateHistoryFilters;
}
