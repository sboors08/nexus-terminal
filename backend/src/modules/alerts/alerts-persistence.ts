import {
  randomUUID,
} from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  resolve,
} from 'node:path';
import {
  ALERT_EVENT_SOURCE_BY_TYPE,
  ALERT_EVENT_TYPES,
  type AlertEventSource,
  type AlertEventType,
  type AlertParameters,
  type AlertRule,
  type AlertTrigger,
} from './alerts.types.js';
import {
  ALERT_DELIVERY_STATES,
  cloneAlertDeliveryOutboxItem,
  type AlertDeliveryOutboxItem,
  type AlertDeliveryState,
} from './alerts-delivery.js';

export const ALERTS_PERSISTENCE_SCHEMA =
  'nexus.alerts.runtime';

export const ALERTS_PERSISTENCE_VERSION = 2;

export const ALERTS_PERSISTENCE_LEGACY_VERSION = 1;

export interface AlertsPersistedCooldown {
  scope: string;
  cooldownUntil: string;
}

export interface AlertsPersistenceSnapshotV1 {
  schema: typeof ALERTS_PERSISTENCE_SCHEMA;
  version: typeof ALERTS_PERSISTENCE_LEGACY_VERSION;
  savedAt: string;
  rules: AlertRule[];
  triggers: AlertTrigger[];
  sourceEventDedupeKeys: string[];
  cooldowns: AlertsPersistedCooldown[];
}

export interface AlertsPersistenceSnapshotV2 {
  schema: typeof ALERTS_PERSISTENCE_SCHEMA;
  version: typeof ALERTS_PERSISTENCE_VERSION;
  savedAt: string;
  rules: AlertRule[];
  triggers: AlertTrigger[];
  sourceEventDedupeKeys: string[];
  cooldowns: AlertsPersistedCooldown[];
  deliveryOutbox: AlertDeliveryOutboxItem[];
}

export type AlertsPersistenceSnapshot =
  AlertsPersistenceSnapshotV2;

export interface AlertsPersistenceContract {
  readonly adapter: string;

  load(): Promise<unknown | null>;

  save(
    snapshot: AlertsPersistenceSnapshot,
  ): Promise<void>;
}

export interface JsonFileAlertsPersistenceOptions {
  filePath: string;
}

export type AlertsPersistenceErrorCode =
  | 'alerts_persistence_corrupt'
  | 'alerts_persistence_unsupported_version'
  | 'alerts_persistence_read_failed'
  | 'alerts_persistence_write_failed';

export class AlertsPersistenceError
extends Error {
  constructor(
    public readonly code:
      AlertsPersistenceErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AlertsPersistenceError';
  }
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const TIMEFRAME_PATTERN =
  /^[1-9][0-9]*(?:m|h|d)$/;

const ID_PATTERN =
  /^[A-Za-z0-9._:-]{1,300}$/;

const COOLDOWN_SCOPE_PATTERN =
  /^[A-Za-z0-9.*_:-]{1,500}$/;

const MAX_RULES_IN_SNAPSHOT =
  100_000;

const MAX_TRIGGERS_IN_SNAPSHOT =
  100_000;

const MAX_DEDUPE_KEYS_IN_SNAPSHOT =
  500_000;

const MAX_COOLDOWNS_IN_SNAPSHOT =
  100_000;

const MAX_DELIVERY_OUTBOX_IN_SNAPSHOT =
  100_000;

const DELIVERY_CHANNEL_PATTERN =
  /^[a-z0-9][a-z0-9_-]{0,63}$/;

const DELIVERY_ERROR_CODE_PATTERN =
  /^[a-z0-9][a-z0-9._:-]{0,99}$/;

const MAX_ALERT_COOLDOWN_MS =
  7 * 24 * 60 * 60 * 1_000;

function corrupt(
  message: string,
): never {
  throw new AlertsPersistenceError(
    'alerts_persistence_corrupt',
    message,
  );
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value),
  );
}

function requireRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    corrupt(
      `Invalid Alerts persistence ${label}`,
    );
  }

  return value;
}

function requireArray(
  value: unknown,
  label: string,
  maximumLength: number,
): unknown[] {
  if (
    !Array.isArray(value)
    || value.length > maximumLength
  ) {
    corrupt(
      `Invalid Alerts persistence ${label}`,
    );
  }

  return value;
}

