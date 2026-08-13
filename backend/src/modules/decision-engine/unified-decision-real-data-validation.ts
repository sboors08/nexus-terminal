import {
  DEFAULT_LEVEL_LINES_DETECTION_OPTIONS,
  detectLevelLines,
} from '../level-engine/level-lines-detector.js';
import type {
  LevelEngineCandle,
} from '../level-engine/level-engine-touch-detector.types.js';
import {
  normalizeLevelEngineSymbol,
} from '../level-engine/level-engine.contract.js';
import type {
  LevelEngineRealDataValidationReport,
  LevelEngineValidationDatasetSnapshot,
} from '../level-engine/level-engine-real-data-validation.types.js';
import type {
  LevelLinesDetectionOptions,
} from '../level-engine/level-lines.types.js';
import {
  evaluateRealtimeConfirmations,
} from '../level-engine/realtime-confirmation-engine.js';
import {
  buildUnifiedDecision,
} from './unified-decision.js';
import {
  UNIFIED_DECISION_REAL_DATA_VALIDATION_VERSION,
} from './unified-decision-real-data-validation.types.js';
import type {
  UnifiedDecisionDatasetValidationReport,
  UnifiedDecisionEmpiricalCoverage,
  UnifiedDecisionRealDataValidationAppliedOptions,
  UnifiedDecisionRealDataValidationOptions,
  UnifiedDecisionRealDataValidationReport,
  UnifiedDecisionRealDataValidationTotals,
  UnifiedDecisionScenarioSymmetryCoverage,
  UnifiedDecisionSymbolValidationReport,
  UnifiedDecisionValidationObservation,
  UnifiedDecisionValidationTotals,
  UnifiedDecisionValidationTransition,
  UnifiedDecisionValidationViolation,
  UnifiedDecisionValidationViolationCode,
} from './unified-decision-real-data-validation.types.js';
import type {
  UnifiedDecision,
  UnifiedDecisionInvalidation,
  UnifiedDecisionMissingConfirmation,
  UnifiedDecisionReason,
  UnifiedDecisionState,
} from './unified-decision.types.js';

interface IndexedClosedCandle {
  readonly originalIndex: number;
  readonly candle: LevelEngineCandle;
}

export interface UnifiedDecisionRealDataReplayProgress {
  readonly symbol: string;
  readonly completedStepCount: number;
  readonly totalStepCount: number;
  readonly currentClosedCandleCount: number;
  readonly totalClosedCandleCount: number;
}

export interface UnifiedDecisionRealDataValidationDependencies {
  readonly onReplayProgress?: (
    progress: UnifiedDecisionRealDataReplayProgress,
  ) => void;
}

export class UnifiedDecisionRealDataValidationError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      'UnifiedDecisionRealDataValidationError';
  }
}

const UNAVAILABLE_MARKET_CONTEXT =
  Object.freeze({
    btc: Object.freeze({
      availability: 'unavailable' as const,
      mode: null,
      observedAt: null,
    }),
    impulse: Object.freeze({
      availability: 'unavailable' as const,
      direction: null,
      observedAt: null,
    }),
  });

const UNAVAILABLE_SOURCE =
  Object.freeze({
    availability: 'unavailable' as const,
    observedAt: null,
  });

const STATES = Object.freeze([
  'observe',
  'possible_long',
  'possible_short',
  'wait_confirmation',
  'setup_confirmed',
  'skip',
] as const);

const REASONS = Object.freeze([
  'no_active_level',
  'level_candidate_detected',
  'level_confirmed',
  'observation_progress_active',
  'approach_active',
  'realtime_sources_support_breakout',
  'realtime_sources_support_bounce',
  'setup_breakout_confirmed',
  'setup_bounce_confirmed',
  'btc_context_aligned',
  'symbol_impulse_aligned',
  'market_context_conflict',
  'market_context_double_conflict',
] as const satisfies readonly UnifiedDecisionReason[]);

