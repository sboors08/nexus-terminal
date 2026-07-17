import {
  ALERTS,
  ALERT_EVENT_LABELS,
  INITIAL_ALERT_RULES,
  type AlertEventType,
  type AlertPriority,
  type AlertReadStatus,
  type AlertRule,
  type NexusAlert as AlertViewItem,
} from '@/features/alerts/alertsData';
import {
  HISTORY_RESULT_LABELS,
  MARKET_HISTORY_ITEMS,
  type HistoryResult,
  type HistorySetupType,
  type MarketHistoryItem,
} from '@/features/market-history/marketHistoryData';
import {
  REPLAY_SESSIONS,
  getReplaySession as getReplaySessionViewFixture,
  getReplayStage as getReplayStageView,
  type ReplayCandle as ReplayViewCandle,
  type ReplayLiquidityLevel as ReplayViewLiquidityLevel,
  type ReplaySession as ReplayViewSession,
} from '@/features/replay/replayData';
import {
  SCANNER_SETUPS,
  type ScannerSetup,
  type ScannerSetupKind,
  type ScannerTimeframe,
} from '@/features/scanner/scannerData';
import {
  MARKET_DYNAMICS,
  STAGE_FLOW,
  WORKSPACE_LIQUIDITY,
  WORKSPACE_PRINTS,
  type LiquidityLevel as WorkspaceLiquidityView,
  type PrintSide,
  type TapePrint,
} from '@/features/workspace/workspaceData';
import type {
  ApiMutationResult,
  Candle,
  FeedbackPayload,
  LiquidityLevel,
  MarketActivity,
  MarketSymbol,
  NexusAlert,
  NexusApi,
  PriceLevel,
  ReplayFrame,
  ReplaySession,
  Setup,
  SetupFeedback,
  SetupHistoryItem,
  SetupReason,
  TradePrint,
  WorkspaceSnapshot,
} from '@/shared/api/contracts';
import {
  DASHBOARD_VIEW_DATA,
  type DashboardActivityPeriod,
  type DashboardCandle,
  type DashboardChartPeriod,
  type DashboardHotCoin,
  type DashboardViewData,
} from './dashboardViewData';

export type {
  AlertEventType,
  AlertPriority,
  AlertReadStatus,
  AlertRule,
  AlertViewItem,
  DashboardActivityPeriod,
  DashboardCandle,
  DashboardChartPeriod,
  DashboardHotCoin,
  DashboardViewData,
  HistoryResult,
  HistorySetupType,
  MarketHistoryItem,
  PrintSide,
  ReplayViewCandle,
  ReplayViewLiquidityLevel,
  ReplayViewSession,
  ScannerSetup,
  ScannerSetupKind,
  ScannerTimeframe,
  TapePrint,
  WorkspaceLiquidityView,
};

export { getReplayStageView };

export interface WorkspaceViewData {
  selectedSetup: ScannerSetup;
  prints: TapePrint[];
  liquidity: WorkspaceLiquidityView[];
  marketDynamics: typeof MARKET_DYNAMICS;
  stageFlow: typeof STAGE_FLOW;
}

export interface AlertsViewData {
  alerts: AlertViewItem[];
  rules: AlertRule[];
  eventLabels: Record<AlertEventType, string>;
}

export interface MarketHistoryViewData {
  items: MarketHistoryItem[];
  resultLabels: Record<HistoryResult, string>;
}

export interface NexusViewApi {
  getDashboardView(): Promise<DashboardViewData | null>;
  getScannerSetups(): Promise<ScannerSetup[]>;
  getWorkspaceView(symbol?: string | null): Promise<WorkspaceViewData | null>;
  getAlertsView(): Promise<AlertsViewData>;
  getMarketHistoryView(): Promise<MarketHistoryViewData>;
  getReplayView(sessionId?: string | null): Promise<ReplayViewSession | null>;
}

const MOCK_LATENCY_MS = 140;
const FIXED_NOW = '2026-07-15T17:32:14Z';

const feedbackStore: FeedbackPayload[] = [];
const setupFeedbackStore: SetupFeedback[] = [];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function getMockState(): 'normal' | 'empty' | 'error' {
  if (typeof window === 'undefined') return 'normal';
  const value = new URLSearchParams(window.location.search).get('mockState');
  if (value === 'empty' || value === 'error') return value;
  return 'normal';
}

