import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildUnifiedDecision,
  type BuildUnifiedDecisionInput,
} from '../src/modules/decision-engine/unified-decision.js';
import type {
  UnifiedDecisionMarketContext,
} from '../src/modules/decision-engine/unified-decision.types.js';
import type {
  LevelEngineKind,
} from '../src/modules/level-engine/level-engine.types.js';
import type {
  RealtimeConfirmationEvidenceState,
} from '../src/modules/level-engine/realtime-confirmation-engine.types.js';
import type {
  SetupEngineState,
} from '../src/modules/setup-engine/setup-engine.types.js';

const GENERATED_AT =
  '2026-08-13T12:00:00.000Z';

type LevelSource =
  BuildUnifiedDecisionInput['levelLines'];

function marketContext(
  values: {
    readonly mode?:
      'risk_on'
      | 'neutral'
      | 'risk_off'
      | null;
    readonly btcAvailability?:
      UnifiedDecisionMarketContext['btc']['availability'];
    readonly impulse?:
      'long'
      | 'short'
      | null;
    readonly impulseAvailability?:
      UnifiedDecisionMarketContext['impulse']['availability'];
  } = {},
): UnifiedDecisionMarketContext {
  return {
    btc: {
      availability:
        values.btcAvailability
        ?? 'ready',
      mode:
        values.mode
        ?? 'neutral',
      observedAt:
        GENERATED_AT,
    },
    impulse: {
      availability:
        values.impulseAvailability
        ?? 'ready',
      direction:
        values.impulse
        ?? null,
      observedAt:
        GENERATED_AT,
    },
  };
}

function levelSource(
  values: {
    readonly kind?: LevelEngineKind;
    readonly status?:
      'candidate'
      | 'confirmed'
      | 'worked';
    readonly observation?: boolean;
    readonly approach?: boolean;
    readonly tape?:
      RealtimeConfirmationEvidenceState;
    readonly book?:
      RealtimeConfirmationEvidenceState;
    readonly active?: boolean;
  } = {},
): LevelSource {
  const kind =
    values.kind
    ?? 'resistance';
  const status =
    values.status
    ?? 'confirmed';
  const observation =
    values.observation
    ?? true;
  const approach =
    values.approach
    ?? true;
  const tape =
    values.tape
    ?? 'supports';
  const book =
    values.book
    ?? 'supports';
  const active =
    values.active
    ?? true;
  const price =
    100;
  const currentPrice =
    kind === 'resistance'
      ? 99.9
      : 100.1;
  const line = {
    id: `line-${kind}`,
    symbol: 'ETHUSDT',
    timeframe: '1m',
    price,
    kind,
    originCandleIndex: 1,
    originExtremumAt:
      '2026-08-13T11:00:00.000Z',
    originExtremumPrice: price,
    activeFrom:
      '2026-08-13T11:01:00.000Z',
    confirmedAt:
      status === 'candidate'
        ? null
        : '2026-08-13T11:10:00.000Z',
    touchCount:
      status === 'candidate'
        ? 1
        : 2,
    status,
    workedAt:
      status === 'worked'
        ? '2026-08-13T11:30:00.000Z'
        : null,
    supersededAt: null,
    supersessionEvidence: null,
    brokenAt: null,
    breakEvidence: null,
  } as const;
  const observationItem = {
    lineId: line.id,
    symbol: 'ETHUSDT',
    timeframe: '1m',
    kind,
    levelPrice: price,
    departureExtremumPrice:
      kind === 'resistance'
        ? 98
        : 102,
    departureExtremumObservedAt:
      '2026-08-13T11:20:00.000Z',
    currentPrice,
    currentCandleIndex: 59,
    currentCandleOpenTime:
      '2026-08-13T11:59:00.000Z',
    observedAt: GENERATED_AT,
    progress: 0.95,
    observationPathProgressThreshold:
      0.5,
    stage:
      observation
        ? 'OBSERVATION'
        : null,
  } as const;
  const approachItem = {
    lineId: line.id,
    symbol: 'ETHUSDT',
    timeframe: '1m',
    kind,
    levelPrice: price,
    currentPrice,
    currentCandleIndex: 59,
    currentCandleOpenTime:
      '2026-08-13T11:59:00.000Z',
    observedAt: GENERATED_AT,
    observationProgress: 0.95,
    observationStage:
      observation
        ? 'OBSERVATION'
        : null,
    distanceToLevelPercent: 0.1,
    maxDistanceToLevelPercent: 0.5,
    stage:
      approach
        ? 'APPROACH'
        : null,
  } as const;
  const confirmation = {
    lineId: line.id,
    symbol: 'ETHUSDT',
    timeframe: '1m',
    kind,
    levelPrice: price,
    currentPrice,
    currentCandleIndex: 59,
    currentCandleOpenTime:
      '2026-08-13T11:59:00.000Z',
    observedAt: GENERATED_AT,
    approachStage:
      approach
        ? 'APPROACH'
        : null,
    interactionDirection:
      kind === 'resistance'
        ? 'up'
        : 'down',
    approachSideValid: true,
    candleIntersectsLevelZone: true,
    tapePressurePercent: 20,
    directionalTapePressurePercent:
      tape === 'supports'
        ? 20
        : tape === 'opposes'
          ? -20
          : 0,
    tapeState: tape,
    orderBookImbalancePercent: 20,
    directionalOrderBookPressurePercent:
      book === 'supports'
        ? 20
        : book === 'opposes'
          ? -20
          : 0,
    orderBookState: book,
    status:
      tape === 'supports'
      && book === 'supports'
        ? 'confirmed'
        : 'not_ready',
    stage:
      tape === 'supports'
      && book === 'supports'
        ? 'CONFIRMATION'
        : null,
    reasons: [],
  } as const;

  return {
    symbol: 'ETHUSDT',
    timeframe: '1m',
    generatedAt: GENERATED_AT,
    candles: [
      {
        openTime:
          '2026-08-13T11:59:00.000Z',
        closeTime: GENERATED_AT,
        open: currentPrice,
        high: 100.2,
        low: 99.8,
        close: currentPrice,
        volume: 100,
        isClosed: true,
      },
    ],
    lines:
      active
        ? [line]
        : [],
    activeLevels:
      active
        ? [line]
        : [],
    observationTracking: {
      symbol: 'ETHUSDT',
      timeframe: '1m',
      currentPrice,
      activeProgress:
        active
          ? [observationItem]
          : [],
    },
    approachEvaluation: {
      symbol: 'ETHUSDT',
      timeframe: '1m',
      currentPrice,
      evaluations:
        active
          ? [approachItem]
          : [],
    },
    realtimeConfirmation: {
      symbol: 'ETHUSDT',
      timeframe: '1m',
      evaluations:
        active
          ? [confirmation]
          : [],
    },
  } as unknown as LevelSource;
}

