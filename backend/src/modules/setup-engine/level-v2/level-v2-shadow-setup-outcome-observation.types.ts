import type {
  LevelV2ShadowConfirmationCandidateConfidence,
  LevelV2ShadowConfirmationExpectedDirection,
} from './level-v2-shadow-confirmation-candidate.types.js';
import type {
  LevelV2ShadowMarketEvidenceHistoryStatus,
} from './level-v2-shadow-market-evidence-history.types.js';
import type {
  LevelV2Kind,
} from './level-v2-zones-score.types.js';

export type LevelV2ShadowSetupOutcomeStatus =
  | 'pending'
  | 'successful_continuation'
  | 'failed_reversal'
  | 'mixed';

export interface LevelV2ShadowSetupOutcomeObservationOptions {
  successThresholdPct: number;
  failureThresholdPct: number;
  maxObservationMs: number;
}

export interface LevelV2ShadowSetupOutcomeObservation {
  id: string;
  classifierId: string;
  levelId: string;
  symbol: string;
  timeframe: string;
  currentKind: LevelV2Kind;
  expectedDirection:
    LevelV2ShadowConfirmationExpectedDirection;
  anchorCandidateHistoryEntryId: string;
  anchorCandidateId: string;
  anchorConfidence:
    LevelV2ShadowConfirmationCandidateConfidence;
  startedAt: string;
  startedSequence: number;
  windowEndsAt: string;
  entryPrice: number;
  latestPrice: number;
  latestPriceAt: string;
  latestSourceObservedAt: string;
  observedPricesCount: number;
  durationMs: number;
  observationWindowElapsed: boolean;
  levelReferencePrice:
    number
    | null;
  levelBoundaryPrice:
    number
    | null;
  levelGeometryAvailable: boolean;
  maxFavorableExcursionPct: number;
  maxAdverseExcursionPct: number;
  maxFavorablePrice: number;
  maxAdversePrice: number;
  continuationReached: boolean;
  continuationReachedAt:
    string
    | null;
  adverseThresholdReached: boolean;
  adverseThresholdReachedAt:
    string
    | null;
  returnedInsideLevel:
    boolean
    | null;
  returnedInsideLevelAt:
    string
    | null;
  failureConditionReached: boolean;
  failureConditionReachedAt:
    string
    | null;
  status:
    LevelV2ShadowSetupOutcomeStatus;
  resolvedAt:
    string
    | null;
  timeToOutcomeMs:
    number
    | null;
  reasons: readonly string[];
  options:
    LevelV2ShadowSetupOutcomeObservationOptions;
  observationalOnly: true;
  changesBreakClassification: false;
  changesProductionSetup: false;
  tradeExecution: false;
}

export interface LevelV2ShadowSetupOutcomeStatusCounts {
  pending: number;
  successful_continuation: number;
  failed_reversal: number;
  mixed: number;
}

export interface LevelV2ShadowSetupOutcomeDirectionCounts {
  up: number;
  down: number;
}

export interface LevelV2ShadowSetupOutcomeObservationStatus {
  observationsCount: number;
  classifiersCount: number;
  symbolsCount: number;
  observationsWithLevelGeometryCount: number;
  sourceEntriesCount: number;
  sourceCandidateHistoryEntriesCount: number;
  sourceLevelsCount: number;
  truncatedSourceHistory: boolean;
  sourceHistoryStatus:
    LevelV2ShadowMarketEvidenceHistoryStatus
    | null;
  latestObservedAt:
    string
    | null;
  options:
    LevelV2ShadowSetupOutcomeObservationOptions;
  observationalOnly: true;
  changesBreakClassification: false;
  changesProductionSetup: false;
  tradeExecution: false;
}

export interface LevelV2ShadowSetupOutcomeObservationDiagnostics {
  observationsCount: number;
  statusCounts:
    LevelV2ShadowSetupOutcomeStatusCounts;
  expectedDirectionCounts:
    LevelV2ShadowSetupOutcomeDirectionCounts;
  continuationReachedCount: number;
  adverseThresholdReachedCount: number;
  returnedInsideLevelCount: number;
  failureConditionReachedCount: number;
  averageMaxFavorableExcursionPct:
    number
    | null;
  averageMaxAdverseExcursionPct:
    number
    | null;
  latestObservedAt:
    string
    | null;
  observationalOnly: true;
  changesBreakClassification: false;
  changesProductionSetup: false;
  tradeExecution: false;
}

export interface LevelV2ShadowSetupOutcomeObservationFilters {
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

export interface LevelV2ShadowSetupOutcomeObservationListResponse {
  items:
    readonly LevelV2ShadowSetupOutcomeObservation[];
  count: number;
  totalObservations: number;
  status:
    LevelV2ShadowSetupOutcomeObservationStatus;
  diagnostics:
    LevelV2ShadowSetupOutcomeObservationDiagnostics;
  filters:
    LevelV2ShadowSetupOutcomeObservationFilters;
}
