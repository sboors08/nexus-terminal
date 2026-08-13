import type {
  LevelLineApproachEvaluation,
} from '../level-engine/approach-engine.types.js';
import type {
  LevelLine,
  LevelLinesSnapshot,
  LevelLinesSnapshotCandle,
} from '../level-engine/level-lines.types.js';
import type {
  ObservationPathProgress,
} from '../level-engine/observation-tracker.types.js';
import type {
  LevelLineRealtimeConfirmation,
} from '../level-engine/realtime-confirmation-engine.types.js';
import type {
  SetupDirection,
  SetupEngineSetupType,
  SetupEngineState,
} from '../setup-engine/setup-engine.types.js';
import {
  UNIFIED_DECISION_CONTRACT_VERSION,
  type UnifiedDecision,
  type UnifiedDecisionBtcContext,
  type UnifiedDecisionDirection,
  type UnifiedDecisionImpulseContext,
  type UnifiedDecisionInvalidation,
  type UnifiedDecisionLevelContext,
  type UnifiedDecisionMarketAlignment,
  type UnifiedDecisionMarketContext,
  type UnifiedDecisionMissingConfirmation,
  type UnifiedDecisionReason,
  type UnifiedDecisionScenario,
  type UnifiedDecisionSetupContext,
  type UnifiedDecisionState,
} from './unified-decision.types.js';

type UnifiedDecisionLevelSource =
  Omit<
    Pick<
      LevelLinesSnapshot,
      | 'symbol'
      | 'timeframe'
      | 'generatedAt'
      | 'candles'
      | 'lines'
      | 'activeLevels'
      | 'observationTracking'
      | 'approachEvaluation'
      | 'realtimeConfirmation'
    >,
    'candles'
  > & {
    readonly candles:
      readonly Pick<
        LevelLinesSnapshotCandle,
        'close' | 'isClosed'
      >[];
  };

export interface BuildUnifiedDecisionInput {
  readonly levelLines:
    UnifiedDecisionLevelSource;
  readonly setups:
    readonly SetupEngineState[];
  readonly marketContext:
    UnifiedDecisionMarketContext;
}

interface SelectedLevelEvidence {
  readonly line: LevelLine;
  readonly observation:
    ObservationPathProgress | null;
  readonly approach:
    LevelLineApproachEvaluation | null;
  readonly confirmation:
    LevelLineRealtimeConfirmation | null;
  readonly context:
    UnifiedDecisionLevelContext;
}

interface DecisionDraft {
  state: UnifiedDecisionState;
  direction:
    UnifiedDecisionDirection;
  scenario:
    UnifiedDecisionScenario;
  causalStage:
    UnifiedDecision['causalStage'];
  level:
    UnifiedDecisionLevelContext | null;
  setup:
    UnifiedDecisionSetupContext | null;
  reasons:
    UnifiedDecisionReason[];
  missing:
    UnifiedDecisionMissingConfirmation[];
  invalidations:
    UnifiedDecisionInvalidation[];
}

const ACTIVE_MARKET_AVAILABILITY =
  new Set([
    'ready',
    'degraded',
  ]);

const ACTIVE_SETUP_STAGE_RANK:
Readonly<Record<string, number>> = {
  LEVEL_CONFIRMED: 0,
  APPROACHING_THIRD_TOUCH: 1,
  THIRD_TOUCH_CONFIRMED: 2,
};

function fail(
  message: string,
): never {
  throw new Error(
    `Unified Decision: ${message}`,
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
      `${field} must be a valid timestamp`,
    );
  }

  return parsed;
}

function isCurrentSetup(
  setup: SetupEngineState,
  symbol: string,
  timeframe: string,
  generatedAtMs: number,
): boolean {
  return (
    setup.symbol === symbol
    && setup.timeframe === timeframe
    && timestamp(
      setup.expiresAt,
      `setup ${setup.id} expiresAt`,
    ) >= generatedAtMs
  );
}

function isConfirmedOutcome(
  setup: SetupEngineState,
): boolean {
  return (
    (
      setup.stage
        === 'BREAKOUT_CONFIRMED'
      && setup.outcome === 'breakout'
      && setup.setupType
        === 'level_breakout'
    )
    || (
      setup.stage
        === 'REJECTION_CONFIRMED'
      && setup.outcome === 'rejection'
      && setup.setupType
        === 'level_bounce'
    )
  );
}