function decision(
  levelLines: LevelSource,
  market:
    UnifiedDecisionMarketContext =
      marketContext(),
  setups:
    readonly SetupEngineState[] = [],
) {
  return buildUnifiedDecision({
    levelLines,
    marketContext: market,
    setups,
  });
}

test(
  'returns skip without an active causal level',
  () => {
    const result =
      decision(
        levelSource({
          active: false,
        }),
      );

    assert.equal(result.state, 'skip');
    assert.equal(result.direction, null);
    assert.deepEqual(
      result.reasons,
      ['no_active_level'],
    );
    assert.deepEqual(
      result.missingConfirmations,
      ['active_level'],
    );
  },
);

test(
  'keeps candidate, confirmed and observation-only levels observational',
  () => {
    const candidate =
      decision(
        levelSource({
          status: 'candidate',
        }),
      );
    const confirmed =
      decision(
        levelSource({
          observation: false,
          approach: false,
          tape: 'unavailable',
          book: 'unavailable',
        }),
      );
    const observation =
      decision(
        levelSource({
          approach: false,
          tape: 'unavailable',
          book: 'unavailable',
        }),
      );

    assert.equal(candidate.state, 'observe');
    assert.equal(candidate.causalStage, 'LEVEL');
    assert.ok(
      candidate.reasons.includes(
        'level_candidate_detected',
      ),
    );
    assert.equal(confirmed.state, 'observe');
    assert.equal(confirmed.causalStage, 'LEVEL');
    assert.equal(observation.state, 'observe');
    assert.equal(
      observation.causalStage,
      'OBSERVATION',
    );
  },
);

test(
  'waits when approach evidence is partial or sources disagree',
  () => {
    const partial =
      decision(
        levelSource({
          tape: 'supports',
          book: 'neutral',
        }),
      );
    const disagreement =
      decision(
        levelSource({
          tape: 'supports',
          book: 'opposes',
        }),
      );

    assert.equal(
      partial.state,
      'wait_confirmation',
    );
    assert.equal(
      disagreement.state,
      'wait_confirmation',
    );
    assert.equal(partial.direction, null);
    assert.ok(
      partial.missingConfirmations
        .includes(
          'realtime_direction_consensus',
        ),
    );
  },
);

test(
  'maps support and resistance breakout pressure to the correct possible direction',
  () => {
    const resistance =
      decision(
        levelSource({
          kind: 'resistance',
        }),
      );
    const support =
      decision(
        levelSource({
          kind: 'support',
        }),
      );

    assert.equal(
      resistance.state,
      'possible_long',
    );
    assert.equal(
      resistance.scenario,
      'breakout',
    );
    assert.equal(
      support.state,
      'possible_short',
    );
    assert.equal(
      support.scenario,
      'breakout',
    );
  },
);

