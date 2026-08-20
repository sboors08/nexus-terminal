import type {
  LevelV2BreakClassificationEvent,
  LevelV2BreakClassificationOptions,
  LevelV2BreakClassificationState,
} from './level-v2-break-classification.types.js';
import type {
  LevelV2FoundationOptions,
} from './level-v2.types.js';
import type {
  LevelV2LifecycleEvent,
  LevelV2LifecycleOptions,
  LevelV2LifecycleState,
} from './level-v2-lifecycle.types.js';
import type {
  LevelV2ZoneRejectionCode,
  LevelV2ZonesScoreOptions,
} from './level-v2-zones-score.types.js';
import type {
  LevelV2ShadowEvaluation,
  LevelV2ShadowEvaluationOptions,
} from './level-v2-shadow-evaluation.types.js';
import type {
  LevelV2ShadowHistoryEntry,
  LevelV2ShadowHistoryOptions,
  LevelV2ShadowHistoryStatus,
} from './level-v2-shadow-history.types.js';
import type {
  LevelV2ShadowMarketEvidence,
} from './level-v2-shadow-market-evidence.types.js';
import type {
  LevelV2ShadowMarketEvidenceHistoryEntry,
  LevelV2ShadowMarketEvidenceHistoryOptions,
  LevelV2ShadowMarketEvidenceHistoryStatus,
} from './level-v2-shadow-market-evidence-history.types.js';
import type {
  SetupDetectionRuntimeSource,
  SetupDetectionTriggerSource,
} from '../setup-detection-runtime.types.js';

export type LevelV2ShadowRuntimeState =
  | 'idle'
  | 'running'
  | 'stopped';

export interface LevelV2ShadowRuntimeOptions {
  maxCandles: number;
  foundationOptions: LevelV2FoundationOptions;
  zonesScoreOptions: LevelV2ZonesScoreOptions;
  lifecycleOptions: LevelV2LifecycleOptions;
  breakClassificationOptions?:
    LevelV2BreakClassificationOptions;
  historyOptions?:
    LevelV2ShadowHistoryOptions;
  marketEvidenceHistoryOptions?:
    LevelV2ShadowMarketEvidenceHistoryOptions;
  evaluationOptions?:
    LevelV2ShadowEvaluationOptions;
  now: () => Date;

  /*
   * Heavy shadow scans must never run directly in the
   * realtime ingestion callback.
   *
   * Production uses setImmediate. Tests may inject a
   * deterministic scheduler.
   */
  schedule?: (
    task: () => void,
  ) => void;
}

export interface LevelV2ShadowRejectionCounts {
  insufficientTouches: number;
  acceptanceZone: number;
  structureMidrange: number;
  scoreBelowThreshold: number;
}

export interface LevelV2ShadowSnapshot {
  symbol: string;
  timeframe: '1m';
  generatedAt: string;
  triggerSource: SetupDetectionTriggerSource;
  sourceCandlesCount: number;
  closedCandlesCount: number;
  detectedZonesCount: number;
  rejectedZonesCount: number;
  rejectionCounts: LevelV2ShadowRejectionCounts;
  evaluation: LevelV2ShadowEvaluation;
  levels: readonly LevelV2LifecycleState[];
  lifecycleEvents: readonly LevelV2LifecycleEvent[];
  breakClassifications?:
    readonly LevelV2BreakClassificationState[];
  breakClassificationEvents?:
    readonly LevelV2BreakClassificationEvent[];
  marketEvidence?:
    readonly LevelV2ShadowMarketEvidence[];
}

export interface LevelV2ShadowRuntimeStatus {
  state: LevelV2ShadowRuntimeState;
  snapshotsCount: number;
  levelsCount: number;
  eligibleLevelsCount: number;
  scansCount: number;
  failedScans: number;
  lastScanAt: string | null;
  lastTriggerSource: SetupDetectionTriggerSource | null;
  lastError: string | null;
}

export interface LevelV2ShadowRuntimeLifecycle {
  start(): void;
  stop(): void;
}

export interface LevelV2ShadowRuntimeReader {
  getStatus(): LevelV2ShadowRuntimeStatus;
  getSnapshots(): LevelV2ShadowSnapshot[];
  getSnapshot(symbol: string): LevelV2ShadowSnapshot | null;
  getEvaluationHistory?(
    symbol?: string,
    limit?: number,
  ): LevelV2ShadowHistoryEntry[];
  getEvaluationHistoryStatus?(): LevelV2ShadowHistoryStatus;
  getMarketEvidenceHistory?(
    symbol?: string,
    classifierId?: string,
    limit?: number,
  ): LevelV2ShadowMarketEvidenceHistoryEntry[];
  getMarketEvidenceHistoryStatus?():
    LevelV2ShadowMarketEvidenceHistoryStatus;
}

export type LevelV2ShadowRuntimeSource =
  SetupDetectionRuntimeSource;

export type LevelV2ShadowRejectionCode =
  LevelV2ZoneRejectionCode;
