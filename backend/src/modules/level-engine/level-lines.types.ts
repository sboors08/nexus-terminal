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

export const LEVEL_LINES_CONTRACT_VERSION =
  'level-lines-v0.1' as const;

export type LevelLineStatus =
  | 'candidate'
  | 'confirmed'
  | 'worked'
  | 'broken';

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
  readonly touchCount: number;
  readonly status: LevelLineStatus;
  readonly workedAt: string | null;
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
