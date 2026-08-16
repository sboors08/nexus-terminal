import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  SetupEngineStage,
  SetupEngineState,
} from '../src/modules/setup-engine/setup-engine.types.js';
import {
  diagnoseUnifiedDecisionCoverageGapReachability,
  UnifiedDecisionCoverageGapReachabilityDiagnosticsError,
} from '../src/modules/decision-engine/unified-decision-coverage-gap-reachability-diagnostics.js';
import type {
  UnifiedDecisionLiveObservation,
} from '../src/modules/decision-engine/unified-decision-live-observation.types.js';
import type {
  UnifiedDecisionMarketAlignment,
  UnifiedDecisionReason,
  UnifiedDecisionState,
} from '../src/modules/decision-engine/unified-decision.types.js';

const NOW = new Date('2026-08-16T10:00:00.000Z');

interface ObservationOptions {
  readonly sequence: number;
  readonly symbol?: string;
  readonly state?: UnifiedDecisionState;
  readonly direction?: 'long' | 'short' | null;
  readonly scenario?: 'breakout' | 'bounce' | null;
  readonly btcAvailability?: 'ready' | 'degraded' | 'stale' | 'unavailable';
  readonly btcMode?: 'risk_on' | 'risk_off' | 'neutral' | null;
  readonly impulseAvailability?: 'ready' | 'degraded' | 'stale' | 'collecting' | 'unavailable';
  readonly impulseDirection?: 'long' | 'short' | null;
  readonly setupStages?: readonly SetupEngineStage[];
  readonly setupExpired?: boolean;
  readonly wrongBtcAlignment?: boolean;
  readonly safetyChanged?: boolean;
}

function timestamp(sequence: number): string {
  return new Date(
    Date.parse('2026-08-15T18:00:00.000Z')
    + sequence * 60_000,
  ).toISOString();
}

function derivedBtcAlignment(
  direction: 'long' | 'short' | null,
  availability: string,
  mode: 'risk_on' | 'risk_off' | 'neutral' | null,
): UnifiedDecisionMarketAlignment {
  if (
    direction === null
    || !['ready', 'degraded'].includes(availability)
    || mode === null
  ) return 'unavailable';
  if (mode === 'neutral') return 'neutral';
  return (
    (direction === 'long' && mode === 'risk_on')
    || (direction === 'short' && mode === 'risk_off')
  ) ? 'aligned' : 'opposed';
}

function derivedImpulseAlignment(
  direction: 'long' | 'short' | null,
  availability: string,
  impulseDirection: 'long' | 'short' | null,
): UnifiedDecisionMarketAlignment {
  if (
    direction === null
    || !['ready', 'degraded'].includes(availability)
  ) return 'unavailable';
  if (impulseDirection === null) return 'neutral';
  return direction === impulseDirection ? 'aligned' : 'opposed';
}

function setup(
  options: ObservationOptions,
  stage: SetupEngineStage,
  index: number,
): SetupEngineState {
  const observedAt = timestamp(options.sequence);
  const terminal = stage === 'BREAKOUT_CONFIRMED'
    || stage === 'REJECTION_CONFIRMED';
  const rejection = stage === 'REJECTION_CONFIRMED';
  return {
    id: `setup:${options.sequence}:${index}`,
    symbol: options.symbol ?? 'BTCUSDT',
    timeframe: '1m',
    setupType: rejection ? 'level_bounce' : 'level_breakout',
    direction: rejection ? 'short' : 'long',
    stage,
    outcome: terminal ? (rejection ? 'rejection' : 'breakout') : null,
    level: {
      kind: 'resistance',
      centerPrice: 100,
      zoneLow: 99.9,
      zoneHigh: 100.1,
      touches: 3,
      confirmedAt: timestamp(1),
    },
    currentPrice: 101,
    distanceToLevelPct: 1,
    createdAt: timestamp(1),
    updatedAt: observedAt,
    expiresAt: options.setupExpired
      ? new Date(Date.parse(observedAt) - 1).toISOString()
      : new Date(Date.parse(observedAt) + 3_600_000).toISOString(),
    causal: {
      lineId: 'line:1',
      observedAt,
      observationProgress: 1,
      approachDistancePct: 0.1,
      realtimeConfirmationStatus: 'confirmed',
      realtimeTapeState: 'supports',
      realtimeOrderBookState: 'supports',
      reasons: [],
    },
  } as unknown as SetupEngineState;
}

