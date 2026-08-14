import type {
  SetupEngineState,
} from '../setup-engine/setup-engine.types.js';
import {
  UNIFIED_DECISION_LIVE_OBSERVATION_DATASET_VERSION,
  UNIFIED_DECISION_LIVE_OBSERVATION_PERSISTENCE_SCHEMA,
  UNIFIED_DECISION_LIVE_OBSERVATION_PERSISTENCE_VERSION,
} from './unified-decision-live-observation.types.js';
import type {
  UnifiedDecisionLiveObservation,
} from './unified-decision-live-observation.types.js';
import {
  UNIFIED_DECISION_LIVE_COHORT_VALIDATION_VERSION,
} from './unified-decision-live-cohort-validation.types.js';
import type {
  UnifiedDecisionLiveCohortAppliedOptions,
  UnifiedDecisionLiveCohortCoverageGap,
  UnifiedDecisionLiveCohortCoverageStatus,
  UnifiedDecisionLiveCohortReportStatus,
  UnifiedDecisionLiveCohortTransition,
  UnifiedDecisionLiveCohortValidationOptions,
  UnifiedDecisionLiveCohortValidationReport,
  UnifiedDecisionLiveCohortViolation,
  UnifiedDecisionLiveCohortViolationCode,
} from './unified-decision-live-cohort-validation.types.js';
import type {
  UnifiedDecisionScenario,
  UnifiedDecisionState,
} from './unified-decision.types.js';

const STATES = [
  'observe',
  'possible_long',
  'possible_short',
  'wait_confirmation',
  'setup_confirmed',
  'skip',
] as const satisfies readonly UnifiedDecisionState[];

const VIOLATION_CODES = [
  'duplicate_observation_id',
  'duplicate_sequence',
  'non_monotonic_sequence',
  'non_monotonic_recorded_at',
  'decision_timestamp_after_recording',
  'observation_identity_mismatch',
  'possible_state_direction_mismatch',
  'possible_without_level_or_scenario',
  'possible_wrong_causal_stage',
  'possible_level_scenario_direction_mismatch',
  'possible_without_matching_reason',
  'possible_without_complete_live_realtime',
  'possible_without_evidence_consensus',
  'realtime_disagreement_not_downgraded',
  'realtime_disagreement_missing_marker',
  'non_live_tape_not_downgraded',
  'non_live_tape_missing_marker',
  'non_live_order_book_not_downgraded',
  'non_live_order_book_missing_marker',
  'market_context_conflict_not_downgraded',
  'market_context_conflict_missing_contract',
  'unavailable_market_context_missing_marker',
  'setup_confirmed_without_terminal_outcome',
  'setup_confirmed_without_captured_candidate',
  'setup_confirmed_causal_line_mismatch',
  'current_terminal_outcome_not_confirmed',
  'safety_contract_changed',
] as const satisfies readonly UnifiedDecisionLiveCohortViolationCode[];

const POSSIBLE_CODES = new Set<UnifiedDecisionLiveCohortViolationCode>([
  'possible_state_direction_mismatch',
  'possible_without_level_or_scenario',
  'possible_wrong_causal_stage',
  'possible_level_scenario_direction_mismatch',
  'possible_without_matching_reason',
  'possible_without_complete_live_realtime',
  'possible_without_evidence_consensus',
]);

const REALTIME_CODES = new Set<UnifiedDecisionLiveCohortViolationCode>([
  'possible_without_complete_live_realtime',
  'possible_without_evidence_consensus',
  'realtime_disagreement_not_downgraded',
  'realtime_disagreement_missing_marker',
  'non_live_tape_not_downgraded',
  'non_live_tape_missing_marker',
  'non_live_order_book_not_downgraded',
  'non_live_order_book_missing_marker',
]);

const MARKET_FRESHNESS_CODES =
  new Set<UnifiedDecisionLiveCohortViolationCode>([
    'unavailable_market_context_missing_marker',
  ]);

const MARKET_CONFLICT_CODES =
  new Set<UnifiedDecisionLiveCohortViolationCode>([
    'market_context_conflict_not_downgraded',
    'market_context_conflict_missing_contract',
  ]);

const SETUP_CODES = new Set<UnifiedDecisionLiveCohortViolationCode>([
  'setup_confirmed_without_terminal_outcome',
  'setup_confirmed_without_captured_candidate',
  'setup_confirmed_causal_line_mismatch',
  'current_terminal_outcome_not_confirmed',
]);

export class UnifiedDecisionLiveCohortValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnifiedDecisionLiveCohortValidationError';
  }
}

export interface UnifiedDecisionLiveCohortValidationDependencies {
  readonly now?: () => Date;
}

interface CohortSource {
  readonly datasetVersion: string;
  readonly persistenceSchema: string | null;
  readonly persistenceVersion: number | null;
  readonly sourceSavedAt: string | null;
  readonly observations: readonly UnifiedDecisionLiveObservation[];
}

function fail(message: string): never {
  throw new UnifiedDecisionLiveCohortValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function timestamp(value: unknown, field: string): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    fail(`${field} must be a valid timestamp`);
  }
  return new Date(value).toISOString();
}

function positive(value: number | undefined, fallback: number, field: string): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result <= 0) {
    fail(`${field} must be a positive integer`);
  }
  return result;
}

function optionalPositive(value: number | undefined, field: string): number | null {
  return value === undefined ? null : positive(value, value, field);
}

function applyOptions(
  options: UnifiedDecisionLiveCohortValidationOptions,
): UnifiedDecisionLiveCohortAppliedOptions {
  const startSequence = optionalPositive(options.startSequence, 'startSequence');
  const endSequence = optionalPositive(options.endSequence, 'endSequence');
  if (startSequence !== null && endSequence !== null && startSequence > endSequence) {
    fail('startSequence must not be greater than endSequence');
  }
  return Object.freeze({
    startSequence,
    endSequence,
    minimumObservationCount: positive(options.minimumObservationCount, 500, 'minimumObservationCount'),
    minimumSymmetryCellCount: positive(options.minimumSymmetryCellCount, 10, 'minimumSymmetryCellCount'),
    minimumRealtimeLossCount: positive(options.minimumRealtimeLossCount, 1, 'minimumRealtimeLossCount'),
    minimumDisagreementCount: positive(options.minimumDisagreementCount, 10, 'minimumDisagreementCount'),
  });
}

export function readUnifiedDecisionLiveCohortSource(value: unknown): CohortSource {
  if (!isRecord(value)) {
    fail('Live cohort source must be an object');
  }
  let datasetVersion: string;
  let persistenceSchema: string | null = null;
  let persistenceVersion: number | null = null;
  let sourceSavedAt: string | null = null;

  if (value.schema === UNIFIED_DECISION_LIVE_OBSERVATION_PERSISTENCE_SCHEMA) {
    if (
      value.version !== UNIFIED_DECISION_LIVE_OBSERVATION_PERSISTENCE_VERSION
      || value.datasetVersion !== UNIFIED_DECISION_LIVE_OBSERVATION_DATASET_VERSION
    ) {
      fail('Unsupported live observation persistence version');
    }
    datasetVersion = value.datasetVersion;
    persistenceSchema = value.schema;
    persistenceVersion = value.version;
    sourceSavedAt = timestamp(value.savedAt, 'savedAt');
  } else {
    if (value.version !== UNIFIED_DECISION_LIVE_OBSERVATION_DATASET_VERSION) {
      fail('Unsupported live observation dataset version');
    }
    datasetVersion = value.version;
    sourceSavedAt = value.exportedAt === undefined
      ? null
      : timestamp(value.exportedAt, 'exportedAt');
  }

  if (!Array.isArray(value.observations)) {
    fail('Live cohort observations must be an array');
  }
  const observations = value.observations.map((observation, index) => {
    if (
      !isRecord(observation)
      || !isRecord(observation.decision)
      || !isRecord(observation.realtime)
      || !isRecord(observation.setups)
      || !isRecord(observation.marketContext)
    ) {
      fail(`Observation ${index} is malformed`);
    }
    return observation as unknown as UnifiedDecisionLiveObservation;
  });

  return Object.freeze({
    datasetVersion,
    persistenceSchema,
    persistenceVersion,
    sourceSavedAt,
    observations: Object.freeze(observations),
  });
}

function emptyCounts(values: readonly string[]): Record<string, number> {
  return Object.fromEntries(values.map((value) => [value, 0]));
}

function increment(counts: Record<string, number>, value: string): void {
  counts[value] = (counts[value] ?? 0) + 1;
}

function isPossible(state: UnifiedDecisionState): boolean {
  return state === 'possible_long' || state === 'possible_short';
}

