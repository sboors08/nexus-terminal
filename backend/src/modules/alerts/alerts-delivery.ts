import {
  randomUUID,
} from 'node:crypto';
import type {
  AlertTrigger,
} from './alerts.types.js';

export const ALERT_DELIVERY_STATES = [
  'pending',
  'sending',
  'delivered',
  'failed',
] as const;

export type AlertDeliveryState =
  typeof ALERT_DELIVERY_STATES[number];

export type AlertsDeliveryRuntimeState =
  | 'disabled'
  | 'idle'
  | 'running'
  | 'stopped';

export interface AlertDeliveryOutboxItem {
  id: string;
  triggerId: string;
  channel: string;
  idempotencyKey: string;
  trigger: AlertTrigger;
  state: AlertDeliveryState;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
  lastErrorCode: string | null;
}

export interface AlertDeliveryRequest {
  trigger: AlertTrigger;
  channel: string;
  idempotencyKey: string;
  attempt: number;
}

export interface AlertDeliveryAdapter {
  readonly channel: string;
  readonly adapter: string;

  deliver(
    request: AlertDeliveryRequest,
  ): Promise<void>;
}

export interface AlertsDeliveryOptions {
  maxOutboxItems: number;
  maxAttempts: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  terminalRetentionMs: number;
  now: () => Date;
  createId: () => string;
}

export interface AlertsDeliveryStatus {
  state: AlertsDeliveryRuntimeState;
  channels: string[];
  adapters: string[];
  outboxCount: number;
  pendingCount: number;
  sendingCount: number;
  deliveredCount: number;
  failedCount: number;
  retryScheduledCount: number;
  unavailableChannelCount: number;
  maxOutboxItems: number;
  maxAttempts: number;
  enqueuedCount: number;
  duplicateEnqueuesCount: number;
  rejectedEnqueuesCount: number;
  attemptsCount: number;
  successesCount: number;
  failuresCount: number;
  terminalFailuresCount: number;
  recoveredSendingCount: number;
  cleanedItemsCount: number;
  hydratedItemsCount: number;
  lastAttemptAt: string | null;
  lastDeliveredAt: string | null;
  lastErrorCode: string | null;
}

export type AlertsDeliveryChanged =
  () => void | Promise<void>;

export const DEFAULT_ALERTS_DELIVERY_OPTIONS:
AlertsDeliveryOptions = {
  maxOutboxItems: 10_000,
  maxAttempts: 5,
  retryBaseDelayMs: 1_000,
  retryMaxDelayMs: 60_000,
  terminalRetentionMs:
    7 * 24 * 60 * 60 * 1_000,
  now: () => new Date(),
  createId: () =>
    `delivery-${randomUUID()}`,
};

const ID_PATTERN =
  /^[A-Za-z0-9._:-]{1,300}$/;

const CHANNEL_PATTERN =
  /^[a-z0-9][a-z0-9_-]{0,63}$/;

const ADAPTER_PATTERN =
  /^[A-Za-z0-9._:-]{1,100}$/;

const ERROR_CODE_PATTERN =
  /^[a-z0-9][a-z0-9._:-]{0,99}$/;

export class AlertDeliveryError
extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
    message = code,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AlertDeliveryError';
  }
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

export function cloneAlertDeliveryOutboxItem(
  item: AlertDeliveryOutboxItem,
): AlertDeliveryOutboxItem {
  return {
    ...item,
    trigger:
      cloneTrigger(item.trigger),
  };
}

function positiveInteger(
  value: number,
  label: string,
): number {
  if (
    !Number.isSafeInteger(value)
    || value <= 0
  ) {
    throw new Error(
      `Alerts delivery ${label} must be a positive integer`,
    );
  }

  return value;
}

function nonNegativeInteger(
  value: number,
  label: string,
): number {
  if (
    !Number.isSafeInteger(value)
    || value < 0
  ) {
    throw new Error(
      `Alerts delivery ${label} must be a non-negative integer`,
    );
  }

  return value;
}

function normalizeChannel(
  value: string,
): string {
  const channel =
    typeof value === 'string'
      ? value.trim().toLowerCase()
      : '';

  if (!CHANNEL_PATTERN.test(channel)) {
    throw new Error(
      'Alerts delivery channel is invalid',
    );
  }

  return channel;
}

