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
import type {
  LevelEngineTimeframe,
} from '../level-engine/level-engine.types.js';
import type {
  UnifiedDecisionState,
} from './unified-decision.types.js';
import {
  UNIFIED_DECISION_LIVE_OBSERVATION_DATASET_VERSION,
  UNIFIED_DECISION_LIVE_OBSERVATION_PERSISTENCE_SCHEMA,
  UNIFIED_DECISION_LIVE_OBSERVATION_PERSISTENCE_VERSION,
  type UnifiedDecisionLiveObservation,
  type UnifiedDecisionLiveObservationDataset,
  type UnifiedDecisionLiveObservationFilter,
  type UnifiedDecisionLiveObservationInput,
  type UnifiedDecisionLiveObservationPersistence,
  type UnifiedDecisionLiveObservationPersistenceSnapshot,
  type UnifiedDecisionLiveObservationRecorder,
  type UnifiedDecisionLiveObservationStatus,
  type UnifiedDecisionLiveSourceErrorCode,
} from './unified-decision-live-observation.types.js';

const LEVEL_ENGINE_TIMEFRAMES:
readonly LevelEngineTimeframe[] = [
  '1m',
  '5m',
  '15m',
  '1h',
  '4h',
];

const UNIFIED_DECISION_STATES:
readonly UnifiedDecisionState[] = [
  'observe',
  'possible_long',
  'possible_short',
  'wait_confirmation',
  'setup_confirmed',
  'skip',
];

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const MAX_PERSISTED_OBSERVATIONS =
  100_000;

export type UnifiedDecisionLiveObservationPersistenceErrorCode =
  | 'live_observation_persistence_corrupt'
  | 'live_observation_persistence_unsupported_version'
  | 'live_observation_persistence_read_failed'
  | 'live_observation_persistence_write_failed';

export class UnifiedDecisionLiveObservationPersistenceError
extends Error {
  constructor(
    public readonly code:
      UnifiedDecisionLiveObservationPersistenceErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name =
      'UnifiedDecisionLiveObservationPersistenceError';
  }
}

export interface JsonFileUnifiedDecisionLiveObservationPersistenceOptions {
  readonly filePath: string;
}

