export const ALERTS_META_PATH = '/api/v1/alerts/meta';
export const ALERTS_STATUS_PATH = '/api/v1/alerts/status';
export const ALERTS_RULES_PATH = '/api/v1/alerts/rules';
export const ALERTS_TRIGGERS_PATH = '/api/v1/alerts/triggers';

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

export const ALERT_EVENT_SOURCES = [
  'custom',
  'market_scanner',
  'setup_lifecycle',
  'btc_market_mode',
  'adaptive_ranking',
] as const;

export type AlertEventType = typeof ALERT_EVENT_TYPES[number];
export type AlertEventSource = typeof ALERT_EVENT_SOURCES[number];
export type AlertParameterValue = string | number | boolean | null;
export type AlertParameters = Record<string, AlertParameterValue>;

export interface AlertsMetadata {
  persistenceMode: 'runtime_only';
  eventTypes: AlertEventType[];
  eventSources: AlertEventSource[];
  deliveryChannels: string[];
}

export interface AlertsRuntimeStatus {
  state: 'idle' | 'running' | 'stopped';
  persistenceMode: 'runtime_only';
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

export interface AlertRuleWriteInput {
  name: string;
  description?: string | null;
  eventType: AlertEventType;
  enabled?: boolean;
  symbol?: string | null;
  timeframe?: string | null;
  cooldownMs?: number;
  parameters?: AlertParameters;
}

export type AlertRuleUpdateInput = Partial<AlertRuleWriteInput>;

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

export interface AlertsRuntimeView {
  metadata: AlertsMetadata;
  status: AlertsRuntimeStatus;
  rules: AlertRule[];
  triggers: AlertTrigger[];
}

export type AlertsRuntimeFetch = typeof globalThis.fetch;

export interface AlertsRuntimeRequestOptions {
  baseUrl?: string;
  signal?: AbortSignal;
  fetcher?: AlertsRuntimeFetch;
}

export interface FetchAlertsRuntimeViewOptions
extends AlertsRuntimeRequestOptions {
  limit?: number;
}

export class AlertsRuntimeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null,
  ) {
    super(message);
    this.name = 'AlertsRuntimeApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Invalid Alerts response: ${field}`);
  return value;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid Alerts response: ${key}`);
  }
  return value;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error(`Invalid Alerts response: ${key}`);
  return value;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') throw new Error(`Invalid Alerts response: ${key}`);
  return value;
}

function readNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`Invalid Alerts response: ${key}`);
  }
  return value as number;
}

function readTimestamp(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid Alerts response timestamp: ${key}`);
  }
  return value;
}

function readNullableTimestamp(record: Record<string, unknown>, key: string): string | null {
  const value = readNullableString(record, key);
  if (value !== null && !Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid Alerts response timestamp: ${key}`);
  }
  return value;
}

function readEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  values: readonly T[],
): T {
  const value = readString(record, key);
  if (!values.includes(value as T)) throw new Error(`Invalid Alerts response: ${key}`);
  return value as T;
}

function readParameters(record: Record<string, unknown>, key: string): AlertParameters {
  const value = readRecord(record[key], key);
  const entries = Object.entries(value);
  if (entries.some(([, item]) => (
    item !== null
    && typeof item !== 'string'
    && typeof item !== 'boolean'
    && (typeof item !== 'number' || !Number.isFinite(item))
  ))) {
    throw new Error(`Invalid Alerts response: ${key}`);
  }
  return Object.fromEntries(entries) as AlertParameters;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Invalid Alerts response: ${key}`);
  }
  return [...value];
}

function resolveBaseUrl(value: string | undefined): string {
  return value?.trim().replace(/\/+$/, '') ?? '';
}

function buildPath(path: string, baseUrl?: string): string {
  return resolveBaseUrl(baseUrl) + path;
}

function validateLimit(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 500) {
    throw new Error('Alerts limit must be between 1 and 500');
  }
  return value;
}