function normalizeAdapterName(
  value: string,
): string {
  const adapter =
    typeof value === 'string'
      ? value.trim()
      : '';

  if (!ADAPTER_PATTERN.test(adapter)) {
    throw new Error(
      'Alerts delivery adapter name is invalid',
    );
  }

  return adapter;
}

function normalizeId(
  value: string,
  label: string,
): string {
  const id =
    typeof value === 'string'
      ? value.trim()
      : '';

  if (!ID_PATTERN.test(id)) {
    throw new Error(
      `Alerts delivery ${label} id is invalid`,
    );
  }

  return id;
}

function safeErrorCode(
  value: string,
): string {
  const code =
    value.trim().toLowerCase();

  return ERROR_CODE_PATTERN.test(code)
    ? code
    : 'delivery_adapter_error';
}

function classifyError(
  error: unknown,
): {
  code: string;
  retryable: boolean;
} {
  if (error instanceof AlertDeliveryError) {
    return {
      code:
        safeErrorCode(error.code),
      retryable:
        error.retryable,
    };
  }

  return {
    code: 'delivery_adapter_error',
    retryable: true,
  };
}

function idempotencyKey(
  triggerId: string,
  channel: string,
): string {
  return `nexus.alerts:${channel}:${triggerId}`;
}

function itemIdentity(
  triggerId: string,
  channel: string,
): string {
  return `${channel}:${triggerId}`;
}

function isTerminal(
  item: AlertDeliveryOutboxItem,
): boolean {
  return item.state === 'delivered'
    || (
      item.state === 'failed'
      && item.nextAttemptAt === null
    );
}

export class AlertsDeliveryService {
  private readonly adapters =
    new Map<string, AlertDeliveryAdapter>();

  private readonly items:
    AlertDeliveryOutboxItem[] = [];

  private readonly identityIndex =
    new Map<string, AlertDeliveryOutboxItem>();

  private readonly options:
    AlertsDeliveryOptions;

  private state:
    AlertsDeliveryRuntimeState;

  private timer:
    ReturnType<typeof setTimeout> | null = null;

  private processing:
    Promise<void> | null = null;

  private enqueuedCount = 0;
  private duplicateEnqueuesCount = 0;
  private rejectedEnqueuesCount = 0;
  private attemptsCount = 0;
  private successesCount = 0;
  private failuresCount = 0;
  private terminalFailuresCount = 0;
  private recoveredSendingCount = 0;
  private cleanedItemsCount = 0;
  private hydratedItemsCount = 0;
  private lastAttemptAt: string | null = null;
  private lastDeliveredAt: string | null = null;
  private lastErrorCode: string | null = null;
  private recoveryNeedsPersistence = false;

  constructor(
    adapters:
      readonly AlertDeliveryAdapter[] = [],
    options:
      Partial<AlertsDeliveryOptions> = {},
    private readonly onChanged:
      AlertsDeliveryChanged = () => undefined,
  ) {
    this.options = {
      ...DEFAULT_ALERTS_DELIVERY_OPTIONS,
      ...options,
    };

    positiveInteger(
      this.options.maxOutboxItems,
      'maxOutboxItems',
    );
    positiveInteger(
      this.options.maxAttempts,
      'maxAttempts',
    );
    positiveInteger(
      this.options.retryBaseDelayMs,
      'retryBaseDelayMs',
    );
    positiveInteger(
      this.options.retryMaxDelayMs,
      'retryMaxDelayMs',
    );
    nonNegativeInteger(
      this.options.terminalRetentionMs,
      'terminalRetentionMs',
    );

    if (
      this.options.retryMaxDelayMs
      < this.options.retryBaseDelayMs
    ) {
      throw new Error(
        'Alerts delivery retryMaxDelayMs cannot be below retryBaseDelayMs',
      );
    }

    for (const candidate of adapters) {
      const channel =
        normalizeChannel(candidate.channel);
      const adapter =
        normalizeAdapterName(candidate.adapter);

      if (this.adapters.has(channel)) {
        throw new Error(
          `Duplicate Alerts delivery channel: ${channel}`,
        );
      }

      this.adapters.set(
        channel,
        {
          channel,
          adapter,
          deliver:
            candidate.deliver.bind(candidate),
        },
      );
    }

    this.state =
      this.adapters.size > 0
        ? 'idle'
        : 'disabled';
  }

