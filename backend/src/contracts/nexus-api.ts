export type Exchange = 'binance';
export type TradeDirection = 'long' | 'short';
export type SetupType = 'level_breakout' | 'level_bounce';
export type SetupStage =
  | 'watching'
  | 'approaching'
  | 'confirmation'
  | 'breakout'
  | 'bounce'
  | 'invalidated';

export interface MarketSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  exchange: Exchange;
  price: number;
  priceChangePct: number;
  volumeQuote: number;
  tradesCount: number;
  tradeRate: number;
  volatilityPct: number;
  btcCorrelation: number | null;
  btcRelativeStrength: number | null;
  updatedAt: string;
}

export interface PriceLevel {
  id: string;
  symbol: string;
  type: 'support' | 'resistance';
  zoneLow: number;
  zoneHigh: number;
  centerPrice: number;
  touchesCount: number;
  formedAt: string;
  formationDurationSec: number;
  pullbackType: 'deep' | 'shallow' | null;
  strength: number | null;
  status: 'forming' | 'active' | 'tested' | 'broken' | 'invalidated';
}

export interface SetupReason {
  code: string;
  labelKey: string;
  value?: number | string | null;
  state: 'positive' | 'neutral' | 'warning';
}

export interface Setup {
  id: string;
  symbol: string;
  exchange: Exchange;
  type: SetupType;
  direction: TradeDirection;
  stage: SetupStage;
  timeframe: string;
  detectedAt: string;
  updatedAt: string;
  level: PriceLevel;
  currentPrice: number;
  distanceToLevelPct: number;
  volumeAnomaly: number | null;
  tradesAnomaly: number | null;
  tradeRateAnomaly: number | null;
  btcCorrelation: number | null;
  btcRelativeStrength: number | null;
  reasons: SetupReason[];
  warnings: string[];
  score: number | null;
  scoreStatus: 'experimental' | 'validated' | null;
}

export interface MarketActivity {
  symbol: string;
  timeframe: string;
  volume: number;
  volumeBaseline: number;
  volumeAnomaly: number;
  tradesCount: number;
  tradesBaseline: number;
  tradesAnomaly: number;
  tradeRate: number;
  tradeRateBaseline: number;
  tradeRateAnomaly: number;
  volatilityPct: number;
  updatedAt: string;
}

export interface TradePrint {
  id: string;
  symbol: string;
  timestamp: string;
  price: number;
  quantity: number;
  quoteValue: number;
  side: 'buy' | 'sell';
  isLarge: boolean;
}

export interface LiquidityLevel {
  id: string;
  symbol: string;
  side: 'bid' | 'ask';
  price: number;
  quantity: number;
  quoteValue: number;
  firstSeenAt: string;
  ageSec: number;
  executedPct: number | null;
  state: 'standing' | 'increasing' | 'decreasing' | 'executing' | 'moved' | 'removed';
  confidence: number | null;
}

export interface Candle {
  openTime: string;
  closeTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradesCount: number;
}

export interface WorkspaceSnapshot {
  setup: Setup;
  symbol: MarketSymbol;
  activity: MarketActivity;
  candles: Candle[];
  prints: TradePrint[];
  liquidity: LiquidityLevel[];
  capturedAt: string;
}

export interface NexusAlert {
  id: string;
  setupId: string;
  symbol: string;
  type:
    | 'price_near_level'
    | 'stage_changed'
    | 'prints_accelerated'
    | 'liquidity_increased'
    | 'liquidity_weakened'
    | 'liquidity_removed'
    | 'level_broken'
    | 'bounce_detected'
    | 'setup_invalidated';
  severity: 'info' | 'attention' | 'critical';
  createdAt: string;
  readAt: string | null;
  titleKey: string;
  messageKey: string;
  params: Record<string, string | number>;
  workspaceUrl: string;
}

export interface SetupHistoryItem {
  setup: Setup;
  result: 'successful' | 'failed' | 'expired' | 'invalidated' | 'unknown';
  maxMovePct: number | null;
  adverseMovePct: number | null;
  timeToMaxMoveSec: number | null;
  completedAt: string | null;
  replayAvailable: boolean;
}

export interface ReplayFrame {
  timestamp: string;
  candleUpdates: Candle[];
  prints: TradePrint[];
  liquidityUpdates: LiquidityLevel[];
  setupStage: Setup['stage'];
  currentPrice: number;
}

export interface ReplaySession {
  id: string;
  setupId: string;
  symbol: string;
  startedAt: string;
  endedAt: string;
  initialSnapshot: WorkspaceSnapshot;
  frames: ReplayFrame[];
}

export interface FeedbackPayload {
  type: 'bug' | 'feature_request' | 'ui_issue' | 'data_issue' | 'setup_issue' | 'other';
  message: string;
  rating: number | null;
  contact: string | null;
  context: {
    route: string;
    screen: string;
    symbol: string | null;
    timeframe: string | null;
    setupId: string | null;
    replayId: string | null;
    appVersion: string;
    userAgent: string;
    createdAt: string;
  };
}

export interface SetupFeedback {
  setupId: string;
  useful: boolean;
  reasons: Array<
    | 'weak_level'
    | 'incorrect_touches'
    | 'detected_too_late'
    | 'incorrect_stage'
    | 'volume_issue'
    | 'liquidity_issue'
    | 'other'
  >;
  comment: string | null;
  createdAt: string;
}

export interface ApiMutationResult {
  id: string;
  acceptedAt: string;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  requestId: string;
}