const MISSING = Object.freeze([
  'active_level',
  'observation_progress',
  'approach_to_level',
  'realtime_tape',
  'realtime_order_book',
  'realtime_direction_consensus',
  'setup_outcome',
  'btc_market_mode',
  'symbol_market_impulse',
] as const satisfies readonly UnifiedDecisionMissingConfirmation[]);

const INVALIDATIONS = Object.freeze([
  'level_superseded_or_broken',
  'realtime_evidence_reversal',
  'market_context_reversal',
  'setup_expired',
  'source_freshness_lost',
] as const satisfies readonly UnifiedDecisionInvalidation[]);

function fail(message: string): never {
  throw new UnifiedDecisionRealDataValidationError(
    message,
  );
}

function positiveInteger(
  value: number,
  field: string,
): number {
  if (
    !Number.isSafeInteger(value)
    || value <= 0
  ) {
    fail(
      `${field} must be a positive integer`,
    );
  }

  return value;
}

function positiveFinite(
  value: number,
  field: string,
): number {
  if (
    !Number.isFinite(value)
    || value <= 0
  ) {
    fail(
      `${field} must be a positive finite number`,
    );
  }

  return value;
}

function canonicalTimestamp(
  value: string,
  field: string,
): string {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    fail(
      `${field} must be a valid timestamp`,
    );
  }

  return new Date(parsed).toISOString();
}

function cloneLevelLinesOptions(
  value: LevelLinesDetectionOptions,
): LevelLinesDetectionOptions {
  return Object.freeze({
    ...value,
  });
}

function appliedOptions(
  value: UnifiedDecisionRealDataValidationOptions,
): UnifiedDecisionRealDataValidationAppliedOptions {
  const levelLinesOptions =
    cloneLevelLinesOptions(
      value.levelLinesOptions
      ?? DEFAULT_LEVEL_LINES_DETECTION_OPTIONS,
    );
  const fallbackStart =
    levelLinesOptions.atrPeriod
    + levelLinesOptions.pivotLeftBars
    + levelLinesOptions.pivotRightBars;

  return Object.freeze({
    startAtClosedCandleCount:
      positiveInteger(
        value.startAtClosedCandleCount
        ?? fallbackStart,
        'startAtClosedCandleCount',
      ),
    levelLinesOptions,
    historicalRealtimeTapeMode:
      'unavailable',
    historicalOrderBookMode:
      'unavailable',
    historicalSetupLifecycleMode:
      'unavailable',
    historicalBtcMarketMode:
      'unavailable',
    historicalSymbolImpulseMode:
      'unavailable',
  });
}

function validateDataset(
  value: LevelEngineValidationDatasetSnapshot,
): {
  readonly symbol: string;
  readonly closed:
    readonly IndexedClosedCandle[];
  readonly ignoredOpenCandlesCount: number;
} {
  const symbol =
    normalizeLevelEngineSymbol(
      value.symbol,
    );

  if (value.sourceTimeframe !== '1m') {
    fail(
      `dataset ${symbol} must use the production 1m timeframe`,
    );
  }

  let previousOpenMs =
    Number.NEGATIVE_INFINITY;
  let openCandleSeen = false;
  let ignoredOpenCandlesCount = 0;
  const closed: IndexedClosedCandle[] = [];

  value.candles.forEach(
    (candle, originalIndex) => {
      const openTime =
        canonicalTimestamp(
          candle.openTime,
          `candles[${originalIndex}].openTime`,
        );
      const closeTime =
        canonicalTimestamp(
          candle.closeTime,
          `candles[${originalIndex}].closeTime`,
        );
      const openMs = Date.parse(openTime);
      const closeMs = Date.parse(closeTime);

      if (openMs <= previousOpenMs) {
        fail(
          'dataset candles must be strictly ordered and unique',
        );
      }
      if (closeMs < openMs) {
        fail(
          `candles[${originalIndex}].closeTime cannot precede openTime`,
        );
      }

      const open = positiveFinite(
        candle.open,
        `candles[${originalIndex}].open`,
      );
      const high = positiveFinite(
        candle.high,
        `candles[${originalIndex}].high`,
      );
      const low = positiveFinite(
        candle.low,
        `candles[${originalIndex}].low`,
      );
      const close = positiveFinite(
        candle.close,
        `candles[${originalIndex}].close`,
      );

      if (
        low > high
        || open < low
        || open > high
        || close < low
        || close > high
      ) {
        fail(
          `candles[${originalIndex}] contains invalid OHLC values`,
        );
      }

      if (!candle.isClosed) {
        openCandleSeen = true;
        ignoredOpenCandlesCount += 1;
      } else if (openCandleSeen) {
        fail(
          'closed candles cannot appear after an open candle',
        );
      }

      previousOpenMs = openMs;

      if (candle.isClosed) {
        closed.push(
          Object.freeze({
            originalIndex,
            candle: Object.freeze({
              openTime,
              closeTime,
              open,
              high,
              low,
              close,
              isClosed: true,
            }),
          }),
        );
      }
    },
  );

  return Object.freeze({
    symbol,
    closed: Object.freeze(closed),
    ignoredOpenCandlesCount,
  });
}

