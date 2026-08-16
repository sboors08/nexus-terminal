import type {
  SetupEngineState,
  SetupEngineStage,
} from '../setup-engine/setup-engine.types.js';
import {
  readUnifiedDecisionLiveCohortSource,
} from './unified-decision-live-cohort-validation.js';
import type {
  UnifiedDecisionLiveObservation,
} from './unified-decision-live-observation.types.js';
import {
  UNIFIED_DECISION_COVERAGE_GAP_REACHABILITY_DIAGNOSTICS_VERSION,
  type UnifiedDecisionCoverageGapReachabilityAppliedOptions,
  type UnifiedDecisionCoverageGapReachabilityAssessment,
  type UnifiedDecisionCoverageGapReachabilityCutoffCode,
  type UnifiedDecisionCoverageGapReachabilityMarketSummary,
  type UnifiedDecisionCoverageGapReachabilityNextAction,
  type UnifiedDecisionCoverageGapReachabilityNode,
  type UnifiedDecisionCoverageGapReachabilityNodeCode,
  type UnifiedDecisionCoverageGapReachabilityOptions,
  type UnifiedDecisionCoverageGapReachabilityReport,
  type UnifiedDecisionCoverageGapReachabilityReportStatus,
  type UnifiedDecisionCoverageGapReachabilitySetupSummary,
  type UnifiedDecisionCoverageGapReachabilityStatus,
  type UnifiedDecisionCoverageGapReachabilityViolation,
  type UnifiedDecisionCoverageGapReachabilityViolationCode,
} from './unified-decision-coverage-gap-reachability-diagnostics.types.js';
import type {
  UnifiedDecisionMarketAlignment,
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

const SETUP_STAGES = [
  'LEVEL_CONFIRMED',
  'APPROACHING_THIRD_TOUCH',
  'THIRD_TOUCH_CONFIRMED',
  'BREAKOUT_CONFIRMED',
  'REJECTION_CONFIRMED',
  'SETUP_EXPIRED',
] as const satisfies readonly SetupEngineStage[];

const ALIGNMENTS = [
  'aligned',
  'opposed',
  'neutral',
  'unavailable',
] as const satisfies readonly UnifiedDecisionMarketAlignment[];

const VIOLATION_CODES = [
  'observation_identity_mismatch',
  'market_context_capture_mismatch',
  'btc_alignment_mismatch',
  'impulse_alignment_mismatch',
  'single_conflict_not_downgraded',
  'single_conflict_contract_mismatch',
  'double_conflict_not_skipped',
  'double_conflict_contract_mismatch',
  'setup_confirmed_without_current_terminal',
  'current_terminal_not_confirmed',
  'setup_confirmed_causal_line_mismatch',
  'safety_contract_changed',
] as const satisfies readonly UnifiedDecisionCoverageGapReachabilityViolationCode[];

const ACTIVE_MARKET_AVAILABILITY = new Set([
  'ready',
  'degraded',
]);

interface PathMetric {
  readonly observations: Set<number>;
  readonly entities: Set<string>;
  occurrenceCount: number;
}

interface ReachabilityMetrics {
  readonly directional: PathMetric;
  readonly marketRead: PathMetric;
  readonly btcComputable: PathMetric;
  readonly impulseComputable: PathMetric;
  readonly bothComputable: PathMetric;
  readonly btcOpposed: PathMetric;
  readonly impulseOpposed: PathMetric;
  readonly singleConflict: PathMetric;
  readonly doubleConflict: PathMetric;
  readonly setupSource: PathMetric;
  readonly setupCandidate: PathMetric;
  readonly setupApproaching: PathMetric;
  readonly setupThirdTouch: PathMetric;
  readonly setupTerminalCaptured: PathMetric;
  readonly setupTerminalCurrent: PathMetric;
  readonly setupConfirmed: PathMetric;
}

export class UnifiedDecisionCoverageGapReachabilityDiagnosticsError
extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      'UnifiedDecisionCoverageGapReachabilityDiagnosticsError';
  }
}

