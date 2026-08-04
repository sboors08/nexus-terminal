import type {
  LevelCandidate,
  LevelEngineKind,
  LevelEngineMaturity,
  LevelEngineTimeframe,
} from './level-engine.types.js';
import type {
  LevelEngineTimeframeDataset,
  MultiTimeframeLevelDetectionOptions,
  MultiTimeframeLevelDetectionResult,
} from './level-engine-multi-timeframe-detector.types.js';
import type {
  LevelLifecycleBreakEvidence,
  LevelLifecycleOptions,
  LevelLifecycleResult,
  LevelLifecycleTransition,
  LevelLifecycleTransitionType,
} from './level-engine-lifecycle.types.js';

export const LEVEL_ENGINE_CAUSAL_REPLAY_VERSION =
  'level-engine-causal-replay-v0.1' as const;

export type LevelEngineCausalReplayEventType =
  | 'candidate_first_seen'
  | 'candidate_confirmed'
  | 'candidate_touch_added'
  | 'candidate_disappeared'
  | 'candidate_reappeared'
  | 'cycle_started'
  | 'cycle_confirmed'
  | 'cycle_touch_added'
  | 'cycle_broken';

export interface LevelEngineCausalReplayOptions {
  readonly detector?: MultiTimeframeLevelDetectionOptions;
  readonly lifecycle?: LevelLifecycleOptions;
  readonly startAtClosedCandleCount?: number;
}

export type DetectMultiTimeframeLevelCandidatesLike = (
  datasets: readonly LevelEngineTimeframeDataset[],
  options: MultiTimeframeLevelDetectionOptions,
) => MultiTimeframeLevelDetectionResult;

export type BuildLevelLifecycleLike = (
  candidate: LevelCandidate,
  dataset: LevelEngineTimeframeDataset,
  options: LevelLifecycleOptions,
) => LevelLifecycleResult;

export interface LevelEngineCausalReplayDependencies {
  readonly detectCandidates?: DetectMultiTimeframeLevelCandidatesLike;
  readonly buildLifecycle?: BuildLevelLifecycleLike;
}

export interface LevelEngineCausalReplayEvent {
  readonly eventIndex: number;
  readonly type: LevelEngineCausalReplayEventType;
  readonly observedAt: string;
  readonly observedCandleIndex: number;
  readonly marketOccurredAt: string | null;
  readonly sourceCandidateId: string;
  readonly cycleId: string | null;
  readonly kind: LevelEngineKind;
  readonly transition: LevelLifecycleTransitionType | null;
  readonly maturity: LevelEngineMaturity | null;
  readonly touchEpisodeCount: number;
}

export interface LevelEngineCausalReplayCycleTrack {
  readonly id: string;
  readonly sourceCandidateId: string;
  readonly sequence: number;
  readonly kind: LevelEngineKind;
  readonly transition: LevelLifecycleTransition;
  readonly firstObservedAt: string;
  readonly firstObservedCandleIndex: number;
  readonly firstConfirmedAt: string | null;
  readonly firstConfirmedCandleIndex: number | null;
  readonly marketActiveFrom: string;
  readonly brokenAt: string | null;
  readonly breakObservedAt: string | null;
  readonly breakObservedCandleIndex: number | null;
  readonly breakEvidence: LevelLifecycleBreakEvidence | null;
  readonly maxTouchEpisodeCount: number;
  readonly latestCandidate: LevelCandidate;
}

export interface LevelEngineCausalReplayCandidateTrack {
  readonly id: string;
  readonly symbol: string;
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly kind: LevelEngineKind;
  readonly sourceCandidate: LevelCandidate;
  readonly latestDetectorCandidate: LevelCandidate;
  readonly firstSeenAt: string;
  readonly firstSeenCandleIndex: number;
  readonly firstConfirmedAt: string | null;
  readonly firstConfirmedCandleIndex: number | null;
  readonly lastSeenAt: string;
  readonly lastSeenCandleIndex: number;
  readonly detectorObservationCount: number;
  readonly disappearanceCount: number;
  readonly reappearanceCount: number;
  readonly maxDetectorTouchEpisodeCount: number;
  readonly presentAtEnd: boolean;
  readonly cycles: readonly LevelEngineCausalReplayCycleTrack[];
}

export interface LevelEngineCausalReplayTotals {
  readonly replayStepCount: number;
  readonly candidateTrackCount: number;
  readonly confirmedCandidateTrackCount: number;
  readonly cycleTrackCount: number;
  readonly confirmedCycleTrackCount: number;
  readonly brokenCycleTrackCount: number;
  readonly originCycleTrackCount: number;
  readonly flipCycleTrackCount: number;
  readonly reclaimCycleTrackCount: number;
  readonly candidateDisappearanceCount: number;
  readonly candidateReappearanceCount: number;
}

export interface LevelEngineCausalReplayResult {
  readonly version: typeof LEVEL_ENGINE_CAUSAL_REPLAY_VERSION;
  readonly symbol: string;
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly closedCandlesCount: number;
  readonly ignoredOpenCandlesCount: number;
  readonly startAtClosedCandleCount: number;
  readonly candidateTracks:
    readonly LevelEngineCausalReplayCandidateTrack[];
  readonly events: readonly LevelEngineCausalReplayEvent[];
  readonly totals: LevelEngineCausalReplayTotals;
  readonly observationalOnly: true;
  readonly createsSetup: false;
  readonly usesQualityScore: false;
  readonly usesFutureCandles: false;
  readonly mergesAcrossTimeframes: false;
}
