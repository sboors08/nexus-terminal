import type {
  LevelEngineKind,
  LevelEngineTimeframe,
} from './level-engine.types.js';
import type {
  ObservationTrackingResult,
} from './observation-tracker.types.js';

export const APPROACH_ENGINE_CONTRACT_VERSION =
  'approach-engine-v0.1' as const;

export interface ApproachEvaluationOptions {
  readonly maxDistanceToLevelPercent:
    number;
}

export interface LevelLineApproachEvaluation {
  readonly lineId: string;
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly kind: LevelEngineKind;
  readonly levelPrice: number;
  readonly currentPrice: number;
  readonly currentCandleIndex: number;
  readonly currentCandleOpenTime: string;
  readonly observedAt: string;
  readonly observationProgress: number;
  readonly observationStage:
    'OBSERVATION' | null;
  readonly distanceToLevelPercent: number;
  readonly maxDistanceToLevelPercent:
    number;
  readonly stage: 'APPROACH' | null;
}

export interface ApproachEvaluationInput {
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly observationTracking:
    ObservationTrackingResult;
}

export interface ApproachEvaluationResult {
  readonly version:
    typeof APPROACH_ENGINE_CONTRACT_VERSION;
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly closedCandlesCount: number;
  readonly ignoredOpenCandlesCount: number;
  readonly currentPrice: number | null;
  readonly currentCandleIndex: number | null;
  readonly currentCandleOpenTime:
    string | null;
  readonly observedAt: string | null;
  readonly evaluations:
    readonly LevelLineApproachEvaluation[];
  readonly appliedOptions:
    ApproachEvaluationOptions;
  readonly observationalOnly: true;
  readonly evaluatesApproach: true;
  readonly createsRealtimeConfirmation:
    false;
  readonly createsSetup: false;
  readonly createsSignal: false;
  readonly usesFutureCandles: false;
}