export interface UnifiedDecisionCoverageGapReachabilityDependencies {
  readonly now?: () => Date;
}

function fail(message: string): never {
  throw new UnifiedDecisionCoverageGapReachabilityDiagnosticsError(message);
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
  options: UnifiedDecisionCoverageGapReachabilityOptions,
): UnifiedDecisionCoverageGapReachabilityAppliedOptions {
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

function metric(): PathMetric {
  return {
    observations: new Set<number>(),
    entities: new Set<string>(),
    occurrenceCount: 0,
  };
}

function metrics(): ReachabilityMetrics {
  return {
    directional: metric(),
    marketRead: metric(),
    btcComputable: metric(),
    impulseComputable: metric(),
    bothComputable: metric(),
    btcOpposed: metric(),
    impulseOpposed: metric(),
    singleConflict: metric(),
    doubleConflict: metric(),
    setupSource: metric(),
    setupCandidate: metric(),
    setupApproaching: metric(),
    setupThirdTouch: metric(),
    setupTerminalCaptured: metric(),
    setupTerminalCurrent: metric(),
    setupConfirmed: metric(),
  };
}

function record(
  target: PathMetric,
  observation: UnifiedDecisionLiveObservation,
  entity: string,
): void {
  target.observations.add(observation.sequence);
  target.entities.add(entity);
  target.occurrenceCount += 1;
}

function node(
  code: UnifiedDecisionCoverageGapReachabilityNodeCode,
  source: PathMetric,
): UnifiedDecisionCoverageGapReachabilityNode {
  return Object.freeze({
    code,
    observationCount: source.observations.size,
    occurrenceCount: source.occurrenceCount,
    uniqueEntityCount: source.entities.size,
  });
}

function lineEntity(
  observation: UnifiedDecisionLiveObservation,
): string {
  return observation.decision.level?.lineId
    ?? `symbol:${observation.symbol}`;
}

function isDirectionalRealtimePrecursor(
  observation: UnifiedDecisionLiveObservation,
): boolean {
  const decision = observation.decision;
  return (
    decision.direction !== null
    && decision.scenario !== null
    && decision.causalStage === 'CONFIRMATION'
    && (
      decision.reasons.includes(
        'realtime_sources_support_breakout',
      )
      || decision.reasons.includes(
        'realtime_sources_support_bounce',
      )
    )
  );
}

function btcAlignment(
  observation: UnifiedDecisionLiveObservation,
): UnifiedDecisionMarketAlignment {
  const direction = observation.decision.direction;
  const context = observation.marketContext.value.btc;
  if (
    direction === null
    || !ACTIVE_MARKET_AVAILABILITY.has(context.availability)
    || context.mode === null
  ) {
    return 'unavailable';
  }
  if (context.mode === 'neutral') return 'neutral';
  return (
    (direction === 'long' && context.mode === 'risk_on')
    || (direction === 'short' && context.mode === 'risk_off')
  )
    ? 'aligned'
    : 'opposed';
}

function impulseAlignment(
  observation: UnifiedDecisionLiveObservation,
): UnifiedDecisionMarketAlignment {
  const direction = observation.decision.direction;
  const context = observation.marketContext.value.impulse;
  if (
    direction === null
    || !ACTIVE_MARKET_AVAILABILITY.has(context.availability)
  ) {
    return 'unavailable';
  }
  if (context.direction === null) return 'neutral';
  return context.direction === direction
    ? 'aligned'
    : 'opposed';
}

function isTerminalSetup(
  setup: SetupEngineState,
): boolean {
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

function isCurrentTerminalSetup(
  setup: SetupEngineState,
  observation: UnifiedDecisionLiveObservation,
): boolean {
  const generatedAt = Date.parse(observation.decision.generatedAt);
  const expiresAt = Date.parse(setup.expiresAt);
  return (
    isTerminalSetup(setup)
    && setup.symbol === observation.symbol
    && setup.timeframe === observation.timeframe
    && Number.isFinite(generatedAt)
    && Number.isFinite(expiresAt)
    && expiresAt >= generatedAt
  );
}

function sameMarketCapture(
  observation: UnifiedDecisionLiveObservation,
): boolean {
  const captured = observation.marketContext.value;
  const decision = observation.decision.marketContext;
  return (
    captured.btc.availability === decision.btc.availability
    && captured.btc.mode === decision.btc.mode
    && captured.btc.observedAt === decision.btc.observedAt
    && captured.impulse.availability === decision.impulse.availability
    && captured.impulse.direction === decision.impulse.direction
    && captured.impulse.observedAt === decision.impulse.observedAt
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
  violations: UnifiedDecisionCoverageGapReachabilityViolation[],
  observation: UnifiedDecisionLiveObservation,
  code: UnifiedDecisionCoverageGapReachabilityViolationCode,
  message: string,
): void {
  violations.push(Object.freeze({
    code,
    sequence: observation.sequence,
    symbol: observation.symbol,
    recordedAt: observation.recordedAt,
    message,
  }));
}

function assess(
  input: {
    readonly kind: UnifiedDecisionCoverageGapReachabilityAssessment['kind'];
    readonly targetCount: number;
    readonly violationCount: number;
    readonly blocked: readonly {
      readonly when: boolean;
      readonly cutoff: UnifiedDecisionCoverageGapReachabilityCutoffCode;
      readonly message: string;
    }[];
    readonly reachableCutoff: UnifiedDecisionCoverageGapReachabilityCutoffCode;
    readonly reachableMessage: string;
    readonly observedMessage: string;
    readonly path: readonly UnifiedDecisionCoverageGapReachabilityNode[];
  },
): UnifiedDecisionCoverageGapReachabilityAssessment {
  let status: UnifiedDecisionCoverageGapReachabilityStatus;
  let cutoff: UnifiedDecisionCoverageGapReachabilityCutoffCode;
  let message: string;
  if (input.violationCount > 0) {
    status = 'contract_violation';
    cutoff = 'contract_violation';
    message = `${input.violationCount} contract violation(s) detected on the causal path`;
  } else if (input.targetCount > 0) {
    status = 'observed';
    cutoff = 'none';
    message = input.observedMessage;
  } else {
    const blocked = input.blocked.find((entry) => entry.when);
    if (blocked) {
      status = 'blocked_upstream';
      cutoff = blocked.cutoff;
      message = blocked.message;
    } else {
      status = 'reachable_not_observed';
      cutoff = input.reachableCutoff;
      message = input.reachableMessage;
    }
  }
  return Object.freeze({
    kind: input.kind,
    status,
    targetObservationCount: input.targetCount,
    cutoff,
    message,
    path: Object.freeze([...input.path]),
  });
}

function violationCount(
  violations: readonly UnifiedDecisionCoverageGapReachabilityViolation[],
  codes: ReadonlySet<UnifiedDecisionCoverageGapReachabilityViolationCode>,
): number {
  return violations.filter((violation) => codes.has(violation.code)).length;
}

export function diagnoseUnifiedDecisionCoverageGapReachability(
  value: unknown,
  options: UnifiedDecisionCoverageGapReachabilityOptions = {},
  dependencies: UnifiedDecisionCoverageGapReachabilityDependencies = {},
): UnifiedDecisionCoverageGapReachabilityReport {
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

  const path = metrics();
  const violations: UnifiedDecisionCoverageGapReachabilityViolation[] = [];
  const symbolCounts: Record<string, number> = {};
  const stateCounts = emptyCounts(STATES) as Record<UnifiedDecisionState, number>;
  const marketReadCounts: Record<string, number> = {};
  const directionCounts = emptyCounts(['long', 'short', 'none']);
  const btcAvailabilityCounts: Record<string, number> = {};
  const impulseAvailabilityCounts: Record<string, number> = {};
  const btcModeCounts: Record<string, number> = {};
  const impulseDirectionCounts: Record<string, number> = {};
  const btcAlignmentCounts = emptyCounts(ALIGNMENTS) as Record<UnifiedDecisionMarketAlignment, number>;
  const impulseAlignmentCounts = emptyCounts(ALIGNMENTS) as Record<UnifiedDecisionMarketAlignment, number>;
  const setupReadCounts: Record<string, number> = {};
  const stageCounts = emptyCounts(SETUP_STAGES) as Record<SetupEngineStage, number>;
  const uniqueCandidateStages = new Map<SetupEngineStage, Set<string>>(
    SETUP_STAGES.map((stage) => [stage, new Set<string>()]),
  );
  const outcomeCounts = emptyCounts(['breakout', 'rejection', 'none']);
  const allCandidateIds = new Set<string>();
  let candidateOccurrenceCount = 0;
  let expiredTerminalObservationCount = 0;
  let alignmentMismatchCount = 0;
  let singleConflictDecisionCount = 0;
  let doubleConflictDecisionCount = 0;

  for (const observation of observations) {
    const decision = observation.decision;
    const entity = lineEntity(observation);
    increment(symbolCounts, observation.symbol);
    increment(stateCounts, decision.state);
    increment(
      directionCounts,
      decision.direction ?? 'none',
    );
    increment(marketReadCounts, observation.marketContext.readState);
    increment(btcAvailabilityCounts, observation.marketContext.value.btc.availability);
    increment(impulseAvailabilityCounts, observation.marketContext.value.impulse.availability);
    increment(btcModeCounts, observation.marketContext.value.btc.mode ?? 'none');
    increment(impulseDirectionCounts, observation.marketContext.value.impulse.direction ?? 'none');
    increment(setupReadCounts, observation.setups.readState);

    if (
      observation.symbol !== decision.symbol
      || observation.timeframe !== decision.timeframe
    ) {
      addViolation(
        violations,
        observation,
        'observation_identity_mismatch',
        'Observation symbol or timeframe does not match Unified Decision',
      );
    }
    if (!sameMarketCapture(observation)) {
      addViolation(
        violations,
        observation,
        'market_context_capture_mismatch',
        'Captured market context does not match the context used by Unified Decision',
      );
    }

    const derivedBtc = btcAlignment(observation);
    const derivedImpulse = impulseAlignment(observation);
    increment(btcAlignmentCounts, derivedBtc);
    increment(impulseAlignmentCounts, derivedImpulse);
    if (derivedBtc !== decision.marketContext.btc.alignment) {
      alignmentMismatchCount += 1;
      addViolation(
        violations,
        observation,
        'btc_alignment_mismatch',
        `Derived BTC alignment ${derivedBtc} differs from decision alignment ${decision.marketContext.btc.alignment}`,
      );
    }
    if (derivedImpulse !== decision.marketContext.impulse.alignment) {
      alignmentMismatchCount += 1;
      addViolation(
        violations,
        observation,
        'impulse_alignment_mismatch',
        `Derived impulse alignment ${derivedImpulse} differs from decision alignment ${decision.marketContext.impulse.alignment}`,
      );
    }

    if (decision.reasons.includes('market_context_conflict')) {
      singleConflictDecisionCount += 1;
    }
    if (decision.reasons.includes('market_context_double_conflict')) {
      doubleConflictDecisionCount += 1;
    }

    if (isDirectionalRealtimePrecursor(observation)) {
      record(path.directional, observation, entity);
      if (observation.marketContext.readState === 'available') {
        record(path.marketRead, observation, entity);
      }
      if (derivedBtc !== 'unavailable') {
        record(path.btcComputable, observation, entity);
      }
      if (derivedImpulse !== 'unavailable') {
        record(path.impulseComputable, observation, entity);
      }
      if (derivedBtc !== 'unavailable' && derivedImpulse !== 'unavailable') {
        record(path.bothComputable, observation, entity);
      }
      if (derivedBtc === 'opposed') {
        record(path.btcOpposed, observation, entity);
      }
      if (derivedImpulse === 'opposed') {
        record(path.impulseOpposed, observation, entity);
      }
      const conflictCount = [derivedBtc, derivedImpulse]
        .filter((alignment) => alignment === 'opposed')
        .length;
      if (conflictCount === 1) {
        record(path.singleConflict, observation, entity);
        if (decision.state !== 'wait_confirmation') {
          addViolation(
            violations,
            observation,
            'single_conflict_not_downgraded',
            'Observed single market conflict was not downgraded to wait_confirmation',
          );
        }
        if (
          !decision.reasons.includes('market_context_conflict')
          || !decision.invalidations.includes('market_context_reversal')
        ) {
          addViolation(
            violations,
            observation,
            'single_conflict_contract_mismatch',
            'Observed single market conflict lacks its reason or invalidation',
          );
        }
      }
      if (conflictCount === 2) {
        record(path.doubleConflict, observation, entity);
        if (decision.state !== 'skip') {
          addViolation(
            violations,
            observation,
            'double_conflict_not_skipped',
            'Observed double market conflict was not downgraded to skip',
          );
        }
        if (
          !decision.reasons.includes('market_context_double_conflict')
          || !decision.invalidations.includes('market_context_reversal')
        ) {
          addViolation(
            violations,
            observation,
            'double_conflict_contract_mismatch',
            'Observed double market conflict lacks its reason or invalidation',
          );
        }
      }
    }

    if (observation.setups.readState === 'available') {
      record(path.setupSource, observation, observation.symbol);
    }
    const terminalCandidates: SetupEngineState[] = [];
    const currentTerminalCandidates: SetupEngineState[] = [];
    for (const setup of observation.setups.candidates) {
      candidateOccurrenceCount += 1;
      allCandidateIds.add(setup.id);
      record(path.setupCandidate, observation, setup.id);
      increment(stageCounts, setup.stage);
      increment(outcomeCounts, setup.outcome ?? 'none');
      uniqueCandidateStages.get(setup.stage)?.add(setup.id);
      if (setup.stage === 'APPROACHING_THIRD_TOUCH') {
        record(path.setupApproaching, observation, setup.id);
      }
      if (setup.stage === 'THIRD_TOUCH_CONFIRMED') {
        record(path.setupThirdTouch, observation, setup.id);
      }
      if (isTerminalSetup(setup)) {
        terminalCandidates.push(setup);
        record(path.setupTerminalCaptured, observation, setup.id);
      }
      if (isCurrentTerminalSetup(setup, observation)) {
        currentTerminalCandidates.push(setup);
        record(path.setupTerminalCurrent, observation, setup.id);
      }
    }
    if (terminalCandidates.length > 0 && currentTerminalCandidates.length === 0) {
      expiredTerminalObservationCount += 1;
    }
    if (decision.state === 'setup_confirmed') {
      record(
        path.setupConfirmed,
        observation,
        decision.setup?.candidateId ?? observation.symbol,
      );
      const selected = decision.setup
        ? currentTerminalCandidates.find((setup) => setup.id === decision.setup?.candidateId)
        : undefined;
      if (!selected) {
        addViolation(
          violations,
          observation,
          'setup_confirmed_without_current_terminal',
          'setup_confirmed does not select a current captured terminal Setup candidate',
        );
      }
      if (
        selected
        && (
          !selected.causal?.lineId
          || selected.causal.lineId !== decision.level?.lineId
        )
      ) {
        addViolation(
          violations,
          observation,
          'setup_confirmed_causal_line_mismatch',
          'setup_confirmed does not preserve the terminal candidate causal Level Line',
        );
      }
    }
    if (
      currentTerminalCandidates.length > 0
      && decision.state !== 'setup_confirmed'
    ) {
      addViolation(
        violations,
        observation,
        'current_terminal_not_confirmed',
        'A current terminal Setup outcome did not produce setup_confirmed',
      );
    }
    if (safetyChanged(observation)) {
      addViolation(
        violations,
        observation,
        'safety_contract_changed',
        'Observation or Unified Decision safety contract changed',
      );
    }
  }

  const singleViolationCodes = new Set<UnifiedDecisionCoverageGapReachabilityViolationCode>([
    'market_context_capture_mismatch',
    'btc_alignment_mismatch',
    'impulse_alignment_mismatch',
    'single_conflict_not_downgraded',
    'single_conflict_contract_mismatch',
  ]);
  const doubleViolationCodes = new Set<UnifiedDecisionCoverageGapReachabilityViolationCode>([
    'market_context_capture_mismatch',
    'btc_alignment_mismatch',
    'impulse_alignment_mismatch',
    'double_conflict_not_skipped',
    'double_conflict_contract_mismatch',
  ]);
  const setupViolationCodes = new Set<UnifiedDecisionCoverageGapReachabilityViolationCode>([
    'setup_confirmed_without_current_terminal',
    'current_terminal_not_confirmed',
    'setup_confirmed_causal_line_mismatch',
  ]);

  const marketPrefix = [
    node('directional_realtime_precursor', path.directional),
    node('market_context_read_available', path.marketRead),
    node('btc_context_computable', path.btcComputable),
    node('impulse_context_computable', path.impulseComputable),
    node('both_market_contexts_computable', path.bothComputable),
    node('btc_opposed', path.btcOpposed),
    node('impulse_opposed', path.impulseOpposed),
  ];
  const singleAssessment = assess({
    kind: 'market_context_single_conflict',
    targetCount: path.singleConflict.observations.size,
    violationCount: violationCount(violations, singleViolationCodes),
    blocked: [
      {
        when: path.directional.observations.size === 0,
        cutoff: 'directional_realtime_precursor_not_observed',
        message: 'No directional realtime precursor reached the market-context filter',
      },
      {
        when: path.marketRead.observations.size === 0,
        cutoff: 'market_context_read_not_available',
        message: 'Market context was never available on a directional realtime precursor',
      },
      {
        when: path.btcOpposed.observations.size === 0
          && path.impulseOpposed.observations.size === 0,
        cutoff: 'opposing_market_context_not_observed',
        message: 'No computable market source opposed a directional realtime precursor',
      },
    ],
    reachableCutoff: 'single_conflict_combination_not_observed',
    reachableMessage: 'Opposing source values were observed, but never as exactly one opposed source',
    observedMessage: 'The single-conflict condition reached the production downgrade contract',
    path: [
      ...marketPrefix,
      node('single_conflict_condition', path.singleConflict),
    ],
  });
  const doubleAssessment = assess({
    kind: 'market_context_double_conflict',
    targetCount: path.doubleConflict.observations.size,
    violationCount: violationCount(violations, doubleViolationCodes),
    blocked: [
      {
        when: path.directional.observations.size === 0,
        cutoff: 'directional_realtime_precursor_not_observed',
        message: 'No directional realtime precursor reached the market-context filter',
      },
      {
        when: path.marketRead.observations.size === 0,
        cutoff: 'market_context_read_not_available',
        message: 'Market context was never available on a directional realtime precursor',
      },
      {
        when: path.btcComputable.observations.size === 0,
        cutoff: 'btc_context_not_computable',
        message: 'BTC context was never computable on a directional realtime precursor',
      },
      {
        when: path.impulseComputable.observations.size === 0,
        cutoff: 'impulse_context_not_computable',
        message: 'Impulse context was never computable on a directional realtime precursor',
      },
      {
        when: path.btcOpposed.observations.size === 0
          || path.impulseOpposed.observations.size === 0,
        cutoff: 'opposing_market_context_not_observed',
        message: 'Both market sources did not independently reach opposed alignment',
      },
    ],
    reachableCutoff: 'double_conflict_combination_not_observed',
    reachableMessage: 'Both sources independently opposed a precursor, but never simultaneously',
    observedMessage: 'The double-conflict condition reached the production skip contract',
    path: [
      ...marketPrefix,
      node('double_conflict_condition', path.doubleConflict),
    ],
  });

  const terminalTargetSequences = new Set([
    ...path.setupTerminalCurrent.observations,
    ...path.setupConfirmed.observations,
  ]);
  const terminalAssessment = assess({
    kind: 'terminal_setup_outcome',
    targetCount: terminalTargetSequences.size,
    violationCount: violationCount(violations, setupViolationCodes),
    blocked: [
      {
        when: path.setupSource.observations.size === 0,
        cutoff: 'setup_source_not_available',
        message: 'Setup source was never available in the selected observations',
      },
      {
        when: path.setupCandidate.observations.size === 0,
        cutoff: 'setup_candidate_not_captured',
        message: 'No Setup candidate was captured from the available source',
      },
      {
        when: path.setupApproaching.observations.size === 0
          && path.setupThirdTouch.observations.size === 0
          && path.setupTerminalCaptured.observations.size === 0,
        cutoff: 'setup_approach_not_observed',
        message: 'No candidate reached APPROACHING_THIRD_TOUCH',
      },
      {
        when: path.setupThirdTouch.observations.size === 0
          && path.setupTerminalCaptured.observations.size === 0,
        cutoff: 'setup_third_touch_not_observed',
        message: 'The captured lifecycle stopped before THIRD_TOUCH_CONFIRMED',
      },
      {
        when: path.setupTerminalCaptured.observations.size === 0,
        cutoff: 'setup_terminal_transition_not_observed',
        message: 'No captured candidate reached BREAKOUT_CONFIRMED or REJECTION_CONFIRMED',
      },
      {
        when: path.setupTerminalCurrent.observations.size === 0
          && path.setupTerminalCaptured.observations.size > 0,
        cutoff: 'setup_terminal_expired_before_decision',
        message: 'Terminal candidates were captured only after their current decision window expired',
      },
    ],
    reachableCutoff: 'setup_terminal_transition_not_observed',
    reachableMessage: 'Terminal lifecycle prerequisites were observed but no current terminal outcome reached Unified Decision',
    observedMessage: 'A current terminal Setup outcome reached setup_confirmed',
    path: [
      node('setup_source_available', path.setupSource),
      node('setup_candidate_captured', path.setupCandidate),
      node('setup_approaching_third_touch', path.setupApproaching),
      node('setup_third_touch_confirmed', path.setupThirdTouch),
      node('setup_terminal_outcome_captured', path.setupTerminalCaptured),
      node('setup_terminal_outcome_current', path.setupTerminalCurrent),
      node('setup_confirmed_decision', path.setupConfirmed),
    ],
  });
  const assessments = Object.freeze([
    singleAssessment,
    doubleAssessment,
    terminalAssessment,
  ]);

  const uniqueCandidateStageCounts = Object.fromEntries(
    SETUP_STAGES.map((stage) => [
      stage,
      uniqueCandidateStages.get(stage)?.size ?? 0,
    ]),
  ) as Record<SetupEngineStage, number>;
  const market: UnifiedDecisionCoverageGapReachabilityMarketSummary = Object.freeze({
    directionalRealtimePrecursorCount: path.directional.observations.size,
    marketContextReadAvailableCount: path.marketRead.observations.size,
    btcContextComputableCount: path.btcComputable.observations.size,
    impulseContextComputableCount: path.impulseComputable.observations.size,
    bothContextsComputableCount: path.bothComputable.observations.size,
    btcOpposedCount: path.btcOpposed.observations.size,
    impulseOpposedCount: path.impulseOpposed.observations.size,
    singleConflictConditionCount: path.singleConflict.observations.size,
    doubleConflictConditionCount: path.doubleConflict.observations.size,
    singleConflictDecisionCount,
    doubleConflictDecisionCount,
    alignmentMismatchCount,
    sourceReadStateCounts: Object.freeze({ ...marketReadCounts }),
    decisionDirectionCounts: Object.freeze({ ...directionCounts }),
    btcAvailabilityCounts: Object.freeze({ ...btcAvailabilityCounts }),
    impulseAvailabilityCounts: Object.freeze({ ...impulseAvailabilityCounts }),
    btcModeCounts: Object.freeze({ ...btcModeCounts }),
    impulseDirectionCounts: Object.freeze({ ...impulseDirectionCounts }),
    btcDerivedAlignmentCounts: Object.freeze({ ...btcAlignmentCounts }),
    impulseDerivedAlignmentCounts: Object.freeze({ ...impulseAlignmentCounts }),
  });
  const setup: UnifiedDecisionCoverageGapReachabilitySetupSummary = Object.freeze({
    sourceReadAvailableObservationCount: path.setupSource.observations.size,
    candidateObservationCount: path.setupCandidate.observations.size,
    candidateOccurrenceCount,
    uniqueCandidateCount: allCandidateIds.size,
    approachingObservationCount: path.setupApproaching.observations.size,
    thirdTouchObservationCount: path.setupThirdTouch.observations.size,
    capturedTerminalObservationCount: path.setupTerminalCaptured.observations.size,
    currentTerminalObservationCount: path.setupTerminalCurrent.observations.size,
    expiredTerminalObservationCount,
    setupConfirmedObservationCount: path.setupConfirmed.observations.size,
    sourceReadStateCounts: Object.freeze({ ...setupReadCounts }),
    stageCounts: Object.freeze({ ...stageCounts }),
    uniqueCandidateStageCounts: Object.freeze(uniqueCandidateStageCounts),
    outcomeCounts: Object.freeze({ ...outcomeCounts }),
  });

  const violationCounts = emptyCounts(VIOLATION_CODES) as Record<UnifiedDecisionCoverageGapReachabilityViolationCode, number>;
  for (const violation of violations) increment(violationCounts, violation.code);
  const hasContractViolations = violations.length > 0;
  const enoughObservations = observations.length >= appliedOptions.minimumObservationCount;
  const allObserved = assessments.every((assessment) => assessment.status === 'observed');
  let status: UnifiedDecisionCoverageGapReachabilityReportStatus;
  if (hasContractViolations) {
    status = 'contract_violations_found';
  } else if (!enoughObservations) {
    status = 'insufficient_observations';
  } else if (allObserved) {
    status = 'diagnosed';
  } else {
    status = 'diagnosed_with_unreached_gaps';
  }

  let nextAction: UnifiedDecisionCoverageGapReachabilityNextAction;
  if (hasContractViolations) {
    nextAction = 'inspect_contract_wiring';
  } else if (terminalAssessment.status === 'blocked_upstream') {
    nextAction = 'inspect_setup_lifecycle_reachability';
  } else if (
    singleAssessment.status === 'blocked_upstream'
    || doubleAssessment.status === 'blocked_upstream'
  ) {
    nextAction = 'inspect_market_context_variation';
  } else if (!allObserved) {
    nextAction = 'run_targeted_collection_after_diagnostics';
  } else {
    nextAction = 'none';
  }

  const now = dependencies.now ?? (() => new Date());
  return Object.freeze({
    version: UNIFIED_DECISION_COVERAGE_GAP_REACHABILITY_DIAGNOSTICS_VERSION,
    generatedAt: now().toISOString(),
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
    symbolCounts: Object.freeze({ ...symbolCounts }),
    stateCounts: Object.freeze({ ...stateCounts }),
    market,
    setup,
    assessments,
    violationCounts: Object.freeze({ ...violationCounts }),
    violations: Object.freeze([...violations]),
    nextAction,
    diagnosticOnly: true,
    decisionRulesChangeRecommended: false,
    thresholdsChanged: false,
    rankingChanged: false,
    setupLifecycleChanged: false,
    createsTradeOrder: false,
    createsSignal: false,
    createsScore: false,
    appliesLearning: false,
    estimatesProfitability: false,
    usesFutureData: false,
  });
}
