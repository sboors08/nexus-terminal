import type {
  LevelV2ShadowConfirmationCandidateConfidence,
  LevelV2ShadowConfirmationExpectedDirection,
} from './level-v2-shadow-confirmation-candidate.types.js';
import type {
  LevelV2ShadowConfirmationCandidateHistoryEntry,
} from './level-v2-shadow-confirmation-candidate-history.types.js';
import type {
  LevelV2ShadowMarketEvidenceHistoryStatus,
} from './level-v2-shadow-market-evidence-history.types.js';
import type {
  LevelV2ShadowSetupOutcomeHistoryEntry,
} from './level-v2-shadow-setup-outcome-history.types.js';
import type {
  LevelV2ShadowSetupOutcomeObservation,
  LevelV2ShadowSetupOutcomeStatus,
} from './level-v2-shadow-setup-outcome-observation.types.js';
import type {
  LevelV2Kind,
} from './level-v2-zones-score.types.js';

export type LevelV2ShadowSetupQualityLabel =
  | 'successful'
  | 'failed'
  | 'mixed'
  | 'unresolved';

export interface LevelV2ShadowSetupQualityStartContext {
  capturedAt: string;
  latestSequence: number;
  classificationStatus:
    LevelV2ShadowConfirmationCandidateHistoryEntry[
      'candidate'
    ][
      'latestClassificationStatus'
    ];
  expectedDirection:
    LevelV2ShadowConfirmationExpectedDirection;
  priceAcceptance: boolean;
  behavior:
    LevelV2ShadowConfirmationCandidateHistoryEntry[
      'candidate'
    ][
      'behavior'
    ];
  behaviorConfidence:
    LevelV2ShadowConfirmationCandidateHistoryEntry[
      'candidate'
    ][
      'behaviorConfidence'
    ];
  aggressionSide:
    LevelV2ShadowConfirmationCandidateHistoryEntry[
      'candidate'
    ][
      'aggressionSide'
    ];
  priceDirection:
    LevelV2ShadowConfirmationCandidateHistoryEntry[
      'candidate'
    ][
      'priceDirection'
    ];
  postEventReaction:
    LevelV2ShadowConfirmationCandidateHistoryEntry[
      'candidate'
    ][
      'postEventReaction'
    ];
  verdict:
    LevelV2ShadowConfirmationCandidateHistoryEntry[
      'candidate'
    ][
      'verdict'
    ];
  confidence:
    LevelV2ShadowConfirmationCandidateConfidence;
  reasons: readonly string[];
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
  latestAvailability:
    LevelV2ShadowConfirmationCandidateHistoryEntry[
      'candidate'
    ][
      'evidence'
    ][
      'latestAvailability'
    ];
  latestEvidenceCapturedAt: string;
}

export interface LevelV2ShadowSetupQualityMetrics {
  entryPrice: number;
  latestPrice: number;
  latestPriceChangePct: number;
  maxFavorableExcursionPct: number;
  maxAdverseExcursionPct: number;
  observedPricesCount: number;
  durationMs: number;
  continuationReached: boolean;
  failureConditionReached: boolean;
  returnedInsideLevel:
    boolean
    | null;
  timeToOutcomeMs:
    number
    | null;
}

export interface LevelV2ShadowSetupQualitySample {
  id: string;
  version: 'v0.1';
  classifierId: string;
  levelId: string;
  symbol: string;
  timeframe: string;
  currentKind: LevelV2Kind;
  expectedDirection:
    LevelV2ShadowConfirmationExpectedDirection;
  generatedAt: string;
  contextCutoffSequence: number;
  qualityLabel:
    LevelV2ShadowSetupQualityLabel;
  resolved: boolean;
  outcomeStatus:
    LevelV2ShadowSetupOutcomeStatus;
  anchorCandidateHistoryEntryId: string;
  anchorCandidateId: string;
  anchorCandidateHistoryEntry:
    LevelV2ShadowConfirmationCandidateHistoryEntry;
  confirmationHistory:
    readonly LevelV2ShadowConfirmationCandidateHistoryEntry[];
  outcomeHistory:
    readonly LevelV2ShadowSetupOutcomeHistoryEntry[];
  finalOutcome:
    LevelV2ShadowSetupOutcomeObservation;
  startContext:
    LevelV2ShadowSetupQualityStartContext;
  metrics:
    LevelV2ShadowSetupQualityMetrics;
  preOutcomeContextOnly: true;
  observationalOnly: true;
  changesBreakClassification: false;
  changesProductionSetup: false;
  tradeExecution: false;
  trainingApplied: false;
}

export interface LevelV2ShadowSetupQualityLabelCounts {
  successful: number;
  failed: number;
  mixed: number;
  unresolved: number;
}

export interface LevelV2ShadowSetupQualityDirectionCounts {
  up: number;
  down: number;
}

export interface LevelV2ShadowSetupQualitySampleStatus {
  samplesCount: number;
  resolvedSamplesCount: number;
  unresolvedSamplesCount: number;
  classifiersCount: number;
  symbolsCount: number;
  sourceEntriesCount: number;
  sourceCandidateHistoryEntriesCount: number;
  sourceOutcomeHistoryEntriesCount: number;
  sourceLevelsCount: number;
  missingAnchorCandidatesCount: number;
  truncatedSourceHistory: boolean;
  sourceHistoryStatus:
    LevelV2ShadowMarketEvidenceHistoryStatus
    | null;
  latestGeneratedAt:
    string
    | null;
  observationalOnly: true;
  changesBreakClassification: false;
  changesProductionSetup: false;
  tradeExecution: false;
  trainingApplied: false;
}

export interface LevelV2ShadowSetupQualitySampleDiagnostics {
  samplesCount: number;
  labelCounts:
    LevelV2ShadowSetupQualityLabelCounts;
  expectedDirectionCounts:
    LevelV2ShadowSetupQualityDirectionCounts;
  highConfidenceAnchorCount: number;
  priceAcceptedAnchorCount: number;
  averageMaxFavorableExcursionPct:
    number
    | null;
  averageMaxAdverseExcursionPct:
    number
    | null;
  averageTimeToOutcomeMs:
    number
    | null;
  latestGeneratedAt:
    string
    | null;
  observationalOnly: true;
  changesBreakClassification: false;
  changesProductionSetup: false;
  tradeExecution: false;
  trainingApplied: false;
}

export interface LevelV2ShadowSetupQualitySampleFilters {
  symbol: string | null;
  classifierId: string | null;
  qualityLabel:
    LevelV2ShadowSetupQualityLabel
    | null;
  expectedDirection:
    LevelV2ShadowConfirmationExpectedDirection
    | null;
  outcomeStatus:
    LevelV2ShadowSetupOutcomeStatus
    | null;
  limit: number;
}

export interface LevelV2ShadowSetupQualitySampleSnapshot {
  samples:
    readonly LevelV2ShadowSetupQualitySample[];
  status:
    LevelV2ShadowSetupQualitySampleStatus;
  diagnostics:
    LevelV2ShadowSetupQualitySampleDiagnostics;
}

export interface LevelV2ShadowSetupQualitySampleListResponse {
  items:
    readonly LevelV2ShadowSetupQualitySample[];
  count: number;
  totalSamples: number;
  status:
    LevelV2ShadowSetupQualitySampleStatus;
  diagnostics:
    LevelV2ShadowSetupQualitySampleDiagnostics;
  filters:
    LevelV2ShadowSetupQualitySampleFilters;
}
