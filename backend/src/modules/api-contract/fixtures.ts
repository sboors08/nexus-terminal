import type {
  ApiMutationResult,
  Candle,
  FeedbackPayload,
  MarketSymbol,
  NexusAlert,
  ReplaySession,
  Setup,
  SetupFeedback,
  SetupHistoryItem,
  WorkspaceSnapshot,
} from '../../contracts/nexus-api.js';

const NOW = '2026-07-18T14:00:00.000Z';

export const marketSymbols: MarketSymbol[] = [
  {
    symbol: 'BTCUSDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    exchange: 'binance',
    price: 104250,
    priceChangePct: 1.82,
    volumeQuote: 2480000000,
    tradesCount: 1820000,
    tradeRate: 3240,
    volatilityPct: 1.68,
    btcCorrelation: 1,
    btcRelativeStrength: 0,
    updatedAt: NOW,
  },
  {
    symbol: 'SOLUSDT',
    baseAsset: 'SOL',
    quoteAsset: 'USDT',
    exchange: 'binance',
    price: 187.42,
    priceChangePct: 4.18,
    volumeQuote: 418000000,
    tradesCount: 284000,
    tradeRate: 1684,
    volatilityPct: 3.84,
    btcCorrelation: 0.42,
    btcRelativeStrength: 2.36,
    updatedAt: NOW,
  },
];

export const setups: Setup[] = [
  {
    id: 'setup-sol-breakout-001',
    symbol: 'SOLUSDT',
    exchange: 'binance',
    type: 'level_breakout',
    direction: 'long',
    stage: 'approaching',
    timeframe: '5m',
    detectedAt: '2026-07-18T13:18:00.000Z',
    updatedAt: NOW,
    level: {
      id: 'level-sol-resistance-001',
      symbol: 'SOLUSDT',
      type: 'resistance',
      zoneLow: 188.1,
      zoneHigh: 188.6,
      centerPrice: 188.35,
      touchesCount: 3,
      formedAt: '2026-07-18T12:04:00.000Z',
      formationDurationSec: 4440,
      pullbackType: 'shallow',
      strength: 86,
      status: 'active',
    },
    currentPrice: 187.42,
    distanceToLevelPct: 0.5,
    volumeAnomaly: 2.08,
    tradesAnomaly: 2.24,
    tradeRateAnomaly: 2.16,
    btcCorrelation: 0.42,
    btcRelativeStrength: 2.36,
    reasons: [
      { code: 'three_touches', labelKey: 'setup.reason.threeTouches', value: 3, state: 'positive' },
      { code: 'activity_acceleration', labelKey: 'setup.reason.activityAcceleration', value: 2.16, state: 'positive' },
    ],
    warnings: [],
    score: 92,
    scoreStatus: 'experimental',
  },
];

export function createCandles(symbol: string, timeframe: string): Candle[] {
  const base = marketSymbols.find((item) => item.symbol === symbol)?.price ?? 100;
  const amount = Number.parseInt(timeframe, 10) || 5;
  const intervalMs = timeframe.endsWith('h') ? amount * 3600000 : amount * 60000;
  const start = Date.parse('2026-07-18T12:00:00.000Z');

  return Array.from({ length: 12 }, (_, index) => {
    const open = base * (1 + Math.sin(index * 0.5) * 0.0015);
    const close = open * (1 + Math.cos(index * 0.7) * 0.0009);
    return {
      openTime: new Date(start + index * intervalMs).toISOString(),
      closeTime: new Date(start + (index + 1) * intervalMs - 1).toISOString(),
      open,
      high: Math.max(open, close) * 1.0012,
      low: Math.min(open, close) * 0.9988,
      close,
      volume: 18000 + index * 1250,
      tradesCount: 840 + index * 31,
    };
  });
}

export function createWorkspaceSnapshot(setup: Setup): WorkspaceSnapshot {
  const symbol = marketSymbols.find((item) => item.symbol === setup.symbol) ?? marketSymbols[0];
  if (!symbol) throw new Error('At least one market symbol fixture is required');

  return {
    setup,
    symbol,
    activity: {
      symbol: setup.symbol,
      timeframe: setup.timeframe,
      volume: 418000000,
      volumeBaseline: 201000000,
      volumeAnomaly: 2.08,
      tradesCount: 284000,
      tradesBaseline: 126800,
      tradesAnomaly: 2.24,
      tradeRate: 1684,
      tradeRateBaseline: 780,
      tradeRateAnomaly: 2.16,
      volatilityPct: 3.84,
      updatedAt: NOW,
    },
    candles: createCandles(setup.symbol, setup.timeframe),
    prints: [{
      id: 'print-sol-001',
      symbol: setup.symbol,
      timestamp: '2026-07-18T13:59:45.000Z',
      price: 187.41,
      quantity: 420,
      quoteValue: 78712.2,
      side: 'buy',
      isLarge: true,
    }],
    liquidity: [{
      id: 'liquidity-sol-ask-001',
      symbol: setup.symbol,
      side: 'ask',
      price: 188.35,
      quantity: 2800,
      quoteValue: 527380,
      firstSeenAt: '2026-07-18T13:31:00.000Z',
      ageSec: 1740,
      executedPct: 18,
      state: 'standing',
      confidence: 0.84,
    }],
    capturedAt: NOW,
  };
}

export const alerts: NexusAlert[] = [{
  id: 'alert-sol-001',
  setupId: 'setup-sol-breakout-001',
  symbol: 'SOLUSDT',
  type: 'price_near_level',
  severity: 'attention',
  createdAt: NOW,
  readAt: null,
  titleKey: 'alert.priceNearLevel.title',
  messageKey: 'alert.priceNearLevel.message',
  params: { symbol: 'SOLUSDT', distancePct: 0.5, timeframe: '5m' },
  workspaceUrl: '/app/workspace?setupId=setup-sol-breakout-001',
}];

export const setupHistory: SetupHistoryItem[] = setups.map((setup) => ({
  setup: { ...setup, stage: 'breakout', scoreStatus: 'validated' },
  result: 'successful',
  maxMovePct: 3.42,
  adverseMovePct: -0.48,
  timeToMaxMoveSec: 1860,
  completedAt: '2026-07-18T14:31:00.000Z',
  replayAvailable: true,
}));

export const replaySessions: ReplaySession[] = setups.map((setup) => {
  const initialSnapshot = createWorkspaceSnapshot(setup);
  return {
    id: `replay-${setup.id}`,
    setupId: setup.id,
    symbol: setup.symbol,
    startedAt: initialSnapshot.candles[0]?.openTime ?? NOW,
    endedAt: initialSnapshot.candles.at(-1)?.closeTime ?? NOW,
    initialSnapshot,
    frames: initialSnapshot.candles.map((candle, index) => ({
      timestamp: candle.openTime,
      candleUpdates: [candle],
      prints: index === initialSnapshot.candles.length - 1 ? initialSnapshot.prints : [],
      liquidityUpdates: index % 4 === 0 ? initialSnapshot.liquidity : [],
      setupStage: index < 4 ? 'watching' : index < 8 ? 'approaching' : 'breakout',
      currentPrice: candle.close,
    })),
  };
});

let sequence = 0;
export function acceptFeedback(_payload: FeedbackPayload | SetupFeedback): ApiMutationResult {
  sequence += 1;
  return { id: `feedback-${sequence}`, acceptedAt: new Date().toISOString() };
}
