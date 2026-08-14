import type {
  LevelEngineTimeframe,
} from '../level-engine/level-engine.types.js';
import type {
  UnifiedDecisionState,
} from './unified-decision.types.js';
import type {
  UnifiedDecisionLiveObservation,
} from './unified-decision-live-observation.types.js';

export const UNIFIED_DECISION_COVERAGE_GAP_OBSERVATION_VERSION =
  'unified-decision-coverage-gap-observation-v0.1' as const;

export const UNIFIED_DECISION_COVERAGE_GAP_PERSISTENCE_SCHEMA =
  'nexus.unified-decision.coverage-gap-observations' as const;

export const UNIFIED_DECISION_COVERAGE_GAP_PERSISTENCE_VERSION =
  1 as const;

export type UnifiedDecisionCoverageGapKind =
  | 'market_context_single_conflict'
  | 'market_context_double_conflict'
  | 'terminal_setup_outcome';

export interface UnifiedDecisionCoverageGapTransition {
  readonly fromObservationId: string;
  readonly fromSequence: number;
  readonly fromState: UnifiedDecisionState;
  readonly fromLineId: string | null;
  readonly toState: UnifiedDecisionState;
  readonly toLineId: string | null;
}

export type UnifiedDecisionCoverageGapViolationCode =
  | 'single_conflict_not_downgraded'
  | 'single_conflict_missing_contract'
  | 'double_conflict_not_skipped'
  | 'double_conflict_missing_contract'
  | 'conflict_produced_possible_state'
  | 'terminal_outcome_not_confirmed'
  | 'setup_confirmed_without_captured_terminal'
  | 'setup_confirmed_causal_line_mismatch'
  | 'setup_confirmed_reason_mismatch'
  | 'safety_contract_changed';

export interface UnifiedDecisionCoverageGapViolation {
  readonly code: UnifiedDecisionCoverageGapViolationCode;
  readonly message: string;
}

export interface UnifiedDecisionCoverageGapCase {
  readonly id: string;
  readonly sequence: number;
  readonly observedAt: string;
  readonly kind: UnifiedDecisionCoverageGapKind;
  readonly sourceObservationId: string;
  readonly sourceObservationSequence: number;
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly conflictCount: 0 | 1 | 2;
  readonly terminalCandidateIds: readonly string[];
  readonly transition: UnifiedDecisionCoverageGapTransition | null;
  readonly violations: readonly UnifiedDecisionCoverageGapViolation[];
  readonly observation: UnifiedDecisionLiveObservation;
  readonly diagnosticOnly: true;
  readonly createsTradeOrder: false;
  readonly createsSignal: false;
  readonly changesDecisionRules: false;
}

export interface UnifiedDecisionCoverageGapFilter {
  readonly kind?: UnifiedDecisionCoverageGapKind;
  readonly symbol?: string;
  readonly timeframe?: LevelEngineTimeframe;
  readonly limit?: number;
}

export type UnifiedDecisionCoverageGapObserverState =
  | 'idle'
  | 'ready'
  | 'degraded'
  | 'stopped';

export type UnifiedDecisionCoverageGapCoverageState =
  | 'observed'
  | 'not_observed';

export interface UnifiedDecisionCoverageGapCoverage {
  readonly kind: UnifiedDecisionCoverageGapKind;
  readonly state: UnifiedDecisionCoverageGapCoverageState;
  readonly caseCount: number;
  readonly firstObservedAt: string | null;
  readonly lastObservedAt: string | null;
}

export interface UnifiedDecisionCoverageGapStatus {
  readonly version: typeof UNIFIED_DECISION_COVERAGE_GAP_OBSERVATION_VERSION;
  readonly state: UnifiedDecisionCoverageGapObserverState;
  readonly persistenceMode: 'persistent' | 'runtime_only';
  readonly persistenceAdapter: string | null;
  readonly capacityPerKind: number;
  readonly maxCaseCount: number;
  readonly caseCount: number;
  readonly sourceObservationCount: number;
  readonly transitionCount: number;
  readonly violationCount: number;
  readonly firstObservedAt: string | null;
  readonly lastObservedAt: string | null;
  readonly nextSequence: number;
  readonly lastPersistenceErrorCode: string | null;
  readonly coverage: readonly UnifiedDecisionCoverageGapCoverage[];
  readonly diagnosticOnly: true;
  readonly createsTradeOrder: false;
  readonly changesDecisionRules: false;
}

export interface UnifiedDecisionCoverageGapReport {
  readonly version: typeof UNIFIED_DECISION_COVERAGE_GAP_OBSERVATION_VERSION;
  readonly exportedAt: string;
  readonly status: UnifiedDecisionCoverageGapStatus;
  readonly cases: readonly UnifiedDecisionCoverageGapCase[];
}

export interface UnifiedDecisionCoverageGapPersistenceSnapshot {
  readonly schema: typeof UNIFIED_DECISION_COVERAGE_GAP_PERSISTENCE_SCHEMA;
  readonly version: typeof UNIFIED_DECISION_COVERAGE_GAP_PERSISTENCE_VERSION;
  readonly reportVersion: typeof UNIFIED_DECISION_COVERAGE_GAP_OBSERVATION_VERSION;
  readonly savedAt: string;
  readonly nextSequence: number;
  readonly cases: readonly UnifiedDecisionCoverageGapCase[];
}

export interface UnifiedDecisionCoverageGapPersistence {
  readonly adapter: string;
  load(): Promise<unknown | null>;
  save(
    snapshot: UnifiedDecisionCoverageGapPersistenceSnapshot,
  ): Promise<void>;
}

export interface UnifiedDecisionCoverageGapObserver {
  start(): Promise<void>;
  stop(): Promise<void>;
  flush(): Promise<void>;
  observe(
    observation: UnifiedDecisionLiveObservation,
  ): readonly UnifiedDecisionCoverageGapCase[];
  getStatus(): UnifiedDecisionCoverageGapStatus;
  getCases(
    filter?: UnifiedDecisionCoverageGapFilter,
  ): readonly UnifiedDecisionCoverageGapCase[];
  exportReport(
    filter?: UnifiedDecisionCoverageGapFilter,
  ): UnifiedDecisionCoverageGapReport;
}