function observation(
  options: ObservationOptions,
): UnifiedDecisionLiveObservation {
  const symbol = options.symbol ?? 'BTCUSDT';
  const generatedAt = timestamp(options.sequence);
  const state = options.state ?? 'possible_long';
  const direction = options.direction === undefined ? 'long' : options.direction;
  const scenario = options.scenario === undefined
    ? (direction === null ? null : 'breakout')
    : options.scenario;
  const btcAvailability = options.btcAvailability ?? 'ready';
  const btcMode = options.btcMode === undefined ? 'risk_on' : options.btcMode;
  const impulseAvailability = options.impulseAvailability ?? 'ready';
  const impulseDirection = options.impulseDirection === undefined
    ? 'long'
    : options.impulseDirection;
  const btc = derivedBtcAlignment(direction, btcAvailability, btcMode);
  const impulse = derivedImpulseAlignment(
    direction,
    impulseAvailability,
    impulseDirection,
  );
  const conflicts = [btc, impulse].filter((value) => value === 'opposed').length;
  const terminal = state === 'setup_confirmed';
  const stages = options.setupStages ?? (terminal ? ['BREAKOUT_CONFIRMED'] : []);
  const candidates = stages.map((stage, index) => setup(options, stage, index));
  const reasons: UnifiedDecisionReason[] = terminal
    ? ['setup_breakout_confirmed']
    : [scenario === 'bounce'
      ? 'realtime_sources_support_bounce'
      : 'realtime_sources_support_breakout'];
  if (conflicts === 1) reasons.push('market_context_conflict');
  if (conflicts === 2) reasons.push('market_context_double_conflict');

  return {
    id: `udlo:${options.sequence}:fixture`,
    sequence: options.sequence,
    recordedAt: generatedAt,
    symbol,
    timeframe: '1m',
    decision: {
      version: 'unified-decision-v0.1',
      symbol,
      timeframe: '1m',
      generatedAt,
      state,
      direction,
      scenario,
      causalStage: terminal ? 'OUTCOME' : direction === null ? 'LEVEL' : 'CONFIRMATION',
      level: direction === null ? null : {
        lineId: 'line:1',
        kind: 'resistance',
        status: 'confirmed',
        levelPrice: 100,
        currentPrice: 101,
        distanceToLevelPercent: 1,
        observationProgress: 1,
        causalStage: 'CONFIRMATION',
        realtimeStatus: 'confirmed',
        tapeState: 'supports',
        orderBookState: 'supports',
      },
      setup: terminal && candidates[0]
        ? {
            candidateId: candidates[0].id,
            setupType: candidates[0].setupType,
            direction: candidates[0].direction,
            stage: candidates[0].stage,
            outcome: candidates[0].outcome,
            updatedAt: candidates[0].updatedAt,
            expiresAt: candidates[0].expiresAt,
          }
        : null,
      marketContext: {
        btc: {
          availability: btcAvailability,
          mode: btcMode,
          observedAt: generatedAt,
          alignment: options.wrongBtcAlignment ? 'neutral' : btc,
        },
        impulse: {
          availability: impulseAvailability,
          direction: impulseDirection,
          observedAt: generatedAt,
          alignment: impulse,
        },
      },
      reasons,
      missingConfirmations: [],
      invalidations: conflicts > 0 ? ['market_context_reversal'] : [],
      decisionSupportOnly: true,
      createsTradeOrder: false,
      createsSetup: false,
      createsSignal: false,
      createsScore: false,
      estimatesProfitability: false,
      changesExistingLifecycle: false,
      usesFutureData: false,
    },
    realtime: {
      capturedAt: generatedAt,
      tape: null,
      orderBook: null,
      sourceErrors: [],
      evaluatedEvidence: {},
      evaluations: [],
    },
    setups: {
      readState: 'available',
      observedAt: candidates[0]?.updatedAt ?? null,
      candidates,
      originalCandidatesCount: candidates.length,
      truncated: false,
    },
    marketContext: {
      readState: 'available',
      value: {
        btc: {
          availability: btcAvailability,
          mode: btcMode,
          observedAt: generatedAt,
        },
        impulse: {
          availability: impulseAvailability,
          direction: impulseDirection,
          observedAt: generatedAt,
        },
      },
    },
    diagnosticOnly: true,
    createsTradeOrder: false,
    createsSetup: false,
    createsSignal: false,
    changesDecisionRules: options.safetyChanged ? true : false,
  } as unknown as UnifiedDecisionLiveObservation;
}

