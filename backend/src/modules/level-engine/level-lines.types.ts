import type {
  Candle,
} from '../../contracts/nexus-api.js';
import type {
  LevelEngineKind,
  LevelEngineTimeframe,
} from './level-engine.types.js';
import type {
  LevelEngineConfirmedBreakEvidence,
} from './level-engine-break-evaluator.types.js';
import type {
  LevelEngineCandle,
} from './level-engine-touch-detector.types.js';
import type {
  DepartureExtremumTrackingResult,
} from './departure-extremum-tracker.types.js';
import type {
  ObservationTrackingResult,
} from './observation-tracker.types.js';

export const LEVEL_LINES_CONTRACT_VERSION =
  'level-lines-v0.1' as const;

export type LevelLineStatus =
  | 'candidate'
  | 'confirmed'
  | 'worked'
  | 'superseded'
  | 'broken';

export interface LevelLineSupersessionEvidence {
  readonly mode:
    'more_extreme_right_candle';
  readonly fromKind: LevelEngineKind;
  readonly candleIndex: number;
  readonly supersededAt: string;
  readonly originPrice: number;
  readonly extremePrice: number;
}

export interface LevelLine {
  readonly id: string;
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly price: number;
  readonly kind: LevelEngineKind;
  readonly originCandleIndex: number;
  readonly originExtremumAt: string;
  readonly originExtremumPrice: number;
  readonly activeFrom: string;
  readonly confirmedAt: string | null;
  readonly touchCount: number;
  readonly status: LevelLineStatus;
  readonly workedAt: string | null;
  readonly supersededAt: string | null;
  readonly supersessionEvidence:
    LevelLineSupersessionEvidence | null;
  readonly brokenAt: string | null;
  readonly breakEvidence:
    LevelEngineConfirmedBreakEvidence | null;
}

export interface LevelLinesDetectionOptions {
  readonly atrPeriod: number;
  readonly pivotLeftBars: number;
  readonly pivotRightBars: number;
  readonly originDepartureAtr: number;
  readonly originDepartureMaxCandles: number;
  readonly candidateVisibilityMinDepartureAtr:
    number;
  readonly candidateVisibilityMaxAgeBars:
    number;
  readonly persistentCandidateMinDepartureAtr:
    number;
  readonly persistentCandidateLookbackBars:
    number;
  readonly originEpisodeMaxSpanCandles: number;
  readonly workedEpisodeMaxSpanCandles: number;
  readonly touchTolerancePercent: number;
  readonly minBarsBetweenTouchEpisodes: number;
  readonly decisiveBreakAtr: number;
  readonly consecutiveBreakCloses: number;
}

export interface LevelLinesDetectionInput {
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly candles: readonly LevelEngineCandle[];
}

export interface LevelLinesDetectionResult {
  readonly version:
    typeof LEVEL_LINES_CONTRACT_VERSION;
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly closedCandlesCount: number;
  readonly ignoredOpenCandlesCount: number;
  readonly lines: readonly LevelLine[];
  readonly activeLevels: readonly LevelLine[];
  readonly departureExtremumTracking:
    DepartureExtremumTrackingResult;
  readonly observationTracking:
    ObservationTrackingResult;
  readonly appliedOptions:
    LevelLinesDetectionOptions;
  readonly observationalOnly: true;
  readonly createsSetup: false;
  readonly mergesNearbyExtrema: false;
  readonly usesFutureCandles: false;
}

export interface LevelLinesSnapshotCandle
  extends Candle {
  readonly isClosed: boolean;
}

export interface LevelLinesSnapshot
  extends LevelLinesDetectionResult {
  readonly generatedAt: string;
  readonly candles:
    readonly LevelLinesSnapshotCandle[];
}
