import { randomUUID } from 'node:crypto';
import {
  ALERT_EVENT_TYPES,
  AlertsDomainError,
  type AlertEventSource,
  type AlertEventSourceContract,
  type AlertEventType,
  type AlertParameters,
  type AlertRule,
  type AlertRuleCreateInput,
  type AlertRuleFilters,
  type AlertRuleUpdateInput,
  type AlertsRuntimeContract,
  type AlertsRuntimeOptions,
  type AlertsRuntimeStatus,
  type AlertTrigger,
  type AlertTriggerEvent,
  type AlertTriggerFilters,
} from './alerts.types.js';

const MAX_COOLDOWN_MS =
  7 * 24 * 60 * 60 * 1_000;

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const TIMEFRAME_PATTERN =
  /^[1-9][0-9]*(?:m|h|d)$/;

const ID_PATTERN =
  /^[A-Za-z0-9._:-]{1,300}$/;

const EVENT_SOURCE_BY_TYPE:
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

export const DEFAULT_ALERTS_RUNTIME_OPTIONS:
AlertsRuntimeOptions = {
  maxRules: 1_000,
  maxTriggers: 10_000,
  maxDedupeKeys: 50_000,
  defaultCooldownMs: 60_000,
  now: () => new Date(),
  createId: (kind) =>
    `${kind}-${randomUUID()}`,
};

function domainError(
  code: string,
  message: string,
): never {
  throw new AlertsDomainError(
    code,
    message,
  );
}

function hasOwn(
  value: object,
  key: string,
): boolean {
  return Object.prototype
    .hasOwnProperty.call(
      value,
      key,
    );
}

function validateOptions(
  options: AlertsRuntimeOptions,
): void {
  for (const [name, value] of [
    ['maxRules', options.maxRules],
    ['maxTriggers', options.maxTriggers],
    ['maxDedupeKeys', options.maxDedupeKeys],
  ] as const) {
    if (
      !Number.isInteger(value)
      || value <= 0
    ) {
      domainError(
        'invalid_alerts_runtime_options',
        `Alerts ${name} must be a positive integer`,
      );
    }
  }

  validateCooldown(
    options.defaultCooldownMs,
  );
}

function validateCooldown(
  value: number,
): number {
  if (
    !Number.isSafeInteger(value)
    || value < 0
    || value > MAX_COOLDOWN_MS
  ) {
    domainError(
      'invalid_alert_rule_cooldown',
      'Alert rule cooldownMs must be an integer from 0 to 604800000',
    );
  }

  return value;
}

function normalizeId(
  value: string,
  label: string,
): string {
  const normalized =
    typeof value === 'string'
      ? value.trim()
      : '';

  if (!ID_PATTERN.test(normalized)) {
    domainError(
      `invalid_alert_${label}_id`,
      `Invalid alert ${label} id`,
    );
  }

  return normalized;
}

function normalizeName(
  value: string,
): string {
  const name =
    typeof value === 'string'
      ? value.trim()
      : '';

  if (
    name.length === 0
    || name.length > 120
  ) {
    domainError(
      'invalid_alert_rule_name',
      'Alert rule name must contain from 1 to 120 characters',
    );
  }

  return name;
}

function normalizeDescription(
  value: string | null,
): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    domainError(
      'invalid_alert_rule_description',
      'Alert rule description must be a string or null',
    );
  }

  const description = value.trim();

  if (description.length > 500) {
    domainError(
      'invalid_alert_rule_description',
      'Alert rule description cannot exceed 500 characters',
    );
  }

  return description.length > 0
    ? description
    : null;
}

function normalizeSymbol(
  value: string | null,
): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    domainError(
      'invalid_alert_symbol',
      'Alert symbol must be a string or null',
    );
  }

  const symbol =
    value.trim().toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    domainError(
      'invalid_alert_symbol',
      'Invalid alert symbol',
    );
  }

  return symbol;
}

function normalizeTimeframe(
  value: string | null,
): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    domainError(
      'invalid_alert_timeframe',
      'Alert timeframe must be a string or null',
    );
  }

  const timeframe = value.trim();

  if (!TIMEFRAME_PATTERN.test(timeframe)) {
    domainError(
      'invalid_alert_timeframe',
      'Invalid alert timeframe',
    );
  }

  return timeframe;
}