function dataset(
  observations: readonly UnifiedDecisionLiveObservation[],
): unknown {
  return {
    version: 'unified-decision-live-observation-dataset-v0.1',
    exportedAt: '2026-08-16T09:59:00.000Z',
    observations,
  };
}

test('locates the market cutoff at missing opposing source values', () => {
  const report = diagnoseUnifiedDecisionCoverageGapReachability(
    dataset([
      observation({ sequence: 1 }),
      observation({ sequence: 2, setupStages: ['APPROACHING_THIRD_TOUCH'] }),
    ]),
    { minimumObservationCount: 1 },
    { now: () => NOW },
  );

  assert.equal(report.status, 'diagnosed_with_unreached_gaps');
  assert.equal(report.market.directionalRealtimePrecursorCount, 2);
  assert.equal(report.market.bothContextsComputableCount, 2);
  assert.equal(report.market.btcOpposedCount, 0);
  assert.equal(report.assessments[0]?.status, 'blocked_upstream');
  assert.equal(
    report.assessments[0]?.cutoff,
    'opposing_market_context_not_observed',
  );
  assert.equal(
    report.assessments[2]?.cutoff,
    'setup_third_touch_not_observed',
  );
  assert.equal(report.nextAction, 'inspect_setup_lifecycle_reachability');
  assert.equal(report.violations.length, 0);
});

test('observes correct single and double market conflict contracts', () => {
  const report = diagnoseUnifiedDecisionCoverageGapReachability(
    dataset([
      observation({
        sequence: 1,
        state: 'wait_confirmation',
        btcMode: 'risk_off',
      }),
      observation({
        sequence: 2,
        state: 'skip',
        btcMode: 'risk_off',
        impulseDirection: 'short',
      }),
    ]),
    { minimumObservationCount: 1 },
    { now: () => NOW },
  );

  assert.equal(report.market.singleConflictConditionCount, 1);
  assert.equal(report.market.doubleConflictConditionCount, 1);
  assert.equal(report.assessments[0]?.status, 'observed');
  assert.equal(report.assessments[1]?.status, 'observed');
  assert.equal(report.assessments[0]?.cutoff, 'none');
  assert.equal(report.violations.length, 0);
});

test('observes a current terminal Setup outcome and its causal line', () => {
  const report = diagnoseUnifiedDecisionCoverageGapReachability(
    dataset([
      observation({
        sequence: 1,
        state: 'setup_confirmed',
        setupStages: ['BREAKOUT_CONFIRMED'],
      }),
    ]),
    { minimumObservationCount: 1 },
    { now: () => NOW },
  );

  assert.equal(report.setup.capturedTerminalObservationCount, 1);
  assert.equal(report.setup.currentTerminalObservationCount, 1);
  assert.equal(report.setup.setupConfirmedObservationCount, 1);
  assert.equal(report.assessments[2]?.status, 'observed');
  assert.equal(report.violations.length, 0);
});

