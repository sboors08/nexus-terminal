import assert from 'node:assert/strict';
import test from 'node:test';

import {
  UnifiedDecisionLiveCohortValidationError,
  validateUnifiedDecisionLiveCohort,
} from '../src/modules/decision-engine/unified-decision-live-cohort-validation.js';
import type {
  UnifiedDecisionLiveObservation,
} from '../src/modules/decision-engine/unified-decision-live-observation.types.js';

interface ObservationOptions {
  readonly sequence: number;
  readonly state?: 'observe' | 'possible_long' | 'possible_short' | 'wait_confirmation' | 'setup_confirmed';
  readonly kind?: 'support' | 'resistance';
  readonly scenario?: 'bounce' | 'breakout' | null;
  readonly tapeSource?: 'live' | 'stale';
  readonly bookSource?: 'live' | 'stale';
  readonly tapeState?: 'supports' | 'opposes' | 'neutral';
  readonly bookState?: 'supports' | 'opposes' | 'neutral';
  readonly missing?: readonly string[];
  readonly impulseAvailability?: 'ready' | 'stale';
  readonly impulseAlignment?: 'neutral' | 'opposed';
  readonly terminalSetup?: boolean;
  readonly wrongSetupLine?: boolean;
}

function observation(options: ObservationOptions): UnifiedDecisionLiveObservation {
  const state = options.state ?? 'observe';
  const possible = state === 'possible_long' || state === 'possible_short';
  const direction = state === 'possible_long'
    ? 'long'
    : state === 'possible_short'
      ? 'short'
      : null;
  const scenario = options.scenario ?? (possible ? 'bounce' : null);
  const kind = options.kind ?? 'support';
  const tapeSource = options.tapeSource ?? 'live';
  const bookSource = options.bookSource ?? 'live';
  const evidenceState = scenario === 'breakout' ? 'supports' : 'opposes';
  const tapeState = options.tapeState ?? (possible ? evidenceState : 'neutral');
  const bookState = options.bookState ?? (possible ? evidenceState : 'neutral');
  const terminal = options.terminalSetup ?? false;
  const lineId = `line:${options.sequence}`;
  const candidateId = `setup:${options.sequence}`;
  const setup = terminal ? {
    id: candidateId,
    setupType: 'level_breakout',
    direction: 'long',
    stage: 'BREAKOUT_CONFIRMED',
    outcome: 'breakout',
    expiresAt: '2026-08-15T00:00:00.000Z',
    causal: {
      lineId: options.wrongSetupLine ? 'line:wrong' : lineId,
    },
  } : null;
  const reasons = possible
    ? [scenario === 'breakout'
      ? 'realtime_sources_support_breakout'
      : 'realtime_sources_support_bounce']
    : [];

  return {
    id: `observation:${options.sequence}`,
    sequence: options.sequence,
    recordedAt: `2026-08-14T00:${String(options.sequence).padStart(2, '0')}:01.000Z`,
    symbol: 'BTCUSDT',
    timeframe: '1m',
    decision: {
      version: 'unified-decision-v0.1',
      symbol: 'BTCUSDT',
      timeframe: '1m',
      generatedAt: `2026-08-14T00:${String(options.sequence).padStart(2, '0')}:00.000Z`,
      state,
      direction,
      scenario,
      causalStage: possible || terminal ? 'CONFIRMATION' : 'APPROACH',
      level: {
        lineId,
        kind,
        status: 'confirmed',
        levelPrice: 100,
        currentPrice: 100,
        distanceToLevelPercent: 0,
        observationProgress: 1,
        causalStage: 'APPROACH',
        realtimeStatus: tapeState === bookState ? 'confirmed' : 'partial',
        tapeState,
        orderBookState: bookState,
      },
      setup: terminal ? {
        candidateId,
        setupType: 'level_breakout',
        direction: 'long',
        stage: 'BREAKOUT_CONFIRMED',
        outcome: 'breakout',
        updatedAt: '2026-08-14T00:00:00.000Z',
        expiresAt: '2026-08-15T00:00:00.000Z',
      } : null,
      marketContext: {
        btc: {
          availability: 'ready',
          mode: 'neutral',
          observedAt: '2026-08-14T00:00:00.000Z',
          alignment: 'neutral',
        },
        impulse: {
          availability: options.impulseAvailability ?? 'ready',
          direction: null,
          observedAt: '2026-08-14T00:00:00.000Z',
          alignment: options.impulseAlignment ?? 'neutral',
        },
      },
      reasons,
      missingConfirmations: options.missing ?? [],
      invalidations: options.impulseAlignment === 'opposed'
        ? ['market_context_reversal']
        : ['source_freshness_lost'],
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
      capturedAt: '2026-08-14T00:00:00.000Z',
      tape: null,
      orderBook: null,
      sourceErrors: [],
      evaluatedEvidence: {
        availability: tapeSource === 'live' && bookSource === 'live'
          ? 'complete'
          : tapeSource === 'live'
            ? 'tape_only'
            : bookSource === 'live'
              ? 'order_book_only'
              : 'unavailable',
        tape: { state: tapeSource },
        orderBook: { state: bookSource },
      },
      evaluations: [],
    },
    setups: {
      readState: 'available',
      observedAt: '2026-08-14T00:00:00.000Z',
      candidates: setup ? [setup] : [],
      originalCandidatesCount: setup ? 1 : 0,
      truncated: false,
    },
    marketContext: {
      readState: 'available',
      value: {
        btc: { availability: 'ready', mode: 'neutral', observedAt: null },
        impulse: { availability: 'ready', direction: null, observedAt: null },
      },
    },
    diagnosticOnly: true,
    createsTradeOrder: false,
    createsSetup: false,
    createsSignal: false,
    changesDecisionRules: false,
  } as unknown as UnifiedDecisionLiveObservation;
}