function normalizeEventType(
  value: AlertEventType,
): AlertEventType {
  if (
    typeof value !== 'string'
    || !ALERT_EVENT_TYPES.includes(
      value as AlertEventType,
    )
  ) {
    domainError(
      'invalid_alert_event_type',
      'Invalid alert event type',
    );
  }

  return value;
}

function normalizeParameters(
  value: AlertParameters,
): AlertParameters {
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
  ) {
    domainError(
      'invalid_alert_parameters',
      'Alert parameters must be an object',
    );
  }

  const entries =
    Object.entries(value);

  if (entries.length > 50) {
    domainError(
      'invalid_alert_parameters',
      'Alert parameters cannot contain more than 50 entries',
    );
  }

  const normalized:
  AlertParameters = {};

  for (const [keyValue, item] of entries) {
    const key = keyValue.trim();

    if (
      key.length === 0
      || key.length > 100
      || !(
        item === null
        || typeof item === 'string'
        || typeof item === 'boolean'
        || (
          typeof item === 'number'
          && Number.isFinite(item)
        )
      )
    ) {
      domainError(
        'invalid_alert_parameters',
        'Alert parameter keys and values must be finite scalar values',
      );
    }

    normalized[key] = item;
  }

  return normalized;
}

function parseTimestamp(
  value: string,
  label: string,
): string {
  const milliseconds = Date.parse(value);

  if (!Number.isFinite(milliseconds)) {
    domainError(
      `invalid_alert_${label}_timestamp`,
      `Invalid alert ${label} timestamp`,
    );
  }

  return new Date(milliseconds)
    .toISOString();
}

function cloneRule(
  rule: AlertRule,
): AlertRule {
  return {
    ...rule,
    parameters: {
      ...rule.parameters,
    },
  };
}

function cloneTrigger(
  trigger: AlertTrigger,
): AlertTrigger {
  return {
    ...trigger,
    payload: {
      ...trigger.payload,
    },
    workspaceContext: {
      ...trigger.workspaceContext,
    },
  };
}

function normalizeSourceEvent(
  input: AlertTriggerEvent,
): AlertTriggerEvent {
  const eventType =
    normalizeEventType(
      input.eventType,
    );

  const expectedSource =
    EVENT_SOURCE_BY_TYPE[eventType];

  if (input.source !== expectedSource) {
    domainError(
      'invalid_alert_event_source',
      `Alert event ${eventType} must use source ${expectedSource}`,
    );
  }

  return {
    sourceEventId:
      normalizeId(
        input.sourceEventId,
        'source_event',
      ),
    source: input.source,
    eventType,
    occurredAt:
      parseTimestamp(
        input.occurredAt,
        'event',
      ),
    symbol:
      normalizeSymbol(
        input.symbol,
      ),
    timeframe:
      normalizeTimeframe(
        input.timeframe,
      ),
    entityId:
      input.entityId === null
        ? null
        : normalizeId(
            input.entityId,
            'entity',
          ),
    payload:
      normalizeParameters(
        input.payload,
      ),
  };
}

function matchesRule(
  rule: AlertRule,
  event: AlertTriggerEvent,
): boolean {
  return rule.enabled
    && rule.eventType === event.eventType
    && rule.source === event.source
    && (
      rule.symbol === null
      || rule.symbol === event.symbol
    )
    && (
      rule.timeframe === null
      || rule.timeframe === event.timeframe
    );
}

function matchesRuleFilters(
  rule: AlertRule,
  filters: AlertRuleFilters,
): boolean {
  return (
    filters.enabled === undefined
    || rule.enabled === filters.enabled
  ) && (
    filters.eventType === undefined
    || rule.eventType === filters.eventType
  ) && (
    filters.source === undefined
    || rule.source === filters.source
  ) && (
    filters.symbol === undefined
    || rule.symbol === filters.symbol
  ) && (
    filters.timeframe === undefined
    || rule.timeframe === filters.timeframe
  );
}