  start(): void {
    if (this.adapters.size === 0) {
      this.state = 'disabled';
      return;
    }

    if (this.state === 'running') {
      return;
    }

    this.state = 'running';

    if (this.recoveryNeedsPersistence) {
      this.recoveryNeedsPersistence = false;
      void this.persistChangedState();
    }

    this.scheduleNext();
  }

  async stop(): Promise<void> {
    this.clearTimer();

    if (this.adapters.size === 0) {
      this.state = 'disabled';
      return;
    }

    this.state = 'stopped';
    await this.processing;
  }

  hydrate(
    items:
      readonly AlertDeliveryOutboxItem[],
  ): void {
    if (
      this.state === 'running'
      || this.processing
    ) {
      throw new Error(
        'Alerts delivery cannot hydrate while running',
      );
    }

    this.items.splice(0);
    this.identityIndex.clear();

    const now = this.nowIso();

    for (const source of items) {
      const item =
        cloneAlertDeliveryOutboxItem(source);
      const identity =
        itemIdentity(
          item.triggerId,
          item.channel,
        );

      if (this.identityIndex.has(identity)) {
        throw new Error(
          `Duplicate Alerts delivery identity: ${identity}`,
        );
      }

      if (item.state === 'sending') {
        item.state = 'failed';
        item.updatedAt = now;
        item.lastErrorCode =
          'delivery_interrupted';
        item.nextAttemptAt =
          item.attempts < item.maxAttempts
            ? now
            : null;
        this.recoveredSendingCount += 1;
        this.recoveryNeedsPersistence = true;
      }

      this.items.push(item);
      this.identityIndex.set(
        identity,
        item,
      );
    }

    this.items.sort(
      (left, right) =>
        left.createdAt.localeCompare(
          right.createdAt,
        )
        || left.id.localeCompare(right.id),
    );

    this.hydratedItemsCount =
      this.items.length;

    if (this.cleanupTerminalItems()) {
      this.recoveryNeedsPersistence = true;
    }
  }

  enqueue(
    trigger: AlertTrigger,
  ): AlertDeliveryOutboxItem[] {
    if (this.adapters.size === 0) {
      return [];
    }

    const created:
      AlertDeliveryOutboxItem[] = [];

    this.cleanupTerminalItems();

    for (const channel of this.adapters.keys()) {
      const identity =
        itemIdentity(
          trigger.id,
          channel,
        );
      const existing =
        this.identityIndex.get(identity);

      if (existing) {
        this.duplicateEnqueuesCount += 1;
        continue;
      }

      this.trimTerminalForCapacity();

      if (
        this.items.length
        >= this.options.maxOutboxItems
      ) {
        this.rejectedEnqueuesCount += 1;
        this.lastErrorCode =
          'delivery_outbox_full';
        continue;
      }

      const timestamp =
        this.nowIso();
      const triggerId =
        normalizeId(
          trigger.id,
          'trigger',
        );
      const item:
        AlertDeliveryOutboxItem = {
          id:
            normalizeId(
              this.options.createId(),
              'outbox',
            ),
          triggerId,
          channel,
          idempotencyKey:
            idempotencyKey(
              triggerId,
              channel,
            ),
          trigger:
            cloneTrigger(trigger),
          state: 'pending',
          attempts: 0,
          maxAttempts:
            this.options.maxAttempts,
          createdAt: timestamp,
          updatedAt: timestamp,
          nextAttemptAt: timestamp,
          lastAttemptAt: null,
          deliveredAt: null,
          lastErrorCode: null,
        };

      this.items.push(item);
      this.identityIndex.set(
        identity,
        item,
      );
      this.enqueuedCount += 1;
      created.push(
        cloneAlertDeliveryOutboxItem(item),
      );
    }

    if (created.length > 0) {
      void this.persistChangedState();
      this.scheduleNext();
    }

    return created;
  }