function normalizeTimestamp(
  value: unknown,
  label: string,
): string {
  if (typeof value !== 'string') {
    corrupt(
      `Invalid Alerts persistence ${label} timestamp`,
    );
  }

  const timestampMs =
    Date.parse(value);

  if (!Number.isFinite(timestampMs)) {
    corrupt(
      `Invalid Alerts persistence ${label} timestamp`,
    );
  }

  return new Date(timestampMs)
    .toISOString();
}

function normalizeId(
  value: unknown,
  label: string,
): string {
  if (
    typeof value !== 'string'
    || !ID_PATTERN.test(value.trim())
  ) {
    corrupt(
      `Invalid persisted Alert ${label} id`,
    );
  }

  return value.trim();
}

function normalizeEventType(
  value: unknown,
): AlertEventType {
  if (
    typeof value !== 'string'
    || !ALERT_EVENT_TYPES.includes(
      value as AlertEventType,
    )
  ) {
    corrupt(
      'Invalid persisted Alert event type',
    );
  }

  return value as AlertEventType;
}

function normalizeSource(
  value: unknown,
  eventType: AlertEventType,
): AlertEventSource {
  const expectedSource =
    ALERT_EVENT_SOURCE_BY_TYPE[eventType];

  if (value !== expectedSource) {
    corrupt(
      `Persisted Alert event ${eventType} must use source ${expectedSource}`,
    );
  }

  return expectedSource;
}

function normalizeNullableSymbol(
  value: unknown,
): string | null {
  if (value === null) {
    return null;
  }

  if (
    typeof value !== 'string'
    || !SYMBOL_PATTERN.test(
      value.trim().toUpperCase(),
    )
  ) {
    corrupt(
      'Invalid persisted Alert symbol',
    );
  }

  return value.trim().toUpperCase();
}

function normalizeNullableTimeframe(
  value: unknown,
): string | null {
  if (value === null) {
    return null;
  }

  if (
    typeof value !== 'string'
    || !TIMEFRAME_PATTERN.test(
      value.trim(),
    )
  ) {
    corrupt(
      'Invalid persisted Alert timeframe',
    );
  }

  return value.trim();
}

function normalizeNullableId(
  value: unknown,
  label: string,
): string | null {
  return value === null
    ? null
    : normalizeId(
        value,
        label,
      );
}

function normalizeParameters(
  value: unknown,
  label: string,
): AlertParameters {
  const record =
    requireRecord(value, label);

  const entries =
    Object.entries(record);

  if (entries.length > 50) {
    corrupt(
      `Persisted Alert ${label} contains too many entries`,
    );
  }

  const normalized:
    AlertParameters = {};

  for (const [rawKey, item] of entries) {
    const key =
      rawKey.trim();

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
      corrupt(
        `Invalid persisted Alert ${label}`,
      );
    }

    normalized[key] = item;
  }

  return normalized;
}

function normalizePositiveInteger(
  value: unknown,
  label: string,
): number {
  if (
    !Number.isSafeInteger(value)
    || (value as number) < 1
  ) {
    corrupt(
      `Invalid persisted Alert ${label}`,
    );
  }

  return value as number;
}

function normalizeNonNegativeInteger(
  value: unknown,
  label: string,
): number {
  if (
    !Number.isSafeInteger(value)
    || (value as number) < 0
  ) {
    corrupt(
      `Invalid persisted Alert ${label}`,
    );
  }

  return value as number;
}

function normalizeCooldownMs(
  value: unknown,
): number {
  const normalized =
    normalizeNonNegativeInteger(
      value,
      'rule cooldownMs',
    );

  if (normalized > MAX_ALERT_COOLDOWN_MS) {
    corrupt(
      'Persisted Alert rule cooldownMs exceeds seven days',
    );
  }

  return normalized;
}