test(
  'maps opposing pressure to the mirrored bounce direction',
  () => {
    const resistance =
      decision(
        levelSource({
          kind: 'resistance',
          tape: 'opposes',
          book: 'opposes',
        }),
      );
    const support =
      decision(
        levelSource({
          kind: 'support',
          tape: 'opposes',
          book: 'opposes',
        }),
      );

    assert.equal(
      resistance.state,
      'possible_short',
    );
    assert.equal(
      resistance.scenario,
      'bounce',
    );
    assert.equal(
      support.state,
      'possible_long',
    );
    assert.equal(
      support.scenario,
      'bounce',
    );
  },
);

test(
  'uses BTC and symbol impulse only as alignment filters',
  () => {
    const aligned =
      decision(
        levelSource(),
        marketContext({
          mode: 'risk_on',
          impulse: 'long',
        }),
      );
    const oneConflict =
      decision(
        levelSource(),
        marketContext({
          mode: 'risk_off',
          impulse: 'long',
        }),
      );
    const doubleConflict =
      decision(
        levelSource(),
        marketContext({
          mode: 'risk_off',
          impulse: 'short',
        }),
      );

    assert.equal(
      aligned.state,
      'possible_long',
    );
    assert.ok(
      aligned.reasons.includes(
        'btc_context_aligned',
      ),
    );
    assert.ok(
      aligned.reasons.includes(
        'symbol_impulse_aligned',
      ),
    );
    assert.equal(
      oneConflict.state,
      'wait_confirmation',
    );
    assert.equal(
      doubleConflict.state,
      'skip',
    );
  },
);

test(
  'reports stale market context as missing instead of inventing alignment',
  () => {
    const result =
      decision(
        levelSource(),
        marketContext({
          mode: 'risk_on',
          btcAvailability: 'stale',
          impulse: 'long',
          impulseAvailability: 'stale',
        }),
      );

    assert.equal(
      result.state,
      'possible_long',
    );
    assert.equal(
      result.marketContext.btc.alignment,
      'unavailable',
    );
    assert.deepEqual(
      result.missingConfirmations.slice(-2),
      [
        'btc_market_mode',
        'symbol_market_impulse',
      ],
    );
  },
);

test(
  'promotes only an existing Setup Engine terminal outcome to setup_confirmed',
  () => {
    const setup:
      SetupEngineState = {
        id: 'setup-confirmed',
        symbol: 'ETHUSDT',
        timeframe: '1m',
        setupType: 'level_bounce',
        direction: 'short',
        stage: 'REJECTION_CONFIRMED',
        outcome: 'rejection',
        level: {
          kind: 'resistance',
          centerPrice: 100,
          zoneLow: 99.9,
          zoneHigh: 100.1,
          touches: 3,
          confirmedAt:
            '2026-08-13T11:10:00.000Z',
        },
        currentPrice: 99,
        distanceToLevelPct: 1,
        createdAt:
          '2026-08-13T11:10:00.000Z',
        updatedAt:
          '2026-08-13T11:59:00.000Z',
        expiresAt:
          '2026-08-13T13:00:00.000Z',
      };
    const result =
      decision(
        levelSource({
          tape: 'supports',
          book: 'supports',
        }),
        marketContext({
          mode: 'risk_on',
          impulse: 'long',
        }),
        [setup],
      );

    assert.equal(
      result.state,
      'setup_confirmed',
    );
    assert.equal(
      result.direction,
      'short',
    );
    assert.equal(
      result.scenario,
      'bounce',
    );
    assert.deepEqual(
      result.reasons,
      ['setup_bounce_confirmed'],
    );
  },
);

test(
  'ignores expired setup outcomes and remains deterministic',
  () => {
    const expired = {
      id: 'expired',
      symbol: 'ETHUSDT',
      timeframe: '1m',
      setupType: 'level_breakout',
      direction: 'long',
      stage: 'BREAKOUT_CONFIRMED',
      outcome: 'breakout',
      level: {
        kind: 'resistance',
        centerPrice: 100,
        zoneLow: 99.9,
        zoneHigh: 100.1,
        touches: 3,
        confirmedAt:
          '2026-08-13T10:00:00.000Z',
      },
      currentPrice: 101,
      distanceToLevelPct: 1,
      createdAt:
        '2026-08-13T10:00:00.000Z',
      updatedAt:
        '2026-08-13T10:30:00.000Z',
      expiresAt:
        '2026-08-13T11:00:00.000Z',
    } as const satisfies SetupEngineState;
    const input:
      BuildUnifiedDecisionInput = {
        levelLines:
          levelSource(),
        marketContext:
          marketContext(),
        setups: [expired],
      };
    const first =
      buildUnifiedDecision(input);
    const second =
      buildUnifiedDecision(input);

    assert.equal(
      first.state,
      'possible_long',
    );
    assert.deepEqual(first, second);
    assert.equal(
      first.decisionSupportOnly,
      true,
    );
    assert.equal(
      first.createsTradeOrder,
      false,
    );
    assert.equal(
      first.createsSignal,
      false,
    );
    assert.equal(
      first.estimatesProfitability,
      false,
    );
  },
);
