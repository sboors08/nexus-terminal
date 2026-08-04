import type {
  LevelCandidate,
  LevelEngineKind,
  LevelEngineTimeframe,
  LevelEngineZone,
  TouchEpisode,
} from './level-engine.types.js';
import type {
  TouchEpisodeDetectionOptions,
} from './level-engine-touch-detector.types.js';

export type LevelLifecycleTransitionType =
  | 'origin'
  | 'reclaim'
  | 'flip';

export type LevelLifecycleBreakMode =
  | 'decisive_body_break'
  | 'consecutive_closes';

export interface LevelLifecycleOptions {
  readonly atrPeriod: number;
  readonly decisiveBreakAtr: number;
  readonly consecutiveBreakCloses: number;
  readonly touchEpisodes: TouchEpisodeDetectionOptions;
}

export interface LevelLifecycleBreakEvidence {
  readonly mode: LevelLifecycleBreakMode;
  readonly fromKind: LevelEngineKind;
  readonly candleIndex: number;
  readonly brokenAt: string;
  readonly boundary: number;
  readonly close: number;
  readonly distanceBeyondBoundary: number;
  readonly distanceBeyondBoundaryAtr: number | null;
}

export interface LevelLifecycleTransition {
  readonly type: LevelLifecycleTransitionType;
  readonly fromCycleId: string | null;
  readonly occurredAt: string;
  readonly triggerEpisodeId: string;
}

export interface LevelLifecycleCycle {
  readonly id: string;
  readonly sequence: number;
  readonly sourceCandidateId: string;
  readonly symbol: string;
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly kind: LevelEngineKind;
  readonly zone: LevelEngineZone;
  readonly transition: LevelLifecycleTransition;
  readonly candidate: LevelCandidate;
  readonly endedAt: string | null;
  readonly breakEvidence: LevelLifecycleBreakEvidence | null;
}

export type IgnoredLevelLifecycleEpisodeReason =
  | 'before_origin'
  | 'opposite_role_without_break'
  | 'started_before_break_confirmation'
  | 'overlapping_episode';

export interface IgnoredLevelLifecycleEpisode {
  readonly episodeId: string;
  readonly kind: LevelEngineKind;
  readonly startedAt: string;
  readonly confirmedAt: string;
  readonly reason: IgnoredLevelLifecycleEpisodeReason;
}

export interface LevelLifecycleResult {
  readonly sourceCandidateId: string;
  readonly symbol: string;
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly zone: LevelEngineZone;
  readonly cycles: readonly LevelLifecycleCycle[];
  readonly currentCycleId: string | null;
  readonly ignoredEpisodes: readonly IgnoredLevelLifecycleEpisode[];
  readonly breakCount: number;
  readonly flipCount: number;
  readonly reclaimCount: number;
  readonly observationalOnly: true;
  readonly createsSetup: false;
  readonly usesQualityScore: false;
}

export interface LevelLifecycleEpisodeEvent {
  readonly episode: TouchEpisode;
  readonly kind: LevelEngineKind;
}