function zeroRecord<K extends string>(
  keys: readonly K[],
): Record<K, number> {
  return Object.fromEntries(
    keys.map((key) => [key, 0]),
  ) as Record<K, number>;
}

function emptyTotals(): {
  stateCounts: Record<UnifiedDecisionState, number>;
  scenarioCounts: Record<'none' | 'bounce' | 'breakout', number>;
  directionCounts: Record<'none' | 'long' | 'short', number>;
  causalStageCounts: Record<'none' | 'LEVEL' | 'OBSERVATION' | 'APPROACH' | 'CONFIRMATION' | 'OUTCOME', number>;
  levelKindCounts: Record<'none' | 'support' | 'resistance', number>;
  reasonCounts: Record<UnifiedDecisionReason, number>;
  missingConfirmationCounts: Record<UnifiedDecisionMissingConfirmation, number>;
  invalidationCounts: Record<UnifiedDecisionInvalidation, number>;
} {
  return {
    stateCounts: zeroRecord(STATES),
    scenarioCounts: zeroRecord([
      'none', 'bounce', 'breakout',
    ] as const),
    directionCounts: zeroRecord([
      'none', 'long', 'short',
    ] as const),
    causalStageCounts: zeroRecord([
      'none', 'LEVEL', 'OBSERVATION', 'APPROACH',
      'CONFIRMATION', 'OUTCOME',
    ] as const),
    levelKindCounts: zeroRecord([
      'none', 'support', 'resistance',
    ] as const),
    reasonCounts: zeroRecord(REASONS),
    missingConfirmationCounts:
      zeroRecord(MISSING),
    invalidationCounts:
      zeroRecord(INVALIDATIONS),
  };
}

function addViolation(
  values: UnifiedDecisionValidationViolation[],
  code: UnifiedDecisionValidationViolationCode,
  symbol: string,
  candleIndex: number,
  observedAt: string,
  message: string,
): void {
  values.push(
    Object.freeze({
      code,
      symbol,
      observedCandleIndex: candleIndex,
      observedAt,
      message,
    }),
  );
}

