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
  LevelLineStatus,
} from '../level-engine/level-lines.types.js';
import type {
  RealtimeConfirmationStatus,
} from '../level-engine/realtime-confirmation-engine.types.js';
import {
  CAUSAL_SETUP_ADAPTER_CONTRACT_VERSION,
  SETUP_CANDIDATE_EPISODE_CONTRACT_VERSION,
  type SetupCandidateEpisodeIdentity,
  type SetupCausalContext,
  type SetupCausalReason,
  type SetupCausalStage,
} from './causal-setup-adapter.types.js';
import type {
  SetupDirection,
  SetupEngineLevelKind,
  SetupEngineOutcome,
  SetupEngineSetupType,
  SetupEngineStage,
  SetupEngineState,
  SetupLevelZone,
} from './setup-engine.types.js';
import type {
  SetupEventHistoryPersistenceErrorCode,
} from './setup-event-history.types.js';
import type {
  SetupLifecycleEvent,
  SetupLifecycleEventType,
} from './setup-lifecycle-events.types.js';

export const SETUP_EVENT_HISTORY_PERSISTENCE_SCHEMA =
  'nexus.setup-event-history';

export const SETUP_EVENT_HISTORY_PERSISTENCE_VERSION =
  1 as const;

export interface SetupEventHistoryPersistenceSnapshotV1 {
  schema:
    typeof SETUP_EVENT_HISTORY_PERSISTENCE_SCHEMA;
  version:
    typeof SETUP_EVENT_HISTORY_PERSISTENCE_VERSION;
  savedAt: string;
  droppedEventsCount: number;
  events: SetupLifecycleEvent[];
}

export type SetupEventHistoryPersistenceSnapshot =
  SetupEventHistoryPersistenceSnapshotV1;

export interface SetupEventHistoryPersistenceContract {
  readonly adapter: string;

  load(): Promise<unknown | null>;

  save(
    snapshot:
      SetupEventHistoryPersistenceSnapshot,
  ): Promise<void>;
}

export interface JsonFileSetupEventHistoryPersistenceOptions {
  filePath: string;
}

export class SetupEventHistoryPersistenceError
extends Error {
  constructor(
    public readonly code:
      SetupEventHistoryPersistenceErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(
      message,
      options,
    );

    this.name =
      'SetupEventHistoryPersistenceError';
  }
}

const MAX_EVENTS_IN_SNAPSHOT =
  200_000;

const MAX_TEXT_LENGTH =
  4_000;

const MAX_REALTIME_REASONS =
  200;

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const TIMEFRAME_PATTERN =
  /^[1-9][0-9]*(?:m|h|d)$/;

const SETUP_TYPES:
readonly SetupEngineSetupType[] = [
  'level_breakout',
  'level_bounce',
];

const DIRECTIONS:
readonly SetupDirection[] = [
  'long',
  'short',
];

const LEVEL_KINDS:
readonly SetupEngineLevelKind[] = [
  'support',
  'resistance',
];

const STAGES:
readonly SetupEngineStage[] = [
  'LEVEL_CONFIRMED',
  'APPROACHING_THIRD_TOUCH',
  'THIRD_TOUCH_CONFIRMED',
  'BREAKOUT_CONFIRMED',
  'REJECTION_CONFIRMED',
  'SETUP_EXPIRED',
];

const EVENT_TYPES:
readonly SetupLifecycleEventType[] = [
  'candidate_created',
  'stage_transition',
  'breakout_confirmed',
  'rejection_confirmed',
  'setup_expired',
];

const LINE_STATUSES:
readonly LevelLineStatus[] = [
  'candidate',
  'confirmed',
  'worked',
  'superseded',
  'broken',
];

const CAUSAL_STAGES:
readonly SetupCausalStage[] = [
  'LEVEL_CONFIRMED',
  'OBSERVATION',
  'APPROACH',
  'CONFIRMATION',
];

const CAUSAL_REASONS:
readonly SetupCausalReason[] = [
  'level_line_confirmed',
  'observation_progress_threshold_met',
  'approach_distance_threshold_met',
  'realtime_confirmation_confirmed',
];

const REALTIME_CONFIRMATION_STATUSES:
readonly RealtimeConfirmationStatus[] = [
  'not_applicable',
  'collecting',
  'not_ready',
  'partial',
  'confirmed',
];

