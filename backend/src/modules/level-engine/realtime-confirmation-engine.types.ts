import type {
  RealtimeTrade,
} from '../realtime-market-data/realtime-market-data.types.js';
import type {
  ApproachEvaluationResult,
  LevelLineApproachEvaluation,
} from './approach-engine.types.js';
import type {
  LevelEngineTimeframe,
} from './level-engine.types.js';
import type {
  LevelEngineCandle,
} from './level-engine-touch-detector.types.js';

export const REALTIME_CONFIRMATION_ENGINE_CONTRACT_VERSION =
  'realtime-confirmation-engine-v0.1' as const;

export type RealtimeConfirmationDirection =
  | 'up'
  | 'down';

export type RealtimeConfirmationSourceState =
  | 'collecting'
  | 'live'
  | 'stale'
  | 'error';

export type RealtimeConfirmationEvidenceState =
  | 'supports'
  | 'opposes'
  | 'neutral'
  | 'unavailable';

export type RealtimeConfirmationStatus =
  | 'not_applicable'
  | 'collecting'
  | 'not_ready'
  | 'partial'
  | 'confirmed';

export type RealtimeConfirmationEvidenceAvailability =
  | 'complete'
  | 'tape_only'
  | 'order_book_only'
  | 'unavailable';

export interface RealtimeConfirmationEngineOptions {
  readonly interactionTolerancePercent:
    number;
  readonly tapeWindowMs: number;
  readonly tapeStaleAfterMs: number;
  readonly minimumTapeTradesCount:
    number;
  readonly directionalPressureThresholdPercent:
    number;
}

export interface RealtimeConfirmationTapeCapture {
  readonly snapshotUpdatedAt:
    string | null;
  readonly trades:
    readonly RealtimeTrade[];
}

export interface RealtimeConfirmationOrderBookCapture {
  readonly state:
    RealtimeConfirmationSourceState;
  readonly synchronized: boolean;
  readonly updatedAt: string | null;
  readonly ageMs: number | null;
  readonly staleAfterMs: number;
  readonly bestBid: number | null;
  readonly bestAsk: number | null;
  readonly spreadPct: number | null;
  readonly bidDepthQuote: number;
  readonly askDepthQuote: number;
  readonly totalDepthQuote: number;
  readonly imbalancePct: number | null;
}

export interface RealtimeConfirmationEvidenceCapture {
  readonly symbol: string;
  readonly capturedAt: string;
  readonly tape:
    RealtimeConfirmationTapeCapture
    | null;
  readonly orderBook:
    RealtimeConfirmationOrderBookCapture
    | null;
  readonly sourceErrors:
    readonly string[];
}

export interface RealtimeConfirmationTapeEvidence {
  readonly state:
    RealtimeConfirmationSourceState;
  readonly snapshotUpdatedAt:
    string | null;
  readonly lastTradeAt: string | null;
  readonly ageMs: number | null;
  readonly windowMs: number;
  readonly tradesCount: number;
  readonly ignoredFutureTradesCount:
    number;
  readonly ignoredOutsideWindowTradesCount:
    number;
  readonly executionsCount: number;
  readonly buyQuoteValue: number;
  readonly sellQuoteValue: number;
  readonly totalQuoteValue: number;
  readonly quoteDelta: number;
  readonly pressurePct: number | null;
}

export interface RealtimeConfirmationOrderBookEvidence {
  readonly state:
    RealtimeConfirmationSourceState;
  readonly synchronized: boolean;
  readonly updatedAt: string | null;
  readonly updatedAfterCapture:
    boolean;
  readonly ageMs: number | null;
  readonly staleAfterMs: number | null;
  readonly bestBid: number | null;
  readonly bestAsk: number | null;
  readonly spreadPct: number | null;
  readonly bidDepthQuote: number | null;
  readonly askDepthQuote: number | null;
  readonly totalDepthQuote: number | null;
  readonly imbalancePct: number | null;
}

export interface RealtimeConfirmationMarketEvidence {
  readonly symbol: string;
  readonly capturedAt: string;
  readonly availability:
    RealtimeConfirmationEvidenceAvailability;
  readonly tape:
    RealtimeConfirmationTapeEvidence;
  readonly orderBook:
    RealtimeConfirmationOrderBookEvidence;
  readonly sourceErrors:
    readonly string[];
}

export interface LevelLineRealtimeConfirmation {
  readonly lineId: string;
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly kind:
    LevelLineApproachEvaluation['kind'];
  readonly levelPrice: number;
  readonly currentPrice: number;
  readonly currentCandleIndex: number;
  readonly currentCandleOpenTime: string;
  readonly observedAt: string;
  readonly approachStage:
    'APPROACH' | null;
  readonly interactionDirection:
    RealtimeConfirmationDirection;
  readonly approachSideValid: boolean;
  readonly candleIntersectsLevelZone:
    boolean;
  readonly tapePressurePercent:
    number | null;
  readonly directionalTapePressurePercent:
    number | null;
  readonly tapeState:
    RealtimeConfirmationEvidenceState;
  readonly orderBookImbalancePercent:
    number | null;
  readonly directionalOrderBookPressurePercent:
    number | null;
  readonly orderBookState:
    RealtimeConfirmationEvidenceState;
  readonly status:
    RealtimeConfirmationStatus;
  readonly stage:
    'CONFIRMATION' | null;
  readonly reasons:
    readonly string[];
}

export interface RealtimeConfirmationEvaluationInput {
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly approachEvaluation:
    ApproachEvaluationResult;
  readonly currentClosedCandle:
    LevelEngineCandle | null;
  readonly evidence:
    RealtimeConfirmationEvidenceCapture;
}

export interface RealtimeConfirmationEvaluationResult {
  readonly version:
    typeof REALTIME_CONFIRMATION_ENGINE_CONTRACT_VERSION;
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly evaluatedAt: string;
  readonly evaluations:
    readonly LevelLineRealtimeConfirmation[];
  readonly evidence:
    RealtimeConfirmationMarketEvidence;
  readonly appliedOptions:
    RealtimeConfirmationEngineOptions;
  readonly observationalOnly: true;
  readonly evaluatesRealtimeConfirmation:
    true;
  readonly evaluatesBreakout: false;
  readonly evaluatesBounce: false;
  readonly createsSetup: false;
  readonly createsSignal: false;
  readonly createsScore: false;
  readonly learnsFromOutcome: false;
  readonly usesFutureCandles: false;
  readonly usesFutureRealtimeEvidence:
    false;
}
