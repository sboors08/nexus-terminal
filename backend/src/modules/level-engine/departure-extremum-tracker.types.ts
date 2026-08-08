import type {
  LevelEngineKind,
  LevelEngineTimeframe,
} from './level-engine.types.js';
import type {
  LevelEngineCandle,
} from './level-engine-touch-detector.types.js';
import type {
  LevelLine,
} from './level-lines.types.js';

export const DEPARTURE_EXTREMUM_TRACKER_CONTRACT_VERSION =
  'departure-extremum-tracker-v0.1' as const;

export interface DepartureExtremum {
  readonly lineId: string;
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly kind: LevelEngineKind;
  readonly levelPrice: number;
  readonly trackingStartedAt: string;
  readonly qualifyingTouchCount: 2 | 3;
  readonly price: number;
  readonly candleIndex: number;
  readonly candleOpenTime: string;
  readonly observedAt: string;
}

export interface DepartureExtremumTrackingInput {
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly candles:
    readonly LevelEngineCandle[];
  readonly lines: readonly LevelLine[];
}

export interface DepartureExtremumTrackingResult {
  readonly version:
    typeof DEPARTURE_EXTREMUM_TRACKER_CONTRACT_VERSION;
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly closedCandlesCount: number;
  readonly ignoredOpenCandlesCount: number;
  readonly activeExtrema:
    readonly DepartureExtremum[];
  readonly observationalOnly: true;
  readonly createsSetup: false;
  readonly computesObservationProgress: false;
  readonly createsSignal: false;
  readonly usesFutureCandles: false;
}