function compareSetups(
  left: SetupEngineState,
  right: SetupEngineState,
): number {
  const updatedDifference =
    timestamp(
      right.updatedAt,
      `setup ${right.id} updatedAt`,
    )
    - timestamp(
      left.updatedAt,
      `setup ${left.id} updatedAt`,
    );

  return updatedDifference !== 0
    ? updatedDifference
    : left.id.localeCompare(
        right.id,
      );
}

function setupContext(
  setup: SetupEngineState,
): UnifiedDecisionSetupContext {
  return Object.freeze({
    candidateId:
      setup.id,
    setupType:
      setup.setupType,
    direction:
      setup.direction,
    stage:
      setup.stage,
    outcome:
      setup.outcome,
    updatedAt:
      setup.updatedAt,
    expiresAt:
      setup.expiresAt,
  });
}

function scenarioForSetupType(
  setupType: SetupEngineSetupType,
): Exclude<
  UnifiedDecisionScenario,
  null
> {
  return setupType === 'level_breakout'
    ? 'breakout'
    : 'bounce';
}

function directionFor(
  line: LevelLine,
  scenario:
    Exclude<
      UnifiedDecisionScenario,
      null
    >,
): SetupDirection {
  if (scenario === 'breakout') {
    return line.kind === 'resistance'
      ? 'long'
      : 'short';
  }

  return line.kind === 'resistance'
    ? 'short'
    : 'long';
}

function currentPrice(
  levelLines:
    UnifiedDecisionLevelSource,
): number | null {
  return levelLines
    .approachEvaluation
    .currentPrice
    ?? levelLines
      .observationTracking
      .currentPrice
    ?? levelLines.candles
      .filter(
        (candle) => candle.isClosed,
      )
      .at(-1)
      ?.close
    ?? null;
}

function selectActiveSetup(
  setups: readonly SetupEngineState[],
  activeLineIds: ReadonlySet<string>,
): SetupEngineState | null {
  return setups
    .filter(
      (setup) =>
        setup.stage
          in ACTIVE_SETUP_STAGE_RANK
        && setup.causal !== undefined
        && activeLineIds.has(
          setup.causal.lineId,
        ),
    )
    .sort(
      (left, right) => {
        const stageDifference =
          (
            ACTIVE_SETUP_STAGE_RANK[
              right.stage
            ]
            ?? -1
          )
          - (
            ACTIVE_SETUP_STAGE_RANK[
              left.stage
            ]
            ?? -1
          );

        return stageDifference !== 0
          ? stageDifference
          : compareSetups(
              left,
              right,
            );
      },
    )[0]
    ?? null;
}

function selectLine(
  levelLines:
    UnifiedDecisionLevelSource,
  setups: readonly SetupEngineState[],
): {
  readonly line: LevelLine | null;
  readonly setup:
    SetupEngineState | null;
} {
  const activeLineIds =
    new Set(
      levelLines.activeLevels.map(
        (line) => line.id,
      ),
    );
  const activeSetup =
    selectActiveSetup(
      setups,
      activeLineIds,
    );
  const setupLineId =
    activeSetup?.causal?.lineId;

  if (setupLineId) {
    const setupLine =
      levelLines.activeLevels.find(
        (line) =>
          line.id === setupLineId,
      );

    if (setupLine) {
      return {
        line: setupLine,
        setup: activeSetup,
      };
    }
  }

  const price =
    currentPrice(levelLines);
  const line =
    [...levelLines.activeLevels]
      .sort(
        (left, right) => {
          const leftDistance =
            price === null
              ? Number.POSITIVE_INFINITY
              : Math.abs(
                  price - left.price,
                ) / left.price;
          const rightDistance =
            price === null
              ? Number.POSITIVE_INFINITY
              : Math.abs(
                  price - right.price,
                ) / right.price;

          return leftDistance
            - rightDistance
            || left.id.localeCompare(
              right.id,
            );
        },
      )[0]
    ?? null;

  return {
    line,
    setup: null,
  };
}