  reportEnqueueFailure(): void {
    this.rejectedEnqueuesCount += 1;
    this.lastErrorCode =
      'delivery_enqueue_failed';
    void this.persistChangedState();
  }

  exportOutbox():
  AlertDeliveryOutboxItem[] {
    return this.items.map(
      cloneAlertDeliveryOutboxItem,
    );
  }

  getStatus(): AlertsDeliveryStatus {
    const pending =
      this.items.filter(
        (item) => item.state === 'pending',
      );
    const sending =
      this.items.filter(
        (item) => item.state === 'sending',
      );
    const delivered =
      this.items.filter(
        (item) => item.state === 'delivered',
      );
    const failed =
      this.items.filter(
        (item) => item.state === 'failed',
      );

    return {
      state: this.state,
      channels: [
        ...this.adapters.keys(),
      ],
      adapters:
        [...this.adapters.values()]
          .map(
            (adapter) => adapter.adapter,
          ),
      outboxCount:
        this.items.length,
      pendingCount:
        pending.length,
      sendingCount:
        sending.length,
      deliveredCount:
        delivered.length,
      failedCount:
        failed.length,
      retryScheduledCount:
        failed.filter(
          (item) => item.nextAttemptAt !== null,
        ).length,
      unavailableChannelCount:
        this.items.filter(
          (item) =>
            !isTerminal(item)
            && !this.adapters.has(item.channel),
        ).length,
      maxOutboxItems:
        this.options.maxOutboxItems,
      maxAttempts:
        this.options.maxAttempts,
      enqueuedCount:
        this.enqueuedCount,
      duplicateEnqueuesCount:
        this.duplicateEnqueuesCount,
      rejectedEnqueuesCount:
        this.rejectedEnqueuesCount,
      attemptsCount:
        this.attemptsCount,
      successesCount:
        this.successesCount,
      failuresCount:
        this.failuresCount,
      terminalFailuresCount:
        this.terminalFailuresCount,
      recoveredSendingCount:
        this.recoveredSendingCount,
      cleanedItemsCount:
        this.cleanedItemsCount,
      hydratedItemsCount:
        this.hydratedItemsCount,
      lastAttemptAt:
        this.lastAttemptAt,
      lastDeliveredAt:
        this.lastDeliveredAt,
      lastErrorCode:
        this.lastErrorCode,
    };
  }

  async flushDue(): Promise<void> {
    if (
      this.state !== 'running'
      || this.adapters.size === 0
    ) {
      return;
    }

    if (this.processing) {
      return this.processing;
    }

    this.clearTimer();

    const run =
      this.processDueItems();

    this.processing =
      run.finally(
        () => {
          this.processing = null;
          this.scheduleNext();
        },
      );

    return this.processing;
  }

  private async processDueItems():
  Promise<void> {
    while (this.state === 'running') {
      const item =
        this.findNextDueItem();

      if (!item) {
        return;
      }

      await this.deliverItem(item);
    }
  }

  private findNextDueItem():
  AlertDeliveryOutboxItem | null {
    const nowMs =
      this.nowMs();

    return this.items.find(
      (item) => {
        if (
          !this.adapters.has(item.channel)
          || !(
            item.state === 'pending'
            || (
              item.state === 'failed'
              && item.nextAttemptAt !== null
            )
          )
        ) {
          return false;
        }

        return item.nextAttemptAt !== null
          && Date.parse(item.nextAttemptAt)
            <= nowMs;
      },
    ) ?? null;
  }