function normalizeRule(
  value: unknown,
): AlertRule {
  const record =
    requireRecord(value, 'rule');

  const id =
    normalizeId(record.id, 'rule');

  if (
    typeof record.name !== 'string'
    || record.name.trim().length === 0
    || record.name.trim().length > 120
  ) {
    corrupt(
      `Invalid persisted Alert rule name: ${id}`,
    );
  }

  const description =
    record.description === null
      ? null
      : typeof record.description === 'string'
        && record.description.trim().length <= 500
        ? record.description.trim() || null
        : corrupt(
            `Invalid persisted Alert rule description: ${id}`,
          );

  const eventType =
    normalizeEventType(
      record.eventType,
    );

  const createdAt =
    normalizeTimestamp(
      record.createdAt,
      'rule createdAt',
    );

  const updatedAt =
    normalizeTimestamp(
      record.updatedAt,
      'rule updatedAt',
    );

  if (updatedAt < createdAt) {
    corrupt(
      `Persisted Alert rule ${id} was updated before creation`,
    );
  }

  if (typeof record.enabled !== 'boolean') {
    corrupt(
      `Invalid persisted Alert rule enabled state: ${id}`,
    );
  }

  return {
    id,
    name:
      record.name.trim(),
    description,
    eventType,
    source:
      normalizeSource(
        record.source,
        eventType,
      ),
    enabled:
      record.enabled,
    symbol:
      normalizeNullableSymbol(
        record.symbol,
      ),
    timeframe:
      normalizeNullableTimeframe(
        record.timeframe,
      ),
    cooldownMs:
      normalizeCooldownMs(
        record.cooldownMs,
      ),
    parameters:
      normalizeParameters(
        record.parameters,
        'rule parameters',
      ),
    createdAt,
    updatedAt,
    revision:
      normalizePositiveInteger(
        record.revision,
        'rule revision',
      ),
  };
}

function normalizeTrigger(
  value: unknown,
): AlertTrigger {
  const record =
    requireRecord(value, 'trigger');

  const id =
    normalizeId(record.id, 'trigger');

  const eventType =
    normalizeEventType(
      record.eventType,
    );

  const occurredAt =
    normalizeTimestamp(
      record.occurredAt,
      'trigger occurredAt',
    );

  const triggeredAt =
    normalizeTimestamp(
      record.triggeredAt,
      'trigger triggeredAt',
    );

  const cooldownUntil =
    normalizeTimestamp(
      record.cooldownUntil,
      'trigger cooldownUntil',
    );

  if (cooldownUntil < triggeredAt) {
    corrupt(
      `Persisted Alert trigger ${id} has an invalid cooldown`,
    );
  }

  const symbol =
    normalizeNullableSymbol(
      record.symbol,
    );

  const timeframe =
    normalizeNullableTimeframe(
      record.timeframe,
    );

  const source =
    normalizeSource(
      record.source,
      eventType,
    );

  const entityId =
    normalizeNullableId(
      record.entityId,
      'entity',
    );

  const workspace =
    requireRecord(
      record.workspaceContext,
      'trigger workspaceContext',
    );

  const workspaceSymbol =
    normalizeNullableSymbol(
      workspace.symbol,
    );

  const workspaceTimeframe =
    normalizeNullableTimeframe(
      workspace.timeframe,
    );

  const setupId =
    normalizeNullableId(
      workspace.setupId,
      'setup',
    );

  if (
    workspace.replayId !== null
    || workspaceSymbol !== symbol
    || workspaceTimeframe !== timeframe
    || (
      source === 'setup_lifecycle'
      && setupId !== entityId
    )
    || (
      source !== 'setup_lifecycle'
      && setupId !== null
    )
  ) {
    corrupt(
      `Invalid persisted Alert trigger workspace context: ${id}`,
    );
  }

  return {
    id,
    ruleId:
      normalizeId(
        record.ruleId,
        'rule',
      ),
    ruleRevision:
      normalizePositiveInteger(
        record.ruleRevision,
        'trigger ruleRevision',
      ),
    sourceEventId:
      normalizeId(
        record.sourceEventId,
        'source event',
      ),
    source,
    eventType,
    occurredAt,
    triggeredAt,
    cooldownUntil,
    symbol,
    timeframe,
    entityId,
    payload:
      normalizeParameters(
        record.payload,
        'trigger payload',
      ),
    workspaceContext: {
      symbol: workspaceSymbol,
      timeframe: workspaceTimeframe,
      setupId,
      replayId: null,
    },
  };
}

function normalizeNullableTimestamp(
  value: unknown,
  label: string,
): string | null {
  return value === null
    ? null
    : normalizeTimestamp(
        value,
        label,
      );
}

