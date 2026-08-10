import type {
  ApproachEvaluationResult,
  LevelLineApproachEvaluation,
} from '../level-engine/approach-engine.types.js';
import type {
  LevelLine,
} from '../level-engine/level-lines.types.js';
import type {
  ObservationPathProgress,
  ObservationTrackingResult,
} from '../level-engine/observation-tracker.types.js';
import type {
  LevelLineRealtimeConfirmation,
} from '../level-engine/realtime-confirmation-engine.types.js';
import {
  calculateDistanceToLevelPct,
} from './setup-engine.js';
import type {
  SetupDirection,
  SetupEngineSetupType,
  SetupEngineState,
} from './setup-engine.types.js';
import {
  CAUSAL_SETUP_ADAPTER_CONTRACT_VERSION,
} from './causal-setup-adapter.types.js';
import type {
  AdaptCausalSetupCandidatesInput,
  AdaptCausalSetupCandidatesResult,
  SetupCausalContext,
  SetupCausalTransition,
  SetupCausalUpdate,
} from './causal-setup-adapter.types.js';

function fail(
  message: string,
): never {
  throw new Error(
    `Causal Setup Adapter: ${message}`,
  );
}

function timestamp(
  value: string,
  field: string,
): number {
  const parsed =
    Date.parse(value);

  if (!Number.isFinite(parsed)) {
    fail(
      `${field} must be a valid ISO date`,
    );
  }

  return parsed;
}

function directionFor(
  line: LevelLine,
  setupType: SetupEngineSetupType,
): SetupDirection {
  if (setupType === 'level_breakout') {
    return line.kind === 'resistance'
      ? 'long'
      : 'short';
  }

  return line.kind === 'resistance'
    ? 'short'
    : 'long';
}

function observationFor(
  lineId: string,
  tracking: ObservationTrackingResult,
): ObservationPathProgress | null {
  return tracking.activeProgress.find(
    (item) =>
      item.lineId === lineId,
  ) ?? null;
}

function approachFor(
  lineId: string,
  evaluation: ApproachEvaluationResult,
): LevelLineApproachEvaluation | null {
  return evaluation.evaluations.find(
    (item) =>
      item.lineId === lineId,
  ) ?? null;
}

function confirmationFor(
  lineId: string,
  evaluations:
    readonly LevelLineRealtimeConfirmation[],
): LevelLineRealtimeConfirmation | null {
  return evaluations.find(
    (item) =>
      item.lineId === lineId,
  ) ?? null;
}