export class JsonFileUnifiedDecisionLiveObservationPersistence
implements UnifiedDecisionLiveObservationPersistence {
  readonly adapter = 'json_file_v1';
  private readonly filePath: string;

  constructor(
    options:
      JsonFileUnifiedDecisionLiveObservationPersistenceOptions,
  ) {
    this.filePath =
      resolve(options.filePath);
  }

  async load(): Promise<unknown | null> {
    let contents: string;

    try {
      contents = await readFile(
        this.filePath,
        'utf8',
      );
    } catch (error: unknown) {
      if (
        isNodeError(error)
        && error.code === 'ENOENT'
      ) {
        return null;
      }

      throw new UnifiedDecisionLiveObservationPersistenceError(
        'live_observation_persistence_read_failed',
        'Unable to read Unified Decision live observation storage',
        { cause: error },
      );
    }

    try {
      return JSON.parse(contents) as unknown;
    } catch (error: unknown) {
      throw new UnifiedDecisionLiveObservationPersistenceError(
        'live_observation_persistence_corrupt',
        'Unified Decision live observation storage contains invalid JSON',
        { cause: error },
      );
    }
  }

  async save(
    snapshot:
      UnifiedDecisionLiveObservationPersistenceSnapshot,
  ): Promise<void> {
    const parentDirectory =
      dirname(this.filePath);
    const temporaryPath =
      `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;

    try {
      await mkdir(
        parentDirectory,
        { recursive: true },
      );
      await writeFile(
        temporaryPath,
        `${JSON.stringify(snapshot, null, 2)}\n`,
        {
          encoding: 'utf8',
          mode: 0o600,
        },
      );
      await rename(
        temporaryPath,
        this.filePath,
      );
    } catch (error: unknown) {
      try {
        await unlink(temporaryPath);
      } catch {
        // The temporary file may not have been created.
      }

      throw new UnifiedDecisionLiveObservationPersistenceError(
        'live_observation_persistence_write_failed',
        'Unable to write Unified Decision live observation storage',
        { cause: error },
      );
    }
  }
}

export interface UnifiedDecisionLiveObservationServiceOptions {
  readonly persistence?:
    UnifiedDecisionLiveObservationPersistence
    | null;
  readonly capacity?: number;
  readonly maxTradesPerObservation?: number;
  readonly maxSetupsPerObservation?: number;
  readonly now?: () => Date;
}

function isNodeError(
  value: unknown,
): value is NodeJS.ErrnoException {
  return value instanceof Error;
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

function normalizeTimestamp(
  value: unknown,
  label: string,
): string {
  if (typeof value !== 'string') {
    throw corrupt(label);
  }

  const timestampMs =
    Date.parse(value);

  if (!Number.isFinite(timestampMs)) {
    throw corrupt(label);
  }

  return new Date(timestampMs)
    .toISOString();
}

function corrupt(
  label: string,
): UnifiedDecisionLiveObservationPersistenceError {
  return new UnifiedDecisionLiveObservationPersistenceError(
    'live_observation_persistence_corrupt',
    `Invalid persisted Unified Decision live observation ${label}`,
  );
}

function clone<T>(
  value: T,
): T {
  return structuredClone(value);
}

function normalizePersistedObservation(
  value: unknown,
): UnifiedDecisionLiveObservation {
  if (!isRecord(value)) {
    throw corrupt('entry');
  }

  if (
    typeof value.id !== 'string'
    || value.id.length < 1
    || value.id.length > 200
    || !Number.isSafeInteger(value.sequence)
    || (value.sequence as number) < 1
    || typeof value.symbol !== 'string'
    || !SYMBOL_PATTERN.test(value.symbol)
    || !LEVEL_ENGINE_TIMEFRAMES.includes(
      value.timeframe as LevelEngineTimeframe,
    )
    || !isRecord(value.decision)
    || value.decision.symbol !== value.symbol
    || value.decision.timeframe !== value.timeframe
    || !UNIFIED_DECISION_STATES.includes(
      value.decision.state as UnifiedDecisionState,
    )
    || !isRecord(value.realtime)
    || !isRecord(value.setups)
    || !isRecord(value.marketContext)
    || value.diagnosticOnly !== true
    || value.createsTradeOrder !== false
    || value.createsSetup !== false
    || value.createsSignal !== false
    || value.changesDecisionRules !== false
  ) {
    throw corrupt('entry');
  }

  normalizeTimestamp(
    value.recordedAt,
    'recordedAt',
  );

  return clone(
    value as unknown as
      UnifiedDecisionLiveObservation,
  );
}

function normalizePersistenceSnapshot(
  value: unknown,
  capacity: number,
): {
  readonly nextSequence: number;
  readonly observations:
    UnifiedDecisionLiveObservation[];
} {
  if (!isRecord(value)) {
    throw corrupt('snapshot');
  }

  if (
    value.schema
      !== UNIFIED_DECISION_LIVE_OBSERVATION_PERSISTENCE_SCHEMA
  ) {
    throw corrupt('schema');
  }

  if (
    value.version
      !== UNIFIED_DECISION_LIVE_OBSERVATION_PERSISTENCE_VERSION
    || value.datasetVersion
      !== UNIFIED_DECISION_LIVE_OBSERVATION_DATASET_VERSION
  ) {
    throw new UnifiedDecisionLiveObservationPersistenceError(
      'live_observation_persistence_unsupported_version',
      'Unsupported Unified Decision live observation storage version',
    );
  }

  normalizeTimestamp(
    value.savedAt,
    'savedAt',
  );

  if (
    !Number.isSafeInteger(value.nextSequence)
    || (value.nextSequence as number) < 1
    || !Array.isArray(value.observations)
    || value.observations.length
      > MAX_PERSISTED_OBSERVATIONS
  ) {
    throw corrupt('snapshot');
  }

  const observations =
    value.observations.map(
      normalizePersistedObservation,
    );
  const retained =
    observations.slice(-capacity);
  const maximumSequence =
    retained.reduce(
      (maximum, observation) =>
        Math.max(
          maximum,
          observation.sequence,
        ),
      0,
    );

  return {
    nextSequence:
      Math.max(
        value.nextSequence as number,
        maximumSequence + 1,
      ),
    observations: retained,
  };
}

function readPersistenceErrorCode(
  error: unknown,
): string {
  return error
    instanceof UnifiedDecisionLiveObservationPersistenceError
      ? error.code
      : 'live_observation_persistence_failed';
}

function sanitizeSourceErrors(
  sourceErrors: readonly string[],
): UnifiedDecisionLiveSourceErrorCode[] {
  const codes = new Set<
    UnifiedDecisionLiveSourceErrorCode
  >();

  for (const error of sourceErrors) {
    if (error.startsWith('tape:')) {
      codes.add('tape_read_failed');
    } else if (error.startsWith('order_book:')) {
      codes.add('order_book_read_failed');
    } else {
      codes.add('source_read_failed');
    }
  }

  return [...codes];
}

function latestTimestamp(
  values: readonly string[],
): string | null {
  let latestMs =
    Number.NEGATIVE_INFINITY;

  for (const value of values) {
    const timestampMs =
      Date.parse(value);

    if (
      Number.isFinite(timestampMs)
      && timestampMs > latestMs
    ) {
      latestMs = timestampMs;
    }
  }

  return Number.isFinite(latestMs)
    ? new Date(latestMs).toISOString()
    : null;
}

function requirePositiveInteger(
  value: number,
  label: string,
  maximum: number,
): number {
  if (
    !Number.isInteger(value)
    || value < 1
    || value > maximum
  ) {
    throw new Error(
      `${label} must be an integer from 1 to ${maximum}`,
    );
  }

  return value;
}

export class UnifiedDecisionLiveObservationService
implements UnifiedDecisionLiveObservationRecorder {
  private readonly persistence:
    UnifiedDecisionLiveObservationPersistence
    | null;
  private readonly capacity: number;
  private readonly maxTradesPerObservation: number;
  private readonly maxSetupsPerObservation: number;
  private readonly now: () => Date;
  private observations:
    UnifiedDecisionLiveObservation[] = [];
  private nextSequence = 1;
  private state:
    UnifiedDecisionLiveObservationStatus['state'] =
      'idle';
  private persistenceWritable = true;
  private lastPersistenceErrorCode:
    string | null = null;
  private saveQueue: Promise<void> =
    Promise.resolve();

  constructor(
    options:
      UnifiedDecisionLiveObservationServiceOptions = {},
  ) {
    this.persistence =
      options.persistence
      ?? null;
    this.capacity =
      requirePositiveInteger(
        options.capacity ?? 5_000,
        'capacity',
        MAX_PERSISTED_OBSERVATIONS,
      );
    this.maxTradesPerObservation =
      requirePositiveInteger(
        options.maxTradesPerObservation ?? 100,
        'maxTradesPerObservation',
        5_000,
      );
    this.maxSetupsPerObservation =
      requirePositiveInteger(
        options.maxSetupsPerObservation ?? 100,
        'maxSetupsPerObservation',
        5_000,
      );
    this.now =
      options.now
      ?? (() => new Date());
  }

  async start(): Promise<void> {
    if (
      this.state === 'ready'
      || this.state === 'degraded'
    ) {
      return;
    }

    if (!this.persistence) {
      this.state = 'ready';
      return;
    }

    try {
      const raw =
        await this.persistence.load();

      if (raw !== null) {
        const normalized =
          normalizePersistenceSnapshot(
            raw,
            this.capacity,
          );
        this.observations =
          normalized.observations;
        this.nextSequence =
          normalized.nextSequence;
      }

      this.state = 'ready';
    } catch (error: unknown) {
      this.persistenceWritable = false;
      this.lastPersistenceErrorCode =
        readPersistenceErrorCode(error);
      this.state = 'degraded';
    }
  }

  async stop(): Promise<void> {
    await this.flush();
    this.state = 'stopped';
  }

  record(
    input: UnifiedDecisionLiveObservationInput,
  ): UnifiedDecisionLiveObservation {
    if (this.state === 'stopped') {
      throw new Error(
        'Unified Decision live observation recorder is stopped',
      );
    }

    if (
      input.symbol !== input.decision.symbol
      || input.timeframe !== input.decision.timeframe
      || input.symbol !== input.realtime.evaluatedEvidence.symbol
    ) {
      throw new Error(
        'Unified Decision live observation sources do not match',
      );
    }

    const allTrades =
      input.realtime.tape?.trades
      ?? [];
    const trades =
      allTrades.slice(
        -this.maxTradesPerObservation,
      );
    const allSetups =
      input.setups.candidates;
    const setups =
      allSetups.slice(
        0,
        this.maxSetupsPerObservation,
      );
    const recordedAt =
      this.now().toISOString();
    const sequence =
      this.nextSequence;
    this.nextSequence += 1;

    const observation:
    UnifiedDecisionLiveObservation = {
      id: `udlo:${sequence}:${randomUUID()}`,
      sequence,
      recordedAt,
      symbol:
        input.symbol,
      timeframe:
        input.timeframe,
      decision:
        clone(input.decision),
      realtime: {
        capturedAt:
          input.realtime.capturedAt,
        tape:
          input.realtime.tape
            ? {
                snapshotUpdatedAt:
                  input.realtime.tape
                    .snapshotUpdatedAt,
                trades:
                  clone(trades),
                originalTradesCount:
                  allTrades.length,
                truncated:
                  allTrades.length
                  > trades.length,
              }
            : null,
        orderBook:
          input.realtime.orderBook
            ? clone(
                input.realtime.orderBook,
              )
            : null,
        sourceErrors:
          sanitizeSourceErrors(
            input.realtime.sourceErrors,
          ),
        evaluatedEvidence: {
          ...clone(
            input.realtime.evaluatedEvidence,
          ),
          sourceErrors:
            sanitizeSourceErrors(
              input.realtime
                .evaluatedEvidence
                .sourceErrors,
            ),
        },
        evaluations:
          clone(
            input.realtime.evaluations,
          ),
      },
      setups: {
        readState:
          input.setups.readState,
        observedAt:
          latestTimestamp(
            allSetups.map(
              (setup) => setup.updatedAt,
            ),
          ),
        candidates:
          clone(setups),
        originalCandidatesCount:
          allSetups.length,
        truncated:
          allSetups.length
          > setups.length,
      },
      marketContext:
        clone(input.marketContext),
      diagnosticOnly: true,
      createsTradeOrder: false,
      createsSetup: false,
      createsSignal: false,
      changesDecisionRules: false,
    };

    this.observations.push(
      observation,
    );

    if (
      this.observations.length
      > this.capacity
    ) {
      this.observations.splice(
        0,
        this.observations.length
        - this.capacity,
      );
    }

    this.enqueueSave();

    return clone(observation);
  }

  async flush(): Promise<void> {
    await this.saveQueue;
  }

  getStatus(): UnifiedDecisionLiveObservationStatus {
    return {
      version:
        UNIFIED_DECISION_LIVE_OBSERVATION_DATASET_VERSION,
      state: this.state,
      persistenceMode:
        this.persistence
          ? 'persistent'
          : 'runtime_only',
      persistenceAdapter:
        this.persistence?.adapter
        ?? null,
      capacity:
        this.capacity,
      observationCount:
        this.observations.length,
      firstRecordedAt:
        this.observations[0]
          ?.recordedAt
        ?? null,
      lastRecordedAt:
        this.observations.at(-1)
          ?.recordedAt
        ?? null,
      nextSequence:
        this.nextSequence,
      lastPersistenceErrorCode:
        this.lastPersistenceErrorCode,
      diagnosticOnly: true,
      createsTradeOrder: false,
      changesDecisionRules: false,
    };
  }

  getObservations(
    filter:
      UnifiedDecisionLiveObservationFilter = {},
  ): readonly UnifiedDecisionLiveObservation[] {
    const limit =
      Math.min(
        filter.limit
        ?? this.capacity,
        this.capacity,
      );
    const matched:
      UnifiedDecisionLiveObservation[] = [];

    for (
      let index =
        this.observations.length - 1;
      index >= 0
      && matched.length < limit;
      index -= 1
    ) {
      const observation =
        this.observations[index];

      if (!observation) {
        continue;
      }

      if (
        filter.symbol
        && observation.symbol
          !== filter.symbol
      ) {
        continue;
      }

      if (
        filter.timeframe
        && observation.timeframe
          !== filter.timeframe
      ) {
        continue;
      }

      if (
        filter.state
        && observation.decision.state
          !== filter.state
      ) {
        continue;
      }

      if (
        filter.direction
        && (
          observation.decision.direction
          ?? 'none'
        ) !== filter.direction
      ) {
        continue;
      }

      matched.push(
        clone(observation),
      );
    }

    return matched;
  }

  exportDataset(
    filter:
      UnifiedDecisionLiveObservationFilter = {},
  ): UnifiedDecisionLiveObservationDataset {
    return {
      version:
        UNIFIED_DECISION_LIVE_OBSERVATION_DATASET_VERSION,
      exportedAt:
        this.now().toISOString(),
      status:
        this.getStatus(),
      observations:
        this.getObservations(filter),
    };
  }

  private enqueueSave(): void {
    if (
      !this.persistence
      || !this.persistenceWritable
    ) {
      return;
    }

    this.saveQueue =
      this.saveQueue
        .then(async () => {
          if (
            !this.persistence
            || !this.persistenceWritable
          ) {
            return;
          }

          const snapshot:
          UnifiedDecisionLiveObservationPersistenceSnapshot = {
            schema:
              UNIFIED_DECISION_LIVE_OBSERVATION_PERSISTENCE_SCHEMA,
            version:
              UNIFIED_DECISION_LIVE_OBSERVATION_PERSISTENCE_VERSION,
            datasetVersion:
              UNIFIED_DECISION_LIVE_OBSERVATION_DATASET_VERSION,
            savedAt:
              this.now().toISOString(),
            nextSequence:
              this.nextSequence,
            observations:
              clone(this.observations),
          };

          await this.persistence.save(
            snapshot,
          );
        })
        .catch((error: unknown) => {
          this.persistenceWritable = false;
          this.lastPersistenceErrorCode =
            readPersistenceErrorCode(error);
          this.state = 'degraded';
        });
  }
}