async function deliver<T>(key: string, value: T, emptyValue: T): Promise<T> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, MOCK_LATENCY_MS));
  const state = getMockState();

  if (state === 'error') {
    throw new Error(`Mock API: не удалось загрузить ${key}`);
  }

  return clone(state === 'empty' ? emptyValue : value);
}

function parseNumber(value: string): number {
  const normalized = value.replace(/\s/g, '').replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseLevelZone(value: string, fallback: number): [number, number] {
  const [rawLow, rawHigh] = value.split(/[–—-]/).map(parseNumber);
  const low = Number.isFinite(rawLow) && rawLow > 0 ? rawLow : fallback;
  const high = Number.isFinite(rawHigh) && rawHigh > 0 ? rawHigh : low;
  return low <= high ? [low, high] : [high, low];
}

function mapSetupStage(setup: ScannerSetup): Setup['stage'] {
  if (setup.stage === 'observation') return 'watching';
  if (setup.stage === 'approach') return 'approaching';
  if (setup.stage === 'confirmation') return 'confirmation';
  return setup.kind.includes('Отскок') ? 'bounce' : 'breakout';
}

function mapSetupType(kind: ScannerSetupKind): Setup['type'] {
  return kind.includes('Отскок') ? 'level_bounce' : 'level_breakout';
}

function mapLevelType(kind: ScannerSetupKind): PriceLevel['type'] {
  return kind.includes('поддержки') ? 'support' : 'resistance';
}

function setupReasons(setup: ScannerSetup): SetupReason[] {
  return setup.reasons.map((reason, index) => ({
    code: `${setup.id}.reason.${index + 1}`,
    labelKey: `setup.reason.${setup.id}.${index + 1}`,
    value: reason,
    state: index === 0 ? 'positive' : 'neutral',
  }));
}

function toContractSetup(setup: ScannerSetup, index: number): Setup {
  const currentPrice = parseNumber(setup.price);
  const [zoneLow, zoneHigh] = parseLevelZone(setup.level, currentPrice);
  const formedAt = new Date(new Date(FIXED_NOW).getTime() - setup.formationMinutes * 60_000).toISOString();
  const level: PriceLevel = {
    id: `${setup.id}.level`,
    symbol: setup.symbol,
    type: mapLevelType(setup.kind),
    zoneLow,
    zoneHigh,
    centerPrice: (zoneLow + zoneHigh) / 2,
    touchesCount: setup.touches,
    formedAt,
    formationDurationSec: setup.formationMinutes * 60,
    pullbackType: setup.pullbackDepth === 'Неглубокие' ? 'shallow' : 'deep',
    strength: Math.min(100, 52 + setup.touches * 8 + Math.round(setup.volumeAnomaly * 5)),
    status: setup.stage === 'triggered' ? 'broken' : setup.stage === 'observation' ? 'forming' : 'active',
  };

  return {
    id: setup.id,
    symbol: setup.symbol,
    exchange: 'binance',
    type: mapSetupType(setup.kind),
    direction: setup.direction,
    stage: mapSetupStage(setup),
    timeframe: setup.timeframe,
    detectedAt: formedAt,
    updatedAt: FIXED_NOW,
    level,
    currentPrice,
    distanceToLevelPct: setup.distancePercent,
    volumeAnomaly: setup.volumeAnomaly,
    tradesAnomaly: setup.tradesAnomaly,
    tradeRateAnomaly: Number(((setup.volumeAnomaly + setup.tradesAnomaly) / 2).toFixed(2)),
    btcCorrelation: parseNumber(setup.btcCorrelation),
    btcRelativeStrength: setup.btcStrength,
    reasons: setupReasons(setup),
    warnings: setup.stage === 'observation' ? ['setup.warning.early_stage'] : [],
    score: Math.min(99, Math.round(58 + setup.volumeAnomaly * 8 + setup.tradesAnomaly * 6 + index)),
    scoreStatus: 'experimental',
  };
}

const activeContractSetups: Setup[] = SCANNER_SETUPS.map(toContractSetup);
const inactiveContractSetups: Setup[] = activeContractSetups.slice(0, 2).map((setup, index) => ({
  ...clone(setup),
  id: `${setup.id}.inactive.${index + 1}`,
  stage: 'invalidated',
  updatedAt: new Date(new Date(FIXED_NOW).getTime() - (index + 1) * 3_600_000).toISOString(),
  warnings: [...setup.warnings, 'setup.warning.no_longer_relevant'],
  score: null,
  scoreStatus: null,
  level: { ...setup.level, status: 'invalidated' },
}));
const contractSetups: Setup[] = [...activeContractSetups, ...inactiveContractSetups];

const MARKET_SEEDS = [
  ['BTCUSDT', 104250, 1.82],
  ['ETHUSDT', 3524.8, 1.92],
  ['SOLUSDT', 187.42, 4.18],
  ['BNBUSDT', 726.4, 0.84],
  ['XRPUSDT', 0.5924, -0.86],
  ['DOGEUSDT', 0.1942, 1.12],
  ['ADAUSDT', 0.4382, -0.42],
  ['SUIUSDT', 1.0846, 2.41],
  ['LINKUSDT', 16.842, 3.26],
  ['AVAXUSDT', 28.14, 0.72],
  ['APTUSDT', 7.184, -2.74],
  ['ARBUSDT', 0.7462, 2.08],
  ['OPUSDT', 1.607, -1.64],
  ['INJUSDT', 27.98, 3.6],
  ['NEARUSDT', 5.21, 1.07],
  ['WIFUSDT', 3.22, 3.42],
  ['PEPEUSDT', 0.00001234, 2.06],
  ['TONUSDT', 7.16, 0.45],
  ['TRXUSDT', 0.1348, 0.31],
  ['LTCUSDT', 92.18, -0.28],
] as const;

const marketSymbols: MarketSymbol[] = MARKET_SEEDS.map(([symbol, price, change], index) => ({
  symbol,
  baseAsset: symbol.replace('USDT', ''),
  quoteAsset: 'USDT',
  exchange: 'binance',
  price,
  priceChangePct: change,
  volumeQuote: 42_000_000 + index * 7_350_000,
  tradesCount: 24_000 + index * 4_270,
  tradeRate: 420 + index * 37,
  volatilityPct: Number((1.2 + (index % 7) * 0.44).toFixed(2)),
  btcCorrelation: symbol === 'BTCUSDT' ? 1 : Number((0.18 + (index % 8) * 0.09).toFixed(2)),
  btcRelativeStrength: symbol === 'BTCUSDT' ? 0 : Number((change - 1.82).toFixed(2)),
  updatedAt: FIXED_NOW,
}));

function createCandles(symbol: MarketSymbol, count = 48): Candle[] {
  const start = new Date('2026-07-15T13:32:00Z').getTime();
  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin(index * 0.42) * symbol.price * 0.0025;
    const trend = symbol.price * 0.00025 * index;
    const open = symbol.price * 0.985 + trend + wave;
    const close = open + Math.sin(index * 0.91) * symbol.price * 0.0018;
    const openTime = new Date(start + index * 5 * 60_000);
    return {
      openTime: openTime.toISOString(),
      closeTime: new Date(openTime.getTime() + 5 * 60_000 - 1).toISOString(),
      open,
      high: Math.max(open, close) + symbol.price * 0.0014,
      low: Math.min(open, close) - symbol.price * 0.0013,
      close,
      volume: 280_000 + index * 9_500,
      tradesCount: 420 + index * 17,
    };
  });
}

