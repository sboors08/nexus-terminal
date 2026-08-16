import type {
  SetupCausalStage,
} from '../setup-engine/causal-setup-adapter.types.js';
import type {
  SetupEngineStage,
  SetupEngineState,
} from '../setup-engine/setup-engine.types.js';
import {
  readUnifiedDecisionLiveCohortSource,
} from './unified-decision-live-cohort-validation.js';
import type {
  UnifiedDecisionLiveObservation,
} from './unified-decision-live-observation.types.js';
import {
  UNIFIED_DECISION_SETUP_LIFECYCLE_REACHABILITY_DIAGNOSTICS_VERSION,
  type UnifiedDecisionSetupLifecycleReachabilityAppliedOptions,
  type UnifiedDecisionSetupLifecycleReachabilityAssessment,
  type UnifiedDecisionSetupLifecycleReachabilityCandidateSummary,
  type UnifiedDecisionSetupLifecycleReachabilityCausalTransition,
  type UnifiedDecisionSetupLifecycleReachabilityCutoffCode,
  type UnifiedDecisionSetupLifecycleReachabilityDiagnosis,
  type UnifiedDecisionSetupLifecycleReachabilityNextAction,
  type UnifiedDecisionSetupLifecycleReachabilityOptions,
  type UnifiedDecisionSetupLifecycleReachabilityPathNode,
  type UnifiedDecisionSetupLifecycleReachabilityReport,
  type UnifiedDecisionSetupLifecycleReachabilityReportStatus,
  type UnifiedDecisionSetupLifecycleReachabilityStageTransition,
  type UnifiedDecisionSetupLifecycleReachabilityViolation,
  type UnifiedDecisionSetupLifecycleReachabilityViolationCode,
} from './unified-decision-setup-lifecycle-reachability-diagnostics.types.js';

const SETUP_STAGES = [
  'LEVEL_CONFIRMED',
  'APPROACHING_THIRD_TOUCH',
  'THIRD_TOUCH_CONFIRMED',
  'BREAKOUT_CONFIRMED',
  'REJECTION_CONFIRMED',
  'SETUP_EXPIRED',
] as const satisfies readonly SetupEngineStage[];

const CAUSAL_STAGES = [
  'LEVEL_CONFIRMED',
  'OBSERVATION',
  'APPROACH',
  'CONFIRMATION',
] as const satisfies readonly SetupCausalStage[];

const VIOLATION_CODES = [
  'invalid_candidate_timestamp',
  'candidate_timestamp_after_observation',
  'candidate_identity_changed',
  'candidate_stage_regressed',
  'causal_timestamp_after_observation',
  'causal_line_identity_changed',
  'causal_stage_regressed',
  'causal_stage_ahead_of_runtime_stage',
  'runtime_stage_without_causal_evidence',
  'safety_contract_changed',
] as const satisfies readonly UnifiedDecisionSetupLifecycleReachabilityViolationCode[];

const TERMINAL_STAGES = new Set<SetupEngineStage>([
  'BREAKOUT_CONFIRMED',
  'REJECTION_CONFIRMED',
  'SETUP_EXPIRED',
]);

interface PathMetric {
  readonly observations: Set<number>;
  readonly candidates: Set<string>;
  occurrenceCount: number;
}

interface CandidateTrail {
  readonly id: string;
  readonly symbol: string;
  readonly timeframe: string;
  readonly setupType: string;
  readonly direction: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly causalLineId: string | null;
  readonly firstSequence: number;
  readonly firstRecordedAtMs: number;
  readonly firstSeenBeforeExpiry: boolean;
  lastStage: SetupEngineStage;
  lastCausalStage: SetupCausalStage | null;
}

interface DiagnosticsMetrics {
  readonly sourceAvailable: PathMetric;
  readonly candidates: PathMetric;
  readonly firstSeenCurrent: PathMetric;
  readonly causalObservation: PathMetric;
  readonly causalApproach: PathMetric;
  readonly setupApproaching: PathMetric;
  readonly causalConfirmation: PathMetric;
  readonly setupThirdTouch: PathMetric;
  readonly terminalOutcome: PathMetric;
}

