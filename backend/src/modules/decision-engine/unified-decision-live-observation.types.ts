import type {
  RealtimeTrade,
} from '../realtime-market-data/realtime-market-data.types.js';
import type {
  SetupEngineState,
} from '../setup-engine/setup-engine.types.js';
import type {
  LevelEngineTimeframe,
} from '../level-engine/level-engine.types.js';
import type {
  LevelLineRealtimeConfirmation,
  RealtimeConfirmationMarketEvidence,
  RealtimeConfirmationOrderBookCapture,
} from '../level-engine/realtime-confirmation-engine.types.js';
import type {
  UnifiedDecision,
  UnifiedDecisionMarketContext,
  UnifiedDecisionState,
} from './unified-decision.types.js';

export const UNIFIED_DECISION_LIVE_OBSERVATION_DATASET_VERSION =
  'unified-decision-live-observation-dataset-v0.1' as const;

export const UNIFIED_DECISION_LIVE_OBSERVATION_PERSISTENCE_SCHEMA =
  'nexus.unified-decision.live-observations' as const;

export const UNIFIED_DECISION_LIVE_OBSERVATION_PERSISTENCE_VERSION =
  1 as const;

export type UnifiedDecisionLiveSourceReadState =
  | 'available'
  | 'unavailable'
  | 'error';

export type UnifiedDecisionLiveSourceErrorCode =
  | 'tape_read_failed'
  | 'order_book_read_failed'
  | 'source_read_failed';

export interface UnifiedDecisionLiveTapeCapture {
  readonly snapshotUpdatedAt: string | null;
  readonly trades: readonly RealtimeTrade[];
  readonly originalTradesCount: number;
  readonly truncated: boolean;
}

export interface UnifiedDecisionLiveRealtimeCapture {
  readonly capturedAt: string;
  readonly tape: UnifiedDecisionLiveTapeCapture | null;
  readonly orderBook: RealtimeConfirmationOrderBookCapture | null;
  readonly sourceErrors: readonly UnifiedDecisionLiveSourceErrorCode[];
  readonly evaluatedEvidence: RealtimeConfirmationMarketEvidence;
  readonly evaluations: readonly LevelLineRealtimeConfirmation[];
}

export interface UnifiedDecisionLiveSetupCapture {
  readonly readState: UnifiedDecisionLiveSourceReadState;
  readonly observedAt: string | null;
  readonly candidates: readonly SetupEngineState[];
  readonly originalCandidatesCount: number;
  readonly truncated: boolean;
}

export interface UnifiedDecisionLiveMarketContextCapture {
  readonly readState: UnifiedDecisionLiveSourceReadState;
  readonly value: UnifiedDecisionMarketContext;
}

export interface UnifiedDecisionLiveObservation {
  readonly id: string;
  readonly sequence: number;
  readonly recordedAt: string;
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly decision: UnifiedDecision;
  readonly realtime: UnifiedDecisionLiveRealtimeCapture;
  readonly setups: UnifiedDecisionLiveSetupCapture;
  readonly marketContext: UnifiedDecisionLiveMarketContextCapture;
  readonly diagnosticOnly: true;
  readonly createsTradeOrder: false;
  readonly createsSetup: false;
  readonly createsSignal: false;
  readonly changesDecisionRules: false;
}

export interface UnifiedDecisionLiveObservationInput {
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly decision: UnifiedDecision;
  readonly realtime: {
    readonly capturedAt: string;
    readonly tape: {
      readonly snapshotUpdatedAt: string | null;
      readonly trades: readonly RealtimeTrade[];
    } | null;
    readonly orderBook: RealtimeConfirmationOrderBookCapture | null;
    readonly sourceErrors: readonly string[];
    readonly evaluatedEvidence: RealtimeConfirmationMarketEvidence;
    readonly evaluations: readonly LevelLineRealtimeConfirmation[];
  };
  readonly setups: {
    readonly readState: UnifiedDecisionLiveSourceReadState;
    readonly candidates: readonly SetupEngineState[];
  };
  readonly marketContext: UnifiedDecisionLiveMarketContextCapture;
}

export interface UnifiedDecisionLiveObservationFilter {
  readonly symbol?: string;
  readonly timeframe?: LevelEngineTimeframe;
  readonly state?: UnifiedDecisionState;
  readonly direction?: 'long' | 'short' | 'none';
  readonly limit?: number;
}

export type UnifiedDecisionLiveRecorderState =
  | 'idle'
  | 'ready'
  | 'degraded'
  | 'stopped';

export interface UnifiedDecisionLiveObservationStatus {
  readonly version: typeof UNIFIED_DECISION_LIVE_OBSERVATION_DATASET_VERSION;
  readonly state: UnifiedDecisionLiveRecorderState;
  readonly persistenceMode: 'persistent' | 'runtime_only';
  readonly persistenceAdapter: string | null;
  readonly capacity: number;
  readonly observationCount: number;
  readonly firstRecordedAt: string | null;
  readonly lastRecordedAt: string | null;
  readonly nextSequence: number;
  readonly lastPersistenceErrorCode: string | null;
  readonly diagnosticOnly: true;
  readonly createsTradeOrder: false;
  readonly changesDecisionRules: false;
}

export interface UnifiedDecisionLiveObservationDataset {
  readonly version: typeof UNIFIED_DECISION_LIVE_OBSERVATION_DATASET_VERSION;
  readonly exportedAt: string;
  readonly status: UnifiedDecisionLiveObservationStatus;
  readonly observations: readonly UnifiedDecisionLiveObservation[];
}

export interface UnifiedDecisionLiveObservationPersistenceSnapshot {
  readonly schema: typeof UNIFIED_DECISION_LIVE_OBSERVATION_PERSISTENCE_SCHEMA;
  readonly version: typeof UNIFIED_DECISION_LIVE_OBSERVATION_PERSISTENCE_VERSION;
  readonly datasetVersion: typeof UNIFIED_DECISION_LIVE_OBSERVATION_DATASET_VERSION;
  readonly savedAt: string;
  readonly nextSequence: number;
  readonly observations: readonly UnifiedDecisionLiveObservation[];
}

export interface UnifiedDecisionLiveObservationPersistence {
  readonly adapter: string;
  load(): Promise<unknown | null>;
  save(
    snapshot: UnifiedDecisionLiveObservationPersistenceSnapshot,
  ): Promise<void>;
}

export interface UnifiedDecisionLiveObservationRecorder {
  start(): Promise<void>;
  stop(): Promise<void>;
  record(
    input: UnifiedDecisionLiveObservationInput,
  ): UnifiedDecisionLiveObservation;
  flush(): Promise<void>;
  getStatus(): UnifiedDecisionLiveObservationStatus;
  getObservations(
    filter?: UnifiedDecisionLiveObservationFilter,
  ): readonly UnifiedDecisionLiveObservation[];
  exportDataset(
    filter?: UnifiedDecisionLiveObservationFilter,
  ): UnifiedDecisionLiveObservationDataset;
}