function expectedDirection(
  kind: 'support' | 'resistance',
  scenario: Exclude<UnifiedDecisionScenario, null>,
): 'long' | 'short' {
  if (scenario === 'breakout') {
    return kind === 'resistance' ? 'long' : 'short';
  }
  return kind === 'resistance' ? 'short' : 'long';
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

function countViolations(
  violations: readonly UnifiedDecisionLiveCohortViolation[],
  codes: ReadonlySet<UnifiedDecisionLiveCohortViolationCode>,
): number {
  return violations.filter((violation) => codes.has(violation.code)).length;
}

function coverageStatus(
  count: number,
  minimum: number,
  violationCount: number,
): UnifiedDecisionLiveCohortCoverageStatus {
  if (count === 0) return 'not_observed';
  return count >= minimum && violationCount === 0 ? 'validated' : 'insufficient';
}

function reportStatus(
  observationCount: number,
  minimumObservationCount: number,
  symmetry: UnifiedDecisionLiveCohortCoverageStatus,
  realtime: UnifiedDecisionLiveCohortCoverageStatus,
  violationCount: number,
  gapCount: number,
): UnifiedDecisionLiveCohortReportStatus {
  if (violationCount > 0) return 'violations_found';
  if (
    observationCount < minimumObservationCount
    || symmetry !== 'validated'
    || realtime !== 'validated'
  ) return 'insufficient_coverage';
  return gapCount > 0 ? 'validated_with_coverage_gaps' : 'validated';
}

export function validateUnifiedDecisionLiveCohort(
  sourceInput: unknown,
  options: UnifiedDecisionLiveCohortValidationOptions = {},
  dependencies: UnifiedDecisionLiveCohortValidationDependencies = {},
): UnifiedDecisionLiveCohortValidationReport {
  const source = readUnifiedDecisionLiveCohortSource(sourceInput);
  const applied = applyOptions(options);
  const selected = source.observations.filter((observation) => (
    (applied.startSequence === null || observation.sequence >= applied.startSequence)
    && (applied.endSequence === null || observation.sequence <= applied.endSequence)
  ));
  if (selected.length === 0) fail('Live cohort contains no selected observations');

  const ordered = [...selected].sort((a, b) => a.sequence - b.sequence);
  const violations: UnifiedDecisionLiveCohortViolation[] = [];
  const add = (
    observation: UnifiedDecisionLiveObservation,
    code: UnifiedDecisionLiveCohortViolationCode,
    message: string,
  ): void => {
    violations.push(Object.freeze({
      code,
      sequence: observation.sequence,
      symbol: observation.symbol,
      recordedAt: observation.recordedAt,
      message,
    }));
  };

  let sourcePreviousSequence: number | null = null;
  for (const observation of selected) {
    if (sourcePreviousSequence !== null && observation.sequence <= sourcePreviousSequence) {
      add(observation, 'non_monotonic_sequence', 'Source sequence is not strictly increasing');
    }
    sourcePreviousSequence = observation.sequence;
  }

  const stateCounts = emptyCounts(STATES);
  const symbolCounts: Record<string, number> = {};
  const availabilityCounts: Record<string, number> = {};
  const tapeStateCounts: Record<string, number> = {};
  const bookStateCounts: Record<string, number> = {};
  const btcAvailabilityCounts: Record<string, number> = {};
  const impulseAvailabilityCounts: Record<string, number> = {};
  const btcAlignmentCounts: Record<string, number> = {};
  const impulseAlignmentCounts: Record<string, number> = {};
  const setupStageCounts: Record<string, number> = {};
  const setupOutcomeCounts: Record<string, number> = {};
  const ids = new Set<string>();
  const sequences = new Set<number>();
  const lineIds = new Set<string>();
  const possibleLineIds = new Set<string>();
  const setupIds = new Set<string>();

  let previousRecordedAt = Number.NEGATIVE_INFINITY;
  let possibleLong = 0;
  let possibleShort = 0;
  let resistanceBreakoutLong = 0;
  let resistanceBounceShort = 0;
  let supportBreakoutShort = 0;
  let supportBounceLong = 0;
  let nonLiveTape = 0;
  let nonLiveBook = 0;
  let disagreements = 0;
  let partial = 0;
  let possibleWithSourceLoss = 0;
  let staleBtc = 0;
  let staleImpulse = 0;
  let directionalUnavailableMarket = 0;
  let singleConflict = 0;
  let doubleConflict = 0;
  let setupSnapshots = 0;
  let activeDecisionSetups = 0;
  let terminalCandidateObservations = 0;
  let setupConfirmed = 0;
  let causalLinkValidated = 0;

  for (const observation of ordered) {
    const decision = observation.decision;
    const evidence = observation.realtime.evaluatedEvidence;
    const recordedAt = Date.parse(observation.recordedAt);
    const generatedAt = Date.parse(decision.generatedAt);
    if (!Number.isFinite(recordedAt) || !Number.isFinite(generatedAt)) {
      fail(`Observation ${observation.sequence} contains an invalid timestamp`);
    }
    if (ids.has(observation.id)) add(observation, 'duplicate_observation_id', 'Observation id is duplicated');
    if (sequences.has(observation.sequence)) add(observation, 'duplicate_sequence', 'Observation sequence is duplicated');
    if (recordedAt < previousRecordedAt) add(observation, 'non_monotonic_recorded_at', 'Observation timestamp moved backwards');
    if (generatedAt > recordedAt) add(observation, 'decision_timestamp_after_recording', 'Decision timestamp is after recording');
    ids.add(observation.id);
    sequences.add(observation.sequence);
    previousRecordedAt = recordedAt;

    if (decision.symbol !== observation.symbol || decision.timeframe !== observation.timeframe) {
      add(observation, 'observation_identity_mismatch', 'Decision identity differs from observation identity');
    }
    increment(stateCounts, decision.state);
    increment(symbolCounts, observation.symbol);
    increment(availabilityCounts, evidence.availability);
    increment(tapeStateCounts, evidence.tape.state);
    increment(bookStateCounts, evidence.orderBook.state);
    increment(btcAvailabilityCounts, decision.marketContext.btc.availability);
    increment(impulseAvailabilityCounts, decision.marketContext.impulse.availability);
    increment(btcAlignmentCounts, decision.marketContext.btc.alignment);
    increment(impulseAlignmentCounts, decision.marketContext.impulse.alignment);
    if (decision.level) lineIds.add(decision.level.lineId);

    const tapeLive = evidence.tape.state === 'live';
    const bookLive = evidence.orderBook.state === 'live';
    if (!tapeLive) nonLiveTape++;
    if (!bookLive) nonLiveBook++;
    if (decision.level?.realtimeStatus === 'partial') partial++;
    const disagreement = Boolean(
      decision.level && decision.level.tapeState !== decision.level.orderBookState,
    );
    if (disagreement) {
      disagreements++;
      if (isPossible(decision.state)) add(observation, 'realtime_disagreement_not_downgraded', 'Realtime disagreement produced a possible direction');
      if (!decision.missingConfirmations.includes('realtime_direction_consensus')) {
        add(observation, 'realtime_disagreement_missing_marker', 'Realtime disagreement lacks its marker');
      }
    }
    if (!tapeLive) {
      if (isPossible(decision.state)) add(observation, 'non_live_tape_not_downgraded', 'Non-live tape produced a possible direction');
      if (!decision.missingConfirmations.includes('realtime_tape')) add(observation, 'non_live_tape_missing_marker', 'Non-live tape lacks its marker');
    }
    if (!bookLive) {
      if (isPossible(decision.state)) add(observation, 'non_live_order_book_not_downgraded', 'Non-live order book produced a possible direction');
      if (!decision.missingConfirmations.includes('realtime_order_book')) add(observation, 'non_live_order_book_missing_marker', 'Non-live order book lacks its marker');
    }

    if (isPossible(decision.state)) {
      const expectedStateDirection = decision.state === 'possible_long' ? 'long' : 'short';
      if (decision.state === 'possible_long') possibleLong++; else possibleShort++;
      if (!tapeLive || !bookLive) possibleWithSourceLoss++;
      if (decision.direction !== expectedStateDirection) add(observation, 'possible_state_direction_mismatch', 'Possible state and direction disagree');
      if (!decision.level || !decision.scenario) {
        add(observation, 'possible_without_level_or_scenario', 'Possible direction lacks a level or scenario');
      }
      if (decision.causalStage !== 'CONFIRMATION') add(observation, 'possible_wrong_causal_stage', 'Possible direction is not in CONFIRMATION');
      if (evidence.availability !== 'complete' || !tapeLive || !bookLive) {
        add(observation, 'possible_without_complete_live_realtime', 'Possible direction lacks complete live realtime sources');
      }
      if (decision.level && decision.scenario) {
        possibleLineIds.add(decision.level.lineId);
        const expected = expectedDirection(decision.level.kind, decision.scenario);
        if (expected !== decision.direction) add(observation, 'possible_level_scenario_direction_mismatch', 'Level, scenario and direction do not match');
        if (decision.level.kind === 'resistance' && decision.scenario === 'breakout' && decision.direction === 'long') resistanceBreakoutLong++;
        if (decision.level.kind === 'resistance' && decision.scenario === 'bounce' && decision.direction === 'short') resistanceBounceShort++;
        if (decision.level.kind === 'support' && decision.scenario === 'breakout' && decision.direction === 'short') supportBreakoutShort++;
        if (decision.level.kind === 'support' && decision.scenario === 'bounce' && decision.direction === 'long') supportBounceLong++;
        const requiredEvidence = decision.scenario === 'breakout' ? 'supports' : 'opposes';
        if (decision.level.tapeState !== requiredEvidence || decision.level.orderBookState !== requiredEvidence) {
          add(observation, 'possible_without_evidence_consensus', 'Possible direction lacks matching source consensus');
        }
        const reason = decision.scenario === 'breakout'
          ? 'realtime_sources_support_breakout'
          : 'realtime_sources_support_bounce';
        if (!decision.reasons.includes(reason)) add(observation, 'possible_without_matching_reason', 'Possible direction lacks its scenario reason');
      }
    }

    const btcActive = ['ready', 'degraded'].includes(decision.marketContext.btc.availability);
    const impulseActive = ['ready', 'degraded'].includes(decision.marketContext.impulse.availability);
    if (!btcActive) staleBtc++;
    if (!impulseActive) staleImpulse++;
    if (decision.direction !== null) {
      if (!btcActive) {
        directionalUnavailableMarket++;
        if (!decision.missingConfirmations.includes('btc_market_mode')) add(observation, 'unavailable_market_context_missing_marker', 'Inactive BTC context lacks its marker');
      }
      if (!impulseActive) {
        directionalUnavailableMarket++;
        if (!decision.missingConfirmations.includes('symbol_market_impulse')) add(observation, 'unavailable_market_context_missing_marker', 'Inactive impulse context lacks its marker');
      }
      const conflicts = [decision.marketContext.btc.alignment, decision.marketContext.impulse.alignment]
        .filter((alignment) => alignment === 'opposed').length;
      if (conflicts === 1) {
        singleConflict++;
        if (decision.state !== 'wait_confirmation') add(observation, 'market_context_conflict_not_downgraded', 'Single conflict was not downgraded to wait_confirmation');
        if (!decision.reasons.includes('market_context_conflict') || !decision.invalidations.includes('market_context_reversal')) {
          add(observation, 'market_context_conflict_missing_contract', 'Single conflict lacks reason or invalidation');
        }
      }
      if (conflicts === 2) {
        doubleConflict++;
        if (decision.state !== 'skip') add(observation, 'market_context_conflict_not_downgraded', 'Double conflict was not downgraded to skip');
        if (!decision.reasons.includes('market_context_double_conflict') || !decision.invalidations.includes('market_context_reversal')) {
          add(observation, 'market_context_conflict_missing_contract', 'Double conflict lacks reason or invalidation');
        }
      }
    }

    setupSnapshots += observation.setups.candidates.length;
    for (const setup of observation.setups.candidates) {
      setupIds.add(setup.id);
      increment(setupStageCounts, setup.stage);
      increment(setupOutcomeCounts, setup.outcome ?? 'none');
    }
    if (decision.setup) activeDecisionSetups++;
    const currentTerminal = observation.setups.candidates.filter((setup) => (
      isTerminalSetup(setup)
      && Number.isFinite(Date.parse(setup.expiresAt))
      && Date.parse(setup.expiresAt) >= generatedAt
    ));
    if (currentTerminal.length > 0) {
      terminalCandidateObservations++;
      if (decision.state !== 'setup_confirmed') add(observation, 'current_terminal_outcome_not_confirmed', 'Current terminal Setup outcome was not confirmed');
    }
    if (decision.state === 'setup_confirmed') {
      setupConfirmed++;
      const captured = decision.setup
        ? observation.setups.candidates.find((setup) => setup.id === decision.setup?.candidateId)
        : undefined;
      if (!captured) add(observation, 'setup_confirmed_without_captured_candidate', 'Confirmed Setup is absent from captured candidates');
      if (!captured || !isTerminalSetup(captured)) add(observation, 'setup_confirmed_without_terminal_outcome', 'setup_confirmed lacks a terminal outcome');
      if (captured) {
        if (!captured.causal?.lineId || captured.causal.lineId !== decision.level?.lineId) {
          add(observation, 'setup_confirmed_causal_line_mismatch', 'Confirmed Setup does not preserve the causal line');
        } else {
          causalLinkValidated++;
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
    ) add(observation, 'safety_contract_changed', 'Observation or decision safety contract changed');
  }

  const transitions: UnifiedDecisionLiveCohortTransition[] = [];
  let lineTransitionCount = 0;
  let directPossibleFlipCount = 0;
  for (const symbol of Object.keys(symbolCounts)) {
    const items = ordered.filter((observation) => observation.symbol === symbol);
    for (let index = 1; index < items.length; index++) {
      const previous = items[index - 1];
      const current = items[index];
      if (!previous || !current) continue;
      const fromLineId = previous.decision.level?.lineId ?? null;
      const toLineId = current.decision.level?.lineId ?? null;
      if (fromLineId !== toLineId) lineTransitionCount++;
      if (previous.decision.state === current.decision.state) continue;
      if (isPossible(previous.decision.state) && isPossible(current.decision.state)) directPossibleFlipCount++;
      transitions.push(Object.freeze({
        symbol,
        fromSequence: previous.sequence,
        toSequence: current.sequence,
        observedAt: current.recordedAt,
        fromState: previous.decision.state,
        toState: current.decision.state,
        fromLineId,
        toLineId,
      }));
    }
  }

  const possibleViolations = countViolations(violations, POSSIBLE_CODES);
  const realtimeViolations = countViolations(violations, REALTIME_CODES);
  const marketFreshnessViolations = countViolations(violations, MARKET_FRESHNESS_CODES);
  const marketConflictViolations = countViolations(violations, MARKET_CONFLICT_CODES);
  const setupViolations = countViolations(violations, SETUP_CODES);
  const symmetryMinimum = Math.min(
    resistanceBreakoutLong,
    resistanceBounceShort,
    supportBreakoutShort,
    supportBounceLong,
  );
  const possibleCount = possibleLong + possibleShort;
  const symmetryStatus: UnifiedDecisionLiveCohortCoverageStatus = possibleCount === 0
    ? 'not_observed'
    : symmetryMinimum >= applied.minimumSymmetryCellCount && possibleViolations === 0
      ? 'validated'
      : 'insufficient';
  const sourceLossCount = nonLiveTape + nonLiveBook;
  const realtimeStatus: UnifiedDecisionLiveCohortCoverageStatus = sourceLossCount === 0 && disagreements === 0
    ? 'not_observed'
    : sourceLossCount >= applied.minimumRealtimeLossCount
      && disagreements >= applied.minimumDisagreementCount
      && realtimeViolations === 0
        ? 'validated'
        : 'insufficient';
  const marketFreshnessStatus = coverageStatus(
    directionalUnavailableMarket,
    1,
    marketFreshnessViolations,
  );
  const marketConflictStatus = coverageStatus(
    singleConflict + doubleConflict,
    1,
    marketConflictViolations,
  );
  const setupStatus = coverageStatus(setupConfirmed, 1, setupViolations);
  const gaps: UnifiedDecisionLiveCohortCoverageGap[] = [];
  if (marketConflictStatus === 'not_observed') gaps.push(Object.freeze({
    code: 'market_context_conflict_not_observed',
    message: 'No directional observation contained opposed BTC or symbol-impulse alignment',
  }));
  if (setupStatus === 'not_observed') gaps.push(Object.freeze({
    code: 'terminal_setup_outcome_not_observed',
    message: 'No current terminal Setup outcome or setup_confirmed decision was observed',
  }));

  const violationCounts = emptyCounts(VIOLATION_CODES) as Record<UnifiedDecisionLiveCohortViolationCode, number>;
  for (const violation of violations) violationCounts[violation.code]++;
  const first = ordered[0];
  const last = ordered.at(-1);
  if (!first || !last) fail('Live cohort contains no ordered observations');

  return Object.freeze({
    version: UNIFIED_DECISION_LIVE_COHORT_VALIDATION_VERSION,
    generatedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    status: reportStatus(
      ordered.length,
      applied.minimumObservationCount,
      symmetryStatus,
      realtimeStatus,
      violations.length,
      gaps.length,
    ),
    source: Object.freeze({
      datasetVersion: source.datasetVersion,
      persistenceSchema: source.persistenceSchema,
      persistenceVersion: source.persistenceVersion,
      sourceSavedAt: source.sourceSavedAt,
    }),
    appliedOptions: applied,
    coverage: Object.freeze({
      observationCount: ordered.length,
      firstSequence: first.sequence,
      lastSequence: last.sequence,
      firstRecordedAt: first.recordedAt,
      lastRecordedAt: last.recordedAt,
      symbolCounts: Object.freeze({ ...symbolCounts }),
      stateCounts: Object.freeze(stateCounts) as Readonly<Record<UnifiedDecisionState, number>>,
      uniqueDecisionLineCount: lineIds.size,
      transitionCount: transitions.length,
      lineTransitionCount,
      directPossibleFlipCount,
      symmetry: Object.freeze({
        status: symmetryStatus,
        possibleObservationCount: possibleCount,
        possibleLongCount: possibleLong,
        possibleShortCount: possibleShort,
        resistanceBreakoutLongCount: resistanceBreakoutLong,
        resistanceBounceShortCount: resistanceBounceShort,
        supportBreakoutShortCount: supportBreakoutShort,
        supportBounceLongCount: supportBounceLong,
        uniquePossibleLineCount: possibleLineIds.size,
        mappingViolationCount: possibleViolations,
      }),
      realtime: Object.freeze({
        status: realtimeStatus,
        availabilityCounts: Object.freeze({ ...availabilityCounts }),
        tapeSourceStateCounts: Object.freeze({ ...tapeStateCounts }),
        orderBookSourceStateCounts: Object.freeze({ ...bookStateCounts }),
        nonLiveTapeObservationCount: nonLiveTape,
        nonLiveOrderBookObservationCount: nonLiveBook,
        disagreementObservationCount: disagreements,
        partialObservationCount: partial,
        possibleWithSourceLossCount: possibleWithSourceLoss,
        downgradeViolationCount: realtimeViolations,
      }),
      marketContext: Object.freeze({
        freshnessStatus: marketFreshnessStatus,
        conflictStatus: marketConflictStatus,
        btcAvailabilityCounts: Object.freeze({ ...btcAvailabilityCounts }),
        impulseAvailabilityCounts: Object.freeze({ ...impulseAvailabilityCounts }),
        btcAlignmentCounts: Object.freeze({ ...btcAlignmentCounts }),
        impulseAlignmentCounts: Object.freeze({ ...impulseAlignmentCounts }),
        staleOrUnavailableBtcObservationCount: staleBtc,
        staleOrUnavailableImpulseObservationCount: staleImpulse,
        directionalUnavailableMarketCount: directionalUnavailableMarket,
        singleConflictObservationCount: singleConflict,
        doubleConflictObservationCount: doubleConflict,
        freshnessViolationCount: marketFreshnessViolations,
        conflictViolationCount: marketConflictViolations,
      }),
      setup: Object.freeze({
        terminalOutcomeStatus: setupStatus,
        setupCandidateSnapshotCount: setupSnapshots,
        uniqueSetupCandidateCount: setupIds.size,
        activeDecisionSetupCount: activeDecisionSetups,
        terminalCandidateObservationCount: terminalCandidateObservations,
        setupConfirmedObservationCount: setupConfirmed,
        causalLinkValidatedObservationCount: causalLinkValidated,
        stageCounts: Object.freeze({ ...setupStageCounts }),
        outcomeCounts: Object.freeze({ ...setupOutcomeCounts }),
        violationCount: setupViolations,
      }),
    }),
    transitions: Object.freeze(transitions),
    coverageGaps: Object.freeze(gaps),
    violationCounts: Object.freeze(violationCounts),
    violations: Object.freeze(violations),
    decisionRulesChangeRecommended: false,
    thresholdsChanged: false,
    rankingChanged: false,
    setupLifecycleChanged: false,
    createsTradeOrder: false,
    createsSignal: false,
    createsScore: false,
    appliesLearning: false,
    estimatesProfitability: false,
  });
}