function validateDecision(
  decision: UnifiedDecision,
  repeated: UnifiedDecision,
  lineIds: ReadonlySet<string>,
  symbol: string,
  candleIndex: number,
  observedAt: string,
  violations: UnifiedDecisionValidationViolation[],
): void {
  if (
    JSON.stringify(decision)
    !== JSON.stringify(repeated)
  ) {
    addViolation(
      violations,
      'non_deterministic_decision',
      symbol,
      candleIndex,
      observedAt,
      'the same causal prefix produced different Unified Decision values',
    );
  }

  if (
    Date.parse(decision.generatedAt)
    > Date.parse(observedAt)
  ) {
    addViolation(
      violations,
      'future_decision_timestamp',
      symbol,
      candleIndex,
      observedAt,
      'decision generatedAt is later than the closed-candle observation',
    );
  }

  if (
    decision.level
    && !lineIds.has(decision.level.lineId)
  ) {
    addViolation(
      violations,
      'level_line_not_in_prefix',
      symbol,
      candleIndex,
      observedAt,
      `decision line ${decision.level.lineId} is absent from the causal prefix`,
    );
  }

  if (
    decision.level
    && (
      decision.level.currentPrice !== null
      && !Number.isFinite(
        decision.level.currentPrice,
      )
    )
  ) {
    addViolation(
      violations,
      'level_context_mismatch',
      symbol,
      candleIndex,
      observedAt,
      'decision level contains a non-finite current price',
    );
  }

  if (
    decision.state === 'possible_long'
    || decision.state === 'possible_short'
    || decision.state === 'setup_confirmed'
  ) {
    addViolation(
      violations,
      'unsupported_offline_state',
      symbol,
      candleIndex,
      observedAt,
      `${decision.state} cannot be established without historical realtime/setup evidence`,
    );
  }

  if (decision.scenario !== null) {
    addViolation(
      violations,
      'scenario_without_historical_realtime_evidence',
      symbol,
      candleIndex,
      observedAt,
      `${decision.scenario} scenario was produced without historical realtime evidence`,
    );
  }

  if (
    decision.state === 'setup_confirmed'
    && decision.setup === null
  ) {
    addViolation(
      violations,
      'setup_confirmed_without_terminal_outcome',
      symbol,
      candleIndex,
      observedAt,
      'setup_confirmed has no terminal Setup outcome',
    );
  }

  for (const context of [
    decision.marketContext.btc,
    decision.marketContext.impulse,
  ]) {
    if (
      context.availability !== 'unavailable'
      || context.observedAt !== null
    ) {
      addViolation(
        violations,
        'available_market_context_without_source',
        symbol,
        candleIndex,
        observedAt,
        'market context is available although the historical source is unavailable',
      );
      break;
    }
  }

  if (
    decision.decisionSupportOnly !== true
    || decision.createsTradeOrder !== false
    || decision.createsSetup !== false
    || decision.createsSignal !== false
    || decision.createsScore !== false
    || decision.estimatesProfitability !== false
    || decision.changesExistingLifecycle !== false
    || decision.usesFutureData !== false
  ) {
    addViolation(
      violations,
      'safety_contract_changed',
      symbol,
      candleIndex,
      observedAt,
      'Unified Decision safety flags changed during validation',
    );
  }
}

function freezeTotals(
  counts: ReturnType<typeof emptyTotals>,
  values: Omit<
    UnifiedDecisionValidationTotals,
    | 'stateCounts'
    | 'scenarioCounts'
    | 'directionCounts'
    | 'causalStageCounts'
    | 'levelKindCounts'
    | 'reasonCounts'
    | 'missingConfirmationCounts'
    | 'invalidationCounts'
  >,
): UnifiedDecisionValidationTotals {
  return Object.freeze({
    ...values,
    stateCounts: Object.freeze(counts.stateCounts),
    scenarioCounts: Object.freeze(counts.scenarioCounts),
    directionCounts: Object.freeze(counts.directionCounts),
    causalStageCounts: Object.freeze(counts.causalStageCounts),
    levelKindCounts: Object.freeze(counts.levelKindCounts),
    reasonCounts: Object.freeze(counts.reasonCounts),
    missingConfirmationCounts:
      Object.freeze(counts.missingConfirmationCounts),
    invalidationCounts:
      Object.freeze(counts.invalidationCounts),
  });
}

function scenarioSymmetry(
  observations:
    readonly UnifiedDecisionValidationObservation[],
): readonly UnifiedDecisionScenarioSymmetryCoverage[] {
  const rows = [
    ['resistance', 'breakout', 'long'],
    ['resistance', 'bounce', 'short'],
    ['support', 'breakout', 'short'],
    ['support', 'bounce', 'long'],
  ] as const;

  return Object.freeze(
    rows.map(
      ([levelKind, scenario, expectedDirection]) =>
        Object.freeze({
          levelKind,
          scenario,
          expectedDirection,
          realObservationCount:
            observations.filter(
              (observation) =>
                observation.levelKind === levelKind
                && observation.scenario === scenario
                && observation.direction === expectedDirection,
            ).length,
        }),
    ),
  );
}