function corrupt(
  message: string,
): never {
  throw new SetupEventHistoryPersistenceError(
    'setup_event_history_persistence_corrupt',
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
      `Invalid Setup Event History ${label}`,
    );
  }

  return value;
}

function normalizeText(
  value: unknown,
  label: string,
  maximumLength:
    number = MAX_TEXT_LENGTH,
): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > maximumLength
    || value.trim() !== value
  ) {
    corrupt(
      `Invalid Setup Event History ${label}`,
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
      `Invalid Setup Event History ${label} timestamp`,
    );
  }

  const timestamp =
    Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    corrupt(
      `Invalid Setup Event History ${label} timestamp`,
    );
  }

  return new Date(timestamp)
    .toISOString();
}

function normalizePositiveInteger(
  value: unknown,
  label: string,
): number {
  if (
    !Number.isSafeInteger(value)
    || (value as number) <= 0
  ) {
    corrupt(
      `Invalid Setup Event History ${label}`,
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
      `Invalid Setup Event History ${label}`,
    );
  }

  return value as number;
}

function normalizeFiniteNumber(
  value: unknown,
  label: string,
): number {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
  ) {
    corrupt(
      `Invalid Setup Event History ${label}`,
    );
  }

  return value;
}

function normalizeNonNegativeNumber(
  value: unknown,
  label: string,
): number {
  const normalized =
    normalizeFiniteNumber(
      value,
      label,
    );

  if (normalized < 0) {
    corrupt(
      `Invalid Setup Event History ${label}`,
    );
  }

  return normalized;
}

function normalizeNullableFiniteNumber(
  value: unknown,
  label: string,
): number | null {
  return value === null
    ? null
    : normalizeFiniteNumber(
        value,
        label,
      );
}

function normalizeSetupType(
  value: unknown,
): SetupEngineSetupType {
  if (
    typeof value !== 'string'
    || !SETUP_TYPES.includes(
      value as SetupEngineSetupType,
    )
  ) {
    corrupt(
      'Invalid Setup Event History setup type',
    );
  }

  return value as SetupEngineSetupType;
}

function normalizeDirection(
  value: unknown,
): SetupDirection {
  if (
    typeof value !== 'string'
    || !DIRECTIONS.includes(
      value as SetupDirection,
    )
  ) {
    corrupt(
      'Invalid Setup Event History direction',
    );
  }

  return value as SetupDirection;
}

function normalizeStage(
  value: unknown,
  label: string,
): SetupEngineStage {
  if (
    typeof value !== 'string'
    || !STAGES.includes(
      value as SetupEngineStage,
    )
  ) {
    corrupt(
      `Invalid Setup Event History ${label}`,
    );
  }

  return value as SetupEngineStage;
}

function normalizeOutcome(
  value: unknown,
): SetupEngineOutcome {
  if (
    value !== null
    && value !== 'breakout'
    && value !== 'rejection'
  ) {
    corrupt(
      'Invalid Setup Event History outcome',
    );
  }

  return value as SetupEngineOutcome;
}

function normalizeEventType(
  value: unknown,
): SetupLifecycleEventType {
  if (
    typeof value !== 'string'
    || !EVENT_TYPES.includes(
      value as SetupLifecycleEventType,
    )
  ) {
    corrupt(
      'Invalid Setup Event History lifecycle event type',
    );
  }

  return value as SetupLifecycleEventType;
}

function normalizeSymbol(
  value: unknown,
): string {
  if (
    typeof value !== 'string'
    || !SYMBOL_PATTERN.test(value)
  ) {
    corrupt(
      'Invalid Setup Event History symbol',
    );
  }

  return value;
}

function normalizeTimeframe(
  value: unknown,
): string {
  if (
    typeof value !== 'string'
    || !TIMEFRAME_PATTERN.test(value)
  ) {
    corrupt(
      'Invalid Setup Event History timeframe',
    );
  }

  return value;
}

