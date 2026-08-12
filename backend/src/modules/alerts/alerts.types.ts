import type {
  SetupDirection,
  SetupEngineOutcome,
  SetupEngineSetupType,
  SetupEngineStage,
} from '../setup-engine/setup-engine.types.js';

export const ALERT_EVENT_TYPES = [
  'custom_condition',
  'volume_spike',
  'trades_anomaly',
  'impulse',
  'price_near_level',
  'setup_stage_changed',
  'setup_confirmation',
  'setup_breakout',
  'setup_bounce',
  'setup_invalidated',
  'btc_market_mode_changed',
  'rating_changed',
] as const;

export type AlertEventType =
  typeof ALERT_EVENT_TYPES[number];

export type AlertEventSource =
  | 'custom'
  | 'market_scanner'
  | 'setup_lifecycle'
  | 'btc_market_mode'
  | 'adaptive_ranking';

export const ALERT_EVENT_SOURCE_BY_TYPE:
Record<AlertEventType, AlertEventSource> = {
  custom_condition: 'custom',
  volume_spike: 'market_scanner',
  trades_anomaly: 'market_scanner',
  impulse: 'market_scanner',
  price_near_level: 'setup_lifecycle',
  setup_stage_changed: 'setup_lifecycle',
  setup_confirmation: 'setup_lifecycle',
  setup_breakout: 'setup_lifecycle',
  setup_bounce: 'setup_lifecycle',
  setup_invalidated: 'setup_lifecycle',
  btc_market_mode_changed: 'btc_market_mode',
  rating_changed: 'adaptive_ranking',
};

export type AlertParameterValue =
  | string
  | number
  | boolean
  | null;

export type AlertParameters =
  Record<string, AlertParameterValue>;

export interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  eventType: AlertEventType;
  source: AlertEventSource;
  enabled: boolean;
  symbol: string | null;
  timeframe: string | null;
  cooldownMs: number;
  parameters: AlertParameters;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface AlertRuleCreateInput {
  name: string;
  description?: string | null;
  eventType: AlertEventType;
  enabled?: boolean;
  symbol?: string | null;
  timeframe?: string | null;
  cooldownMs?: number;
  parameters?: AlertParameters;
}

export type AlertRuleUpdateInput =
  Partial<AlertRuleCreateInput>;

export interface AlertTriggerEvent {
  sourceEventId: string;
  source: AlertEventSource;
  eventType: AlertEventType;
  occurredAt: string;
  symbol: string | null;
  timeframe: string | null;
  entityId: string | null;
  payload: AlertParameters;
}

export interface AlertTrigger {
  id: string;
  ruleId: string;
  ruleRevision: number;
  sourceEventId: string;
  source: AlertEventSource;
  eventType: AlertEventType;
  occurredAt: string;
  triggeredAt: string;
  cooldownUntil: string;
  symbol: string | null;
  timeframe: string | null;
  entityId: string | null;
  payload: AlertParameters;
  workspaceContext: {
    symbol: string | null;
    timeframe: string | null;
    setupId: string | null;
    replayId: null;
  };
}

export interface AlertRuleFilters {
  enabled?: boolean;
  eventType?: AlertEventType;
  source?: AlertEventSource;
  symbol?: string;
  timeframe?: string;
}

export interface AlertTriggerFilters {
  ruleId?: string;
  eventType?: AlertEventType;
  source?: AlertEventSource;
  symbol?: string;
  timeframe?: string;
}

export type AlertsRuntimeState =
  | 'idle'
  | 'running'
  | 'stopped';

export type AlertsPersistenceMode =
  | 'runtime_only'
  | 'persistent';

export type AlertsPersistenceState =
  | 'disabled'
  | 'pending'
  | 'loading'
  | 'ready'
  | 'degraded';

export interface AlertsRuntimeOptions {
  maxRules: number;
  maxTriggers: number;
  maxDedupeKeys: number;
  defaultCooldownMs: number;
  now: () => Date;
  createId: (kind: 'rule' | 'trigger') => string;
}

export interface AlertsRuntimeStatus {
  state: AlertsRuntimeState;
  persistenceMode: AlertsPersistenceMode;
  persistenceState: AlertsPersistenceState;
  persistenceAdapter: string | null;
  persistenceVersion: number | null;
  persistenceLoadAttempts: number;
  persistenceSaveAttempts: number;
  persistenceSavesCount: number;
  persistenceErrorsCount: number;
  hydratedRulesCount: number;
  hydratedTriggersCount: number;
  pendingPersistenceWrites: number;
  lastPersistedAt: string | null;
  lastPersistenceError: string | null;
  rulesCount: number;
  enabledRulesCount: number;
  triggersCount: number;
  maxRules: number;
  maxTriggers: number;
  maxDedupeKeys: number;
  sourceEventsCount: number;
  duplicateEventsCount: number;
  cooldownSuppressedCount: number;
  droppedTriggersCount: number;
  lastSourceEventAt: string | null;
  lastTriggeredAt: string | null;
}

export type AlertEventListener =
  (event: AlertTriggerEvent) => void;

export interface AlertEventSourceContract {
  subscribeAlertEvents(
    listener: AlertEventListener,
  ): () => void;
}

export interface AlertsRuntimeLifecycle {
  start(): void | Promise<void>;
  stop(): void | Promise<void>;
}

export interface AlertsRuntimeReader {
  getStatus(): AlertsRuntimeStatus;
  getRules(filters?: AlertRuleFilters): AlertRule[];
  getRule(ruleId: string): AlertRule | null;
  getTriggers(filters?: AlertTriggerFilters): AlertTrigger[];
  getTrigger(triggerId: string): AlertTrigger | null;
}

export interface AlertsRuntimeWriter {
  createRule(input: AlertRuleCreateInput): AlertRule;
  updateRule(ruleId: string, input: AlertRuleUpdateInput): AlertRule | null;
  setRuleEnabled(ruleId: string, enabled: boolean): AlertRule | null;
  ingestEvent(event: AlertTriggerEvent): AlertTrigger[];
}

export interface AlertsRuntimeContract
extends
  AlertsRuntimeLifecycle,
  AlertsRuntimeReader,
  AlertsRuntimeWriter {}

export interface SetupAlertPayload extends AlertParameters {
  candidateId: string;
  setupType: SetupEngineSetupType;
  direction: SetupDirection;
  previousStage: SetupEngineStage | null;
  currentStage: SetupEngineStage;
  outcome: Exclude<SetupEngineOutcome, null> | 'pending';
  currentPrice: number;
  distanceToLevelPct: number;
}

export class AlertsDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AlertsDomainError';
  }
}