function normalizeDeliveryOutboxItem(
  value: unknown,
): AlertDeliveryOutboxItem {
  const record =
    requireRecord(
      value,
      'delivery outbox item',
    );
  const id =
    normalizeId(
      record.id,
      'delivery outbox',
    );
  const trigger =
    normalizeTrigger(
      record.trigger,
    );
  const triggerId =
    normalizeId(
      record.triggerId,
      'trigger',
    );

  if (triggerId !== trigger.id) {
    corrupt(
      `Persisted Alerts delivery ${id} references a mismatched trigger`,
    );
  }

  if (
    typeof record.channel !== 'string'
    || !DELIVERY_CHANNEL_PATTERN.test(
      record.channel,
    )
  ) {
    corrupt(
      `Invalid persisted Alerts delivery channel: ${id}`,
    );
  }

  const channel =
    record.channel;
  const expectedIdempotencyKey =
    `nexus.alerts:${channel}:${triggerId}`;

  if (
    record.idempotencyKey
    !== expectedIdempotencyKey
  ) {
    corrupt(
      `Invalid persisted Alerts delivery idempotency key: ${id}`,
    );
  }

  if (
    typeof record.state !== 'string'
    || !ALERT_DELIVERY_STATES.includes(
      record.state as AlertDeliveryState,
    )
  ) {
    corrupt(
      `Invalid persisted Alerts delivery state: ${id}`,
    );
  }

  const state =
    record.state as AlertDeliveryState;
  const attempts =
    normalizeNonNegativeInteger(
      record.attempts,
      'delivery attempts',
    );
  const maxAttempts =
    normalizePositiveInteger(
      record.maxAttempts,
      'delivery maxAttempts',
    );

  if (attempts > maxAttempts) {
    corrupt(
      `Persisted Alerts delivery ${id} exceeds maxAttempts`,
    );
  }

  const createdAt =
    normalizeTimestamp(
      record.createdAt,
      'delivery createdAt',
    );
  const updatedAt =
    normalizeTimestamp(
      record.updatedAt,
      'delivery updatedAt',
    );
  const nextAttemptAt =
    normalizeNullableTimestamp(
      record.nextAttemptAt,
      'delivery nextAttemptAt',
    );
  const lastAttemptAt =
    normalizeNullableTimestamp(
      record.lastAttemptAt,
      'delivery lastAttemptAt',
    );
  const deliveredAt =
    normalizeNullableTimestamp(
      record.deliveredAt,
      'delivery deliveredAt',
    );
  const lastErrorCode =
    record.lastErrorCode === null
      ? null
      : typeof record.lastErrorCode === 'string'
        && DELIVERY_ERROR_CODE_PATTERN.test(
          record.lastErrorCode,
        )
        ? record.lastErrorCode
        : corrupt(
            `Invalid persisted Alerts delivery error code: ${id}`,
          );

  if (
    updatedAt < createdAt
    || (
      lastAttemptAt !== null
      && lastAttemptAt < createdAt
    )
    || (
      deliveredAt !== null
      && deliveredAt < createdAt
    )
  ) {
    corrupt(
      `Invalid persisted Alerts delivery timestamps: ${id}`,
    );
  }

  if (
    state === 'pending'
    && (
      nextAttemptAt === null
      || deliveredAt !== null
      || lastErrorCode !== null
    )
  ) {
    corrupt(
      `Invalid pending Alerts delivery state: ${id}`,
    );
  }

  if (
    state === 'sending'
    && (
      attempts < 1
      || lastAttemptAt === null
      || nextAttemptAt !== null
      || deliveredAt !== null
      || lastErrorCode !== null
    )
  ) {
    corrupt(
      `Invalid sending Alerts delivery state: ${id}`,
    );
  }

  if (
    state === 'delivered'
    && (
      attempts < 1
      || lastAttemptAt === null
      || deliveredAt === null
      || nextAttemptAt !== null
      || lastErrorCode !== null
    )
  ) {
    corrupt(
      `Invalid delivered Alerts delivery state: ${id}`,
    );
  }

  if (
    state === 'failed'
    && (
      attempts < 1
      || lastAttemptAt === null
      || deliveredAt !== null
      || lastErrorCode === null
      || (
        nextAttemptAt !== null
        && attempts >= maxAttempts
      )
    )
  ) {
    corrupt(
      `Invalid failed Alerts delivery state: ${id}`,
    );
  }

  return {
    id,
    triggerId,
    channel,
    idempotencyKey:
      expectedIdempotencyKey,
    trigger,
    state,
    attempts,
    maxAttempts,
    createdAt,
    updatedAt,
    nextAttemptAt,
    lastAttemptAt,
    deliveredAt,
    lastErrorCode,
  };
}

