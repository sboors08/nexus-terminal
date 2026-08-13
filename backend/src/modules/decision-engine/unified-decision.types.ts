import type {
  LevelEngineKind,
  LevelEngineTimeframe,
} from '../level-engine/level-engine.types.js';
import type {
  LevelLineStatus,
} from '../level-engine/level-lines.types.js';
import type {
  RealtimeConfirmationEvidenceState,
  RealtimeConfirmationStatus,
} from '../level-engine/realtime-confirmation-engine.types.js';
import type {
  SetupDirection,
  SetupEngineOutcome,
  SetupEngineSetupType,
  SetupEngineStage,
} from '../setup-engine/setup-engine.types.js';
import type {
  BtcMarketMode,
} from '../alerts/btc-market-mode-alert-event-source.js';
import type {
  BtcMarketModeAvailability,
} from '../alerts/btc-market-mode-producer.js';
import type {
  MarketImpulseDirection,
} from '../alerts/market-impulse-alert-event-source.js';
import type {
  MarketImpulseAvailability,
} from '../alerts/market-impulse-producer.js';

export const UNIFIED_DECISION_CONTRACT_VERSION =
  'unified-decision-v0.1' as const;

export type UnifiedDecisionState =
  | 'observe'
  | 'possible_long'
  | 'possible_short'
  | 'wait_confirmation'
  | 'setup_confirmed'
  | 'skip';

export type UnifiedDecisionScenario =
  | 'bounce'
  | 'breakout'
  | null;

export type UnifiedDecisionDirection =
  | SetupDirection
  | null;

export type UnifiedDecisionCausalStage =
  | 'LEVEL'
  | 'OBSERVATION'
  | 'APPROACH'
  | 'CONFIRMATION'
  | 'OUTCOME'
  | null;

export type UnifiedDecisionMarketAlignment =
  | 'aligned'
  | 'opposed'
  | 'neutral'
  | 'unavailable';

export type UnifiedDecisionReason =
  | 'no_active_level'
  | 'level_candidate_detected'
  | 'level_confirmed'
  | 'observation_progress_active'
  | 'approach_active'
  | 'realtime_sources_support_breakout'
  | 'realtime_sources_support_bounce'
  | 'setup_breakout_confirmed'
  | 'setup_bounce_confirmed'
  | 'btc_context_aligned'
  | 'symbol_impulse_aligned'
  | 'market_context_conflict'
  | 'market_context_double_conflict';

export type UnifiedDecisionMissingConfirmation =
  | 'active_level'
  | 'observation_progress'
  | 'approach_to_level'
  | 'realtime_tape'
  | 'realtime_order_book'
  | 'realtime_direction_consensus'
  | 'setup_outcome'
  | 'btc_market_mode'
  | 'symbol_market_impulse';

export type UnifiedDecisionInvalidation =
  | 'level_superseded_or_broken'
  | 'realtime_evidence_reversal'
  | 'market_context_reversal'
  | 'setup_expired'
  | 'source_freshness_lost';

export interface UnifiedDecisionBtcContext {
  readonly availability:
    BtcMarketModeAvailability;
  readonly mode: BtcMarketMode | null;
  readonly observedAt: string | null;
  readonly alignment:
    UnifiedDecisionMarketAlignment;
}

export interface UnifiedDecisionImpulseContext {
  readonly availability:
    MarketImpulseAvailability;
  readonly direction:
    MarketImpulseDirection | null;
  readonly observedAt: string | null;
  readonly alignment:
    UnifiedDecisionMarketAlignment;
}

export interface UnifiedDecisionMarketContext {
  readonly btc:
    Omit<
      UnifiedDecisionBtcContext,
      'alignment'
    >;
  readonly impulse:
    Omit<
      UnifiedDecisionImpulseContext,
      'alignment'
    >;
}

export interface UnifiedDecisionLevelContext {
  readonly lineId: string;
  readonly kind: LevelEngineKind;
  readonly status: LevelLineStatus;
  readonly levelPrice: number;
  readonly currentPrice: number | null;
  readonly distanceToLevelPercent:
    number | null;
  readonly observationProgress:
    number | null;
  readonly causalStage:
    Exclude<
      UnifiedDecisionCausalStage,
      'OUTCOME' | null
    >;
  readonly realtimeStatus:
    RealtimeConfirmationStatus;
  readonly tapeState:
    RealtimeConfirmationEvidenceState;
  readonly orderBookState:
    RealtimeConfirmationEvidenceState;
}

export interface UnifiedDecisionSetupContext {
  readonly candidateId: string;
  readonly setupType:
    SetupEngineSetupType;
  readonly direction:
    SetupDirection;
  readonly stage:
    SetupEngineStage;
  readonly outcome:
    SetupEngineOutcome;
  readonly updatedAt: string;
  readonly expiresAt: string;
}

export interface UnifiedDecision {
  readonly version:
    typeof UNIFIED_DECISION_CONTRACT_VERSION;
  readonly symbol: string;
  readonly timeframe:
    LevelEngineTimeframe;
  readonly generatedAt: string;
  readonly state:
    UnifiedDecisionState;
  readonly direction:
    UnifiedDecisionDirection;
  readonly scenario:
    UnifiedDecisionScenario;
  readonly causalStage:
    UnifiedDecisionCausalStage;
  readonly level:
    UnifiedDecisionLevelContext | null;
  readonly setup:
    UnifiedDecisionSetupContext | null;
  readonly marketContext: {
    readonly btc:
      UnifiedDecisionBtcContext;
    readonly impulse:
      UnifiedDecisionImpulseContext;
  };
  readonly reasons:
    readonly UnifiedDecisionReason[];
  readonly missingConfirmations:
    readonly UnifiedDecisionMissingConfirmation[];
  readonly invalidations:
    readonly UnifiedDecisionInvalidation[];
  readonly decisionSupportOnly: true;
  readonly createsTradeOrder: false;
  readonly createsSetup: false;
  readonly createsSignal: false;
  readonly createsScore: false;
  readonly estimatesProfitability: false;
  readonly changesExistingLifecycle: false;
  readonly usesFutureData: false;
}

export interface UnifiedDecisionMarketContextReader {
  getMarketContext(
    symbol: string,
  ): UnifiedDecisionMarketContext;
}