function empiricalCoverage(
  observations:
    readonly UnifiedDecisionValidationObservation[],
): UnifiedDecisionEmpiricalCoverage {
  const symmetry =
    scenarioSymmetry(observations);

  return Object.freeze({
    realtimeEvidenceObservationCount: 0,
    setupOutcomeObservationCount: 0,
    btcContextObservationCount: 0,
    impulseContextObservationCount: 0,
    possibleDirectionObservationCount:
      observations.filter(
        (observation) =>
          observation.direction !== null,
      ).length,
    setupConfirmedObservationCount:
      observations.filter(
        (observation) =>
          observation.state === 'setup_confirmed',
      ).length,
    staleContextObservationCount: 0,
    scenarioSymmetryValidatedFromRealObservations:
      symmetry.every(
        (row) =>
          row.realObservationCount > 0,
      ),
    staleDowngradeValidatedFromRealObservations:
      false,
    setupOutcomeValidatedFromRealObservations:
      false,
    requiresLiveObservationDataset: true,
  });
}

export function replayUnifiedDecisionRealDataDataset(
  dataset: LevelEngineValidationDatasetSnapshot,
  optionsValue:
    UnifiedDecisionRealDataValidationOptions = {},
  dependencies:
    UnifiedDecisionRealDataValidationDependencies = {},
): UnifiedDecisionDatasetValidationReport {
  const validated = validateDataset(dataset);
  const options = appliedOptions(optionsValue);

  if (
    options.startAtClosedCandleCount
    > validated.closed.length
  ) {
    fail(
      `dataset ${validated.symbol} has ${validated.closed.length} closed candles, fewer than startAtClosedCandleCount ${options.startAtClosedCandleCount}`,
    );
  }

  const observations:
    UnifiedDecisionValidationObservation[] = [];
  const transitions:
    UnifiedDecisionValidationTransition[] = [];
  const violations:
    UnifiedDecisionValidationViolation[] = [];
  const uniqueLineIds = new Set<string>();
  const counts = emptyTotals();
  let previousState: UnifiedDecisionState | null = null;
  let previousLineId: string | null = null;
  const totalStepCount =
    validated.closed.length
    - options.startAtClosedCandleCount
    + 1;

  for (
    let closedCount = options.startAtClosedCandleCount;
    closedCount <= validated.closed.length;
    closedCount += 1
  ) {
    const current = validated.closed[closedCount - 1];

    if (!current) {
      continue;
    }

    const prefix = Object.freeze(
      validated.closed
        .slice(0, closedCount)
        .map((value) => value.candle),
    );
    const detection = detectLevelLines(
      {
        symbol: validated.symbol,
        timeframe: '1m',
        candles: prefix,
      },
      options.levelLinesOptions,
    );
    const currentClosedCandle =
      detection.approachEvaluation.currentCandleIndex
        === null
        ? null
        : prefix[
            detection.approachEvaluation.currentCandleIndex
          ] ?? null;
    const realtimeConfirmation =
      evaluateRealtimeConfirmations({
        symbol: validated.symbol,
        timeframe: '1m',
        approachEvaluation:
          detection.approachEvaluation,
        currentClosedCandle,
        evidence: Object.freeze({
          symbol: validated.symbol,
          capturedAt:
            current.candle.closeTime,
          tape: null,
          orderBook: null,
          sourceErrors:
            Object.freeze([]),
        }),
      });
    const decisionInput = {
      levelLines: {
        ...detection,
        generatedAt:
          current.candle.closeTime,
        realtimeConfirmation,
        candles: prefix,
      },
      setups: Object.freeze([]),
      marketContext:
        UNAVAILABLE_MARKET_CONTEXT,
    } as const;
    const decision =
      buildUnifiedDecision(decisionInput);
    const repeated =
      buildUnifiedDecision(decisionInput);
    const lineIds =
      new Set(
        detection.lines.map(
          (line) => line.id,
        ),
      );

    validateDecision(
      decision,
      repeated,
      lineIds,
      validated.symbol,
      current.originalIndex,
      current.candle.closeTime,
      violations,
    );

    const observationIndex =
      observations.length;
    const lineId =
      decision.level?.lineId
      ?? null;
    const observation =
      Object.freeze({
        observationIndex,
        closedCandleCount: closedCount,
        observedCandleIndex:
          current.originalIndex,
        observedAt:
          current.candle.closeTime,
        currentPrice:
          detection.approachEvaluation.currentPrice,
        state: decision.state,
        direction: decision.direction,
        scenario: decision.scenario,
        causalStage: decision.causalStage,
        lineId,
        levelKind:
          decision.level?.kind
          ?? null,
        reasons:
          Object.freeze([...decision.reasons]),
        missingConfirmations:
          Object.freeze([
            ...decision.missingConfirmations,
          ]),
        invalidations:
          Object.freeze([...decision.invalidations]),
        sources: Object.freeze({
          candleCloseAt:
            current.candle.closeTime,
          realtimeTape: UNAVAILABLE_SOURCE,
          orderBook: UNAVAILABLE_SOURCE,
          setupLifecycle: UNAVAILABLE_SOURCE,
          btcMarketMode: UNAVAILABLE_SOURCE,
          symbolImpulse: UNAVAILABLE_SOURCE,
        }),
      } satisfies UnifiedDecisionValidationObservation);

    observations.push(observation);

    if (
      previousState !== decision.state
      || previousLineId !== lineId
    ) {
      transitions.push(
        Object.freeze({
          transitionIndex:
            transitions.length,
          observationIndex,
          observedAt:
            current.candle.closeTime,
          fromState: previousState,
          toState: decision.state,
          fromLineId: previousLineId,
          toLineId: lineId,
        }),
      );
    }

    if (lineId) {
      uniqueLineIds.add(lineId);
    }
    counts.stateCounts[decision.state] += 1;
    counts.scenarioCounts[
      decision.scenario ?? 'none'
    ] += 1;
    counts.directionCounts[
      decision.direction ?? 'none'
    ] += 1;
    counts.causalStageCounts[
      decision.causalStage ?? 'none'
    ] += 1;
    counts.levelKindCounts[
      decision.level?.kind ?? 'none'
    ] += 1;
    decision.reasons.forEach(
      (reason) => {
        counts.reasonCounts[reason] += 1;
      },
    );
    decision.missingConfirmations.forEach(
      (missing) => {
        counts.missingConfirmationCounts[missing] += 1;
      },
    );
    decision.invalidations.forEach(
      (invalidation) => {
        counts.invalidationCounts[invalidation] += 1;
      },
    );

    previousState = decision.state;
    previousLineId = lineId;

    dependencies.onReplayProgress?.(
      Object.freeze({
        symbol: validated.symbol,
        completedStepCount:
          observationIndex + 1,
        totalStepCount,
        currentClosedCandleCount:
          closedCount,
        totalClosedCandleCount:
          validated.closed.length,
      }),
    );
  }

  const frozenObservations =
    Object.freeze(observations);
  const frozenTransitions =
    Object.freeze(transitions);
  const frozenViolations =
    Object.freeze(violations);
  const symmetry =
    scenarioSymmetry(frozenObservations);
  const coverage =
    empiricalCoverage(frozenObservations);
  const futureLeakageCount =
    violations.filter(
      (value) =>
        value.code === 'future_decision_timestamp'
        || value.code === 'future_source_timestamp',
    ).length;
  const unsupportedOfflineStateCount =
    violations.filter(
      (value) =>
        value.code === 'unsupported_offline_state'
        || value.code === 'scenario_without_historical_realtime_evidence',
    ).length;

  return Object.freeze({
    symbol: validated.symbol,
    sourceTimeframe: '1m',
    closedCandlesCount:
      validated.closed.length,
    ignoredOpenCandlesCount:
      validated.ignoredOpenCandlesCount,
    firstClosedAt:
      validated.closed[0]?.candle.closeTime
      ?? null,
    lastClosedAt:
      validated.closed.at(-1)?.candle.closeTime
      ?? null,
    observations: frozenObservations,
    transitions: frozenTransitions,
    violations: frozenViolations,
    totals: freezeTotals(counts, {
      replayStepCount:
        observations.length,
      uniqueDecisionLineCount:
        uniqueLineIds.size,
      marketContextConflictObservationCount:
        observations.filter(
          (observation) =>
            observation.reasons.includes(
              'market_context_conflict',
            )
            || observation.reasons.includes(
              'market_context_double_conflict',
            ),
        ).length,
      transitionCount:
        transitions.length,
      lineTransitionCount:
        transitions.filter(
          (transition) =>
            transition.fromLineId
            !== transition.toLineId,
        ).length,
      deterministicMismatchCount:
        violations.filter(
          (value) =>
            value.code === 'non_deterministic_decision',
        ).length,
      futureLeakageCount,
      unsupportedOfflineStateCount,
      violationCount:
        violations.length,
    }),
    empiricalCoverage: coverage,
    scenarioSymmetry: symmetry,
    appliedOptions: options,
    historicalRealtimeEvidenceAvailable: false,
    historicalSetupLifecycleAvailable: false,
    historicalMarketContextAvailable: false,
    validatesOfflineFallback: true,
    validatesPossibleDirectionScenarios: false,
    validatesSetupOutcomes: false,
    usesFutureCandles: false,
    usesFutureSourceEvidence: false,
  });
}