  private async deliverItem(
    item: AlertDeliveryOutboxItem,
  ): Promise<void> {
    const adapter =
      this.adapters.get(item.channel);

    if (!adapter) {
      return;
    }

    const attemptAt =
      this.nowIso();

    item.state = 'sending';
    item.attempts += 1;
    item.updatedAt = attemptAt;
    item.lastAttemptAt = attemptAt;
    item.nextAttemptAt = null;
    item.lastErrorCode = null;
    this.attemptsCount += 1;
    this.lastAttemptAt = attemptAt;

    await this.persistChangedState();

    try {
      await adapter.deliver({
        trigger:
          cloneTrigger(item.trigger),
        channel: item.channel,
        idempotencyKey:
          item.idempotencyKey,
        attempt:
          item.attempts,
      });

      const deliveredAt =
        this.nowIso();

      item.state = 'delivered';
      item.updatedAt = deliveredAt;
      item.deliveredAt = deliveredAt;
      item.nextAttemptAt = null;
      item.lastErrorCode = null;
      this.successesCount += 1;
      this.lastDeliveredAt = deliveredAt;
      this.lastErrorCode = null;
    } catch (error) {
      const failure =
        classifyError(error);
      const failedAt =
        this.nowIso();
      const retryable =
        failure.retryable
        && item.attempts
          < item.maxAttempts;

      item.state = 'failed';
      item.updatedAt = failedAt;
      item.deliveredAt = null;
      item.lastErrorCode =
        failure.code;
      item.nextAttemptAt =
        retryable
          ? new Date(
              Date.parse(failedAt)
              + this.retryDelayMs(
                  item.attempts,
                ),
            ).toISOString()
          : null;
      this.failuresCount += 1;
      this.lastErrorCode =
        failure.code;

      if (!retryable) {
        this.terminalFailuresCount += 1;
      }
    }

    this.cleanupTerminalItems();
    await this.persistChangedState();
  }

  private retryDelayMs(
    attempts: number,
  ): number {
    const multiplier =
      2 ** Math.max(0, attempts - 1);

    return Math.min(
      this.options.retryMaxDelayMs,
      this.options.retryBaseDelayMs
        * multiplier,
    );
  }

  private scheduleNext(): void {
    if (
      this.state !== 'running'
      || this.timer
      || this.processing
    ) {
      return;
    }

    const nextAttemptMs =
      this.items.reduce<
        number | null
      >(
        (earliest, item) => {
          if (
            !this.adapters.has(item.channel)
            || item.nextAttemptAt === null
            || !(
              item.state === 'pending'
              || item.state === 'failed'
            )
          ) {
            return earliest;
          }

          const timestamp =
            Date.parse(item.nextAttemptAt);

          return earliest === null
            || timestamp < earliest
              ? timestamp
              : earliest;
        },
        null,
      );

    if (nextAttemptMs === null) {
      return;
    }

    const delay =
      Math.max(
        0,
        nextAttemptMs - this.nowMs(),
      );

    this.timer = setTimeout(
      () => {
        this.timer = null;
        void this.flushDue();
      },
      delay,
    );

    this.timer.unref?.();
  }

  private clearTimer(): void {
    if (!this.timer) {
      return;
    }

    clearTimeout(this.timer);
    this.timer = null;
  }

  private cleanupTerminalItems(): boolean {
    const cutoff =
      this.nowMs()
      - this.options.terminalRetentionMs;
    let changed = false;

    for (
      let index = this.items.length - 1;
      index >= 0;
      index -= 1
    ) {
      const item = this.items[index];

      if (
        item
        && isTerminal(item)
        && Date.parse(item.updatedAt) < cutoff
      ) {
        this.removeAt(index);
        changed = true;
      }
    }

    return changed;
  }

  private trimTerminalForCapacity(): void {
    while (
      this.items.length
      >= this.options.maxOutboxItems
    ) {
      const index =
        this.items.findIndex(isTerminal);

      if (index < 0) {
        return;
      }

      this.removeAt(index);
    }
  }

  private removeAt(
    index: number,
  ): void {
    const [removed] =
      this.items.splice(index, 1);

    if (!removed) {
      return;
    }

    this.identityIndex.delete(
      itemIdentity(
        removed.triggerId,
        removed.channel,
      ),
    );
    this.cleanedItemsCount += 1;
  }

  private async persistChangedState():
  Promise<void> {
    try {
      await this.onChanged();
    } catch {
      // Alerts persistence owns and reports storage failures.
    }
  }

  private nowMs(): number {
    const now =
      this.options.now();
    const timestamp =
      now.getTime();

    if (!Number.isFinite(timestamp)) {
      throw new Error(
        'Alerts delivery clock returned an invalid date',
      );
    }

    return timestamp;
  }

  private nowIso(): string {
    return new Date(
      this.nowMs(),
    ).toISOString();
  }
}
