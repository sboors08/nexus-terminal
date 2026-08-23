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

export const MARKET_HISTORY_RUNTIME_CONTRACT_VERSION =
  'market-history-runtime-v0.1' as const;

export const MARKET_HISTORY_RUNTIME_TIMEFRAMES = [
  '1m',
  '5m',
  '15m',
  '1h',
  '4h',
] as const;

export type MarketHistoryRuntimeTimeframe =
  typeof MARKET_HISTORY_RUNTIME_TIMEFRAMES[number];

export type MarketHistoryRuntimeResult =
  | 'active'
  | 'breakout_confirmed'
  | 'rejection_confirmed'
  | 'expired';

export interface MarketHistoryRuntimeLifecycleEntry {
  eventId: number;
  type: SetupLifecycleEventType;
  occurredAt: string;
  previousStage: SetupEngineStage | null;
  currentStage: SetupEngineStage;
  outcome: SetupEngineOutcome;
}

export interface MarketHistoryRuntimeLevel {
  kind: SetupEngineLevelKind;
  centerPrice: number;
  zoneLow: number;
  zoneHigh: number;
  touches: number;
  confirmedAt: string;
}

export interface MarketHistoryRuntimeItem {
  id: string;
  setupId: string;
  symbol: string;
  timeframe: string;
  setupType: SetupEngineSetupType;
  direction: SetupDirection;
  detectedAt: string;
  latestEventAt: string;
  completedAt: string | null;
  expiresAt: string;
  result: MarketHistoryRuntimeResult;
  stageAtDetection: SetupEngineStage;
  currentStage: SetupEngineStage;
  outcome: SetupEngineOutcome;
  detectedPrice: number;
  currentPrice: number;
  distanceToLevelPct: number;
  level: MarketHistoryRuntimeLevel;
  firstEventId: number;
  lastEventId: number;
  lifecycleEventCount: number;
  historyComplete: boolean;
  episodeId: string | null;
  lineId: string | null;
  lifecycle: MarketHistoryRuntimeLifecycleEntry[];
}

export interface MarketHistoryRuntimePersistenceStatus {
  state: SetupEventHistoryPersistenceState;
  version: number | null;
  hydrated: boolean;
  writable: boolean;
  lastPersistedAt: string | null;
  lastErrorCode: SetupEventHistoryPersistenceErrorCode | null;
}

export interface MarketHistoryRuntimeSourceStatus {
  state: SetupEventHistoryState;
  eventsCount: number;
  droppedEventsCount: number;
  persistence: MarketHistoryRuntimePersistenceStatus | null;
}

export interface MarketHistoryRuntimeResponse {
  version: typeof MARKET_HISTORY_RUNTIME_CONTRACT_VERSION;
  source: MarketHistoryRuntimeSourceStatus;
  items: MarketHistoryRuntimeItem[];
}

export interface MarketHistoryRuntimeFilters {
  symbol?: string;
  timeframe?: MarketHistoryRuntimeTimeframe;
  setupType?: SetupEngineSetupType;
  direction?: SetupDirection;
  result?: MarketHistoryRuntimeResult;
  limit?: number;
}