function buildListUrl(path: string, baseUrl: string | undefined, limit: number): string {
  return `${buildPath(path, baseUrl)}?${new URLSearchParams({ limit: String(validateLimit(limit)) })}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim().length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('Alerts API returned invalid JSON');
  }
}

async function requestJson(
  url: string,
  options: AlertsRuntimeRequestOptions,
  init: RequestInit = {},
): Promise<unknown> {
  const fetcher = options.fetcher ?? globalThis.fetch;
  const response = await fetcher(url, {
    ...init,
    signal: options.signal,
    headers: {
      accept: 'application/json',
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const payload = await readJson(response);
  if (!response.ok) {
    const error = isRecord(payload) ? payload : {};
    const code = typeof error.error === 'string' ? error.error : null;
    const message = typeof error.message === 'string'
      ? error.message
      : `Alerts API request failed (${response.status})`;
    throw new AlertsRuntimeApiError(message, response.status, code);
  }
  return payload;
}

export function parseAlertsMetadata(value: unknown): AlertsMetadata {
  const metadata = readRecord(value, 'metadata');
  const persistenceMode = readString(metadata, 'persistenceMode');
  if (persistenceMode !== 'runtime_only') {
    throw new Error('Invalid Alerts response: persistenceMode');
  }
  const eventTypes = readStringArray(metadata, 'eventTypes');
  const eventSources = readStringArray(metadata, 'eventSources');
  if (eventTypes.some((item) => !ALERT_EVENT_TYPES.includes(item as AlertEventType))) {
    throw new Error('Invalid Alerts response: eventTypes');
  }
  if (eventSources.some((item) => !ALERT_EVENT_SOURCES.includes(item as AlertEventSource))) {
    throw new Error('Invalid Alerts response: eventSources');
  }
  return {
    persistenceMode,
    eventTypes: eventTypes as AlertEventType[],
    eventSources: eventSources as AlertEventSource[],
    deliveryChannels: readStringArray(metadata, 'deliveryChannels'),
  };
}

export function parseAlertsRuntimeStatus(value: unknown): AlertsRuntimeStatus {
  const status = readRecord(value, 'status');
  const state = readString(status, 'state');
  const persistenceMode = readString(status, 'persistenceMode');
  if (state !== 'idle' && state !== 'running' && state !== 'stopped') {
    throw new Error('Invalid Alerts response: state');
  }
  if (persistenceMode !== 'runtime_only') {
    throw new Error('Invalid Alerts response: persistenceMode');
  }
  return {
    state,
    persistenceMode,
    rulesCount: readNonNegativeInteger(status, 'rulesCount'),
    enabledRulesCount: readNonNegativeInteger(status, 'enabledRulesCount'),
    triggersCount: readNonNegativeInteger(status, 'triggersCount'),
    maxRules: readNonNegativeInteger(status, 'maxRules'),
    maxTriggers: readNonNegativeInteger(status, 'maxTriggers'),
    maxDedupeKeys: readNonNegativeInteger(status, 'maxDedupeKeys'),
    sourceEventsCount: readNonNegativeInteger(status, 'sourceEventsCount'),
    duplicateEventsCount: readNonNegativeInteger(status, 'duplicateEventsCount'),
    cooldownSuppressedCount: readNonNegativeInteger(status, 'cooldownSuppressedCount'),
    droppedTriggersCount: readNonNegativeInteger(status, 'droppedTriggersCount'),
    lastSourceEventAt: readNullableTimestamp(status, 'lastSourceEventAt'),
    lastTriggeredAt: readNullableTimestamp(status, 'lastTriggeredAt'),
  };
}

export function parseAlertRule(value: unknown): AlertRule {
  const rule = readRecord(value, 'rule');
  return {
    id: readString(rule, 'id'),
    name: readString(rule, 'name'),
    description: readNullableString(rule, 'description'),
    eventType: readEnum(rule, 'eventType', ALERT_EVENT_TYPES),
    source: readEnum(rule, 'source', ALERT_EVENT_SOURCES),
    enabled: readBoolean(rule, 'enabled'),
    symbol: readNullableString(rule, 'symbol'),
    timeframe: readNullableString(rule, 'timeframe'),
    cooldownMs: readNonNegativeInteger(rule, 'cooldownMs'),
    parameters: readParameters(rule, 'parameters'),
    createdAt: readTimestamp(rule, 'createdAt'),
    updatedAt: readTimestamp(rule, 'updatedAt'),
    revision: readNonNegativeInteger(rule, 'revision'),
  };
}

export function parseAlertTrigger(value: unknown): AlertTrigger {
  const trigger = readRecord(value, 'trigger');
  const workspaceContext = readRecord(trigger.workspaceContext, 'workspaceContext');
  if (workspaceContext.replayId !== null) {
    throw new Error('Invalid Alerts response: replayId');
  }
  return {
    id: readString(trigger, 'id'),
    ruleId: readString(trigger, 'ruleId'),
    ruleRevision: readNonNegativeInteger(trigger, 'ruleRevision'),
    sourceEventId: readString(trigger, 'sourceEventId'),
    source: readEnum(trigger, 'source', ALERT_EVENT_SOURCES),
    eventType: readEnum(trigger, 'eventType', ALERT_EVENT_TYPES),
    occurredAt: readTimestamp(trigger, 'occurredAt'),
    triggeredAt: readTimestamp(trigger, 'triggeredAt'),
    cooldownUntil: readTimestamp(trigger, 'cooldownUntil'),
    symbol: readNullableString(trigger, 'symbol'),
    timeframe: readNullableString(trigger, 'timeframe'),
    entityId: readNullableString(trigger, 'entityId'),
    payload: readParameters(trigger, 'payload'),
    workspaceContext: {
      symbol: readNullableString(workspaceContext, 'symbol'),
      timeframe: readNullableString(workspaceContext, 'timeframe'),
      setupId: readNullableString(workspaceContext, 'setupId'),
      replayId: null,
    },
  };
}

function parseArray<T>(value: unknown, parser: (item: unknown) => T, label: string): T[] {
  if (!Array.isArray(value)) throw new Error(`Invalid Alerts response: ${label}`);
  return value.map(parser);
}

export async function fetchAlertsMetadata(
  options: AlertsRuntimeRequestOptions = {},
): Promise<AlertsMetadata> {
  return parseAlertsMetadata(await requestJson(buildPath(ALERTS_META_PATH, options.baseUrl), options));
}

export async function fetchAlertsRuntimeStatus(
  options: AlertsRuntimeRequestOptions = {},
): Promise<AlertsRuntimeStatus> {
  return parseAlertsRuntimeStatus(await requestJson(buildPath(ALERTS_STATUS_PATH, options.baseUrl), options));
}

export async function fetchAlertRules(
  options: FetchAlertsRuntimeViewOptions = {},
): Promise<AlertRule[]> {
  const payload = await requestJson(
    buildListUrl(ALERTS_RULES_PATH, options.baseUrl, options.limit ?? 500),
    options,
  );
  return parseArray(payload, parseAlertRule, 'rules');
}

export async function fetchAlertTriggers(
  options: FetchAlertsRuntimeViewOptions = {},
): Promise<AlertTrigger[]> {
  const payload = await requestJson(
    buildListUrl(ALERTS_TRIGGERS_PATH, options.baseUrl, options.limit ?? 500),
    options,
  );
  return parseArray(payload, parseAlertTrigger, 'triggers');
}

export async function fetchAlertsRuntimeView(
  options: FetchAlertsRuntimeViewOptions = {},
): Promise<AlertsRuntimeView> {
  const [metadata, status, rules, triggers] = await Promise.all([
    fetchAlertsMetadata(options),
    fetchAlertsRuntimeStatus(options),
    fetchAlertRules(options),
    fetchAlertTriggers(options),
  ]);
  return { metadata, status, rules, triggers };
}

function ruleUrl(ruleId: string, baseUrl?: string): string {
  const normalized = ruleId.trim();
  if (!/^[A-Za-z0-9._:-]{1,300}$/.test(normalized)) {
    throw new Error('Invalid alert rule id');
  }
  return `${buildPath(ALERTS_RULES_PATH, baseUrl)}/${encodeURIComponent(normalized)}`;
}

export async function createAlertRule(
  input: AlertRuleWriteInput,
  options: AlertsRuntimeRequestOptions = {},
): Promise<AlertRule> {
  return parseAlertRule(await requestJson(buildPath(ALERTS_RULES_PATH, options.baseUrl), options, {
    method: 'POST',
    body: JSON.stringify(input),
  }));
}

export async function updateAlertRule(
  ruleId: string,
  input: AlertRuleUpdateInput,
  options: AlertsRuntimeRequestOptions = {},
): Promise<AlertRule> {
  return parseAlertRule(await requestJson(ruleUrl(ruleId, options.baseUrl), options, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }));
}

export async function setAlertRuleEnabled(
  ruleId: string,
  enabled: boolean,
  options: AlertsRuntimeRequestOptions = {},
): Promise<AlertRule> {
  return parseAlertRule(await requestJson(`${ruleUrl(ruleId, options.baseUrl)}/enabled`, options, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  }));
}