function createWorkspaceSnapshot(setup: Setup): WorkspaceSnapshot {
  const symbol = marketSymbols.find((item) => item.symbol === setup.symbol) ?? marketSymbols[0];
  const candles = createCandles(symbol);
  const activity: MarketActivity = {
    symbol: setup.symbol,
    timeframe: setup.timeframe,
    volume: 4_210_000,
    volumeBaseline: 2_288_000,
    volumeAnomaly: setup.volumeAnomaly ?? 1,
    tradesCount: 8_420,
    tradesBaseline: 3_898,
    tradesAnomaly: setup.tradesAnomaly ?? 1,
    tradeRate: 1_684,
    tradeRateBaseline: 820,
    tradeRateAnomaly: setup.tradeRateAnomaly ?? 1,
    volatilityPct: symbol.volatilityPct,
    updatedAt: FIXED_NOW,
  };

  const prints: TradePrint[] = WORKSPACE_PRINTS.map((print) => ({
    id: print.id,
    symbol: setup.symbol,
    timestamp: `2026-07-15T${print.time.replace(/\.\d+$/, '')}Z`,
    price: parseNumber(print.price),
    quantity: parseNumber(print.size),
    quoteValue: parseNumber(print.value),
    side: print.side,
    isLarge: parseNumber(print.value) >= 10_000,
  }));

  const stateMap: Record<WorkspaceLiquidityView['state'], LiquidityLevel['state']> = {
    Стоит: 'standing',
    Увеличивается: 'increasing',
    Уменьшается: 'decreasing',
    Исполняется: 'executing',
    Переставляется: 'moved',
  };

  const liquidity: LiquidityLevel[] = WORKSPACE_LIQUIDITY.map((level) => ({
    id: level.id,
    symbol: setup.symbol,
    side: level.side === 'buyer' ? 'bid' : 'ask',
    price: parseNumber(level.price),
    quantity: parseNumber(level.size) / Math.max(parseNumber(level.price), 1),
    quoteValue: parseNumber(level.size) * (level.size.includes('K') ? 1_000 : 1),
    firstSeenAt: new Date(new Date(FIXED_NOW).getTime() - parseNumber(level.age) * 60_000).toISOString(),
    ageSec: parseNumber(level.age) * 60,
    executedPct: level.fillPercent,
    state: stateMap[level.state],
    confidence: Number(Math.min(1, 0.55 + level.intensity * 0.4).toFixed(2)),
  }));

  return {
    setup,
    symbol,
    activity,
    candles,
    prints,
    liquidity,
    capturedAt: FIXED_NOW,
  };
}