function normalizeLevel(
  value: unknown,
): SetupLevelZone {
  const record =
    requireRecord(
      value,
      'candidate level',
    );

  if (
    typeof record.kind !== 'string'
    || !LEVEL_KINDS.includes(
      record.kind as SetupEngineLevelKind,
    )
  ) {
    corrupt(
      'Invalid Setup Event History level kind',
    );
  }

  const centerPrice =
    normalizeFiniteNumber(
      record.centerPrice,
      'level centerPrice',
    );
  const zoneLow =
    normalizeFiniteNumber(
      record.zoneLow,
      'level zoneLow',
    );
  const zoneHigh =
    normalizeFiniteNumber(
      record.zoneHigh,
      'level zoneHigh',
    );

  if (
    centerPrice <= 0
    || zoneLow <= 0
    || zoneHigh <= 0
    || zoneLow > centerPrice
    || centerPrice > zoneHigh
  ) {
    corrupt(
      'Invalid Setup Event History level price geometry',
    );
  }

  return {
    kind:
      record.kind as SetupEngineLevelKind,
    centerPrice,
    zoneLow,
    zoneHigh,
    touches:
      normalizePositiveInteger(
        record.touches,
        'level touches',
      ),
    confirmedAt:
      normalizeTimestamp(
        record.confirmedAt,
        'level confirmedAt',
      ),
  };
}

function normalizeEpisode(
  value: unknown,
  candidateId: string,
  candidateSetupType:
    SetupEngineSetupType,
): SetupCandidateEpisodeIdentity {
  const record =
    requireRecord(
      value,
      'candidate episode',
    );

  if (
    record.version
    !== SETUP_CANDIDATE_EPISODE_CONTRACT_VERSION
  ) {
    corrupt(
      'Invalid Setup Event History episode version',
    );
  }

  const id =
    normalizeText(
      record.id,
      'episode id',
    );

  if (id !== candidateId) {
    corrupt(
      'Persisted Setup episode id must match candidate id',
    );
  }

  const setupType =
    normalizeSetupType(
      record.setupType,
    );

  if (
    setupType
    !== candidateSetupType
  ) {
    corrupt(
      'Persisted Setup episode type must match candidate type',
    );
  }

  if (
    record.boundary
      !== 'observation_threshold_reentry'
    || record.restartDeterministic
      !== true
    || record.usesFutureCandles
      !== false
  ) {
    corrupt(
      'Invalid Setup Event History episode safety contract',
    );
  }

  const startedAt =
    normalizeTimestamp(
      record.startedAt,
      'episode startedAt',
    );
  const departureExtremumObservedAt =
    normalizeTimestamp(
      record.departureExtremumObservedAt,
      'episode departureExtremumObservedAt',
    );

  if (
    departureExtremumObservedAt
    > startedAt
  ) {
    corrupt(
      'Persisted Setup episode departure cannot follow episode start',
    );
  }

  return {
    version:
      SETUP_CANDIDATE_EPISODE_CONTRACT_VERSION,
    id,
    lineId:
      normalizeText(
        record.lineId,
        'episode lineId',
      ),
    setupType,
    startedAt,
    departureExtremumObservedAt,
    boundary:
      'observation_threshold_reentry',
    restartDeterministic:
      true,
    usesFutureCandles:
      false,
  };
}