export class UnifiedDecisionSetupLifecycleReachabilityDiagnosticsError
extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      'UnifiedDecisionSetupLifecycleReachabilityDiagnosticsError';
  }
}

export interface UnifiedDecisionSetupLifecycleReachabilityDependencies {
  readonly now?: () => Date;
}

function fail(message: string): never {
  throw new UnifiedDecisionSetupLifecycleReachabilityDiagnosticsError(message);
}

function positive(
  value: number | undefined,
  fallback: number,
  field: string,
): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result <= 0) {
    fail(`${field} must be a positive integer`);
  }
  return result;
}

function optionalPositive(
  value: number | undefined,
  field: string,
): number | null {
  return value === undefined
    ? null
    : positive(value, value, field);
}

function applyOptions(
  options: UnifiedDecisionSetupLifecycleReachabilityOptions,
): UnifiedDecisionSetupLifecycleReachabilityAppliedOptions {
  const startSequence = optionalPositive(
    options.startSequence,
    'startSequence',
  );
  const endSequence = optionalPositive(
    options.endSequence,
    'endSequence',
  );
  if (
    startSequence !== null
    && endSequence !== null
    && startSequence > endSequence
  ) {
    fail('startSequence must not be greater than endSequence');
  }
  return Object.freeze({
    startSequence,
    endSequence,
    minimumObservationCount: positive(
      options.minimumObservationCount,
      500,
      'minimumObservationCount',
    ),
  });
}

function metric(): PathMetric {
  return {
    observations: new Set<number>(),
    candidates: new Set<string>(),
    occurrenceCount: 0,
  };
}

function metrics(): DiagnosticsMetrics {
  return {
    sourceAvailable: metric(),
    candidates: metric(),
    firstSeenCurrent: metric(),
    causalObservation: metric(),
    causalApproach: metric(),
    setupApproaching: metric(),
    causalConfirmation: metric(),
    setupThirdTouch: metric(),
    terminalOutcome: metric(),
  };
}

function record(
  target: PathMetric,
  observation: UnifiedDecisionLiveObservation,
  candidateId: string,
): void {
  target.observations.add(observation.sequence);
  target.candidates.add(candidateId);
  target.occurrenceCount += 1;
}

function node(
  code: UnifiedDecisionSetupLifecycleReachabilityPathNode['code'],
  source: PathMetric,
): UnifiedDecisionSetupLifecycleReachabilityPathNode {
  return Object.freeze({
    code,
    observationCount: source.observations.size,
    occurrenceCount: source.occurrenceCount,
    uniqueCandidateCount: source.candidates.size,
  });
}

function emptyCounts(
  values: readonly string[],
): Record<string, number> {
  return Object.fromEntries(
    values.map((value) => [value, 0]),
  );
}

function increment(
  counts: Record<string, number>,
  value: string,
): void {
  counts[value] = (counts[value] ?? 0) + 1;
}

function incrementMap(
  counts: Map<string, number>,
  value: string,
): void {
  counts.set(value, (counts.get(value) ?? 0) + 1);
}

function timestampValue(value: string): number {
  return Date.parse(value);
}

function setupStageRank(stage: SetupEngineStage): number {
  if (stage === 'LEVEL_CONFIRMED') return 0;
  if (stage === 'APPROACHING_THIRD_TOUCH') return 1;
  if (stage === 'THIRD_TOUCH_CONFIRMED') return 2;
  return 3;
}

function causalStageRank(stage: SetupCausalStage): number {
  return CAUSAL_STAGES.indexOf(stage);
}

function isTerminalOutcome(candidate: SetupEngineState): boolean {
  return (
    candidate.stage === 'BREAKOUT_CONFIRMED'
    && candidate.outcome === 'breakout'
    && candidate.setupType === 'level_breakout'
  ) || (
    candidate.stage === 'REJECTION_CONFIRMED'
    && candidate.outcome === 'rejection'
    && candidate.setupType === 'level_bounce'
  );
}