function evidenceFor(
  levelLines:
    UnifiedDecisionLevelSource,
  line: LevelLine,
): SelectedLevelEvidence {
  const observation =
    levelLines
      .observationTracking
      .activeProgress
      .find(
        (item) =>
          item.lineId === line.id,
      )
    ?? null;
  const approach =
    levelLines
      .approachEvaluation
      .evaluations
      .find(
        (item) =>
          item.lineId === line.id,
      )
    ?? null;
  const confirmation =
    levelLines
      .realtimeConfirmation
      .evaluations
      .find(
        (item) =>
          item.lineId === line.id,
      )
    ?? null;
  const causalStage:
    UnifiedDecisionLevelContext['causalStage'] =
    line.status === 'candidate'
      ? 'LEVEL'
      : confirmation?.stage === 'CONFIRMATION'
      ? 'CONFIRMATION'
      : approach?.stage === 'APPROACH'
        ? 'APPROACH'
        : observation?.stage === 'OBSERVATION'
            ? 'OBSERVATION'
            : 'LEVEL';
  const price =
    currentPrice(levelLines);
  const distance =
    price === null
      ? approach
          ?.distanceToLevelPercent
        ?? null
      : Math.abs(
          price - line.price,
        ) / line.price * 100;

  return {
    line,
    observation,
    approach,
    confirmation,
    context: Object.freeze({
      lineId: line.id,
      kind: line.kind,
      status: line.status,
      levelPrice: line.price,
      currentPrice: price,
      distanceToLevelPercent:
        distance,
      observationProgress:
        observation?.progress
        ?? approach
          ?.observationProgress
        ?? null,
      causalStage,
      realtimeStatus:
        confirmation?.status
        ?? 'not_applicable',
      tapeState:
        confirmation?.tapeState
        ?? 'unavailable',
      orderBookState:
        confirmation?.orderBookState
        ?? 'unavailable',
    }),
  };
}

function availabilityActive(
  value: string,
): boolean {
  return ACTIVE_MARKET_AVAILABILITY
    .has(value);
}

function btcAlignment(
  direction:
    UnifiedDecisionDirection,
  market:
    UnifiedDecisionMarketContext['btc'],
): UnifiedDecisionMarketAlignment {
  if (
    direction === null
    || !availabilityActive(
      market.availability,
    )
    || market.mode === null
  ) {
    return 'unavailable';
  }

  if (market.mode === 'neutral') {
    return 'neutral';
  }

  return (
    (
      direction === 'long'
      && market.mode === 'risk_on'
    )
    || (
      direction === 'short'
      && market.mode === 'risk_off'
    )
  )
    ? 'aligned'
    : 'opposed';
}

function impulseAlignment(
  direction:
    UnifiedDecisionDirection,
  market:
    UnifiedDecisionMarketContext['impulse'],
): UnifiedDecisionMarketAlignment {
  if (
    direction === null
    || !availabilityActive(
      market.availability,
    )
  ) {
    return 'unavailable';
  }

  if (market.direction === null) {
    return 'neutral';
  }

  return market.direction === direction
    ? 'aligned'
    : 'opposed';
}

function marketContexts(
  direction:
    UnifiedDecisionDirection,
  market:
    UnifiedDecisionMarketContext,
): {
  readonly btc:
    UnifiedDecisionBtcContext;
  readonly impulse:
    UnifiedDecisionImpulseContext;
} {
  return {
    btc: Object.freeze({
      ...market.btc,
      alignment:
        btcAlignment(
          direction,
          market.btc,
        ),
    }),
    impulse: Object.freeze({
      ...market.impulse,
      alignment:
        impulseAlignment(
          direction,
          market.impulse,
        ),
    }),
  };
}

