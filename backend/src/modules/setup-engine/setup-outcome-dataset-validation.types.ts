import type {
  BinanceOneMinuteKlineUpdate,
} from '../realtime-market-data/market-wide-one-minute-metrics.js';
import type {
  SetupDirection,
  SetupEngineOutcome,
  SetupEngineSetupType,
  SetupEngineStage,
} from './setup-engine.types.js';
import type {
  SetupLifecycleEventType,
} from './setup-lifecycle-events.types.js';

export const SETUP_OUTCOME_DATASET_VALIDATION_VERSION =
  'setup-outcome-dataset-validation-v0.1' as const;

export const DEFAULT_SETUP_OUTCOME_HORIZONS_MINUTES =
  Object.freeze([
    5,
    15,
    30,
    60,
  ] as const);

export type SetupOutcomeDatasetValidationStatus =
  | 'insufficient_sample'
  | 'sample_available';

export type SetupOutcomeMeasurementStatus =
  | 'measured'
  | 'pending_window'
  | 'missing_third_touch_anchor'
  | 'insufficient_candle_coverage'
  | 'market_history_error';

export type SetupOutcomeTerminalEventType =
  Extract<
    SetupLifecycleEventType,
    | 'breakout_confirmed'
    | 'rejection_confirmed'
    | 'setup_expired'
  >;

export interface SetupOutcomeMarketHistorySource {
  fetchOneMinuteKlines(
    request: {
      symbol: string;
      limit: number;
      endTime?: number;
    },
  ): Promise<BinanceOneMinuteKlineUpdate[]>;
}

export interface SetupOutcomeDatasetBuildOptions {
  horizonsMinutes:
    readonly number[];

  excludeAnchorMinute:
    true;
}

export interface SetupOutcomeDatasetSource {
  historySnapshotFound: boolean;

  snapshotSavedAt:
    string
    | null;

  retainedEventsCount: number;
  droppedEventsCount: number;
}

export interface SetupOutcomeTerminalFact {
  eventId: number;

  type:
    SetupOutcomeTerminalEventType;

  occurredAt: string;

  stage:
    SetupEngineStage;

  lifecycleOutcome:
    SetupEngineOutcome;

  snapshotPrice: number;
}

export interface SetupOutcomeAnchorFact {
  eventId: number;

  occurredAt: string;

  price: number;

  measurementStartsAt: string;

  anchorMinuteExcluded: true;

  anchorGapMs: number;
}

export interface SetupOutcomeCheckpoint {
  horizonMinutes: number;

  cutoffAt: string;

  candlesCount: number;

  closePrice: number;

  signedReturnPct: number;
}

export interface SetupOutcomeMeasuredMetrics {
  observationWindowMinutes: number;

  observationWindowEndsAt: string;

  candlesCount: number;

  firstCandleOpenTime: string;
  lastCandleCloseTime: string;

  maxFavorableExcursionPct: number;
  maxAdverseExcursionPct: number;

  maxFavorablePrice: number;
  maxAdversePrice: number;

  checkpoints:
    readonly SetupOutcomeCheckpoint[];
}

export interface SetupOutcomeDatasetItem {
  id: string;

  candidateId: string;

  symbol: string;
  timeframe: string;

  setupType:
    SetupEngineSetupType;

  direction:
    SetupDirection;

  episodeId:
    string
    | null;

  lineId:
    string
    | null;

  historyComplete: boolean;

  firstRetainedEventId: number;
  lastRetainedEventId: number;

  lifecycleEventsCount: number;

  terminal:
    SetupOutcomeTerminalFact;

  anchor:
    SetupOutcomeAnchorFact
    | null;

  measurementStatus:
    SetupOutcomeMeasurementStatus;

  metrics:
    SetupOutcomeMeasuredMetrics
    | null;

  observationalOnly: true;

  profitabilityLabelApplied: false;

  changesProductionSetup: false;
  changesTradingRules: false;

  tradeExecution: false;
  trainingApplied: false;
}

export interface SetupOutcomeDatasetDiagnostics {
  candidatesCount: number;

  terminalCandidatesCount: number;

  anchoredTerminalCandidatesCount: number;

  measuredCandidatesCount: number;

  pendingWindowCandidatesCount: number;

  missingThirdTouchAnchorCount: number;

  insufficientCandleCoverageCount: number;

  marketHistoryErrorCount: number;

  multipleTerminalEventsCount: number;
}

export interface SetupOutcomeDatasetValidationReport {
  version:
    typeof SETUP_OUTCOME_DATASET_VALIDATION_VERSION;

  generatedAt: string;

  status:
    SetupOutcomeDatasetValidationStatus;

  source:
    SetupOutcomeDatasetSource;

  options:
    SetupOutcomeDatasetBuildOptions;

  diagnostics:
    SetupOutcomeDatasetDiagnostics;

  items:
    readonly SetupOutcomeDatasetItem[];

  observationalOnly: true;

  profitabilityLabelApplied: false;

  sampleSufficiencyThresholdApplied: false;

  changesProductionSetup: false;
  changesTradingRules: false;

  tradeExecution: false;
  trainingApplied: false;

  futureMarketDataUsedForDetection: false;

  postEventMarketDataUsedForMeasurement: boolean;
}