function safetyChanged(
  observation: UnifiedDecisionLiveObservation,
): boolean {
  const decision = observation.decision;
  return (
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
  );
}

function addViolation(
  violations: UnifiedDecisionSetupLifecycleReachabilityViolation[],
  observation: UnifiedDecisionLiveObservation,
  candidateId: string | null,
  code: UnifiedDecisionSetupLifecycleReachabilityViolationCode,
  message: string,
): void {
  violations.push(Object.freeze({
    code,
    sequence: observation.sequence,
    symbol: observation.symbol,
    candidateId,
    recordedAt: observation.recordedAt,
    message,
  }));
}

function sameIdentity(
  trail: CandidateTrail,
  candidate: SetupEngineState,
): boolean {
  return (
    trail.symbol === candidate.symbol
    && trail.timeframe === candidate.timeframe
    && trail.setupType === candidate.setupType
    && trail.direction === candidate.direction
    && trail.createdAt === candidate.createdAt
    && trail.expiresAt === candidate.expiresAt
  );
}

function setupTransitionKey(
  from: SetupEngineStage,
  to: SetupEngineStage,
): string {
  return `${from}->${to}`;
}

function causalTransitionKey(
  from: SetupCausalStage,
  to: SetupCausalStage,
): string {
  return `${from}->${to}`;
}

function summarizeSetupTransitions(
  counts: ReadonlyMap<string, number>,
): readonly UnifiedDecisionSetupLifecycleReachabilityStageTransition[] {
  return Object.freeze(
    [...counts.entries()]
      .map(([key, candidateCount]) => {
        const [from, to] = key.split('->') as [SetupEngineStage, SetupEngineStage];
        return Object.freeze({ from, to, candidateCount });
      })
      .sort((left, right) => (
        setupStageRank(left.from) - setupStageRank(right.from)
        || setupStageRank(left.to) - setupStageRank(right.to)
        || left.from.localeCompare(right.from)
        || left.to.localeCompare(right.to)
      )),
  );
}

function summarizeCausalTransitions(
  counts: ReadonlyMap<string, number>,
): readonly UnifiedDecisionSetupLifecycleReachabilityCausalTransition[] {
  return Object.freeze(
    [...counts.entries()]
      .map(([key, candidateCount]) => {
        const [from, to] = key.split('->') as [SetupCausalStage, SetupCausalStage];
        return Object.freeze({ from, to, candidateCount });
      })
      .sort((left, right) => (
        causalStageRank(left.from) - causalStageRank(right.from)
        || causalStageRank(left.to) - causalStageRank(right.to)
      )),
  );
}

