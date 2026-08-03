import type {
  LevelV2ShadowConfirmationExpectedDirection,
} from './level-v2-shadow-confirmation-candidate.types.js';
import type {
  LevelV2ShadowMarketEvidenceHistoryStatus,
} from './level-v2-shadow-market-evidence-history.types.js';
import type {
  LevelV2ShadowSetupOutcomeObservation,
  LevelV2ShadowSetupOutcomeStatus,
  LevelV2ShadowSetupOutcomeStatusCounts,
} from './level-v2-shadow-setup-outcome-observation.types.js';

export interface LevelV2ShadowSetupOutcomeHistoryOptions {
  maxEntriesPerClassifier: number;
  maxTotalEntries: number;
}

export interface LevelV2ShadowSetupOutcomeHistoryChanges {
  previousEntryId:
    string
    | null;
  statusBefore:
    LevelV2ShadowSetupOutcomeStatus
    | null;
  statusAfter:
    LevelV2ShadowSetupOutcomeStatus;
  latestPriceBefore:
    number
    | null;
  latestPriceAfter: number;
  latestPriceChangePctBefore:
    number
    | null;
  latestPriceChangePctAfter: number;
  maxFavorableExcursionPctBefore:
    number
    | null;
  maxFavorableExcursionPctAfter: number;
  maxAdverseExcursionPctBefore:
    number
    | null;
  maxAdverseExcursionPctAfter: number;
  observedPricesCountBefore:
    number
    | null;
  observedPricesCountAfter: number;
  durationMsBefore:
    number
    | null;
  durationMsAfter: number;
  continuationReachedBefore:
    boolean
    | null;
  continuationReachedAfter: boolean;
  failureConditionReachedBefore:
    boolean
    | null;
  failureConditionReachedAfter: boolean;
  returnedInsideLevelBefore:
    boolean
    | null;
  returnedInsideLevelAfter:
    boolean
    | null;
  resolvedAtBefore:
    string
    | null;
  resolvedAtAfter:
    string
    | null;
  timeToOutcomeMsBefore:
    number
    | null;
  timeToOutcomeMsAfter:
    number
    | null;
  statusChanged: boolean;
  latestPriceChanged: boolean;
  latestPriceChangePctChanged: boolean;
  maxFavorableExcursionPctChanged: boolean;
  maxAdverseExcursionPctChanged: boolean;
  observedPricesCountChanged: boolean;
  durationMsChanged: boolean;
  continuationReachedChanged: boolean;
  failureConditionReachedChanged: boolean;
  returnedInsideLevelChanged: boolean;
  resolvedAtChanged: boolean;
  timeToOutcomeMsChanged: boolean;
  reasonsChanged: boolean;
}

export interface LevelV2ShadowSetupOutcomeHistoryEntry {
  id: string;
  sequence: number;
  classifierId: string;
  levelId: string;
  symbol: string;
  timeframe: string;
  capturedAt: string;
  latestPriceChangePct: number;
  observation:
    LevelV2ShadowSetupOutcomeObservation;
  changes:
    LevelV2ShadowSetupOutcomeHistoryChanges;
  observationalOnly: true;
  changesBreakClassification: false;
  changesProductionSetup: false;
  tradeExecution: false;
}

export interface LevelV2ShadowSetupOutcomeHistoryStatus {
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
  sourceObservationsCount: number;
  sourceLevelsCount: number;
  truncatedSourceHistory: boolean;
  sourceHistoryStatus:
    LevelV2ShadowMarketEvidenceHistoryStatus
    | null;
  observationalOnly: true;
  changesBreakClassification: false;
  changesProductionSetup: false;
  tradeExecution: false;
}

export interface LevelV2ShadowSetupOutcomeHistoryDiagnostics {
  entriesCount: number;
  statusTransitionsCount: number;
  latestPriceTransitionsCount: number;
  favorableExcursionTransitionsCount: number;
  adverseExcursionTransitionsCount: number;
  continuationTransitionsCount: number;
  failureTransitionsCount: number;
  returnedInsideLevelTransitionsCount: number;
  observedPricesTransitionsCount: number;
  statusCounts:
    LevelV2ShadowSetupOutcomeStatusCounts;
  latestCapturedAt:
    string
    | null;
  observationalOnly: true;
  changesBreakClassification: false;
  changesProductionSetup: false;
  tradeExecution: false;
}

export interface LevelV2ShadowSetupOutcomeHistoryFilters {
  symbol: string | null;
  classifierId: string | null;
  status:
    LevelV2ShadowSetupOutcomeStatus
    | null;
  expectedDirection:
    LevelV2ShadowConfirmationExpectedDirection
    | null;
  limit: number;
}

export interface LevelV2ShadowSetupOutcomeHistoryListResponse {
  items:
    readonly LevelV2ShadowSetupOutcomeHistoryEntry[];
  count: number;
  totalEntries: number;
  status:
    LevelV2ShadowSetupOutcomeHistoryStatus;
  diagnostics:
    LevelV2ShadowSetupOutcomeHistoryDiagnostics;
  filters:
    LevelV2ShadowSetupOutcomeHistoryFilters;
}