function normalizeDedupeKey(
  value: unknown,
): string {
  if (
    typeof value !== 'string'
    || value.length > 500
  ) {
    corrupt(
      'Invalid persisted Alert source-event dedupe key',
    );
  }

  const separatorIndex =
    value.indexOf(':');

  if (separatorIndex <= 0) {
    corrupt(
      'Invalid persisted Alert source-event dedupe key',
    );
  }

  const source =
    value.slice(
      0,
      separatorIndex,
    ) as AlertEventSource;

  const sourceEventId =
    value.slice(
      separatorIndex + 1,
    );

  if (
    !Object.values(
      ALERT_EVENT_SOURCE_BY_TYPE,
    ).includes(source)
    || !ID_PATTERN.test(sourceEventId)
  ) {
    corrupt(
      'Invalid persisted Alert source-event dedupe key',
    );
  }

  return `${source}:${sourceEventId}`;
}

function normalizeCooldown(
  value: unknown,
): AlertsPersistedCooldown {
  const record =
    requireRecord(
      value,
      'cooldown',
    );

  if (
    typeof record.scope !== 'string'
    || !COOLDOWN_SCOPE_PATTERN.test(
      record.scope,
    )
  ) {
    corrupt(
      'Invalid persisted Alert cooldown scope',
    );
  }

  return {
    scope: record.scope,
    cooldownUntil:
      normalizeTimestamp(
        record.cooldownUntil,
        'cooldownUntil',
      ),
  };
}

function requireUnique(
  values: readonly string[],
  label: string,
): void {
  if (new Set(values).size !== values.length) {
    corrupt(
      `Duplicate persisted Alert ${label}`,
    );
  }
}

export function normalizeAlertsPersistenceSnapshot(
  value: unknown,
): AlertsPersistenceSnapshot {
  const record =
    requireRecord(
      value,
      'snapshot',
    );

  if (record.schema !== ALERTS_PERSISTENCE_SCHEMA) {
    corrupt(
      'Invalid Alerts persistence schema',
    );
  }

  if (
    record.version
      !== ALERTS_PERSISTENCE_LEGACY_VERSION
    && record.version
      !== ALERTS_PERSISTENCE_VERSION
  ) {
    throw new AlertsPersistenceError(
      'alerts_persistence_unsupported_version',
      `Unsupported Alerts persistence version: ${String(record.version)}`,
    );
  }

  const rules =
    requireArray(
      record.rules,
      'rules',
      MAX_RULES_IN_SNAPSHOT,
    ).map(normalizeRule);

  const triggers =
    requireArray(
      record.triggers,
      'triggers',
      MAX_TRIGGERS_IN_SNAPSHOT,
    ).map(normalizeTrigger);

  const sourceEventDedupeKeys =
    requireArray(
      record.sourceEventDedupeKeys,
      'sourceEventDedupeKeys',
      MAX_DEDUPE_KEYS_IN_SNAPSHOT,
    ).map(normalizeDedupeKey);

  const cooldowns =
    requireArray(
      record.cooldowns,
      'cooldowns',
      MAX_COOLDOWNS_IN_SNAPSHOT,
    ).map(normalizeCooldown);

  const deliveryOutbox =
    record.version
      === ALERTS_PERSISTENCE_LEGACY_VERSION
      ? []
      : requireArray(
          record.deliveryOutbox,
          'deliveryOutbox',
          MAX_DELIVERY_OUTBOX_IN_SNAPSHOT,
        ).map(
          normalizeDeliveryOutboxItem,
        );

  requireUnique(
    rules.map((rule) => rule.id),
    'rule id',
  );
  requireUnique(
    triggers.map((trigger) => trigger.id),
    'trigger id',
  );
  requireUnique(
    sourceEventDedupeKeys,
    'source-event dedupe key',
  );
  requireUnique(
    cooldowns.map(
      (cooldown) => cooldown.scope,
    ),
    'cooldown scope',
  );
  requireUnique(
    deliveryOutbox.map(
      (item) => item.id,
    ),
    'delivery outbox id',
  );
  requireUnique(
    deliveryOutbox.map(
      (item) =>
        `${item.channel}:${item.triggerId}`,
    ),
    'delivery trigger/channel identity',
  );

  const rulesById =
    new Map(
      rules.map(
        (rule) => [
          rule.id,
          rule,
        ],
      ),
    );

  for (const trigger of triggers) {
    const rule =
      rulesById.get(
        trigger.ruleId,
      );

    if (
      !rule
      || trigger.ruleRevision
        > rule.revision
    ) {
      corrupt(
        `Persisted Alert trigger ${trigger.id} references an invalid rule revision`,
      );
    }
  }

  for (const cooldown of cooldowns) {
    if (
      !rules.some(
        (rule) =>
          cooldown.scope.startsWith(
            `${rule.id}:`,
          ),
      )
    ) {
      corrupt(
        `Persisted Alert cooldown references an unknown rule: ${cooldown.scope}`,
      );
    }
  }

  return {
    schema: ALERTS_PERSISTENCE_SCHEMA,
    version: ALERTS_PERSISTENCE_VERSION,
    savedAt:
      normalizeTimestamp(
        record.savedAt,
        'savedAt',
      ),
    rules:
      rules.map((rule) => ({
        ...rule,
        parameters: {
          ...rule.parameters,
        },
      })),
    triggers:
      triggers.map((trigger) => ({
        ...trigger,
        payload: {
          ...trigger.payload,
        },
        workspaceContext: {
          ...trigger.workspaceContext,
        },
      })),
    sourceEventDedupeKeys: [
      ...sourceEventDedupeKeys,
    ],
    cooldowns:
      cooldowns.map(
        (cooldown) => ({
          ...cooldown,
        }),
      ),
    deliveryOutbox:
      deliveryOutbox.map(
        cloneAlertDeliveryOutboxItem,
      ),
  };
}