function buildAssessment(
  input: {
    readonly path: DiagnosticsMetrics;
    readonly violations: readonly UnifiedDecisionSetupLifecycleReachabilityViolation[];
    readonly uniqueCandidateCount: number;
    readonly firstSeenCurrentCount: number;
  },
): UnifiedDecisionSetupLifecycleReachabilityAssessment {
  let diagnosis: UnifiedDecisionSetupLifecycleReachabilityDiagnosis;
  let cutoff: UnifiedDecisionSetupLifecycleReachabilityCutoffCode;
  let message: string;

  const transitionMismatch = input.violations.some((violation) => (
    violation.code === 'causal_stage_ahead_of_runtime_stage'
    || violation.code === 'runtime_stage_without_causal_evidence'
  ));

  if (input.violations.length > 0) {
    diagnosis = transitionMismatch
      ? 'runtime_transition_wiring_mismatch'
      : 'contract_violation';
    cutoff = 'contract_violation';
    message = `${input.violations.length} lifecycle contract violation(s) require inspection`;
  } else if (input.path.sourceAvailable.observations.size === 0) {
    diagnosis = 'source_unavailable';
    cutoff = 'setup_source_not_available';
    message = 'The Setup source was never available in the selected observations';
  } else if (input.uniqueCandidateCount === 0) {
    diagnosis = 'candidate_generation_not_observed';
    cutoff = 'setup_candidate_not_captured';
    message = 'The available Setup source did not expose any candidate snapshot';
  } else if (input.firstSeenCurrentCount === 0) {
    diagnosis = 'retention_currentness_mismatch';
    cutoff = 'candidate_first_seen_after_expiry';
    message = 'Every unique candidate first appeared at or after expiresAt, so retained terminal snapshots cannot prove live-stage reachability';
  } else if (input.path.causalObservation.candidates.size === 0) {
    diagnosis = 'candidate_generation_not_observed';
    cutoff = 'causal_observation_not_captured';
    message = 'Candidates were current, but no Level Lines causal observation context was captured';
  } else if (input.path.causalApproach.candidates.size === 0) {
    diagnosis = 'market_approach_not_observed';
    cutoff = 'causal_approach_not_observed';
    message = 'Current causal candidates never reached the production Approach boundary';
  } else if (input.path.setupApproaching.candidates.size === 0) {
    diagnosis = 'retention_currentness_mismatch';
    cutoff = 'runtime_approach_stage_not_captured';
    message = 'Causal Approach evidence exists, but the retained snapshots do not expose the corresponding live runtime stage; a short targeted capture is required before calling this a wiring defect';
  } else if (input.path.causalConfirmation.candidates.size === 0) {
    diagnosis = 'realtime_confirmation_not_observed';
    cutoff = 'causal_confirmation_not_observed';
    message = 'The runtime reached Approach, but causal realtime Confirmation was not observed';
  } else if (input.path.setupThirdTouch.candidates.size === 0) {
    diagnosis = 'retention_currentness_mismatch';
    cutoff = 'runtime_third_touch_stage_not_captured';
    message = 'Causal Confirmation exists, but the retained snapshots do not expose the corresponding third-touch-or-later runtime stage; a short targeted capture is required before calling this a wiring defect';
  } else if (input.path.terminalOutcome.candidates.size === 0) {
    diagnosis = 'terminal_outcome_not_observed';
    cutoff = 'terminal_outcome_not_observed';
    message = 'Third touch was reached, but no breakout/rejection terminal outcome was observed';
  } else {
    diagnosis = 'fully_reached';
    cutoff = 'none';
    message = 'At least one candidate reached the full captured Setup lifecycle path';
  }

  return Object.freeze({
    diagnosis,
    cutoff,
    message,
    path: Object.freeze([
      node('setup_source_available', input.path.sourceAvailable),
      node('candidate_snapshot_captured', input.path.candidates),
      node('candidate_first_seen_current', input.path.firstSeenCurrent),
      node('causal_observation_captured', input.path.causalObservation),
      node('causal_approach_captured', input.path.causalApproach),
      node('setup_approaching_captured', input.path.setupApproaching),
      node('causal_confirmation_captured', input.path.causalConfirmation),
      node('setup_third_touch_captured', input.path.setupThirdTouch),
      node('setup_terminal_outcome_captured', input.path.terminalOutcome),
    ]),
  });
}

function nextAction(
  assessment: UnifiedDecisionSetupLifecycleReachabilityAssessment,
): UnifiedDecisionSetupLifecycleReachabilityNextAction {
  if (assessment.diagnosis === 'fully_reached') return 'none';
  if (assessment.diagnosis === 'source_unavailable') return 'inspect_setup_source_wiring';
  if (assessment.diagnosis === 'candidate_generation_not_observed') {
    return assessment.cutoff === 'causal_observation_not_captured'
      ? 'inspect_setup_source_wiring'
      : 'inspect_candidate_creation_timing';
  }
  if (assessment.diagnosis === 'retention_currentness_mismatch') {
    return assessment.cutoff === 'candidate_first_seen_after_expiry'
      ? 'inspect_candidate_creation_timing'
      : 'run_short_targeted_live_check';
  }
  if (assessment.diagnosis === 'market_approach_not_observed') {
    return 'inspect_causal_approach_reachability';
  }
  if (assessment.diagnosis === 'runtime_transition_wiring_mismatch') {
    return 'inspect_runtime_transition_wiring';
  }
  if (
    assessment.diagnosis === 'realtime_confirmation_not_observed'
    || assessment.diagnosis === 'terminal_outcome_not_observed'
  ) {
    return 'run_short_targeted_live_check';
  }
  return 'inspect_contract_invariants';
}

