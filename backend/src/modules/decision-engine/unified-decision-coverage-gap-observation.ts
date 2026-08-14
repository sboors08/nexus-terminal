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
  SetupEngineState,
} from '../setup-engine/setup-engine.types.js';
import {
  UNIFIED_DECISION_COVERAGE_GAP_OBSERVATION_VERSION,
  UNIFIED_DECISION_COVERAGE_GAP_PERSISTENCE_SCHEMA,
  UNIFIED_DECISION_COVERAGE_GAP_PERSISTENCE_VERSION,
  type UnifiedDecisionCoverageGapCase,
  type UnifiedDecisionCoverageGapCoverage,
  type UnifiedDecisionCoverageGapFilter,
  type UnifiedDecisionCoverageGapKind,
  type UnifiedDecisionCoverageGapObserver,
  type UnifiedDecisionCoverageGapPersistence,
  type UnifiedDecisionCoverageGapPersistenceSnapshot,
  type UnifiedDecisionCoverageGapReport,
  type UnifiedDecisionCoverageGapStatus,
  type UnifiedDecisionCoverageGapViolation,
} from './unified-decision-coverage-gap-observation.types.js';
import type {
  UnifiedDecisionLiveObservation,
  UnifiedDecisionLiveObservationRecorder,
} from './unified-decision-live-observation.types.js';

const GAP_KINDS:
readonly UnifiedDecisionCoverageGapKind[] = [
  'market_context_single_conflict',
  'market_context_double_conflict',
  'terminal_setup_outcome',
];

const MAX_PERSISTED_CASES = 100_000;

export type UnifiedDecisionCoverageGapPersistenceErrorCode =
  | 'coverage_gap_persistence_corrupt'
  | 'coverage_gap_persistence_unsupported_version'
  | 'coverage_gap_persistence_read_failed'
  | 'coverage_gap_persistence_write_failed';

export class UnifiedDecisionCoverageGapPersistenceError
extends Error {
  constructor(
    public readonly code:
      UnifiedDecisionCoverageGapPersistenceErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name =
      'UnifiedDecisionCoverageGapPersistenceError';
  }
}

export interface JsonFileUnifiedDecisionCoverageGapPersistenceOptions {
  readonly filePath: string;
}