function addMarketContext(
  draft: DecisionDraft,
  contexts:
    ReturnType<
      typeof marketContexts
    >,
): void {
  if (
    contexts.btc.alignment
      === 'aligned'
  ) {
    draft.reasons.push(
      'btc_context_aligned',
    );
  } else if (
    contexts.btc.alignment
      === 'unavailable'
  ) {
    draft.missing.push(
      'btc_market_mode',
    );
  }

  if (
    contexts.impulse.alignment
      === 'aligned'
  ) {
    draft.reasons.push(
      'symbol_impulse_aligned',
    );
  } else if (
    contexts.impulse.alignment
      === 'unavailable'
  ) {
    draft.missing.push(
      'symbol_market_impulse',
    );
  }

  const conflicts = [
    contexts.btc.alignment,
    contexts.impulse.alignment,
  ].filter(
    (alignment) =>
      alignment === 'opposed',
  ).length;

  if (conflicts === 0) {
    return;
  }

  draft.invalidations.push(
    'market_context_reversal',
  );

  if (conflicts === 1) {
    draft.state =
      'wait_confirmation';
    draft.reasons.push(
      'market_context_conflict',
    );
    return;
  }

  draft.state = 'skip';
  draft.reasons.push(
    'market_context_double_conflict',
  );
}

function missingRealtime(
  confirmation:
    LevelLineRealtimeConfirmation | null,
): UnifiedDecisionMissingConfirmation[] {
  const missing:
    UnifiedDecisionMissingConfirmation[] = [];

  if (
    confirmation?.tapeState
      === 'unavailable'
    || !confirmation
  ) {
    missing.push(
      'realtime_tape',
    );
  }

  if (
    confirmation?.orderBookState
      === 'unavailable'
    || !confirmation
  ) {
    missing.push(
      'realtime_order_book',
    );
  }

  if (
    !confirmation
    || confirmation.tapeState
      !== confirmation.orderBookState
    || ![
      'supports',
      'opposes',
    ].includes(
      confirmation.tapeState,
    )
  ) {
    missing.push(
      'realtime_direction_consensus',
    );
  }

  return missing;
}

function baseDraft(
  evidence:
    SelectedLevelEvidence,
  setup:
    SetupEngineState | null,
): DecisionDraft {
  const draft: DecisionDraft = {
    state: 'observe',
    direction: null,
    scenario: null,
    causalStage:
      evidence.context
        .causalStage,
    level:
      evidence.context,
    setup:
      setup
        ? setupContext(setup)
        : null,
    reasons: [],
    missing: [],
    invalidations: [
      'level_superseded_or_broken',
      'source_freshness_lost',
    ],
  };

  if (
    evidence.line.status
      === 'candidate'
  ) {
    draft.reasons.push(
      'level_candidate_detected',
    );
    draft.missing.push(
      'observation_progress',
      'approach_to_level',
      ...missingRealtime(
        evidence.confirmation,
      ),
      'setup_outcome',
    );
    return draft;
  }

  if (
    evidence.observation?.stage
      !== 'OBSERVATION'
  ) {
    draft.reasons.push(
      'level_confirmed',
    );
    draft.missing.push(
      'observation_progress',
      'approach_to_level',
      ...missingRealtime(
        evidence.confirmation,
      ),
      'setup_outcome',
    );
    return draft;
  }

  if (
    evidence.approach?.stage
      !== 'APPROACH'
  ) {
    draft.reasons.push(
      'observation_progress_active',
    );
    draft.missing.push(
      'approach_to_level',
      ...missingRealtime(
        evidence.confirmation,
      ),
      'setup_outcome',
    );
    return draft;
  }

  draft.state =
    'wait_confirmation';
  draft.reasons.push(
    'approach_active',
  );
  draft.missing.push(
    ...missingRealtime(
      evidence.confirmation,
    ),
    'setup_outcome',
  );
  draft.invalidations.push(
    'realtime_evidence_reversal',
  );

  const confirmation =
    evidence.confirmation;
  const interactionReady =
    confirmation
    && confirmation.approachSideValid
    && confirmation
      .candleIntersectsLevelZone;
  const supports =
    interactionReady
    && confirmation.tapeState
      === 'supports'
    && confirmation.orderBookState
      === 'supports';
  const opposes =
    interactionReady
    && confirmation.tapeState
      === 'opposes'
    && confirmation.orderBookState
      === 'opposes';

  if (!supports && !opposes) {
    return draft;
  }

  draft.scenario =
    supports
      ? 'breakout'
      : 'bounce';
  draft.direction =
    directionFor(
      evidence.line,
      draft.scenario,
    );
  draft.state =
    draft.direction === 'long'
      ? 'possible_long'
      : 'possible_short';
  draft.causalStage =
    'CONFIRMATION';
  draft.reasons.push(
    supports
      ? 'realtime_sources_support_breakout'
      : 'realtime_sources_support_bounce',
  );
  draft.missing =
    draft.missing.filter(
      (item) =>
        item !== 'realtime_tape'
        && item !== 'realtime_order_book'
        && item
          !== 'realtime_direction_consensus',
    );

  return draft;
}