function matchesTriggerFilters(
  trigger: AlertTrigger,
  filters: AlertTriggerFilters,
): boolean {
  return (
    filters.ruleId === undefined
    || trigger.ruleId === filters.ruleId
  ) && (
    filters.eventType === undefined
    || trigger.eventType === filters.eventType
  ) && (
    filters.source === undefined
    || trigger.source === filters.source
  ) && (
    filters.symbol === undefined
    || trigger.symbol === filters.symbol
  ) && (
    filters.timeframe === undefined
    || trigger.timeframe === filters.timeframe
  );
}

function normalizeRuleFilters(
  filters: AlertRuleFilters,
): AlertRuleFilters {
  const normalized: AlertRuleFilters = {};

  if (filters.enabled !== undefined) {
    normalized.enabled = filters.enabled;
  }

  if (filters.eventType !== undefined) {
    normalized.eventType =
      normalizeEventType(filters.eventType);
  }

  if (filters.source !== undefined) {
    normalized.source = filters.source;
  }

  if (filters.symbol !== undefined) {
    normalized.symbol =
      normalizeSymbol(filters.symbol) as string;
  }

  if (filters.timeframe !== undefined) {
    normalized.timeframe =
      normalizeTimeframe(filters.timeframe) as string;
  }

  return normalized;
}

function normalizeTriggerFilters(
  filters: AlertTriggerFilters,
): AlertTriggerFilters {
  const normalized: AlertTriggerFilters = {};

  if (filters.ruleId !== undefined) {
    normalized.ruleId =
      normalizeId(filters.ruleId, 'rule');
  }

  if (filters.eventType !== undefined) {
    normalized.eventType =
      normalizeEventType(filters.eventType);
  }

  if (filters.source !== undefined) {
    normalized.source = filters.source;
  }

  if (filters.symbol !== undefined) {
    normalized.symbol =
      normalizeSymbol(filters.symbol) as string;
  }

  if (filters.timeframe !== undefined) {
    normalized.timeframe =
      normalizeTimeframe(filters.timeframe) as string;
  }

  return normalized;
}