function source(observations: readonly UnifiedDecisionLiveObservation[]): unknown {
  return {
    schema: 'nexus.unified-decision.live-observations',
    version: 1,
    datasetVersion: 'unified-decision-live-observation-dataset-v0.1',
    savedAt: '2026-08-14T01:00:00.000Z',
    nextSequence: observations.length + 1,
    observations,
  };
}

test('validates four symmetry cells and realtime downgrade coverage', () => {
  const report = validateUnifiedDecisionLiveCohort(source([
    observation({ sequence: 1, state: 'possible_long', kind: 'resistance', scenario: 'breakout' }),
    observation({ sequence: 2, state: 'possible_short', kind: 'resistance', scenario: 'bounce' }),
    observation({ sequence: 3, state: 'possible_short', kind: 'support', scenario: 'breakout' }),
    observation({
      sequence: 4,
      state: 'possible_long',
      kind: 'support',
      scenario: 'bounce',
      impulseAvailability: 'stale',
      missing: ['symbol_market_impulse'],
    }),
    observation({
      sequence: 5,
      state: 'wait_confirmation',
      tapeSource: 'stale',
      tapeState: 'supports',
      bookState: 'opposes',
      missing: ['realtime_tape', 'realtime_direction_consensus'],
    }),
  ]), {
    minimumObservationCount: 5,
    minimumSymmetryCellCount: 1,
    minimumRealtimeLossCount: 1,
    minimumDisagreementCount: 1,
  }, { now: () => new Date('2026-08-14T02:00:00.000Z') });

  assert.equal(report.status, 'validated_with_coverage_gaps');
  assert.equal(report.coverage.symmetry.status, 'validated');
  assert.equal(report.coverage.realtime.status, 'validated');
  assert.equal(report.coverage.marketContext.freshnessStatus, 'validated');
  assert.equal(report.violations.length, 0);
  assert.deepEqual(report.coverageGaps.map((gap) => gap.code), [
    'market_context_conflict_not_observed',
    'terminal_setup_outcome_not_observed',
  ]);
  assert.equal(report.decisionRulesChangeRecommended, false);
  assert.equal(report.createsTradeOrder, false);
});

test('reports invalid level-scenario-direction mapping', () => {
  const report = validateUnifiedDecisionLiveCohort(source([
    observation({ sequence: 1, state: 'possible_long', kind: 'support', scenario: 'breakout' }),
  ]), {
    minimumObservationCount: 1,
    minimumSymmetryCellCount: 1,
    minimumRealtimeLossCount: 1,
    minimumDisagreementCount: 1,
  });
  assert.equal(report.status, 'violations_found');
  assert.equal(
    report.violationCounts.possible_level_scenario_direction_mismatch,
    1,
  );
});

test('validates terminal Setup outcome only with the same causal line', () => {
  const valid = validateUnifiedDecisionLiveCohort(source([
    observation({ sequence: 1, state: 'setup_confirmed', terminalSetup: true }),
  ]), {
    minimumObservationCount: 1,
    minimumSymmetryCellCount: 1,
    minimumRealtimeLossCount: 1,
    minimumDisagreementCount: 1,
  });
  assert.equal(valid.coverage.setup.terminalOutcomeStatus, 'validated');
  assert.equal(valid.coverage.setup.causalLinkValidatedObservationCount, 1);

  const invalid = validateUnifiedDecisionLiveCohort(source([
    observation({ sequence: 1, state: 'setup_confirmed', terminalSetup: true, wrongSetupLine: true }),
  ]), {
    minimumObservationCount: 1,
    minimumSymmetryCellCount: 1,
    minimumRealtimeLossCount: 1,
    minimumDisagreementCount: 1,
  });
  assert.equal(invalid.violationCounts.setup_confirmed_causal_line_mismatch, 1);
});

test('accepts export and persistence contracts and rejects unsupported input', () => {
  const item = observation({ sequence: 1 });
  const exportReport = validateUnifiedDecisionLiveCohort({
    version: 'unified-decision-live-observation-dataset-v0.1',
    exportedAt: '2026-08-14T01:00:00.000Z',
    observations: [item],
  }, { minimumObservationCount: 1 });
  assert.equal(exportReport.source.persistenceSchema, null);
  assert.throws(
    () => validateUnifiedDecisionLiveCohort({ version: 'wrong', observations: [] }),
    UnifiedDecisionLiveCohortValidationError,
  );
});
