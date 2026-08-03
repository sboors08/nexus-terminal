import type {
  LevelV2BreakClassificationStatus,
} from './level-v2-break-classification.types.js';
import type {
  LevelV2ShadowMarketEvidence,
  LevelV2ShadowMarketEvidenceAvailability,
} from './level-v2-shadow-market-evidence.types.js';

export interface LevelV2ShadowMarketEvidenceHistoryOptions {
  maxEntriesPerClassifier: number;
  maxTotalEntries: number;
}

export interface LevelV2ShadowMarketEvidenceHistoryChanges {
  previousEntryId:
    string
    | null;
  classificationStatusBefore:
    LevelV2BreakClassificationStatus
    | null;
  classificationStatusAfter:
    LevelV2BreakClassificationStatus;
  availabilityBefore:
    LevelV2ShadowMarketEvidenceAvailability
    | null;
  availabilityAfter:
    LevelV2ShadowMarketEvidenceAvailability;
  tapeQuoteDeltaChange:
    number
    | null;
  tapeBuySharePctChange:
    number
    | null;
  tapePriceChangePctChange:
    number
    | null;
  tapeDominantSideChanged: boolean;
  orderBookImbalancePctChange:
    number
    | null;
  orderBookBidDepthQuoteChange:
    number
    | null;
  orderBookAskDepthQuoteChange:
    number
    | null;
  orderBookSpreadPctChange:
    number
    | null;
  orderBookStateChanged: boolean;
  sourceErrorsChanged: boolean;
}

export interface LevelV2ShadowMarketEvidenceHistoryEntry {
  id: string;
  sequence: number;
  evidence:
    LevelV2ShadowMarketEvidence;
  changes:
    LevelV2ShadowMarketEvidenceHistoryChanges;
}

export interface LevelV2ShadowMarketEvidenceHistoryStatus {
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
}

export interface LevelV2ShadowMarketEvidenceHistoryFilters {
  symbol: string | null;
  classifierId: string | null;
  limit: number;
}

export interface LevelV2ShadowMarketEvidenceHistoryListResponse {
  items:
    readonly LevelV2ShadowMarketEvidenceHistoryEntry[];
  count: number;
  totalEntries: number;
  status:
    LevelV2ShadowMarketEvidenceHistoryStatus;
  filters:
    LevelV2ShadowMarketEvidenceHistoryFilters;
}