function causalContext(
  line: LevelLine,
  observation: ObservationPathProgress | null,
  approach: LevelLineApproachEvaluation | null,
  confirmation:
    LevelLineRealtimeConfirmation | null,
  evaluatedAt: string,
  observationProgressThreshold: number,
  maxDistanceToLevelPercent: number,
): SetupCausalContext {
  if (
    confirmation?.stage
      === 'CONFIRMATION'
  ) {
    return Object.freeze({
      version:
        CAUSAL_SETUP_ADAPTER_CONTRACT_VERSION,
      source: 'level_lines',
      lineId: line.id,
      lineStatus: line.status,
      stage: 'CONFIRMATION',
      reason:
        'realtime_confirmation_confirmed',
      observedAt: evaluatedAt,
      observationProgress:
        observation?.progress
        ?? null,
      observationProgressThreshold,
      distanceToLevelPercent:
        approach
          ?.distanceToLevelPercent
        ?? null,
      maxDistanceToLevelPercent,
      realtimeConfirmationStatus:
        confirmation.status,
      realtimeConfirmationReasons:
        Object.freeze([
          ...confirmation.reasons,
        ]),
      sourceObservationalOnly: true,
      sourceCreatesSetup: false,
      sourceCreatesSignal: false,
      evaluatesBreakout: false,
      evaluatesBounce: false,
      usesFutureCandles: false,
      usesFutureRealtimeEvidence: false,
    });
  }

  if (approach?.stage === 'APPROACH') {
    return Object.freeze({
      version:
        CAUSAL_SETUP_ADAPTER_CONTRACT_VERSION,
      source: 'level_lines',
      lineId: line.id,
      lineStatus: line.status,
      stage: 'APPROACH',
      reason:
        'approach_distance_threshold_met',
      observedAt: approach.observedAt,
      observationProgress:
        observation?.progress
        ?? null,
      observationProgressThreshold,
      distanceToLevelPercent:
        approach.distanceToLevelPercent,
      maxDistanceToLevelPercent,
      realtimeConfirmationStatus:
        confirmation?.status
        ?? 'not_applicable',
      realtimeConfirmationReasons:
        Object.freeze([
          ...(confirmation?.reasons
            ?? []),
        ]),
      sourceObservationalOnly: true,
      sourceCreatesSetup: false,
      sourceCreatesSignal: false,
      evaluatesBreakout: false,
      evaluatesBounce: false,
      usesFutureCandles: false,
      usesFutureRealtimeEvidence: false,
    });
  }

  if (observation?.stage === 'OBSERVATION') {
    return Object.freeze({
      version:
        CAUSAL_SETUP_ADAPTER_CONTRACT_VERSION,
      source: 'level_lines',
      lineId: line.id,
      lineStatus: line.status,
      stage: 'OBSERVATION',
      reason:
        'observation_progress_threshold_met',
      observedAt: observation.observedAt,
      observationProgress:
        observation.progress,
      observationProgressThreshold,
      distanceToLevelPercent:
        approach
          ?.distanceToLevelPercent
        ?? null,
      maxDistanceToLevelPercent,
      realtimeConfirmationStatus:
        confirmation?.status
        ?? 'not_applicable',
      realtimeConfirmationReasons:
        Object.freeze([
          ...(confirmation?.reasons
            ?? []),
        ]),
      sourceObservationalOnly: true,
      sourceCreatesSetup: false,
      sourceCreatesSignal: false,
      evaluatesBreakout: false,
      evaluatesBounce: false,
      usesFutureCandles: false,
      usesFutureRealtimeEvidence: false,
    });
  }

  const confirmedAt =
    line.confirmedAt;

  if (!confirmedAt) {
    fail(
      `line ${line.id} is not confirmed`,
    );
  }

  return Object.freeze({
    version:
      CAUSAL_SETUP_ADAPTER_CONTRACT_VERSION,
    source: 'level_lines',
    lineId: line.id,
    lineStatus: line.status,
    stage: 'LEVEL_CONFIRMED',
    reason: 'level_line_confirmed',
    observedAt: confirmedAt,
    observationProgress:
      observation?.progress
      ?? null,
    observationProgressThreshold,
    distanceToLevelPercent:
      approach
        ?.distanceToLevelPercent
      ?? null,
    maxDistanceToLevelPercent,
    realtimeConfirmationStatus:
      confirmation?.status
      ?? 'not_applicable',
    realtimeConfirmationReasons:
      Object.freeze([
        ...(confirmation?.reasons
          ?? []),
      ]),
    sourceObservationalOnly: true,
    sourceCreatesSetup: false,
    sourceCreatesSignal: false,
    evaluatesBreakout: false,
    evaluatesBounce: false,
    usesFutureCandles: false,
    usesFutureRealtimeEvidence: false,
  });
}

function transitionEvents(
  context: SetupCausalContext,
  approach: LevelLineApproachEvaluation | null,
  confirmation:
    LevelLineRealtimeConfirmation | null,
  evaluatedAt: string,
): readonly SetupCausalTransition[] {
  const events:
    SetupCausalTransition[] = [];

  if (
    context.stage === 'APPROACH'
    || context.stage === 'CONFIRMATION'
  ) {
    if (!approach) {
      fail(
        `line ${context.lineId} is missing approach evidence`,
      );
    }

    const approachContext:
      SetupCausalContext =
        context.stage === 'APPROACH'
          ? context
          : Object.freeze({
              ...context,
              stage: 'APPROACH',
              reason:
                'approach_distance_threshold_met',
              observedAt:
                approach.observedAt,
              realtimeConfirmationStatus:
                'not_applicable',
              realtimeConfirmationReasons:
                Object.freeze([]),
            });

    events.push(
      Object.freeze({
        event: Object.freeze({
          type: 'APPROACH_DETECTED',
          price: approach.currentPrice,
          occurredAt: approach.observedAt,
        }),
        context: approachContext,
      }),
    );
  }

  if (context.stage === 'CONFIRMATION') {
    if (!confirmation) {
      fail(
        `line ${context.lineId} is missing realtime confirmation evidence`,
      );
    }

    events.push(
      Object.freeze({
        event: Object.freeze({
          type: 'THIRD_TOUCH_DETECTED',
          price: confirmation.currentPrice,
          occurredAt: evaluatedAt,
        }),
        context,
      }),
    );
  }

  return Object.freeze(events);
}