function unique<T>(
  values: readonly T[],
): readonly T[] {
  return Object.freeze([
    ...new Set(values),
  ]);
}

function buildResult(
  input: BuildUnifiedDecisionInput,
  draft: DecisionDraft,
): UnifiedDecision {
  const contexts =
    marketContexts(
      draft.direction,
      input.marketContext,
    );

  if (
    draft.state === 'possible_long'
    || draft.state === 'possible_short'
  ) {
    addMarketContext(
      draft,
      contexts,
    );
  }

  return Object.freeze({
    version:
      UNIFIED_DECISION_CONTRACT_VERSION,
    symbol:
      input.levelLines.symbol,
    timeframe:
      input.levelLines.timeframe,
    generatedAt:
      input.levelLines.generatedAt,
    state:
      draft.state,
    direction:
      draft.direction,
    scenario:
      draft.scenario,
    causalStage:
      draft.causalStage,
    level:
      draft.level,
    setup:
      draft.setup,
    marketContext:
      Object.freeze(contexts),
    reasons:
      unique(draft.reasons),
    missingConfirmations:
      unique(draft.missing),
    invalidations:
      unique(draft.invalidations),
    decisionSupportOnly: true,
    createsTradeOrder: false,
    createsSetup: false,
    createsSignal: false,
    createsScore: false,
    estimatesProfitability: false,
    changesExistingLifecycle: false,
    usesFutureData: false,
  });
}

export function buildUnifiedDecision(
  input: BuildUnifiedDecisionInput,
): UnifiedDecision {
  const generatedAtMs =
    timestamp(
      input.levelLines.generatedAt,
      'generatedAt',
    );
  const symbol =
    input.levelLines.symbol;
  const timeframe =
    input.levelLines.timeframe;
  const currentSetups =
    input.setups
      .filter(
        (setup) =>
          isCurrentSetup(
            setup,
            symbol,
            timeframe,
            generatedAtMs,
          ),
      );
  const confirmedSetup =
    currentSetups
      .filter(
        isConfirmedOutcome,
      )
      .sort(compareSetups)[0]
    ?? null;

  if (confirmedSetup) {
    const lineId =
      confirmedSetup.causal?.lineId;
    const line =
      lineId
        ? input.levelLines.lines.find(
            (item) =>
              item.id === lineId,
          )
          ?? null
        : null;
    const evidence =
      line
        ? evidenceFor(
            input.levelLines,
            line,
          )
        : null;
    const scenario =
      scenarioForSetupType(
        confirmedSetup.setupType,
      );

    return buildResult(
      input,
      {
        state: 'setup_confirmed',
        direction:
          confirmedSetup.direction,
        scenario,
        causalStage: 'OUTCOME',
        level:
          evidence?.context
          ?? null,
        setup:
          setupContext(
            confirmedSetup,
          ),
        reasons: [
          scenario === 'breakout'
            ? 'setup_breakout_confirmed'
            : 'setup_bounce_confirmed',
        ],
        missing: [],
        invalidations: [
          'setup_expired',
          'source_freshness_lost',
        ],
      },
    );
  }

  const selection =
    selectLine(
      input.levelLines,
      currentSetups,
    );

  if (!selection.line) {
    return buildResult(
      input,
      {
        state: 'skip',
        direction: null,
        scenario: null,
        causalStage: null,
        level: null,
        setup: null,
        reasons: [
          'no_active_level',
        ],
        missing: [
          'active_level',
        ],
        invalidations: [],
      },
    );
  }

  const evidence =
    evidenceFor(
      input.levelLines,
      selection.line,
    );
  const draft =
    baseDraft(
      evidence,
      selection.setup,
    );

  return buildResult(
    input,
    draft,
  );
}