export class JsonFileUnifiedDecisionCoverageGapPersistence
implements UnifiedDecisionCoverageGapPersistence {
  readonly adapter = 'json_file_v1';
  private readonly filePath: string;

  constructor(
    options: JsonFileUnifiedDecisionCoverageGapPersistenceOptions,
  ) {
    this.filePath = resolve(options.filePath);
  }

  async load(): Promise<unknown | null> {
    try {
      const contents = await readFile(this.filePath, 'utf8');
      try {
        return JSON.parse(contents) as unknown;
      } catch (error: unknown) {
        throw new UnifiedDecisionCoverageGapPersistenceError(
          'coverage_gap_persistence_corrupt',
          'Unified Decision coverage-gap storage contains invalid JSON',
          { cause: error },
        );
      }
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') return null;
      if (error instanceof UnifiedDecisionCoverageGapPersistenceError) throw error;
      throw new UnifiedDecisionCoverageGapPersistenceError(
        'coverage_gap_persistence_read_failed',
        'Unable to read Unified Decision coverage-gap storage',
        { cause: error },
      );
    }
  }

  async save(
    snapshot: UnifiedDecisionCoverageGapPersistenceSnapshot,
  ): Promise<void> {
    const parent = dirname(this.filePath);
    const temporary =
      `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;

    try {
      await mkdir(parent, { recursive: true });
      await writeFile(
        temporary,
        `${JSON.stringify(snapshot, null, 2)}\n`,
        { encoding: 'utf8', mode: 0o600 },
      );
      await rename(temporary, this.filePath);
    } catch (error: unknown) {
      try {
        await unlink(temporary);
      } catch {
        // The temporary file may not exist.
      }
      throw new UnifiedDecisionCoverageGapPersistenceError(
        'coverage_gap_persistence_write_failed',
        'Unable to write Unified Decision coverage-gap storage',
        { cause: error },
      );
    }
  }
}

export interface UnifiedDecisionCoverageGapObservationServiceOptions {
  readonly source?: UnifiedDecisionLiveObservationRecorder | null;
  readonly persistence?: UnifiedDecisionCoverageGapPersistence | null;
  readonly capacity?: number;
  readonly now?: () => Date;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function persistenceError(
  label: string,
): UnifiedDecisionCoverageGapPersistenceError {
  return new UnifiedDecisionCoverageGapPersistenceError(
    'coverage_gap_persistence_corrupt',
    `Invalid persisted Unified Decision coverage-gap ${label}`,
  );
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw persistenceError(label);
  }
  return new Date(Date.parse(value)).toISOString();
}

function normalizeCase(value: unknown): UnifiedDecisionCoverageGapCase {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || !Number.isSafeInteger(value.sequence)
    || (value.sequence as number) < 1
    || !GAP_KINDS.includes(value.kind as UnifiedDecisionCoverageGapKind)
    || typeof value.sourceObservationId !== 'string'
    || !Number.isSafeInteger(value.sourceObservationSequence)
    || typeof value.symbol !== 'string'
    || !Array.isArray(value.violations)
    || !isRecord(value.observation)
    || value.observation.id !== value.sourceObservationId
    || value.observation.sequence !== value.sourceObservationSequence
    || value.diagnosticOnly !== true
    || value.createsTradeOrder !== false
    || value.createsSignal !== false
    || value.changesDecisionRules !== false
  ) {
    throw persistenceError('case');
  }
  timestamp(value.observedAt, 'observedAt');
  return clone(value as unknown as UnifiedDecisionCoverageGapCase);
}

function normalizeSnapshot(
  value: unknown,
  capacity: number,
): {
  readonly nextSequence: number;
  readonly cases: UnifiedDecisionCoverageGapCase[];
} {
  if (!isRecord(value)) throw persistenceError('snapshot');
  if (value.schema !== UNIFIED_DECISION_COVERAGE_GAP_PERSISTENCE_SCHEMA) {
    throw persistenceError('schema');
  }
  if (
    value.version !== UNIFIED_DECISION_COVERAGE_GAP_PERSISTENCE_VERSION
    || value.reportVersion !== UNIFIED_DECISION_COVERAGE_GAP_OBSERVATION_VERSION
  ) {
    throw new UnifiedDecisionCoverageGapPersistenceError(
      'coverage_gap_persistence_unsupported_version',
      'Unsupported Unified Decision coverage-gap storage version',
    );
  }
  timestamp(value.savedAt, 'savedAt');
  if (
    !Number.isSafeInteger(value.nextSequence)
    || (value.nextSequence as number) < 1
    || !Array.isArray(value.cases)
    || value.cases.length > MAX_PERSISTED_CASES
  ) {
    throw persistenceError('snapshot');
  }
  const normalizedCases = value.cases.map(normalizeCase);
  const cases = GAP_KINDS.flatMap((kind) =>
    normalizedCases.filter((item) => item.kind === kind).slice(-capacity),
  ).sort((left, right) => left.sequence - right.sequence);
  const maximum = cases.reduce(
    (current, item) => Math.max(current, item.sequence),
    0,
  );
  return {
    nextSequence: Math.max(value.nextSequence as number, maximum + 1),
    cases,
  };
}

function requireCapacity(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > MAX_PERSISTED_CASES) {
    throw new Error(`capacity must be an integer from 1 to ${MAX_PERSISTED_CASES}`);
  }
  return value;
}

function isTerminalSetup(setup: SetupEngineState): boolean {
  return (
    setup.stage === 'BREAKOUT_CONFIRMED'
    && setup.outcome === 'breakout'
    && setup.setupType === 'level_breakout'
  ) || (
    setup.stage === 'REJECTION_CONFIRMED'
    && setup.outcome === 'rejection'
    && setup.setupType === 'level_bounce'
  );
}

function currentTerminalCandidateIds(
  observation: UnifiedDecisionLiveObservation,
): string[] {
  const generatedAt = Date.parse(observation.decision.generatedAt);
  if (!Number.isFinite(generatedAt)) return [];
  return observation.setups.candidates
    .filter((setup) => (
      isTerminalSetup(setup)
      && Number.isFinite(Date.parse(setup.expiresAt))
      && Date.parse(setup.expiresAt) >= generatedAt
    ))
    .map((setup) => setup.id);
}

function conflictCount(
  observation: UnifiedDecisionLiveObservation,
): 0 | 1 | 2 {
  if (observation.decision.direction === null) return 0;
  return [
    observation.decision.marketContext.btc.alignment,
    observation.decision.marketContext.impulse.alignment,
  ].filter((alignment) => alignment === 'opposed').length as 0 | 1 | 2;
}

function readPersistenceErrorCode(error: unknown): string {
  return error instanceof UnifiedDecisionCoverageGapPersistenceError
    ? error.code
    : 'coverage_gap_persistence_failed';
}

function validateCase(
  kind: UnifiedDecisionCoverageGapKind,
  observation: UnifiedDecisionLiveObservation,
  terminalCandidateIds: readonly string[],
): UnifiedDecisionCoverageGapViolation[] {
  const violations: UnifiedDecisionCoverageGapViolation[] = [];
  const add = (
    code: UnifiedDecisionCoverageGapViolation['code'],
    message: string,
  ) => violations.push({ code, message });
  const decision = observation.decision;
  const possible = decision.state === 'possible_long' || decision.state === 'possible_short';

  if (kind === 'market_context_single_conflict') {
    if (decision.state !== 'wait_confirmation') {
      add('single_conflict_not_downgraded', 'Single market conflict was not downgraded to wait_confirmation');
    }
    if (
      !decision.reasons.includes('market_context_conflict')
      || !decision.invalidations.includes('market_context_reversal')
    ) {
      add('single_conflict_missing_contract', 'Single market conflict lacks its reason or invalidation');
    }
  }

  if (kind === 'market_context_double_conflict') {
    if (decision.state !== 'skip') {
      add('double_conflict_not_skipped', 'Double market conflict was not downgraded to skip');
    }
    if (
      !decision.reasons.includes('market_context_double_conflict')
      || !decision.invalidations.includes('market_context_reversal')
    ) {
      add('double_conflict_missing_contract', 'Double market conflict lacks its reason or invalidation');
    }
  }

  if (kind.startsWith('market_context_') && possible) {
    add('conflict_produced_possible_state', 'Market conflict produced a possible direction');
  }

  if (kind === 'terminal_setup_outcome') {
    if (terminalCandidateIds.length > 0 && decision.state !== 'setup_confirmed') {
      add('terminal_outcome_not_confirmed', 'Current terminal Setup outcome did not produce setup_confirmed');
    }
    const captured = decision.setup
      ? observation.setups.candidates.find((setup) => setup.id === decision.setup?.candidateId)
      : undefined;
    if (decision.state === 'setup_confirmed' && (!captured || !isTerminalSetup(captured))) {
      add('setup_confirmed_without_captured_terminal', 'setup_confirmed lacks a captured terminal Setup candidate');
    }
    if (
      decision.state === 'setup_confirmed'
      && captured
      && (
        !captured.causal?.lineId
        || captured.causal.lineId !== decision.level?.lineId
      )
    ) {
      add('setup_confirmed_causal_line_mismatch', 'Confirmed Setup does not preserve the causal Level Line');
    }
    if (decision.state === 'setup_confirmed' && captured) {
      const expectedReason = captured.outcome === 'breakout'
        ? 'setup_breakout_confirmed'
        : 'setup_bounce_confirmed';
      if (!decision.reasons.includes(expectedReason)) {
        add('setup_confirmed_reason_mismatch', 'setup_confirmed lacks the matching terminal outcome reason');
      }
    }
  }

  if (
    observation.diagnosticOnly !== true
    || observation.createsTradeOrder !== false
    || observation.createsSetup !== false
    || observation.createsSignal !== false
    || observation.changesDecisionRules !== false
    || decision.decisionSupportOnly !== true
    || decision.createsTradeOrder !== false
    || decision.createsSetup !== false
    || decision.createsSignal !== false
    || decision.createsScore !== false
    || decision.estimatesProfitability !== false
    || decision.changesExistingLifecycle !== false
    || decision.usesFutureData !== false
  ) {
    add('safety_contract_changed', 'Observation or Unified Decision safety contract changed');
  }

  return violations;
}

export class UnifiedDecisionCoverageGapObservationService
implements UnifiedDecisionCoverageGapObserver {
  private readonly source: UnifiedDecisionLiveObservationRecorder | null;
  private readonly persistence: UnifiedDecisionCoverageGapPersistence | null;
  private readonly capacity: number;
  private readonly now: () => Date;
  private cases: UnifiedDecisionCoverageGapCase[] = [];
  private nextSequence = 1;
  private state: UnifiedDecisionCoverageGapStatus['state'] = 'idle';
  private persistenceWritable = true;
  private lastPersistenceErrorCode: string | null = null;
  private saveQueue: Promise<void> = Promise.resolve();
  private unsubscribe: (() => void) | null = null;
  private readonly previousBySymbol =
    new Map<string, UnifiedDecisionLiveObservation>();

  constructor(
    options: UnifiedDecisionCoverageGapObservationServiceOptions = {},
  ) {
    this.source = options.source ?? null;
    this.persistence = options.persistence ?? null;
    this.capacity = requireCapacity(options.capacity ?? 1_000);
    this.now = options.now ?? (() => new Date());
  }

  async start(): Promise<void> {
    if (this.state === 'ready' || this.state === 'degraded') return;
    if (this.persistence) {
      try {
        const raw = await this.persistence.load();
        if (raw !== null) {
          const normalized = normalizeSnapshot(raw, this.capacity);
          this.cases = normalized.cases;
          this.nextSequence = normalized.nextSequence;
        }
      } catch (error: unknown) {
        this.persistenceWritable = false;
        this.lastPersistenceErrorCode = readPersistenceErrorCode(error);
        this.state = 'degraded';
      }
    }
    if (this.source?.subscribe) {
      this.unsubscribe = this.source.subscribe((observation) => {
        this.observe(observation);
      });
    }
    if (this.state !== 'degraded') this.state = 'ready';
  }

  async stop(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    await this.flush();
    this.state = 'stopped';
  }

  observe(
    observation: UnifiedDecisionLiveObservation,
  ): readonly UnifiedDecisionCoverageGapCase[] {
    if (this.state === 'stopped') {
      throw new Error('Unified Decision coverage-gap observer is stopped');
    }
    const previous = this.previousBySymbol.get(observation.symbol) ?? null;
    this.previousBySymbol.set(observation.symbol, clone(observation));
    const conflicts = conflictCount(observation);
    const terminalCandidateIds = currentTerminalCandidateIds(observation);
    const kinds: UnifiedDecisionCoverageGapKind[] = [];
    if (conflicts === 1) kinds.push('market_context_single_conflict');
    if (conflicts === 2) kinds.push('market_context_double_conflict');
    if (terminalCandidateIds.length > 0 || observation.decision.state === 'setup_confirmed') {
      kinds.push('terminal_setup_outcome');
    }
    const added = kinds.map((kind) => this.createCase(
      kind,
      observation,
      previous,
      conflicts,
      terminalCandidateIds,
    ));
    if (added.length > 0) {
      this.cases.push(...added);
      this.trimPerKind();
      this.enqueueSave();
    }
    return clone(added);
  }

  async flush(): Promise<void> {
    await this.saveQueue;
  }

  getStatus(): UnifiedDecisionCoverageGapStatus {
    const sourceIds = new Set(this.cases.map((item) => item.sourceObservationId));
    return {
      version: UNIFIED_DECISION_COVERAGE_GAP_OBSERVATION_VERSION,
      state: this.state,
      persistenceMode: this.persistence ? 'persistent' : 'runtime_only',
      persistenceAdapter: this.persistence?.adapter ?? null,
      capacityPerKind: this.capacity,
      maxCaseCount: this.capacity * GAP_KINDS.length,
      caseCount: this.cases.length,
      sourceObservationCount: sourceIds.size,
      transitionCount: this.cases.filter((item) => item.transition !== null).length,
      violationCount: this.cases.reduce(
        (count, item) => count + item.violations.length,
        0,
      ),
      firstObservedAt: this.cases[0]?.observedAt ?? null,
      lastObservedAt: this.cases.at(-1)?.observedAt ?? null,
      nextSequence: this.nextSequence,
      lastPersistenceErrorCode: this.lastPersistenceErrorCode,
      coverage: GAP_KINDS.map((kind) => this.coverageFor(kind)),
      diagnosticOnly: true,
      createsTradeOrder: false,
      changesDecisionRules: false,
    };
  }

  getCases(
    filter: UnifiedDecisionCoverageGapFilter = {},
  ): readonly UnifiedDecisionCoverageGapCase[] {
    const maximum = this.capacity * GAP_KINDS.length;
    const limit = Math.min(filter.limit ?? maximum, maximum);
    const matched: UnifiedDecisionCoverageGapCase[] = [];
    for (let index = this.cases.length - 1; index >= 0 && matched.length < limit; index -= 1) {
      const item = this.cases[index];
      if (!item) continue;
      if (filter.kind && item.kind !== filter.kind) continue;
      if (filter.symbol && item.symbol !== filter.symbol) continue;
      if (filter.timeframe && item.timeframe !== filter.timeframe) continue;
      matched.push(clone(item));
    }
    return matched;
  }

  exportReport(
    filter: UnifiedDecisionCoverageGapFilter = {},
  ): UnifiedDecisionCoverageGapReport {
    return {
      version: UNIFIED_DECISION_COVERAGE_GAP_OBSERVATION_VERSION,
      exportedAt: this.now().toISOString(),
      status: this.getStatus(),
      cases: this.getCases(filter),
    };
  }

  private createCase(
    kind: UnifiedDecisionCoverageGapKind,
    observation: UnifiedDecisionLiveObservation,
    previous: UnifiedDecisionLiveObservation | null,
    conflicts: 0 | 1 | 2,
    terminalCandidateIds: readonly string[],
  ): UnifiedDecisionCoverageGapCase {
    const sequence = this.nextSequence;
    this.nextSequence += 1;
    return {
      id: `udcg:${sequence}:${randomUUID()}`,
      sequence,
      observedAt: this.now().toISOString(),
      kind,
      sourceObservationId: observation.id,
      sourceObservationSequence: observation.sequence,
      symbol: observation.symbol,
      timeframe: observation.timeframe,
      conflictCount: conflicts,
      terminalCandidateIds: [...terminalCandidateIds],
      transition: previous
        ? {
            fromObservationId: previous.id,
            fromSequence: previous.sequence,
            fromState: previous.decision.state,
            fromLineId: previous.decision.level?.lineId ?? null,
            toState: observation.decision.state,
            toLineId: observation.decision.level?.lineId ?? null,
          }
        : null,
      violations: validateCase(kind, observation, terminalCandidateIds),
      observation: clone(observation),
      diagnosticOnly: true,
      createsTradeOrder: false,
      createsSignal: false,
      changesDecisionRules: false,
    };
  }

  private trimPerKind(): void {
    const retainedIds = new Set<string>();
    for (const kind of GAP_KINDS) {
      for (const item of this.cases.filter((candidate) => candidate.kind === kind).slice(-this.capacity)) {
        retainedIds.add(item.id);
      }
    }
    this.cases = this.cases.filter((item) => retainedIds.has(item.id));
  }

  private coverageFor(
    kind: UnifiedDecisionCoverageGapKind,
  ): UnifiedDecisionCoverageGapCoverage {
    const cases = this.cases.filter((item) => item.kind === kind);
    return {
      kind,
      state: cases.length > 0 ? 'observed' : 'not_observed',
      caseCount: cases.length,
      firstObservedAt: cases[0]?.observedAt ?? null,
      lastObservedAt: cases.at(-1)?.observedAt ?? null,
    };
  }

  private enqueueSave(): void {
    if (!this.persistence || !this.persistenceWritable) return;
    this.saveQueue = this.saveQueue
      .then(async () => {
        if (!this.persistence || !this.persistenceWritable) return;
        await this.persistence.save({
          schema: UNIFIED_DECISION_COVERAGE_GAP_PERSISTENCE_SCHEMA,
          version: UNIFIED_DECISION_COVERAGE_GAP_PERSISTENCE_VERSION,
          reportVersion: UNIFIED_DECISION_COVERAGE_GAP_OBSERVATION_VERSION,
          savedAt: this.now().toISOString(),
          nextSequence: this.nextSequence,
          cases: clone(this.cases),
        });
      })
      .catch((error: unknown) => {
        this.persistenceWritable = false;
        this.lastPersistenceErrorCode = readPersistenceErrorCode(error);
        this.state = 'degraded';
      });
  }
}
