import type {
  LevelCandidate,
  LevelEngineKind,
  LevelEngineTimeframe,
  LevelEngineZone,
} from './level-engine.types.js';
import type {
  LevelEngineCandle,
  TouchEpisodeDetectionOptions,
} from './level-engine-touch-detector.types.js';

export interface LevelEngineTimeframeDataset {
  readonly symbol: string;
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly candles: readonly LevelEngineCandle[];
}

export interface MultiTimeframeLevelDetectionOptions {
  readonly atrPeriod: number;
  readonly pivotLeftBars: number;
  readonly pivotRightBars: number;
  readonly zoneHalfWidthAtr: number;
  readonly clusterDistanceAtr: number;
  readonly touchEpisodes: TouchEpisodeDetectionOptions;
}

export interface LevelPivotSeed {
  readonly id: string;
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly kind: LevelEngineKind;
  readonly candleIndex: number;
  readonly anchorAt: string;
  readonly confirmedAt: string;
  readonly price: number;
  readonly atrAtPivot: number;
}

export type LevelClusterRejectionReason =
  | 'insufficient_history'
  | 'no_pivot_seed'
  | 'no_confirmed_touch_episode'
  | 'no_causal_touch_episode'
  | 'duplicate_episode_set';

export interface RejectedLevelCluster {
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly kind: LevelEngineKind;
  readonly seedId: string | null;
  readonly zone: LevelEngineZone | null;
  readonly pivotSeedCount: number;
  readonly reason: LevelClusterRejectionReason;
}

export interface TimeframeLevelDetectionResult {
  readonly symbol: string;
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly closedCandlesCount: number;
  readonly ignoredOpenCandlesCount: number;
  readonly pivotSeeds: readonly LevelPivotSeed[];
  readonly candidates: readonly LevelCandidate[];
  readonly rejectedClusters: readonly RejectedLevelCluster[];
}

export interface MultiTimeframeLevelDetectionResult {
  readonly symbol: string;
  readonly requestedTimeframes: readonly LevelEngineTimeframe[];
  readonly timeframes: readonly TimeframeLevelDetectionResult[];
  readonly candidates: readonly LevelCandidate[];
  readonly observationalOnly: true;
  readonly createsSetup: false;
  readonly mergesAcrossTimeframes: false;
}
