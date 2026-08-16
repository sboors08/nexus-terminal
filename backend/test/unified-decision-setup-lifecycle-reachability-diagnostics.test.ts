import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  SetupCausalStage,
} from '../src/modules/setup-engine/causal-setup-adapter.types.js';
import type {
  SetupEngineStage,
  SetupEngineState,
} from '../src/modules/setup-engine/setup-engine.types.js';
import {
  diagnoseUnifiedDecisionSetupLifecycleReachability,
  UnifiedDecisionSetupLifecycleReachabilityDiagnosticsError,
} from '../src/modules/decision-engine/unified-decision-setup-lifecycle-reachability-diagnostics.js';
import type {
  UnifiedDecisionLiveObservation,
} from '../src/modules/decision-engine/unified-decision-live-observation.types.js';

const NOW = new Date('2026-08-16T16:00:00.000Z');
const CREATED_AT = '2026-08-16T12:00:00.000Z';

function recordedAt(sequence: number): string {
  return new Date(
    Date.parse(CREATED_AT) + sequence * 60_000,
  ).toISOString();
}

interface CandidateOptions {
  readonly id?: string;
  readonly sequence: number;
  readonly stage: SetupEngineStage;
  readonly causalStage?: SetupCausalStage | null;
  readonly expiresAt?: string;
  readonly createdAt?: string;
  readonly lineId?: string;
}

function candidate(options: CandidateOptions): SetupEngineState {
  const terminalBreakout = options.stage === 'BREAKOUT_CONFIRMED';
  const terminalRejection = options.stage === 'REJECTION_CONFIRMED';
  const causalStage = options.causalStage === undefined
    ? 'OBSERVATION'
    : options.causalStage;
  const observedAt = recordedAt(options.sequence);
  return {
    id: options.id ?? 'setup:line-1:breakout',
    symbol: 'BTCUSDT',
    timeframe: '1m',
    setupType: terminalRejection ? 'level_bounce' : 'level_breakout',
    direction: terminalRejection ? 'short' : 'long',
    stage: options.stage,
    outcome: terminalBreakout
      ? 'breakout'
      : terminalRejection
        ? 'rejection'
        : null,
    level: {
      kind: 'resistance',
      centerPrice: 100,
      zoneLow: 100,
      zoneHigh: 100,
      touches: 3,
      confirmedAt: CREATED_AT,
    },
    currentPrice: 100.1,
    distanceToLevelPct: 0.1,
    createdAt: options.createdAt ?? CREATED_AT,
    updatedAt: observedAt,
    expiresAt: options.expiresAt ?? '2026-08-16T14:00:00.000Z',
    ...(causalStage === null
      ? {}
      : {
          causal: {
            version: 'causal-setup-adapter-v0.1',
            source: 'level_lines',
            lineId: options.lineId ?? 'line-1',
            lineStatus: 'confirmed',
            stage: causalStage,
            reason: causalStage === 'CONFIRMATION'
              ? 'realtime_confirmation_confirmed'
              : causalStage === 'APPROACH'
                ? 'approach_distance_threshold_met'
                : causalStage === 'OBSERVATION'
                  ? 'observation_progress_threshold_met'
                  : 'level_line_confirmed',
            observedAt,
            observationProgress: 0.8,
            observationProgressThreshold: 0.5,
            distanceToLevelPercent: 0.1,
            maxDistanceToLevelPercent: 0.5,
            realtimeConfirmationStatus: causalStage === 'CONFIRMATION'
              ? 'confirmed'
              : 'not_applicable',
            realtimeConfirmationReasons: [],
            sourceObservationalOnly: true,
            sourceCreatesSetup: false,
            sourceCreatesSignal: false,
            evaluatesBreakout: false,
            evaluatesBounce: false,
            usesFutureCandles: false,
            usesFutureRealtimeEvidence: false,
          },
        }),
  } as SetupEngineState;
}

interface ObservationOptions {
  readonly sequence: number;
  readonly candidates?: readonly SetupEngineState[];
  readonly setupReadState?: 'available' | 'unavailable' | 'error';
  readonly safetyChanged?: boolean;
}