function baseCandidate(
  line: LevelLine,
  setupType: SetupEngineSetupType,
  currentPrice: number,
  expiresAfterSec: number,
  initialContext: SetupCausalContext,
): SetupEngineState {
  const confirmedAt =
    line.confirmedAt;

  if (!confirmedAt) {
    fail(
      `line ${line.id} is not confirmed`,
    );
  }

  const createdAtMs =
    timestamp(
      initialContext.observedAt,
      'causal.observedAt',
    );
  const expiresAtMs =
    createdAtMs
    + expiresAfterSec * 1_000;

  return Object.freeze({
    id:
      `setup-${line.id}-${setupType}`,
    symbol: line.symbol,
    timeframe: line.timeframe,
    setupType,
    direction:
      directionFor(
        line,
        setupType,
      ),
    stage: 'LEVEL_CONFIRMED',
    outcome: null,
    level: Object.freeze({
      kind: line.kind,
      centerPrice: line.price,
      zoneLow: line.price,
      zoneHigh: line.price,
      touches: line.touchCount,
      confirmedAt,
    }),
    currentPrice,
    distanceToLevelPct:
      calculateDistanceToLevelPct(
        currentPrice,
        line.price,
      ),
    createdAt:
      initialContext.observedAt,
    updatedAt:
      initialContext.observedAt,
    expiresAt:
      new Date(
        expiresAtMs,
      ).toISOString(),
    causal: initialContext,
  });
}

export function adaptCausalSetupCandidates(
  input: AdaptCausalSetupCandidatesInput,
): AdaptCausalSetupCandidatesResult {
  if (input.detection.timeframe !== '1m') {
    fail(
      `unsupported runtime timeframe: ${input.detection.timeframe}`,
    );
  }

  if (
    input.realtimeConfirmation.symbol
      !== input.detection.symbol
    || input.realtimeConfirmation.timeframe
      !== input.detection.timeframe
  ) {
    fail(
      'realtime confirmation identity must match Level Lines detection',
    );
  }

  if (
    !Number.isInteger(
      input.expiresAfterSec,
    )
    || input.expiresAfterSec <= 0
  ) {
    fail(
      'expiresAfterSec must be a positive integer',
    );
  }

  const candidates:
    SetupEngineState[] = [];
  const updates:
    SetupCausalUpdate[] = [];
  const observationProgressThreshold =
    input.detection
      .observationTracking
      .appliedOptions
      .observationPathProgressThreshold;
  const maxDistanceToLevelPercent =
    input.detection
      .approachEvaluation
      .appliedOptions
      .maxDistanceToLevelPercent;
  const currentPrice =
    input.detection
      .observationTracking
      .currentPrice;

  if (currentPrice === null) {
    return Object.freeze({
      version:
        CAUSAL_SETUP_ADAPTER_CONTRACT_VERSION,
      symbol: input.detection.symbol,
      timeframe: '1m',
      candidates: Object.freeze([]),
      updates: Object.freeze([]),
      observationalSourceCreatesSetup:
        false,
      createsSignal: false,
      evaluatesBreakout: false,
      evaluatesBounce: false,
    });
  }

  for (
    const line
    of input.detection.activeLevels
  ) {
    if (
      line.confirmedAt === null
      || (
        line.status !== 'confirmed'
        && line.status !== 'worked'
      )
    ) {
      continue;
    }

    const observation =
      observationFor(
        line.id,
        input.detection
          .observationTracking,
      );

    if (observation?.stage !== 'OBSERVATION') {
      continue;
    }

    const approach =
      approachFor(
        line.id,
        input.detection
          .approachEvaluation,
      );
    const confirmation =
      confirmationFor(
        line.id,
        input.realtimeConfirmation
          .evaluations,
      );
    const context =
      causalContext(
        line,
        observation,
        approach,
        confirmation,
        input.realtimeConfirmation
          .evaluatedAt,
        observationProgressThreshold,
        maxDistanceToLevelPercent,
      );
    const events =
      transitionEvents(
        context,
        approach,
        confirmation,
        input.realtimeConfirmation
          .evaluatedAt,
      );

    for (
      const setupType
      of input.setupTypes
    ) {
      const candidate =
        baseCandidate(
          line,
          setupType,
          currentPrice,
          input.expiresAfterSec,
          context.stage === 'OBSERVATION'
            ? context
            : Object.freeze({
                ...context,
                stage: 'OBSERVATION',
                reason:
                  'observation_progress_threshold_met',
                observedAt:
                  observation.observedAt,
                realtimeConfirmationStatus:
                  'not_applicable',
                realtimeConfirmationReasons:
                  Object.freeze([]),
              }),
        );

      candidates.push(
        candidate,
      );
      updates.push(
        Object.freeze({
          candidateId:
            candidate.id,
          context,
          transitionEvents:
            events,
        }),
      );
    }
  }

  return Object.freeze({
    version:
      CAUSAL_SETUP_ADAPTER_CONTRACT_VERSION,
    symbol: input.detection.symbol,
    timeframe: '1m',
    candidates:
      Object.freeze(candidates),
    updates:
      Object.freeze(updates),
    observationalSourceCreatesSetup:
      false,
    createsSignal: false,
    evaluatesBreakout: false,
    evaluatesBounce: false,
  });
}
