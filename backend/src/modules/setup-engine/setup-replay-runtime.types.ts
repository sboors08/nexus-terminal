import type {
  SetupDirection,
  SetupEngineLevelKind,
  SetupEngineOutcome,
  SetupEngineSetupType,
  SetupEngineStage,
} from './setup-engine.types.js';
import type {
  SetupEventHistoryPersistenceErrorCode,
  SetupEventHistoryPersistenceState,
  SetupEventHistoryState,
} from './setup-event-history.types.js';
import type {
  SetupLifecycleEventType,
} from './setup-lifecycle-events.types.js';

export const SETUP_REPLAY_RUNTIME_CONTRACT_VERSION =
  'real-setup-replay-v0.1' as const;

export type SetupReplayRuntimeResult =
  | 'active'
  | 'breakout_confirmed'
  | 'rejection_confirmed'
  | 'expired';

export interface SetupReplayRuntimeLevel {
  kind: SetupEngineLevelKind;
  centerPrice: number;
  zoneLow: number;
  zoneHigh: number;
  touches: number;
  confirmedAt: string;
}

export interface SetupReplayRuntimeFrame {
  index: number;
  eventId: number;
  type: SetupLifecycleEventType;
  occurredAt: string;
  previousStage: SetupEngineStage | null;
  currentStage: SetupEngineStage;
  outcome: SetupEngineOutcome;
  currentPrice: number;
  distanceToLevelPct: number;
  snapshotUpdatedAt: string;
  expiresAt: string;
  level: SetupReplayRuntimeLevel;
  episodeId: string | null;
  lineId: string | null;
}

export interface SetupReplayRuntimeCapabilities {
  lifecycleFrames: true;
  eventSnapshotPrices: true;
  candles: false;
  aggTrades: false;
  orderBook: false;
  pnl: false;
}

export interface SetupReplayRuntimeSession {
  id: string;
  setupId: string;
  candidateId: string;
  symbol: string;
  timeframe: string;
  setupType: SetupEngineSetupType;
  direction: SetupDirection;
  detectedAt: string;
  firstRetainedAt: string;
  latestEventAt: string;
  completedAt: string | null;
  result: SetupReplayRuntimeResult;
  historyComplete: boolean;
  firstEventId: number;
  lastEventId: number;
  frameCount: number;
  episodeId: string | null;
  lineId: string | null;
  frames: SetupReplayRuntimeFrame[];
}

export interface SetupReplayRuntimePersistenceStatus {
  state: SetupEventHistoryPersistenceState;
  version: number | null;
  hydrated: boolean;
  writable: boolean;
  lastPersistedAt: string | null;
  lastErrorCode: SetupEventHistoryPersistenceErrorCode | null;
}

export interface SetupReplayRuntimeSourceStatus {
  state: SetupEventHistoryState;
  eventsCount: number;
  droppedEventsCount: number;
  persistence: SetupReplayRuntimePersistenceStatus | null;
}

export interface SetupReplayRuntimeResponse {
  version: typeof SETUP_REPLAY_RUNTIME_CONTRACT_VERSION;
  source: SetupReplayRuntimeSourceStatus;
  capabilities: SetupReplayRuntimeCapabilities;
  session: SetupReplayRuntimeSession;
}
