import type {
  SetupDetectionTriggerSource,
} from '../setup-detection-runtime.types.js';
import type {
  LevelV2ShadowEvaluationSummary,
} from './level-v2-shadow-evaluation.types.js';
import type {
  LevelV2LifecycleStatus,
} from './level-v2-lifecycle.types.js';
import type {
  LevelV2Kind,
} from './level-v2-zones-score.types.js';

export interface LevelV2ShadowHistoryOptions {
  maxEntriesPerSymbol: number;
  maxTotalEntries: number;
}

export interface LevelV2ShadowHistoryLevelState {
  id: string;
  kind: LevelV2Kind;
  status: LevelV2LifecycleStatus;
  eligibleForSetups: boolean;
  referencePrice: number;
  score: number;
  touchesCount: number;
  qualifiedTouchesCount: number;
}

export interface LevelV2ShadowHistoryLifecycleTransition {
  levelId: string;
  fromStatus:
    LevelV2LifecycleStatus
    | null;
  toStatus: LevelV2LifecycleStatus;
  eligibleBefore:
    boolean
    | null;
  eligibleAfter: boolean;
}

export interface LevelV2ShadowHistoryChanges {
  previousEntryId:
    string
    | null;
  addedLevelIds: readonly string[];
  removedLevelIds: readonly string[];
  lifecycleTransitions:
    readonly LevelV2ShadowHistoryLifecycleTransition[];
  matchRateDeltaPct:
    number
    | null;
  eligibleLevelsDelta:
    number
    | null;
}

export interface LevelV2ShadowHistoryEntry {
  id: string;
  sequence: number;
  symbol: string;
  timeframe: '1m';
  generatedAt: string;
  triggerSource:
    SetupDetectionTriggerSource;
  sourceCandlesCount: number;
  closedCandlesCount: number;
  detectedZonesCount: number;
  rejectedZonesCount: number;
  levelsCount: number;
  eligibleLevelsCount: number;
  evaluationSummary:
    LevelV2ShadowEvaluationSummary;
  lifecycleStatusCounts:
    Record<
      LevelV2LifecycleStatus,
      number
    >;
  levels:
    readonly LevelV2ShadowHistoryLevelState[];
  changes:
    LevelV2ShadowHistoryChanges;
}

export interface LevelV2ShadowHistoryStatus {
  entriesCount: number;
  symbolsCount: number;
  maxEntriesPerSymbol: number;
  maxTotalEntries: number;
  droppedEntriesCount: number;
  deduplicatedEntriesCount: number;
  oldestGeneratedAt:
    string
    | null;
  latestGeneratedAt:
    string
    | null;
}