test('distinguishes captured terminal outcomes expired before decision', () => {
  const report = diagnoseUnifiedDecisionCoverageGapReachability(
    dataset([
      observation({
        sequence: 1,
        state: 'observe',
        direction: null,
        scenario: null,
        setupStages: ['BREAKOUT_CONFIRMED'],
        setupExpired: true,
      }),
    ]),
    { minimumObservationCount: 1 },
    { now: () => NOW },
  );

  assert.equal(report.setup.capturedTerminalObservationCount, 1);
  assert.equal(report.setup.currentTerminalObservationCount, 0);
  assert.equal(report.setup.expiredTerminalObservationCount, 1);
  assert.equal(
    report.assessments[2]?.cutoff,
    'setup_terminal_expired_before_decision',
  );
  assert.equal(report.assessments[2]?.status, 'blocked_upstream');
});

test('reports alignment and downgrade contract violations', () => {
  const report = diagnoseUnifiedDecisionCoverageGapReachability(
    dataset([
      observation({
        sequence: 1,
        state: 'possible_long',
        btcMode: 'risk_off',
        wrongBtcAlignment: true,
      }),
    ]),
    { minimumObservationCount: 1 },
    { now: () => NOW },
  );

  assert.equal(report.status, 'contract_violations_found');
  assert.equal(report.market.alignmentMismatchCount, 1);
  assert.equal(report.violationCounts.btc_alignment_mismatch, 1);
  assert.equal(report.violationCounts.single_conflict_not_downgraded, 1);
  assert.equal(report.assessments[0]?.status, 'contract_violation');
  assert.equal(report.nextAction, 'inspect_contract_wiring');
});

test('reports setup_confirmed without a current terminal candidate', () => {
  const report = diagnoseUnifiedDecisionCoverageGapReachability(
    dataset([
      observation({
        sequence: 1,
        state: 'setup_confirmed',
        setupStages: ['BREAKOUT_CONFIRMED'],
        setupExpired: true,
      }),
    ]),
    { minimumObservationCount: 1 },
    { now: () => NOW },
  );

  assert.equal(
    report.violationCounts.setup_confirmed_without_current_terminal,
    1,
  );
  assert.equal(report.assessments[2]?.status, 'contract_violation');
});

test('accepts persistence snapshots and applies an exact sequence range', () => {
  const input = {
    schema: 'nexus.unified-decision.live-observations',
    version: 1,
    datasetVersion: 'unified-decision-live-observation-dataset-v0.1',
    savedAt: '2026-08-16T09:59:00.000Z',
    nextSequence: 4,
    observations: [
      observation({ sequence: 1 }),
      observation({ sequence: 2 }),
      observation({ sequence: 3 }),
    ],
  };
  const report = diagnoseUnifiedDecisionCoverageGapReachability(
    input,
    {
      startSequence: 2,
      endSequence: 2,
      minimumObservationCount: 1,
    },
    { now: () => NOW },
  );

  assert.equal(report.source.persistenceVersion, 1);
  assert.equal(report.observationCount, 1);
  assert.equal(report.firstSequence, 2);
  assert.equal(report.lastSequence, 2);
  assert.equal(report.generatedAt, NOW.toISOString());
});

test('keeps an insufficient cohort diagnostic-only', () => {
  const report = diagnoseUnifiedDecisionCoverageGapReachability(
    dataset([observation({ sequence: 1, safetyChanged: true })]),
    { minimumObservationCount: 500 },
    { now: () => NOW },
  );

  assert.equal(report.status, 'contract_violations_found');
  assert.equal(report.violationCounts.safety_contract_changed, 1);
  assert.equal(report.diagnosticOnly, true);
  assert.equal(report.decisionRulesChangeRecommended, false);
  assert.equal(report.createsTradeOrder, false);
  assert.equal(report.appliesLearning, false);
});

test('rejects unsupported input and invalid sequence ranges', () => {
  assert.throws(
    () => diagnoseUnifiedDecisionCoverageGapReachability({}),
    /Unsupported live observation dataset version/,
  );
  assert.throws(
    () => diagnoseUnifiedDecisionCoverageGapReachability(
      dataset([observation({ sequence: 1 })]),
      { startSequence: 2, endSequence: 1 },
    ),
    UnifiedDecisionCoverageGapReachabilityDiagnosticsError,
  );
});
