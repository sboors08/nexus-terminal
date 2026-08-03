import type {
  LevelV2BreakClassificationStatus,
} from './level-v2-break-classification.types.js';
import type {
  LevelV2ShadowMarketEvidenceHistoryStatus,
} from './level-v2-shadow-market-evidence-history.types.js';
import type {
  LevelV2ShadowMarketEvidenceAggressionSide,
  LevelV2ShadowMarketEvidenceBehavior,
  LevelV2ShadowMarketEvidenceBehaviorAnalysis,
  LevelV2ShadowMarketEvidenceBehaviorConfidence,
  LevelV2ShadowMarketEvidenceBehaviorConfidenceCounts,
  LevelV2ShadowMarketEvidenceBehaviorCounts,
  LevelV2ShadowMarketEvidencePriceDirection,
} from './level-v2-shadow-market-evidence-behavior-analysis.types.js';

export interface LevelV2ShadowMarketEvidenceBehaviorHistoryOptions {
  maxEntriesPerClassifier: number;
  maxTotalEntries: number;
}

export interface LevelV2ShadowMarketEvidenceBehaviorHistoryChanges {
  previousEntryId:
    string
    | null;
  behaviorBefore:
    LevelV2ShadowMarketEvidenceBehavior
    | null;
  behaviorAfter:
    LevelV2ShadowMarketEvidenceBehavior;
  confidenceBefore:
    LevelV2ShadowMarketEvidenceBehaviorConfidence
    | null;
  confidenceAfter:
    LevelV2ShadowMarketEvidenceBehaviorConfidence;
  aggressionSideBefore:
    LevelV2ShadowMarketEvidenceAggressionSide
    | null;
  aggressionSideAfter:
    LevelV2ShadowMarketEvidenceAggressionSide;
  priceDirectionBefore:
    LevelV2ShadowMarketEvidencePriceDirection
    | null;
  priceDirectionAfter:
    LevelV2ShadowMarketEvidencePriceDirection;
  classificationStatusBefore:
    LevelV2BreakClassificationStatus
    | null;
  classificationStatusAfter:
    LevelV2BreakClassificationStatus;
  behaviorChanged: boolean;
  confidenceChanged: boolean;
  aggressionSideChanged: boolean;
  priceDirectionChanged: boolean;
  classificationStatusChanged: boolean;
  reasonsChanged: boolean;
}

export interface LevelV2ShadowMarketEvidenceBehaviorHistoryEntry {
  id: string;
  sequence: number;
  classifierId: string;
  levelId: string;
  symbol: string;
  timeframe: string;
  capturedAt: string;
  analysis:
    LevelV2ShadowMarketEvidenceBehaviorAnalysis;
  changes:
    LevelV2ShadowMarketEvidenceBehaviorHistoryChanges;
  observationalOnly: true;
  changesBreakClassification: false;
}

export interface LevelV2ShadowMarketEvidenceBehaviorHistoryStatus {
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
}

export interface LevelV2ShadowMarketEvidenceBehaviorHistoryDiagnostics {
  entriesCount: number;
  behaviorTransitionsCount: number;
  confidenceTransitionsCount: number;
  aggressionSideTransitionsCount: number;
  priceDirectionTransitionsCount: number;
  classificationTransitionsCount: number;
  behaviorCounts:
    LevelV2ShadowMarketEvidenceBehaviorCounts;
  confidenceCounts:
    LevelV2ShadowMarketEvidenceBehaviorConfidenceCounts;
  latestCapturedAt:
    string
    | null;
  observationalOnly: true;
}

export interface LevelV2ShadowMarketEvidenceBehaviorHistoryFilters {
  symbol: string | null;
  classifierId: string | null;
  behavior:
    LevelV2ShadowMarketEvidenceBehavior
    | null;
  confidence:
    LevelV2ShadowMarketEvidenceBehaviorConfidence
    | null;
  limit: number;
}

export interface LevelV2ShadowMarketEvidenceBehaviorHistoryListResponse {
  items:
    readonly LevelV2ShadowMarketEvidenceBehaviorHistoryEntry[];
  count: number;
  totalEntries: number;
  status:
    LevelV2ShadowMarketEvidenceBehaviorHistoryStatus;
  diagnostics:
    LevelV2ShadowMarketEvidenceBehaviorHistoryDiagnostics;
  filters:
    LevelV2ShadowMarketEvidenceBehaviorHistoryFilters;
}