export class JsonFileAlertsPersistence
implements AlertsPersistenceContract {
  readonly adapter = 'json_file';

  readonly filePath: string;

  constructor(
    options:
      JsonFileAlertsPersistenceOptions,
  ) {
    const filePath =
      options.filePath.trim();

    if (filePath.length === 0) {
      throw new Error(
        'Alerts persistence file path is required',
      );
    }

    this.filePath =
      resolve(filePath);
  }

  async load():
  Promise<AlertsPersistenceSnapshot | null> {
    let source: string;

    try {
      source =
        await readFile(
          this.filePath,
          'utf8',
        );
    } catch (error) {
      if (
        (
          error as NodeJS.ErrnoException
        ).code === 'ENOENT'
      ) {
        return null;
      }

      throw new AlertsPersistenceError(
        'alerts_persistence_read_failed',
        'Unable to read Alerts persistence file',
        {
          cause: error,
        },
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(source) as unknown;
    } catch (error) {
      throw new AlertsPersistenceError(
        'alerts_persistence_corrupt',
        'Alerts persistence file contains invalid JSON',
        {
          cause: error,
        },
      );
    }

    return normalizeAlertsPersistenceSnapshot(
      parsed,
    );
  }

  async save(
    snapshot: AlertsPersistenceSnapshot,
  ): Promise<void> {
    const normalized =
      normalizeAlertsPersistenceSnapshot(
        snapshot,
      );

    const temporaryPath = [
      this.filePath,
      process.pid,
      randomUUID(),
      'tmp',
    ].join('.');

    try {
      await mkdir(
        dirname(this.filePath),
        {
          recursive: true,
        },
      );

      await writeFile(
        temporaryPath,
        `${JSON.stringify(normalized, null, 2)}\n`,
        'utf8',
      );

      await rename(
        temporaryPath,
        this.filePath,
      );
    } catch (error) {
      try {
        await unlink(temporaryPath);
      } catch {
        // The temporary file may not have been created.
      }

      throw new AlertsPersistenceError(
        'alerts_persistence_write_failed',
        'Unable to write Alerts persistence file',
        {
          cause: error,
        },
      );
    }
  }
}