const canonicalAlerts: NexusAlert[] = Array.from({ length: 30 }, (_, index) => {
  const setup = contractSetups[index % contractSetups.length];
  const alertTypes: NexusAlert['type'][] = [
    'price_near_level',
    'stage_changed',
    'prints_accelerated',
    'liquidity_increased',
    'liquidity_weakened',
    'liquidity_removed',
    'level_broken',
    'bounce_detected',
    'setup_invalidated',
  ];
  const createdAt = new Date(new Date(FIXED_NOW).getTime() - index * 97_000).toISOString();
  return {
    id: `contract-alert-${index + 1}`,
    setupId: setup.id,
    symbol: setup.symbol,
    type: alertTypes[index % alertTypes.length],
    severity: index % 5 === 0 ? 'critical' : index % 2 === 0 ? 'attention' : 'info',
    createdAt,
    readAt: index < 7 ? null : new Date(new Date(createdAt).getTime() + 35_000).toISOString(),
    titleKey: `alert.${alertTypes[index % alertTypes.length]}.title`,
    messageKey: `alert.${alertTypes[index % alertTypes.length]}.message`,
    params: {
      symbol: setup.symbol,
      distancePct: setup.distanceToLevelPct,
      timeframe: setup.timeframe,
    },
    workspaceUrl: `/app/workspace?symbol=${setup.symbol}`,
  };
});

const canonicalHistory: SetupHistoryItem[] = MARKET_HISTORY_ITEMS.map((item, index) => ({
  setup: contractSetups.find((setup) => setup.symbol === item.symbol)
    ?? contractSetups[index % contractSetups.length],
  result: item.result,
  maxMovePct: item.maxMovePct,
  adverseMovePct: item.adverseMovePct,
  timeToMaxMoveSec: item.timeToTargetSec,
  completedAt: item.completedAt,
  replayAvailable: item.replayAvailable,
}));

