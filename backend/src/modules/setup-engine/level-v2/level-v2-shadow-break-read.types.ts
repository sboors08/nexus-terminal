import type {
  LevelV2BreakClassificationEvent,
  LevelV2BreakClassificationState,
  LevelV2BreakClassificationStatus,
} from './level-v2-break-classification.types.js';
import type {
  LevelV2ShadowMarketEvidence,
} from './level-v2-shadow-market-evidence.types.js';
import type {
  LevelV2ShadowRuntimeStatus,
} from './level-v2-shadow-runtime.types.js';
import type {
  LevelV2Kind,
} from './level-v2-zones-score.types.js';

export interface LevelV2ShadowBreakReadFilters {
  symbol: string | null;
  levelId: string | null;
  kind: LevelV2Kind | null;
  status: LevelV2BreakClassificationStatus | null;
  limit: number;
}

export interface LevelV2ShadowBreakReadItem {
  symbol: string;
  timeframe: '1m';
  generatedAt: string;
  state: LevelV2BreakClassificationState;
  events: readonly LevelV2BreakClassificationEvent[];
  marketEvidence:
    LevelV2ShadowMarketEvidence
    | null;
}

export interface LevelV2ShadowBreakReadListResponse {
  items: readonly LevelV2ShadowBreakReadItem[];
  count: number;
  matchedCount: number;
  totalClassifications: number;
  filters: LevelV2ShadowBreakReadFilters;
}

export interface LevelV2ShadowBreakDiagnostics {
  runtime: LevelV2ShadowRuntimeStatus;
  symbolsCount: number;
  classificationsCount: number;
  eventsCount: number;
  marketEvidenceCount: number;
  completeMarketEvidenceCount: number;
  tapeAvailableCount: number;
  orderBookAvailableCount: number;
  marketEvidenceSourceErrorsCount: number;
  statusCounts:
    Record<
      LevelV2BreakClassificationStatus,
      number
    >;
  kindCounts:
    Record<
      LevelV2Kind,
      number
    >;
  maxPenetrationDepthPct: number;
  latestGeneratedAt: string | null;
}