function observation(options: ObservationOptions): UnifiedDecisionLiveObservation {
  const timestamp = recordedAt(options.sequence);
  const candidates = options.candidates ?? [];
  return {
    id: `observation:${options.sequence}`,
    sequence: options.sequence,
    recordedAt: timestamp,
    symbol: 'BTCUSDT',
    timeframe: '1m',
    decision: {
      version: 'unified-decision-v0.1',
      symbol: 'BTCUSDT',
      timeframe: '1m',
      generatedAt: timestamp,
      state: 'observe',
      direction: null,
      scenario: null,
      causalStage: 'LEVEL',
      level: null,
      setup: null,
      marketContext: {
        btc: {
          availability: 'unavailable',
          mode: null,
          observedAt: null,
          alignment: 'unavailable',
        },
        impulse: {
          availability: 'unavailable',
          direction: null,
          observedAt: null,
          alignment: 'unavailable',
        },
      },
      reasons: [],
      missingConfirmations: [],
      invalidations: [],
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
      capturedAt: timestamp,
      tape: null,
      orderBook: null,
      sourceErrors: [],
      evaluatedEvidence: {} as never,
      evaluations: [],
    },
    setups: {
      readState: options.setupReadState ?? 'available',
      observedAt: candidates[0]?.updatedAt ?? null,
      candidates,
      originalCandidatesCount: candidates.length,
      truncated: false,
    },
    marketContext: {
      readState: 'available',
      value: {
        btc: {
          availability: 'unavailable',
          mode: null,
          observedAt: null,
        },
        impulse: {
          availability: 'unavailable',
          direction: null,
          observedAt: null,
        },
      },
    },
    diagnosticOnly: true,
    createsTradeOrder: false,
    createsSetup: false,
    createsSignal: false,
    changesDecisionRules: options.safetyChanged ?? false,
  } as UnifiedDecisionLiveObservation;
}

function dataset(observations: readonly UnifiedDecisionLiveObservation[]): unknown {
  return {
    version: 'unified-decision-live-observation-dataset-v0.1',
    exportedAt: NOW.toISOString(),
    status: {},
    observations,
  };
}

function diagnose(observations: readonly UnifiedDecisionLiveObservation[]) {
  return diagnoseUnifiedDecisionSetupLifecycleReachability(
    dataset(observations),
    { minimumObservationCount: 1 },
    { now: () => NOW },
  );
}

test('separates repeated retained expiry snapshots from unique candidates', () => {
  const expiresAt = '2026-08-16T12:30:00.000Z';
  const report = diagnose([
    observation({
      sequence: 60,
      candidates: [candidate({
        sequence: 30,
        stage: 'SETUP_EXPIRED',
        causalStage: 'OBSERVATION',
        expiresAt,
      })],
    }),
    observation({
      sequence: 61,
      candidates: [candidate({
        sequence: 30,
        stage: 'SETUP_EXPIRED',
        causalStage: 'OBSERVATION',
        expiresAt,
      })],
    }),
  ]);

  assert.equal(report.candidates.candidateOccurrenceCount, 2);
  assert.equal(report.candidates.uniqueCandidateCount, 1);
  assert.equal(report.candidates.firstSeenAtOrAfterExpiryCount, 1);
  assert.equal(report.candidates.retainedExpiredOccurrenceCount, 2);
  assert.equal(report.assessment.diagnosis, 'retention_currentness_mismatch');
  assert.equal(report.assessment.cutoff, 'candidate_first_seen_after_expiry');
  assert.equal(report.nextAction, 'inspect_candidate_creation_timing');
  assert.equal(report.violations.length, 0);
});

test('localizes a current candidate cutoff before causal Approach', () => {
  const report = diagnose([
    observation({
      sequence: 1,
      candidates: [candidate({
        sequence: 1,
        stage: 'LEVEL_CONFIRMED',
        causalStage: 'OBSERVATION',
      })],
    }),
  ]);

  assert.equal(report.candidates.firstSeenBeforeExpiryCount, 1);
  assert.equal(report.assessment.diagnosis, 'market_approach_not_observed');
  assert.equal(report.assessment.cutoff, 'causal_approach_not_observed');
  assert.equal(report.nextAction, 'inspect_causal_approach_reachability');
});

test('reconstructs a complete lifecycle and deduplicates stage transitions', () => {
  const id = 'setup:complete';
  const report = diagnose([
    observation({
      sequence: 1,
      candidates: [candidate({ sequence: 1, id, stage: 'LEVEL_CONFIRMED', causalStage: 'OBSERVATION' })],
    }),
    observation({
      sequence: 2,
      candidates: [candidate({ sequence: 2, id, stage: 'APPROACHING_THIRD_TOUCH', causalStage: 'APPROACH' })],
    }),
    observation({
      sequence: 3,
      candidates: [candidate({ sequence: 3, id, stage: 'THIRD_TOUCH_CONFIRMED', causalStage: 'CONFIRMATION' })],
    }),
    observation({
      sequence: 4,
      candidates: [candidate({ sequence: 4, id, stage: 'BREAKOUT_CONFIRMED', causalStage: 'CONFIRMATION' })],
    }),
  ]);

  assert.equal(report.status, 'diagnosed');
  assert.equal(report.assessment.diagnosis, 'fully_reached');
  assert.equal(report.assessment.cutoff, 'none');
  assert.equal(report.candidates.setupStageTransitions.length, 3);
  assert.deepEqual(
    report.candidates.causalStageTransitions.map(({ from, to }) => `${from}->${to}`),
    ['OBSERVATION->APPROACH', 'APPROACH->CONFIRMATION'],
  );
  assert.equal(report.targetedLiveCheckRecommended, false);
  assert.equal(report.violations.length, 0);
});