function normalizeCausalContext(
  value: unknown,
): SetupCausalContext {
  const record =
    requireRecord(
      value,
      'candidate causal context',
    );

  if (
    record.version
      !== CAUSAL_SETUP_ADAPTER_CONTRACT_VERSION
    || record.source
      !== 'level_lines'
  ) {
    corrupt(
      'Invalid Setup Event History causal contract',
    );
  }

  if (
    typeof record.lineStatus
      !== 'string'
    || !LINE_STATUSES.includes(
      record.lineStatus as LevelLineStatus,
    )
  ) {
    corrupt(
      'Invalid Setup Event History causal line status',
    );
  }

  if (
    typeof record.stage
      !== 'string'
    || !CAUSAL_STAGES.includes(
      record.stage as SetupCausalStage,
    )
  ) {
    corrupt(
      'Invalid Setup Event History causal stage',
    );
  }

  if (
    typeof record.reason
      !== 'string'
    || !CAUSAL_REASONS.includes(
      record.reason as SetupCausalReason,
    )
  ) {
    corrupt(
      'Invalid Setup Event History causal reason',
    );
  }

  if (
    typeof record.realtimeConfirmationStatus
      !== 'string'
    || !REALTIME_CONFIRMATION_STATUSES.includes(
      record.realtimeConfirmationStatus as
        RealtimeConfirmationStatus,
    )
  ) {
    corrupt(
      'Invalid Setup Event History realtime confirmation status',
    );
  }

  if (
    !Array.isArray(
      record.realtimeConfirmationReasons,
    )
    || record.realtimeConfirmationReasons.length
      > MAX_REALTIME_REASONS
  ) {
    corrupt(
      'Invalid Setup Event History realtime confirmation reasons',
    );
  }

  const realtimeConfirmationReasons =
    record.realtimeConfirmationReasons.map(
      (
        reason,
      ) =>
        normalizeText(
          reason,
          'realtime confirmation reason',
          1_000,
        ),
    );

  if (
    record.sourceObservationalOnly
      !== true
    || record.sourceCreatesSetup
      !== false
    || record.sourceCreatesSignal
      !== false
    || record.evaluatesBreakout
      !== false
    || record.evaluatesBounce
      !== false
    || record.usesFutureCandles
      !== false
    || record.usesFutureRealtimeEvidence
      !== false
  ) {
    corrupt(
      'Invalid Setup Event History causal safety flags',
    );
  }

  return {
    version:
      CAUSAL_SETUP_ADAPTER_CONTRACT_VERSION,
    source:
      'level_lines',
    lineId:
      normalizeText(
        record.lineId,
        'causal lineId',
      ),
    lineStatus:
      record.lineStatus as
        LevelLineStatus,
    stage:
      record.stage as
        SetupCausalStage,
    reason:
      record.reason as
        SetupCausalReason,
    observedAt:
      normalizeTimestamp(
        record.observedAt,
        'causal observedAt',
      ),
    observationProgress:
      normalizeNullableFiniteNumber(
        record.observationProgress,
        'causal observationProgress',
      ),
    observationProgressThreshold:
      normalizeNonNegativeNumber(
        record.observationProgressThreshold,
        'causal observationProgressThreshold',
      ),
    distanceToLevelPercent:
      normalizeNullableFiniteNumber(
        record.distanceToLevelPercent,
        'causal distanceToLevelPercent',
      ),
    maxDistanceToLevelPercent:
      normalizeNonNegativeNumber(
        record.maxDistanceToLevelPercent,
        'causal maxDistanceToLevelPercent',
      ),
    realtimeConfirmationStatus:
      record.realtimeConfirmationStatus as
        RealtimeConfirmationStatus,
    realtimeConfirmationReasons,
    sourceObservationalOnly:
      true,
    sourceCreatesSetup:
      false,
    sourceCreatesSignal:
      false,
    evaluatesBreakout:
      false,
    evaluatesBounce:
      false,
    usesFutureCandles:
      false,
    usesFutureRealtimeEvidence:
      false,
  };
}

function validateStageOutcome(
  stage: SetupEngineStage,
  outcome: SetupEngineOutcome,
): void {
  if (
    stage === 'BREAKOUT_CONFIRMED'
    && outcome !== 'breakout'
  ) {
    corrupt(
      'Persisted breakout Setup must have breakout outcome',
    );
  }

  if (
    stage === 'REJECTION_CONFIRMED'
    && outcome !== 'rejection'
  ) {
    corrupt(
      'Persisted rejection Setup must have rejection outcome',
    );
  }

  if (
    stage !== 'BREAKOUT_CONFIRMED'
    && stage !== 'REJECTION_CONFIRMED'
    && outcome !== null
  ) {
    corrupt(
      'Persisted non-terminal Setup has an invalid outcome',
    );
  }
}

