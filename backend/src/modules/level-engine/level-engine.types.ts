export const LEVEL_ENGINE_CONTRACT_VERSION =
  'level-engine-reset-v0.1' as const;

export const LEVEL_ENGINE_TIMEFRAMES = [
  '1m',
  '5m',
  '15m',
  '1h',
  '4h',
] as const;

export type LevelEngineTimeframe =
  typeof LEVEL_ENGINE_TIMEFRAMES[number];

export type LevelEngineKind =
  | 'support'
  | 'resistance';

export type LevelEngineMaturity =
  | 'candidate'
  | 'developing'
  | 'confirmed';

export type LevelEngineLifecycleStatus =
  | 'active'
  | 'testing'
  | 'broken'
  | 'flipped'
  | 'expired';

export type LevelEngineDecision =
  | 'accepted'
  | 'rejected';

export type LevelAcceptanceReason =
  | 'confirmed_departure'
  | 'independent_touch_episode'
  | 'coherent_price_cluster'
  | 'clean_reaction'
  | 'role_flip_evidence';

export type LevelRejectionReason =
  | 'single_candle_noise'
  | 'same_touch_episode'
  | 'insufficient_departure'
  | 'insufficient_time_separation'
  | 'incoherent_price_cluster'
  | 'zone_too_wide'
  | 'mid_range_noise'
  | 'already_broken'
  | 'stale_candidate'
  | 'future_data_dependency';

export interface LevelEngineZone {
  readonly low: number;
  readonly reference: number;
  readonly high: number;
}

export interface TouchEpisode {
  readonly id: string;
  readonly symbol: string;
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly kind: LevelEngineKind;
  readonly startCandleIndex: number;
  readonly endCandleIndex: number;
  readonly anchorCandleIndex: number;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly anchorAt: string;
  readonly confirmedAt: string;
  readonly extremePrice: number;
  readonly atrAtTouch: number;
  readonly departureDistance: number;
  readonly departureAtr: number;
  readonly departureCandles: number;
}

export interface LevelCandidate {
  readonly id: string;
  readonly contractVersion: typeof LEVEL_ENGINE_CONTRACT_VERSION;
  readonly symbol: string;
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly kind: LevelEngineKind;
  readonly zone: LevelEngineZone;
  readonly activeFrom: string;
  readonly detectedAt: string;
  readonly maturity: LevelEngineMaturity;
  readonly status: LevelEngineLifecycleStatus;
  readonly decision: LevelEngineDecision;
  readonly touchEpisodes: readonly TouchEpisode[];
  readonly acceptanceReasons: readonly LevelAcceptanceReason[];
  readonly rejectionReasons: readonly LevelRejectionReason[];
  readonly observationalOnly: true;
  readonly createsSetup: false;
}
