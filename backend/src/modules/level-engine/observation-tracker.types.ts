import type {
  DepartureExtremumTrackingResult,
} from './departure-extremum-tracker.types.js';
import type {
  LevelEngineKind,
  LevelEngineTimeframe,
} from './level-engine.types.js';
import type {
  LevelEngineCandle,
} from './level-engine-touch-detector.types.js';

export const OBSERVATION_TRACKER_CONTRACT_VERSION =
  'observation-tracker-v0.1' as const;

export interface ObservationTrackingOptions {
  readonly observationPathProgressThreshold:
    number;
}

export interface ObservationPathProgress {
  readonly lineId: string;
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly kind: LevelEngineKind;
  readonly levelPrice: number;
  readonly departureExtremumPrice: number;
  readonly departureExtremumObservedAt: string;
  readonly currentPrice: number;
  readonly currentCandleIndex: number;
  readonly currentCandleOpenTime: string;
  readonly observedAt: string;
  readonly episodeStartedAt:
    string | null;
  readonly progress: number;
  readonly observationPathProgressThreshold:
    number;
  readonly stage: 'OBSERVATION' | null;
}

export interface ObservationTrackingInput {
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly candles:
    readonly LevelEngineCandle[];
  readonly departureExtremumTracking:
    DepartureExtremumTrackingResult;
}

export interface ObservationTrackingResult {
  readonly version:
    typeof OBSERVATION_TRACKER_CONTRACT_VERSION;
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly closedCandlesCount: number;
  readonly ignoredOpenCandlesCount: number;
  readonly currentPrice: number | null;
  readonly currentCandleIndex: number | null;
  readonly currentCandleOpenTime:
    string | null;
  readonly observedAt: string | null;
  readonly activeProgress:
    readonly ObservationPathProgress[];
  readonly appliedOptions:
    ObservationTrackingOptions;
  readonly observationalOnly: true;
  readonly computesObservationProgress: true;
  readonly createsApproachEvaluation: false;
  readonly createsSetup: false;
  readonly createsSignal: false;
  readonly usesFutureCandles: false;
}