function normalizeCandidate(
  value: unknown,
): SetupEngineState {
  const record =
    requireRecord(
      value,
      'candidate',
    );

  const id =
    normalizeText(
      record.id,
      'candidate id',
    );
  const symbol =
    normalizeSymbol(
      record.symbol,
    );
  const setupType =
    normalizeSetupType(
      record.setupType,
    );
  const direction =
    normalizeDirection(
      record.direction,
    );
  const stage =
    normalizeStage(
      record.stage,
      'candidate stage',
    );
  const outcome =
    normalizeOutcome(
      record.outcome,
    );

  validateStageOutcome(
    stage,
    outcome,
  );

  const createdAt =
    normalizeTimestamp(
      record.createdAt,
      'candidate createdAt',
    );
  const updatedAt =
    normalizeTimestamp(
      record.updatedAt,
      'candidate updatedAt',
    );
  const expiresAt =
    normalizeTimestamp(
      record.expiresAt,
      'candidate expiresAt',
    );

  if (
    updatedAt < createdAt
    || expiresAt < createdAt
  ) {
    corrupt(
      'Invalid Setup Event History candidate timestamps',
    );
  }

  const episode =
    record.episode === undefined
      ? null
      : normalizeEpisode(
          record.episode,
          id,
          setupType,
        );

  const causal =
    record.causal === undefined
      ? null
      : normalizeCausalContext(
          record.causal,
        );

  if (
    episode
    && causal
    && episode.lineId
      !== causal.lineId
  ) {
    corrupt(
      'Persisted Setup episode and causal line identities differ',
    );
  }

  return {
    id,
    symbol,
    timeframe:
      normalizeTimeframe(
        record.timeframe,
      ),
    setupType,
    direction,
    stage,
    outcome,
    level:
      normalizeLevel(
        record.level,
      ),
    currentPrice:
      normalizeFiniteNumber(
        record.currentPrice,
        'candidate currentPrice',
      ),
    distanceToLevelPct:
      normalizeNonNegativeNumber(
        record.distanceToLevelPct,
        'candidate distanceToLevelPct',
      ),
    createdAt,
    updatedAt,
    expiresAt,
    ...(episode
      ? {
          episode,
        }
      : {}),
    ...(causal
      ? {
          causal,
        }
      : {}),
  };
}

export function buildSetupEventHistorySemanticKey(
  event:
    Pick<
      SetupLifecycleEvent,
      | 'candidateId'
      | 'type'
      | 'occurredAt'
      | 'previousStage'
      | 'currentStage'
      | 'outcome'
    >,
): string {
  return JSON.stringify([
    event.candidateId,
    event.type,
    event.occurredAt,
    event.previousStage,
    event.currentStage,
    event.outcome,
  ]);
}

function normalizeEvent(
  value: unknown,
): SetupLifecycleEvent {
  const record =
    requireRecord(
      value,
      'event',
    );

  const eventId =
    normalizePositiveInteger(
      record.eventId,
      'eventId',
    );
  const type =
    normalizeEventType(
      record.type,
    );
  const occurredAt =
    normalizeTimestamp(
      record.occurredAt,
      'event occurredAt',
    );
  const candidateId =
    normalizeText(
      record.candidateId,
      'candidate id',
    );
  const symbol =
    normalizeSymbol(
      record.symbol,
    );
  const setupType =
    normalizeSetupType(
      record.setupType,
    );
  const direction =
    normalizeDirection(
      record.direction,
    );
  const previousStage =
    record.previousStage === null
      ? null
      : normalizeStage(
          record.previousStage,
          'previous stage',
        );
  const currentStage =
    normalizeStage(
      record.currentStage,
      'current stage',
    );
  const outcome =
    normalizeOutcome(
      record.outcome,
    );
  const candidate =
    normalizeCandidate(
      record.candidate,
    );

  if (
    candidate.id !== candidateId
    || candidate.symbol !== symbol
    || candidate.setupType !== setupType
    || candidate.direction !== direction
    || candidate.stage !== currentStage
    || candidate.outcome !== outcome
  ) {
    corrupt(
      'Persisted Setup lifecycle event and candidate identities differ',
    );
  }

  if (
    type === 'candidate_created'
    && (
      previousStage !== null
      || occurredAt
        !== candidate.createdAt
    )
  ) {
    corrupt(
      'Invalid persisted candidate_created lifecycle event',
    );
  }

  if (
    type !== 'candidate_created'
    && occurredAt
      !== candidate.updatedAt
  ) {
    corrupt(
      'Persisted Setup transition timestamp must match candidate updatedAt',
    );
  }

  if (
    type === 'breakout_confirmed'
    && (
      currentStage
        !== 'BREAKOUT_CONFIRMED'
      || outcome !== 'breakout'
    )
  ) {
    corrupt(
      'Invalid persisted breakout lifecycle event',
    );
  }

  if (
    type === 'rejection_confirmed'
    && (
      currentStage
        !== 'REJECTION_CONFIRMED'
      || outcome !== 'rejection'
    )
  ) {
    corrupt(
      'Invalid persisted rejection lifecycle event',
    );
  }

  if (
    type === 'setup_expired'
    && (
      currentStage
        !== 'SETUP_EXPIRED'
      || outcome !== null
    )
  ) {
    corrupt(
      'Invalid persisted expiry lifecycle event',
    );
  }

  return {
    eventId,
    type,
    occurredAt,
    candidateId,
    symbol,
    setupType,
    direction,
    previousStage,
    currentStage,
    outcome,
    candidate,
  };
}

