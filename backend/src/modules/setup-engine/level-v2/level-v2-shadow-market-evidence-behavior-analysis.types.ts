import type {
  LevelV2BreakClassificationStatus,
} from './level-v2-break-classification.types.js';
import type {
  LevelV2ShadowMarketEvidenceHistoryStatus,
} from './level-v2-shadow-market-evidence-history.types.js';
import type {
  LevelV2Kind,
} from './level-v2-zones-score.types.js';

export type LevelV2ShadowMarketEvidenceBehavior =
  | 'directional_continuation'
  | 'aggressive_buy_absorption'
  | 'aggressive_sell_absorption'
  | 'momentum_exhaustion'
  | 'mixed'
  | 'insufficient_data';

export type LevelV2ShadowMarketEvidenceBehaviorConfidence =
  | 'low'
  | 'medium'
  | 'high';

export type LevelV2ShadowMarketEvidenceAggressionSide =
  | 'buy'
  | 'sell'
  | 'balanced'
  | 'unknown';

export type LevelV2ShadowMarketEvidencePriceDirection =
  | 'up'
  | 'down'
  | 'flat'
  | 'unknown';

export interface LevelV2ShadowMarketEvidenceBehaviorAnalysisOptions {
  minTapeEntries: number;
  priceMoveThresholdPct: number;
  dominantBuySharePct: number;
  orderBookImbalanceThresholdPct: number;
  exhaustionActivityRatio: number;
  exhaustionDeltaRatio: number;
}

export interface LevelV2ShadowMarketEvidenceBehaviorMetrics {
  sourceEntriesCount: number;
  usableTapeEntriesCount: number;
  completeEntriesCount: number;
  classificationTransitionsCount: number;
  firstTradePrice: number | null;
  latestTradePrice: number | null;
  netPriceChangePct: number | null;
  latestQuoteDelta: number | null;
  quoteDeltaChange: number | null;
  latestBuySharePct: number | null;
  buySharePctChange: number | null;
  latestTotalQuoteValue: number | null;
  activityRatioToPrevious: number | null;
  deltaRatioToPrevious: number | null;
  latestOrderBookImbalancePct: number | null;
  orderBookImbalancePctChange: number | null;
}

export interface LevelV2ShadowMarketEvidenceBehaviorAnalysis {
  id: string;
  classifierId: string;
  levelId: string;
  symbol: string;
  timeframe: string;
  currentKind: LevelV2Kind;
  latestClassificationStatus:
    LevelV2BreakClassificationStatus;
  firstSequence: number;
  latestSequence: number;
  firstCapturedAt: string;
  latestCapturedAt: string;
  behavior:
    LevelV2ShadowMarketEvidenceBehavior;
  confidence:
    LevelV2ShadowMarketEvidenceBehaviorConfidence;
  aggressionSide:
    LevelV2ShadowMarketEvidenceAggressionSide;
  priceDirection:
    LevelV2ShadowMarketEvidencePriceDirection;
  reasons: readonly string[];
  metrics:
    LevelV2ShadowMarketEvidenceBehaviorMetrics;
  observationalOnly: true;
  changesBreakClassification: false;
}

export interface LevelV2ShadowMarketEvidenceBehaviorCounts {
  directional_continuation: number;
  aggressive_buy_absorption: number;
  aggressive_sell_absorption: number;
  momentum_exhaustion: number;
  mixed: number;
  insufficient_data: number;
}

export interface LevelV2ShadowMarketEvidenceBehaviorConfidenceCounts {
  low: number;
  medium: number;
  high: number;
}

export interface LevelV2ShadowMarketEvidenceBehaviorDiagnostics {
  sourceEntriesCount: number;
  analyzedClassifiersCount: number;
  symbolsCount: number;
  behaviorCounts:
    LevelV2ShadowMarketEvidenceBehaviorCounts;
  confidenceCounts:
    LevelV2ShadowMarketEvidenceBehaviorConfidenceCounts;
  latestCapturedAt: string | null;
  truncatedSourceHistory: boolean;
  sourceHistoryStatus:
    LevelV2ShadowMarketEvidenceHistoryStatus
    | null;
  observationalOnly: true;
}

export interface LevelV2ShadowMarketEvidenceBehaviorFilters {
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

export interface LevelV2ShadowMarketEvidenceBehaviorListResponse {
  items:
    readonly LevelV2ShadowMarketEvidenceBehaviorAnalysis[];
  count: number;
  totalAnalyses: number;
  diagnostics:
    LevelV2ShadowMarketEvidenceBehaviorDiagnostics;
  filters:
    LevelV2ShadowMarketEvidenceBehaviorFilters;
}