export class AlertsRuntimeService
implements AlertsRuntimeContract {
  private readonly rules =
    new Map<string, AlertRule>();

  private readonly triggers:
    AlertTrigger[] = [];

  private readonly dedupeKeys =
    new Set<string>();

  private readonly dedupeOrder:
    string[] = [];

  private readonly cooldownByRuleScope =
    new Map<string, number>();

  private readonly unsubscribers:
    Array<() => void> = [];

  private state:
    AlertsRuntimeStatus['state'] = 'idle';

  private sourceEventsCount = 0;
  private duplicateEventsCount = 0;
  private cooldownSuppressedCount = 0;
  private droppedTriggersCount = 0;
  private lastSourceEventAt: string | null = null;
  private lastTriggeredAt: string | null = null;

  private readonly options:
    AlertsRuntimeOptions;

  constructor(
    private readonly sources:
      readonly AlertEventSourceContract[] = [],
    options:
      Partial<AlertsRuntimeOptions> = {},
  ) {
    this.options = {
      ...DEFAULT_ALERTS_RUNTIME_OPTIONS,
      ...options,
    };

    validateOptions(this.options);
  }

  start(): void {
    if (this.state === 'running') {
      return;
    }

    this.state = 'running';

    for (const source of this.sources) {
      const unsubscribe =
        source.subscribeAlertEvents(
          (event) => {
            this.ingestEvent(event);
          },
        );

      this.unsubscribers.push(
        unsubscribe,
      );
    }
  }

  stop(): void {
    for (const unsubscribe of
      this.unsubscribers.splice(0)) {
      unsubscribe();
    }

    this.state = 'stopped';
  }

  getStatus(): AlertsRuntimeStatus {
    const rules =
      [...this.rules.values()];

    return {
      state: this.state,
      persistenceMode: 'runtime_only',
      rulesCount: rules.length,
      enabledRulesCount:
        rules.filter((rule) => rule.enabled).length,
      triggersCount: this.triggers.length,
      maxRules: this.options.maxRules,
      maxTriggers: this.options.maxTriggers,
      maxDedupeKeys: this.options.maxDedupeKeys,
      sourceEventsCount: this.sourceEventsCount,
      duplicateEventsCount: this.duplicateEventsCount,
      cooldownSuppressedCount:
        this.cooldownSuppressedCount,
      droppedTriggersCount:
        this.droppedTriggersCount,
      lastSourceEventAt: this.lastSourceEventAt,
      lastTriggeredAt: this.lastTriggeredAt,
    };
  }

  getRules(
    filters: AlertRuleFilters = {},
  ): AlertRule[] {
    const normalized =
      normalizeRuleFilters(filters);

    return [...this.rules.values()]
      .filter((rule) =>
        matchesRuleFilters(
          rule,
          normalized,
        ))
      .sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
        || right.id.localeCompare(left.id))
      .map(cloneRule);
  }

  getRule(ruleIdValue: string): AlertRule | null {
    const ruleId =
      normalizeId(ruleIdValue, 'rule');
    const rule = this.rules.get(ruleId);

    return rule
      ? cloneRule(rule)
      : null;
  }

  getTriggers(
    filters: AlertTriggerFilters = {},
  ): AlertTrigger[] {
    const normalized =
      normalizeTriggerFilters(filters);

    return this.triggers
      .filter((trigger) =>
        matchesTriggerFilters(
          trigger,
          normalized,
        ))
      .sort((left, right) =>
        right.triggeredAt.localeCompare(left.triggeredAt)
        || right.id.localeCompare(left.id))
      .map(cloneTrigger);
  }

  getTrigger(
    triggerIdValue: string,
  ): AlertTrigger | null {
    const triggerId =
      normalizeId(triggerIdValue, 'trigger');
    const trigger = this.triggers.find(
      (item) => item.id === triggerId,
    );

    return trigger
      ? cloneTrigger(trigger)
      : null;
  }

  createRule(
    input: AlertRuleCreateInput,
  ): AlertRule {
    if (this.rules.size >= this.options.maxRules) {
      domainError(
        'alert_rule_capacity_reached',
        'Alerts runtime rule capacity has been reached',
      );
    }

    const eventType =
      normalizeEventType(input.eventType);
    const timestamp =
      this.options.now().toISOString();
    const id = normalizeId(
      this.options.createId('rule'),
      'rule',
    );

    if (this.rules.has(id)) {
      domainError(
        'duplicate_alert_rule_id',
        `Alert rule ${id} already exists`,
      );
    }

    const rule: AlertRule = {
      id,
      name: normalizeName(input.name),
      description:
        normalizeDescription(
          input.description ?? null,
        ),
      eventType,
      source: EVENT_SOURCE_BY_TYPE[eventType],
      enabled: input.enabled ?? true,
      symbol:
        normalizeSymbol(input.symbol ?? null),
      timeframe:
        normalizeTimeframe(input.timeframe ?? null),
      cooldownMs:
        validateCooldown(
          input.cooldownMs
          ?? this.options.defaultCooldownMs,
        ),
      parameters:
        normalizeParameters(input.parameters ?? {}),
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 1,
    };

    if (typeof rule.enabled !== 'boolean') {
      domainError(
        'invalid_alert_rule_enabled',
        'Alert rule enabled must be a boolean',
      );
    }

    this.rules.set(id, rule);

    return cloneRule(rule);
  }

  updateRule(
    ruleIdValue: string,
    input: AlertRuleUpdateInput,
  ): AlertRule | null {
    const ruleId =
      normalizeId(ruleIdValue, 'rule');
    const current = this.rules.get(ruleId);

    if (!current) {
      return null;
    }

    if (
      typeof input !== 'object'
      || input === null
      || Object.keys(input).length === 0
    ) {
      domainError(
        'empty_alert_rule_update',
        'Alert rule update cannot be empty',
      );
    }

    const eventType =
      hasOwn(input, 'eventType')
        ? normalizeEventType(
            input.eventType as AlertEventType,
          )
        : current.eventType;

    const enabled =
      hasOwn(input, 'enabled')
        ? input.enabled
        : current.enabled;

    if (typeof enabled !== 'boolean') {
      domainError(
        'invalid_alert_rule_enabled',
        'Alert rule enabled must be a boolean',
      );
    }

    const updated: AlertRule = {
      ...current,
      name:
        hasOwn(input, 'name')
          ? normalizeName(input.name as string)
          : current.name,
      description:
        hasOwn(input, 'description')
          ? normalizeDescription(
              input.description ?? null,
            )
          : current.description,
      eventType,
      source: EVENT_SOURCE_BY_TYPE[eventType],
      enabled,
      symbol:
        hasOwn(input, 'symbol')
          ? normalizeSymbol(input.symbol ?? null)
          : current.symbol,
      timeframe:
        hasOwn(input, 'timeframe')
          ? normalizeTimeframe(input.timeframe ?? null)
          : current.timeframe,
      cooldownMs:
        hasOwn(input, 'cooldownMs')
          ? validateCooldown(input.cooldownMs as number)
          : current.cooldownMs,
      parameters:
        hasOwn(input, 'parameters')
          ? normalizeParameters(input.parameters ?? {})
          : { ...current.parameters },
      updatedAt: this.options.now().toISOString(),
      revision: current.revision + 1,
    };

    this.rules.set(ruleId, updated);

    return cloneRule(updated);
  }

  setRuleEnabled(
    ruleId: string,
    enabled: boolean,
  ): AlertRule | null {
    if (typeof enabled !== 'boolean') {
      domainError(
        'invalid_alert_rule_enabled',
        'Alert rule enabled must be a boolean',
      );
    }

    return this.updateRule(
      ruleId,
      { enabled },
    );
  }

  ingestEvent(
    input: AlertTriggerEvent,
  ): AlertTrigger[] {
    const event = normalizeSourceEvent(input);
    this.sourceEventsCount += 1;
    this.lastSourceEventAt = event.occurredAt;

    const dedupeKey =
      `${event.source}:${event.sourceEventId}`;

    if (this.dedupeKeys.has(dedupeKey)) {
      this.duplicateEventsCount += 1;
      return [];
    }

    this.rememberDedupeKey(dedupeKey);

    const triggeredAt =
      this.options.now();
    const triggeredAtMs =
      triggeredAt.getTime();
    const created: AlertTrigger[] = [];

    for (const rule of this.rules.values()) {
      if (!matchesRule(rule, event)) {
        continue;
      }

      const cooldownScope = [
        rule.id,
        event.symbol ?? '*',
        event.timeframe ?? '*',
        event.eventType,
      ].join(':');

      const cooldownUntilMs =
        this.cooldownByRuleScope.get(cooldownScope)
        ?? 0;

      if (triggeredAtMs < cooldownUntilMs) {
        this.cooldownSuppressedCount += 1;
        continue;
      }

      const nextCooldownUntilMs =
        triggeredAtMs + rule.cooldownMs;

      this.cooldownByRuleScope.set(
        cooldownScope,
        nextCooldownUntilMs,
      );

      const trigger: AlertTrigger = {
        id: normalizeId(
          this.options.createId('trigger'),
          'trigger',
        ),
        ruleId: rule.id,
        ruleRevision: rule.revision,
        sourceEventId: event.sourceEventId,
        source: event.source,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        triggeredAt: triggeredAt.toISOString(),
        cooldownUntil:
          new Date(nextCooldownUntilMs).toISOString(),
        symbol: event.symbol,
        timeframe: event.timeframe,
        entityId: event.entityId,
        payload: { ...event.payload },
        workspaceContext: {
          symbol: event.symbol,
          timeframe: event.timeframe,
          setupId:
            event.source === 'setup_lifecycle'
              ? event.entityId
              : null,
          replayId: null,
        },
      };

      this.triggers.push(trigger);
      created.push(cloneTrigger(trigger));
      this.lastTriggeredAt = trigger.triggeredAt;
      this.enforceTriggerBound();
    }

    return created;
  }

  private rememberDedupeKey(
    key: string,
  ): void {
    this.dedupeKeys.add(key);
    this.dedupeOrder.push(key);

    const overflow =
      this.dedupeOrder.length
      - this.options.maxDedupeKeys;

    if (overflow <= 0) {
      return;
    }

    const removed =
      this.dedupeOrder.splice(0, overflow);

    for (const item of removed) {
      this.dedupeKeys.delete(item);
    }
  }

  private enforceTriggerBound(): void {
    const overflow =
      this.triggers.length
      - this.options.maxTriggers;

    if (overflow <= 0) {
      return;
    }

    this.triggers.splice(0, overflow);
    this.droppedTriggersCount += overflow;
  }
}
