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
  evaluationOptions?:
    LevelV2ShadowEvaluationOptions;
  now: () => Date;
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
}

export type LevelV2ShadowRuntimeSource =
  SetupDetectionRuntimeSource;

export type LevelV2ShadowRejectionCode =
  LevelV2ZoneRejectionCode;