function cloneDataset(
  value: LevelEngineValidationDatasetSnapshot,
): LevelEngineValidationDatasetSnapshot {
  return Object.freeze({
    symbol:
      normalizeLevelEngineSymbol(value.symbol),
    sourceTimeframe:
      value.sourceTimeframe,
    candles: Object.freeze(
      value.candles.map(
        (candle) =>
          Object.freeze({ ...candle }),
      ),
    ),
  });
}

function sum(values: readonly number[]): number {
  return values.reduce(
    (total, value) => total + value,
    0,
  );
}

function aggregateTotals(
  datasets:
    readonly UnifiedDecisionDatasetValidationReport[],
): UnifiedDecisionRealDataValidationTotals {
  const counts = emptyTotals();

  for (const dataset of datasets) {
    for (const state of STATES) {
      counts.stateCounts[state] +=
        dataset.totals.stateCounts[state];
    }
    for (const key of ['none', 'bounce', 'breakout'] as const) {
      counts.scenarioCounts[key] +=
        dataset.totals.scenarioCounts[key];
    }
    for (const key of ['none', 'long', 'short'] as const) {
      counts.directionCounts[key] +=
        dataset.totals.directionCounts[key];
    }
    for (const key of ['none', 'LEVEL', 'OBSERVATION', 'APPROACH', 'CONFIRMATION', 'OUTCOME'] as const) {
      counts.causalStageCounts[key] +=
        dataset.totals.causalStageCounts[key];
    }
    for (const key of ['none', 'support', 'resistance'] as const) {
      counts.levelKindCounts[key] +=
        dataset.totals.levelKindCounts[key];
    }
    for (const reason of REASONS) {
      counts.reasonCounts[reason] +=
        dataset.totals.reasonCounts[reason];
    }
    for (const missing of MISSING) {
      counts.missingConfirmationCounts[missing] +=
        dataset.totals.missingConfirmationCounts[missing];
    }
    for (const invalidation of INVALIDATIONS) {
      counts.invalidationCounts[invalidation] +=
        dataset.totals.invalidationCounts[invalidation];
    }
  }

  const base = freezeTotals(counts, {
    replayStepCount: sum(
      datasets.map((value) => value.totals.replayStepCount),
    ),
    uniqueDecisionLineCount: sum(
      datasets.map((value) => value.totals.uniqueDecisionLineCount),
    ),
    marketContextConflictObservationCount: sum(
      datasets.map((value) => value.totals.marketContextConflictObservationCount),
    ),
    transitionCount: sum(
      datasets.map((value) => value.totals.transitionCount),
    ),
    lineTransitionCount: sum(
      datasets.map((value) => value.totals.lineTransitionCount),
    ),
    deterministicMismatchCount: sum(
      datasets.map((value) => value.totals.deterministicMismatchCount),
    ),
    futureLeakageCount: sum(
      datasets.map((value) => value.totals.futureLeakageCount),
    ),
    unsupportedOfflineStateCount: sum(
      datasets.map((value) => value.totals.unsupportedOfflineStateCount),
    ),
    violationCount: sum(
      datasets.map((value) => value.totals.violationCount),
    ),
  });

  return Object.freeze({
    ...base,
    symbolCount: datasets.length,
    datasetCount: datasets.length,
    closedCandlesCount: sum(
      datasets.map((value) => value.closedCandlesCount),
    ),
    ignoredOpenCandlesCount: sum(
      datasets.map((value) => value.ignoredOpenCandlesCount),
    ),
  });
}