export function diagnoseUnifiedDecisionSetupLifecycleReachability(
  value: unknown,
  options: UnifiedDecisionSetupLifecycleReachabilityOptions = {},
  dependencies: UnifiedDecisionSetupLifecycleReachabilityDependencies = {},
): UnifiedDecisionSetupLifecycleReachabilityReport {
  const source = readUnifiedDecisionLiveCohortSource(value);
  const appliedOptions = applyOptions(options);
  const observations = [...source.observations]
    .filter((observation) => (
      (appliedOptions.startSequence === null
        || observation.sequence >= appliedOptions.startSequence)
      && (appliedOptions.endSequence === null
        || observation.sequence <= appliedOptions.endSequence)
    ))
    .sort((left, right) => left.sequence - right.sequence);

  if (observations.length === 0) {
    fail('Live cohort contains no selected observations');
  }

  const path = metrics();
  const violations: UnifiedDecisionSetupLifecycleReachabilityViolation[] = [];
  const symbolCounts: Record<string, number> = {};
  const sourceReadCounts: Record<string, number> = {};
  const setupStageCounts = emptyCounts(SETUP_STAGES) as Record<SetupEngineStage, number>;
  const causalStageCounts = emptyCounts(CAUSAL_STAGES) as Record<SetupCausalStage, number>;
  const uniqueSetupStages = new Map<SetupEngineStage, Set<string>>(
    SETUP_STAGES.map((stage) => [stage, new Set<string>()]),
  );
  const uniqueCausalStages = new Map<SetupCausalStage, Set<string>>(
    CAUSAL_STAGES.map((stage) => [stage, new Set<string>()]),
  );
  const setupTransitions = new Map<string, number>();
  const causalTransitions = new Map<string, number>();
  const trails = new Map<string, CandidateTrail>();
  const candidateObservations = new Set<number>();
  const retainedCandidateIds = new Set<string>();
  const firstWindowRecordedAt = timestampValue(observations[0]?.recordedAt ?? '');
  let candidateOccurrenceCount = 0;
  let firstSeenBeforeExpiryCount = 0;
  let firstSeenAtOrAfterExpiryCount = 0;
  let createdBeforeSelectedWindowCount = 0;
  let createdWithinSelectedWindowCount = 0;
  let currentOccurrenceCount = 0;
  let expiredOccurrenceCount = 0;
  let retainedExpiredOccurrenceCount = 0;
  let maximumRetentionAfterExpirySeconds = 0;

  for (const observation of observations) {
    increment(symbolCounts, observation.symbol);
    increment(sourceReadCounts, observation.setups.readState);
    if (observation.setups.readState === 'available') {
      record(path.sourceAvailable, observation, observation.symbol);
    }
    if (safetyChanged(observation)) {
      addViolation(
        violations,
        observation,
        null,
        'safety_contract_changed',
        'Observation or Unified Decision safety contract changed',
      );
    }

    const recordedAtMs = timestampValue(observation.recordedAt);
    if (!Number.isFinite(recordedAtMs)) {
      fail(`Observation ${observation.sequence} has an invalid recordedAt`);
    }

    for (const candidate of observation.setups.candidates) {
      candidateOccurrenceCount += 1;
      candidateObservations.add(observation.sequence);
      record(path.candidates, observation, candidate.id);
      increment(setupStageCounts, candidate.stage);
      uniqueSetupStages.get(candidate.stage)?.add(candidate.id);

      const createdAtMs = timestampValue(candidate.createdAt);
      const updatedAtMs = timestampValue(candidate.updatedAt);
      const expiresAtMs = timestampValue(candidate.expiresAt);
      const validTimestamps = (
        Number.isFinite(createdAtMs)
        && Number.isFinite(updatedAtMs)
        && Number.isFinite(expiresAtMs)
        && createdAtMs <= updatedAtMs
        && createdAtMs < expiresAtMs
      );
      if (!validTimestamps) {
        addViolation(
          violations,
          observation,
          candidate.id,
          'invalid_candidate_timestamp',
          'Candidate createdAt/updatedAt/expiresAt ordering is invalid',
        );
      }
      if (validTimestamps && updatedAtMs > recordedAtMs) {
        addViolation(
          violations,
          observation,
          candidate.id,
          'candidate_timestamp_after_observation',
          'Candidate updatedAt is later than the containing observation',
        );
      }

      const existing = trails.get(candidate.id);
      if (!existing) {
        const firstSeenBeforeExpiry = validTimestamps && recordedAtMs < expiresAtMs;
        const causalLineId = candidate.causal?.lineId ?? null;
        trails.set(candidate.id, {
          id: candidate.id,
          symbol: candidate.symbol,
          timeframe: candidate.timeframe,
          setupType: candidate.setupType,
          direction: candidate.direction,
          createdAt: candidate.createdAt,
          expiresAt: candidate.expiresAt,
          causalLineId,
          firstSequence: observation.sequence,
          firstRecordedAtMs: recordedAtMs,
          firstSeenBeforeExpiry,
          lastStage: candidate.stage,
          lastCausalStage: candidate.causal?.stage ?? null,
        });
        if (firstSeenBeforeExpiry) {
          firstSeenBeforeExpiryCount += 1;
          record(path.firstSeenCurrent, observation, candidate.id);
        } else {
          firstSeenAtOrAfterExpiryCount += 1;
        }
        if (validTimestamps && createdAtMs < firstWindowRecordedAt) {
          createdBeforeSelectedWindowCount += 1;
        } else {
          createdWithinSelectedWindowCount += 1;
        }
      } else {
        if (!sameIdentity(existing, candidate)) {
          addViolation(
            violations,
            observation,
            candidate.id,
            'candidate_identity_changed',
            'Immutable candidate identity or lifetime changed across snapshots',
          );
        }
        const currentCausalLineId = candidate.causal?.lineId ?? null;
        if (
          existing.causalLineId !== null
          && currentCausalLineId !== null
          && existing.causalLineId !== currentCausalLineId
        ) {
          addViolation(
            violations,
            observation,
            candidate.id,
            'causal_line_identity_changed',
            'Candidate causal Level Line identity changed across snapshots',
          );
        }
        if (
          setupStageRank(candidate.stage) < setupStageRank(existing.lastStage)
          || (
            TERMINAL_STAGES.has(existing.lastStage)
            && candidate.stage !== existing.lastStage
          )
        ) {
          addViolation(
            violations,
            observation,
            candidate.id,
            'candidate_stage_regressed',
            `Candidate stage regressed from ${existing.lastStage} to ${candidate.stage}`,
          );
        } else if (candidate.stage !== existing.lastStage) {
          incrementMap(
            setupTransitions,
            setupTransitionKey(existing.lastStage, candidate.stage),
          );
        }

        const currentCausalStage = candidate.causal?.stage ?? null;
        if (
          existing.lastCausalStage !== null
          && currentCausalStage !== null
          && causalStageRank(currentCausalStage) < causalStageRank(existing.lastCausalStage)
        ) {
          addViolation(
            violations,
            observation,
            candidate.id,
            'causal_stage_regressed',
            `Causal stage regressed from ${existing.lastCausalStage} to ${currentCausalStage}`,
          );
        } else if (
          existing.lastCausalStage !== null
          && currentCausalStage !== null
          && currentCausalStage !== existing.lastCausalStage
        ) {
          incrementMap(
            causalTransitions,
            causalTransitionKey(existing.lastCausalStage, currentCausalStage),
          );
        }
        existing.lastStage = candidate.stage;
        existing.lastCausalStage = currentCausalStage;
      }

      const current = validTimestamps && recordedAtMs < expiresAtMs;
      if (current) currentOccurrenceCount += 1;
      else expiredOccurrenceCount += 1;
      if (validTimestamps && recordedAtMs >= expiresAtMs) {
        retainedExpiredOccurrenceCount += 1;
        retainedCandidateIds.add(candidate.id);
        maximumRetentionAfterExpirySeconds = Math.max(
          maximumRetentionAfterExpirySeconds,
          Math.floor((recordedAtMs - expiresAtMs) / 1_000),
        );
      }

      const causal = candidate.causal;
      if (causal) {
        increment(causalStageCounts, causal.stage);
        uniqueCausalStages.get(causal.stage)?.add(candidate.id);
        const causalObservedAtMs = timestampValue(causal.observedAt);
        if (!Number.isFinite(causalObservedAtMs) || causalObservedAtMs > recordedAtMs) {
          addViolation(
            violations,
            observation,
            candidate.id,
            'causal_timestamp_after_observation',
            'Causal observedAt is invalid or later than the containing observation',
          );
        }
        if (causalStageRank(causal.stage) >= causalStageRank('OBSERVATION')) {
          record(path.causalObservation, observation, candidate.id);
        }
        if (causalStageRank(causal.stage) >= causalStageRank('APPROACH')) {
          record(path.causalApproach, observation, candidate.id);
        }
        if (causalStageRank(causal.stage) >= causalStageRank('CONFIRMATION')) {
          record(path.causalConfirmation, observation, candidate.id);
        }

        if (candidate.stage !== 'SETUP_EXPIRED') {
          if (
            causalStageRank(causal.stage) >= causalStageRank('APPROACH')
            && setupStageRank(candidate.stage) < setupStageRank('APPROACHING_THIRD_TOUCH')
          ) {
            addViolation(
              violations,
              observation,
              candidate.id,
              'causal_stage_ahead_of_runtime_stage',
              'Causal Approach evidence is ahead of the non-terminal runtime stage',
            );
          }
          if (
            causalStageRank(causal.stage) >= causalStageRank('CONFIRMATION')
            && setupStageRank(candidate.stage) < setupStageRank('THIRD_TOUCH_CONFIRMED')
          ) {
            addViolation(
              violations,
              observation,
              candidate.id,
              'causal_stage_ahead_of_runtime_stage',
              'Causal Confirmation evidence is ahead of the non-terminal runtime stage',
            );
          }
          if (
            candidate.stage === 'APPROACHING_THIRD_TOUCH'
            && causalStageRank(causal.stage) < causalStageRank('APPROACH')
          ) {
            addViolation(
              violations,
              observation,
              candidate.id,
              'runtime_stage_without_causal_evidence',
              'Runtime Approach stage lacks causal Approach evidence',
            );
          }
          if (
            setupStageRank(candidate.stage) >= setupStageRank('THIRD_TOUCH_CONFIRMED')
            && causalStageRank(causal.stage) < causalStageRank('CONFIRMATION')
          ) {
            addViolation(
              violations,
              observation,
              candidate.id,
              'runtime_stage_without_causal_evidence',
              'Runtime third-touch-or-later stage lacks causal Confirmation evidence',
            );
          }
        }
      }

      if (
        candidate.stage === 'APPROACHING_THIRD_TOUCH'
        || candidate.stage === 'THIRD_TOUCH_CONFIRMED'
        || candidate.stage === 'BREAKOUT_CONFIRMED'
        || candidate.stage === 'REJECTION_CONFIRMED'
      ) {
        record(path.setupApproaching, observation, candidate.id);
      }
      if (
        candidate.stage === 'THIRD_TOUCH_CONFIRMED'
        || candidate.stage === 'BREAKOUT_CONFIRMED'
        || candidate.stage === 'REJECTION_CONFIRMED'
      ) {
        record(path.setupThirdTouch, observation, candidate.id);
      }
      if (isTerminalOutcome(candidate)) {
        record(path.terminalOutcome, observation, candidate.id);
      }
    }
  }

  const assessment = buildAssessment({
    path,
    violations,
    uniqueCandidateCount: trails.size,
    firstSeenCurrentCount: firstSeenBeforeExpiryCount,
  });
  const action = nextAction(assessment);
  const candidateSummary: UnifiedDecisionSetupLifecycleReachabilityCandidateSummary =
    Object.freeze({
      candidateObservationCount: candidateObservations.size,
      candidateOccurrenceCount,
      uniqueCandidateCount: trails.size,
      firstSeenBeforeExpiryCount,
      firstSeenAtOrAfterExpiryCount,
      createdBeforeSelectedWindowCount,
      createdWithinSelectedWindowCount,
      currentOccurrenceCount,
      expiredOccurrenceCount,
      retainedExpiredOccurrenceCount,
      uniqueRetainedExpiredCandidateCount: retainedCandidateIds.size,
      maximumRetentionAfterExpirySeconds,
      setupStageOccurrenceCounts: Object.freeze(setupStageCounts),
      uniqueCandidateStageCounts: Object.freeze(
        Object.fromEntries(
          SETUP_STAGES.map((stage) => [stage, uniqueSetupStages.get(stage)?.size ?? 0]),
        ) as Record<SetupEngineStage, number>,
      ),
      causalStageOccurrenceCounts: Object.freeze(causalStageCounts),
      uniqueCandidateCausalStageCounts: Object.freeze(
        Object.fromEntries(
          CAUSAL_STAGES.map((stage) => [stage, uniqueCausalStages.get(stage)?.size ?? 0]),
        ) as Record<SetupCausalStage, number>,
      ),
      setupStageTransitions: summarizeSetupTransitions(setupTransitions),
      causalStageTransitions: summarizeCausalTransitions(causalTransitions),
    });

  const violationCounts = emptyCounts(
    VIOLATION_CODES,
  ) as Record<UnifiedDecisionSetupLifecycleReachabilityViolationCode, number>;
  for (const violation of violations) increment(violationCounts, violation.code);

  let status: UnifiedDecisionSetupLifecycleReachabilityReportStatus;
  if (violations.length > 0) status = 'contract_violations_found';
  else if (observations.length < appliedOptions.minimumObservationCount) {
    status = 'insufficient_observations';
  } else if (assessment.cutoff !== 'none') {
    status = 'diagnosed_with_unreached_stages';
  } else status = 'diagnosed';

  const generatedAt = (dependencies.now ?? (() => new Date()))();
  if (!(generatedAt instanceof Date) || Number.isNaN(generatedAt.getTime())) {
    fail('now must return a valid Date');
  }

  return Object.freeze({
    version: UNIFIED_DECISION_SETUP_LIFECYCLE_REACHABILITY_DIAGNOSTICS_VERSION,
    generatedAt: generatedAt.toISOString(),
    status,
    source: Object.freeze({
      datasetVersion: source.datasetVersion,
      persistenceSchema: source.persistenceSchema,
      persistenceVersion: source.persistenceVersion,
      sourceSavedAt: source.sourceSavedAt,
    }),
    appliedOptions,
    observationCount: observations.length,
    firstSequence: observations[0]?.sequence ?? null,
    lastSequence: observations.at(-1)?.sequence ?? null,
    firstRecordedAt: observations[0]?.recordedAt ?? null,
    lastRecordedAt: observations.at(-1)?.recordedAt ?? null,
    symbolCounts: Object.freeze(symbolCounts),
    setupSourceReadStateCounts: Object.freeze(sourceReadCounts),
    setupSourceAvailableObservationCount: path.sourceAvailable.observations.size,
    candidates: candidateSummary,
    assessment,
    violationCounts: Object.freeze(violationCounts),
    violations: Object.freeze(violations),
    nextAction: action,
    targetedLiveCheckRecommended: action === 'run_short_targeted_live_check',
    diagnosticOnly: true,
    decisionRulesChangeRecommended: false,
    thresholdsChanged: false,
    rankingChanged: false,
    setupLifecycleChanged: false,
    createsTradeOrder: false,
    createsSignal: false,
    createsScore: false,
    usesFutureData: false,
  });
}
