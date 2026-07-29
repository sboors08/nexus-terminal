import type {
  SetupLevelDetectorOptions,
  SetupLevelKind,
} from '../setup-level-detector.types.js';
import type {
  LevelV2LifecycleStatus,
} from './level-v2-lifecycle.types.js';

export interface LevelV2ShadowEvaluationOptions {
  v1DetectorOptions:
    SetupLevelDetectorOptions;
  maxMatchDistancePct: number;
}

export interface LevelV2ShadowComparableLevel {
  id: string;
  symbol: string;
  timeframe: string;
  kind: SetupLevelKind;
  referencePrice: number;
  zoneLow: number;
  zoneHigh: number;
  touchesCount: number;
  status: LevelV2LifecycleStatus;
  eligibleForSetups: boolean;
  score: number;
}

export interface LevelV2ShadowLevelMatch {
  v1LevelId: string;
  v2LevelId: string;
  kind: SetupLevelKind;
  v1CenterPrice: number;
  v2ReferencePrice: number;
  distancePct: number;
  zoneOverlapPct: number;
  v1TouchesCount: number;
  v2TouchesCount: number;
  v2Status: LevelV2LifecycleStatus;
  v2EligibleForSetups: boolean;
  v2Score: number;
}

export interface LevelV2ShadowUnmatchedV1Level {
  id: string;
  kind: SetupLevelKind;
  centerPrice: number;
  touchesCount: number;
}

export interface LevelV2ShadowUnmatchedV2Level {
  id: string;
  kind: SetupLevelKind;
  referencePrice: number;
  touchesCount: number;
  status: LevelV2LifecycleStatus;
  eligibleForSetups: boolean;
  score: number;
}

export interface LevelV2ShadowLifecycleStatusCounts {
  forming: number;
  active: number;
  testing: number;
  broken: number;
  retestPending: number;
  flipped: number;
  expired: number;
}

export interface LevelV2ShadowEvaluationSummary {
  v1LevelsCount: number;
  v2LevelsCount: number;
  matchedLevelsCount: number;
  v1OnlyLevelsCount: number;
  v2OnlyLevelsCount: number;
  setupEligibleV2LevelsCount: number;
  matchRatePct: number;
  meanMatchedDistancePct: number | null;
  lifecycleStatuses:
    LevelV2ShadowLifecycleStatusCounts;
}

export interface LevelV2ShadowEvaluation {
  summary:
    LevelV2ShadowEvaluationSummary;
  matches:
    readonly LevelV2ShadowLevelMatch[];
  v1OnlyLevels:
    readonly LevelV2ShadowUnmatchedV1Level[];
  v2OnlyLevels:
    readonly LevelV2ShadowUnmatchedV2Level[];
}