function createCanonicalReplay(sessionId?: string): ReplaySession | null {
  const viewSession = getReplaySessionViewFixture(sessionId ?? null);
  if (!viewSession) return null;
  const setup = contractSetups.find((item) => item.symbol === viewSession.symbol) ?? contractSetups[0];
  const initialSnapshot = createWorkspaceSnapshot(setup);
  const frames: ReplayFrame[] = viewSession.candles.map((candle, index) => ({
    timestamp: candle.timestamp,
    candleUpdates: [{
      openTime: candle.timestamp,
      closeTime: new Date(new Date(candle.timestamp).getTime() + 5 * 60_000 - 1).toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      tradesCount: candle.tradesCount,
    }],
    prints: viewSession.prints
      .filter((print) => print.frameIndex === index)
      .map((print) => ({
        id: print.id,
        symbol: viewSession.symbol,
        timestamp: print.timestamp,
        price: print.price,
        quantity: print.quantity,
        quoteValue: print.quoteValue,
        side: print.side,
        isLarge: print.isLarge,
      })),
    liquidityUpdates: [],
    setupStage: index < viewSession.detectedFrameIndex - 2
      ? 'watching'
      : index < viewSession.detectedFrameIndex
        ? 'approaching'
        : index < viewSession.detectedFrameIndex + 3
          ? 'confirmation'
          : viewSession.setupKind === 'bounce' ? 'bounce' : 'breakout',
    currentPrice: candle.close,
  }));

  return {
    id: viewSession.id,
    setupId: setup.id,
    symbol: viewSession.symbol,
    startedAt: viewSession.candles[0].timestamp,
    endedAt: viewSession.endedAt,
    initialSnapshot,
    frames,
  };
}

const contractApi: NexusApi = {
  getMarketSymbols: () => deliver('market symbols', marketSymbols, []),
  getSetups: () => deliver('setups', contractSetups, []),
  getSetupById: async (setupId) => {
    const setup = contractSetups.find((item) => item.id === setupId) ?? null;
    return deliver('setup', setup, null);
  },
  getWorkspaceSnapshot: async (setupId) => {
    const setup = contractSetups.find((item) => item.id === setupId) ?? contractSetups[0] ?? null;
    return deliver('workspace snapshot', setup ? createWorkspaceSnapshot(setup) : null, null);
  },
  getAlerts: () => deliver('alerts', canonicalAlerts, []),
  getSetupHistory: () => deliver('setup history', canonicalHistory, []),
  getReplaySession: (sessionId) => deliver('replay session', createCanonicalReplay(sessionId), null),
  sendFeedback: async (payload) => {
    feedbackStore.push(clone(payload));
    const result: ApiMutationResult = {
      id: `feedback-${feedbackStore.length}`,
      acceptedAt: new Date().toISOString(),
    };
    return deliver('feedback mutation', result, result);
  },
  sendSetupFeedback: async (payload) => {
    setupFeedbackStore.push(clone(payload));
    const result: ApiMutationResult = {
      id: `setup-feedback-${setupFeedbackStore.length}`,
      acceptedAt: new Date().toISOString(),
    };
    return deliver('setup feedback mutation', result, result);
  },
};

const viewApi: NexusViewApi = {
  getDashboardView: () => deliver('dashboard', DASHBOARD_VIEW_DATA, null),
  getScannerSetups: () => deliver('scanner setups', SCANNER_SETUPS, []),
  getWorkspaceView: async (symbol) => {
    const requestedSymbol = symbol?.toUpperCase();
    const selectedSetup = SCANNER_SETUPS.find((setup) => setup.symbol === requestedSymbol) ?? SCANNER_SETUPS[0];
    const data: WorkspaceViewData | null = selectedSetup ? {
      selectedSetup,
      prints: WORKSPACE_PRINTS,
      liquidity: WORKSPACE_LIQUIDITY,
      marketDynamics: MARKET_DYNAMICS,
      stageFlow: STAGE_FLOW,
    } : null;
    return deliver('workspace view', data, null);
  },
  getAlertsView: () => deliver('alerts view', {
    alerts: ALERTS,
    rules: INITIAL_ALERT_RULES,
    eventLabels: ALERT_EVENT_LABELS,
  }, {
    alerts: [],
    rules: [],
    eventLabels: ALERT_EVENT_LABELS,
  }),
  getMarketHistoryView: () => deliver('market history view', {
    items: MARKET_HISTORY_ITEMS,
    resultLabels: HISTORY_RESULT_LABELS,
  }, {
    items: [],
    resultLabels: HISTORY_RESULT_LABELS,
  }),
  getReplayView: (sessionId) => deliver(
    'replay view',
    REPLAY_SESSIONS.length > 0 ? getReplaySessionViewFixture(sessionId ?? null) : null,
    null,
  ),
};

export const nexusApi: NexusApi & NexusViewApi = {
  ...contractApi,
  ...viewApi,
};