export function normalizeSetupEventHistoryPersistenceSnapshot(
  value: unknown,
): SetupEventHistoryPersistenceSnapshot {
  const record =
    requireRecord(
      value,
      'snapshot',
    );

  if (
    record.schema
      !== SETUP_EVENT_HISTORY_PERSISTENCE_SCHEMA
  ) {
    corrupt(
      'Invalid Setup Event History persistence schema',
    );
  }

  if (
    record.version
      !== SETUP_EVENT_HISTORY_PERSISTENCE_VERSION
  ) {
    throw new SetupEventHistoryPersistenceError(
      'setup_event_history_persistence_unsupported_version',
      `Unsupported Setup Event History persistence version: ${String(record.version)}`,
    );
  }

  if (
    !Array.isArray(record.events)
    || record.events.length
      > MAX_EVENTS_IN_SNAPSHOT
  ) {
    corrupt(
      'Invalid Setup Event History persisted events',
    );
  }

  const events =
    record.events.map(
      normalizeEvent,
    );

  let previousEventId = 0;
  const semanticKeys =
    new Set<string>();

  for (const event of events) {
    if (
      event.eventId
      <= previousEventId
    ) {
      corrupt(
        'Persisted Setup Event History eventIds must be strictly increasing',
      );
    }

    previousEventId =
      event.eventId;

    const semanticKey =
      buildSetupEventHistorySemanticKey(
        event,
      );

    if (
      semanticKeys.has(
        semanticKey,
      )
    ) {
      corrupt(
        'Duplicate semantic Setup lifecycle event in persisted history',
      );
    }

    semanticKeys.add(
      semanticKey,
    );
  }

  return {
    schema:
      SETUP_EVENT_HISTORY_PERSISTENCE_SCHEMA,
    version:
      SETUP_EVENT_HISTORY_PERSISTENCE_VERSION,
    savedAt:
      normalizeTimestamp(
        record.savedAt,
        'snapshot savedAt',
      ),
    droppedEventsCount:
      normalizeNonNegativeInteger(
        record.droppedEventsCount,
        'droppedEventsCount',
      ),
    events,
  };
}

export class JsonFileSetupEventHistoryPersistence
implements SetupEventHistoryPersistenceContract {
  readonly adapter =
    'json_file';

  readonly filePath:
    string;

  constructor(
    options:
      JsonFileSetupEventHistoryPersistenceOptions,
  ) {
    const filePath =
      options.filePath.trim();

    if (filePath.length === 0) {
      throw new Error(
        'Setup Event History persistence file path is required',
      );
    }

    this.filePath =
      resolve(
        filePath,
      );
  }

  async load():
  Promise<SetupEventHistoryPersistenceSnapshot | null> {
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
          error as
            NodeJS.ErrnoException
        ).code
          === 'ENOENT'
      ) {
        return null;
      }

      throw new SetupEventHistoryPersistenceError(
        'setup_event_history_persistence_read_failed',
        'Unable to read Setup Event History persistence file',
        {
          cause:
            error,
        },
      );
    }

    let parsed: unknown;

    try {
      parsed =
        JSON.parse(
          source,
        ) as unknown;
    } catch (error) {
      throw new SetupEventHistoryPersistenceError(
        'setup_event_history_persistence_corrupt',
        'Setup Event History persistence file contains invalid JSON',
        {
          cause:
            error,
        },
      );
    }

    return normalizeSetupEventHistoryPersistenceSnapshot(
      parsed,
    );
  }

  async save(
    snapshot:
      SetupEventHistoryPersistenceSnapshot,
  ): Promise<void> {
    const serialized =
      JSON.stringify(
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
        dirname(
          this.filePath,
        ),
        {
          recursive:
            true,
        },
      );

      await writeFile(
        temporaryPath,
        `${serialized}\n`,
        'utf8',
      );

      await rename(
        temporaryPath,
        this.filePath,
      );
    } catch (error) {
      try {
        await unlink(
          temporaryPath,
        );
      } catch {
        // Temporary file may not exist.
      }

      throw new SetupEventHistoryPersistenceError(
        'setup_event_history_persistence_write_failed',
        'Unable to write Setup Event History persistence file',
        {
          cause:
            error,
        },
      );
    }
  }
}