test('detects causal Approach ahead of the non-terminal runtime stage', () => {
  const report = diagnose([
    observation({
      sequence: 1,
      candidates: [candidate({
        sequence: 1,
        stage: 'LEVEL_CONFIRMED',
        causalStage: 'APPROACH',
      })],
    }),
  ]);

  assert.equal(report.status, 'contract_violations_found');
  assert.equal(report.assessment.diagnosis, 'runtime_transition_wiring_mismatch');
  assert.equal(report.violationCounts.causal_stage_ahead_of_runtime_stage, 1);
  assert.equal(report.nextAction, 'inspect_runtime_transition_wiring');
});

test('detects a runtime Approach stage without causal Approach evidence', () => {
  const report = diagnose([
    observation({
      sequence: 1,
      candidates: [candidate({
        sequence: 1,
        stage: 'APPROACHING_THIRD_TOUCH',
        causalStage: 'OBSERVATION',
      })],
    }),
  ]);

  assert.equal(report.status, 'contract_violations_found');
  assert.equal(report.violationCounts.runtime_stage_without_causal_evidence, 1);
});

test('does not call missing retained runtime stages a wiring defect without live evidence', () => {
  const id = 'setup:retained-after-approach';
  const report = diagnose([
    observation({
      sequence: 1,
      candidates: [candidate({
        sequence: 1,
        id,
        stage: 'LEVEL_CONFIRMED',
        causalStage: 'OBSERVATION',
        expiresAt: '2026-08-16T12:30:00.000Z',
      })],
    }),
    observation({
      sequence: 60,
      candidates: [candidate({
        sequence: 30,
        id,
        stage: 'SETUP_EXPIRED',
        causalStage: 'APPROACH',
        expiresAt: '2026-08-16T12:30:00.000Z',
      })],
    }),
  ]);

  assert.equal(report.violations.length, 0);
  assert.equal(report.assessment.diagnosis, 'retention_currentness_mismatch');
  assert.equal(report.assessment.cutoff, 'runtime_approach_stage_not_captured');
  assert.equal(report.nextAction, 'run_short_targeted_live_check');
  assert.equal(report.targetedLiveCheckRecommended, true);
});

test('distinguishes unavailable source from available source without candidates', () => {
  const unavailable = diagnose([
    observation({ sequence: 1, setupReadState: 'unavailable' }),
  ]);
  const empty = diagnose([
    observation({ sequence: 1 }),
  ]);

  assert.equal(unavailable.assessment.cutoff, 'setup_source_not_available');
  assert.equal(unavailable.nextAction, 'inspect_setup_source_wiring');
  assert.equal(empty.assessment.cutoff, 'setup_candidate_not_captured');
  assert.equal(empty.nextAction, 'inspect_candidate_creation_timing');
});

test('applies sequence filters and reports insufficient selected coverage', () => {
  const report = diagnoseUnifiedDecisionSetupLifecycleReachability(
    dataset([
      observation({ sequence: 1 }),
      observation({ sequence: 2 }),
      observation({ sequence: 3 }),
    ]),
    {
      startSequence: 2,
      endSequence: 3,
      minimumObservationCount: 3,
    },
    { now: () => NOW },
  );

  assert.equal(report.observationCount, 2);
  assert.equal(report.firstSequence, 2);
  assert.equal(report.lastSequence, 3);
  assert.equal(report.status, 'insufficient_observations');
});

test('preserves the diagnostic-only safety boundary', () => {
  const report = diagnose([
    observation({ sequence: 1, safetyChanged: true }),
  ]);

  assert.equal(report.violationCounts.safety_contract_changed, 1);
  assert.equal(report.status, 'contract_violations_found');
  assert.equal(report.decisionRulesChangeRecommended, false);
  assert.equal(report.thresholdsChanged, false);
  assert.equal(report.setupLifecycleChanged, false);
  assert.equal(report.createsTradeOrder, false);
});

test('rejects invalid ranges and malformed live cohort input', () => {
  assert.throws(
    () => diagnoseUnifiedDecisionSetupLifecycleReachability(
      dataset([observation({ sequence: 1 })]),
      { startSequence: 2, endSequence: 1 },
    ),
    UnifiedDecisionSetupLifecycleReachabilityDiagnosticsError,
  );
  assert.throws(
    () => diagnoseUnifiedDecisionSetupLifecycleReachability({}),
    /Unsupported live observation dataset version/,
  );
});