export function buildUnifiedDecisionRealDataValidationReport(
  source: LevelEngineRealDataValidationReport,
  optionsValue:
    UnifiedDecisionRealDataValidationOptions = {},
  dependencies:
    UnifiedDecisionRealDataValidationDependencies = {},
): UnifiedDecisionRealDataValidationReport {
  if (
    source.version !== 'level-engine-real-data-validation-v0.1'
    || source.observationalOnly !== true
    || source.createsSetup !== false
    || source.usesQualityScore !== false
  ) {
    fail(
      'source Level Engine validation contract is incompatible',
    );
  }
  if (!source.requestedTimeframes.includes('1m')) {
    fail(
      'source validation must include the production 1m timeframe',
    );
  }

  const generatedAt =
    canonicalTimestamp(
      source.generatedAt,
      'source generatedAt',
    );
  const options = appliedOptions(optionsValue);
  const sourceDatasets = Object.freeze(
    source.symbolReports
      .flatMap((symbolReport) => symbolReport.datasets)
      .filter((dataset) => dataset.sourceTimeframe === '1m')
      .map(cloneDataset),
  );

  if (sourceDatasets.length === 0) {
    fail(
      'source validation contains no 1m datasets',
    );
  }

  const keys = new Set<string>();
  const symbolReports:
    UnifiedDecisionSymbolValidationReport[] = [];

  for (const dataset of sourceDatasets) {
    const symbol =
      normalizeLevelEngineSymbol(dataset.symbol);
    const key = `${symbol}:1m`;

    if (keys.has(key)) {
      fail(`duplicate source dataset: ${key}`);
    }
    keys.add(key);

    symbolReports.push(
      Object.freeze({
        symbol,
        dataset:
          replayUnifiedDecisionRealDataDataset(
            dataset,
            options,
            dependencies,
          ),
      }),
    );
  }

  symbolReports.sort(
    (left, right) =>
      left.symbol.localeCompare(right.symbol),
  );

  const datasets =
    symbolReports.map((value) => value.dataset);
  const observations =
    datasets.flatMap((value) => value.observations);
  const totals = aggregateTotals(datasets);
  const coverage = empiricalCoverage(observations);
  const symmetry = scenarioSymmetry(observations);

  return Object.freeze({
    version:
      UNIFIED_DECISION_REAL_DATA_VALIDATION_VERSION,
    sourceValidationVersion: source.version,
    generatedAt,
    requestedSymbols: Object.freeze(
      source.requestedSymbols.map(
        (symbol) => normalizeLevelEngineSymbol(symbol),
      ),
    ),
    sourceDatasets,
    symbolReports: Object.freeze(symbolReports),
    totals,
    empiricalCoverage: coverage,
    scenarioSymmetry: symmetry,
    appliedOptions: options,
    offlineOnly: true,
    reusesFetchedDatasets: true,
    historicalRealtimeEvidenceAvailable: false,
    historicalSetupLifecycleAvailable: false,
    historicalMarketContextAvailable: false,
    validatesOfflineFallback: true,
    validatesPossibleDirectionScenarios: false,
    validatesSetupOutcomes: false,
    changesTradingRules: false,
    createsLiveDecision: false,
    createsTradeOrder: false,
    createsSetup: false,
    createsSignal: false,
    createsScore: false,
    estimatesProfitability: false,
    appliesTraining: false,
    usesFutureCandles: false,
    usesFutureSourceEvidence: false,
  });
}
