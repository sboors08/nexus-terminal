import type { TradeDirection } from '@/shared/ui/DirectionBadge';
import type { SetupStage } from '@/shared/ui/SetupStageBadge';

export type ReplayResult = 'successful' | 'failed';
export type ReplaySetupKind = 'breakout' | 'bounce';
export type ReplayLiquidityState =
  | 'Стоит'
  | 'Увеличивается'
  | 'Уменьшается'
  | 'Исполняется'
  | 'Снята';

export interface ReplayCandle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradesCount: number;
}

export interface ReplayPrint {
  id: string;
  frameIndex: number;
  timestamp: string;
  price: number;
  quantity: number;
  quoteValue: number;
  side: 'buy' | 'sell';
  isLarge: boolean;
}

export interface ReplayLiquidityLevel {
  id: string;
  side: 'bid' | 'ask';
  price: number;
  quoteValue: number;
  ageSec: number;
  baseState: ReplayLiquidityState;
  visibleFrom: number;
}

export interface ReplayEvent {
  id: string;
  frameIndex: number;
  timestamp: string;
  title: string;
  description: string;
  tone: 'info' | 'positive' | 'warning' | 'critical';
}

export interface ReplaySession {
  id: string;
  setupId: string;
  symbol: string;
  exchange: 'BINANCE';
  timeframe: '1m' | '5m' | '15m';
  direction: TradeDirection;
  setupKind: ReplaySetupKind;
  setupLabel: string;
  resultLabel: 'Пробой' | 'Отскок' | 'Ложный пробой' | 'Уровень удержан';
  result: ReplayResult;
  detectedAt: string;
  endedAt: string;
  detectedFrameIndex: number;
  levelLow: number;
  levelHigh: number;
  maxMovePct: number;
  adverseMovePct: number;
  candles: ReplayCandle[];
  prints: ReplayPrint[];
  liquidity: ReplayLiquidityLevel[];
  events: ReplayEvent[];
}

interface SessionConfig {
  id: string;
  setupId: string;
  symbol: string;
  timeframe: ReplaySession['timeframe'];
  direction: TradeDirection;
  setupKind: ReplaySetupKind;
  setupLabel: string;
  resultLabel: ReplaySession['resultLabel'];
  result: ReplayResult;
  detectedAt: string;
  startPrice: number;
  levelLow: number;
  levelHigh: number;
  maxMovePct: number;
  adverseMovePct: number;
  pathPct: number[];
}

const PATHS = {
  longBreakout: [-0.42, -0.31, -0.35, -0.18, -0.08, -0.02, 0.06, 0.02, 0.12, 0.18, 0.24, 0.38, 0.51, 0.74, 0.92, 1.18, 1.42, 1.76, 2.11, 2.46, 2.82, 3.16, 3.51, 3.84],
  shortBreakout: [0.38, 0.29, 0.33, 0.17, 0.08, 0.02, -0.05, -0.01, -0.11, -0.18, -0.31, -0.47, -0.63, -0.82, -1.01, -1.24, -1.48, -1.69, -1.88, -2.04, -2.19, -2.31, -2.38, -2.42],
  longBounce: [0.25, 0.12, -0.04, -0.18, -0.31, -0.42, -0.35, -0.21, -0.08, 0.05, 0.17, 0.32, 0.48, 0.61, 0.79, 0.93, 1.08, 1.21, 1.35, 1.47, 1.58, 1.64, 1.69, 1.72],
  shortFailed: [0.22, 0.08, -0.04, -0.13, -0.21, -0.29, -0.36, -0.31, -0.18, -0.04, 0.12, 0.29, 0.48, 0.64, 0.79, 0.92, 1.04, 1.12, 1.17, 1.19, 1.21, 1.18, 1.15, 1.12],
  longFailed: [-0.16, -0.04, 0.06, 0.13, 0.21, 0.28, 0.24, 0.12, -0.04, -0.22, -0.39, -0.57, -0.72, -0.84, -0.93, -1.01, -1.08, -1.03, -0.96, -0.89, -0.82, -0.76, -0.72, -0.69],
} as const;

const SESSION_CONFIGS: SessionConfig[] = [
  {
    id: 'replay-sol-18742',
    setupId: 'sol-breakout',
    symbol: 'SOLUSDT',
    timeframe: '5m',
    direction: 'long',
    setupKind: 'breakout',
    setupLabel: 'Пробой сопротивления',
    resultLabel: 'Пробой',
    result: 'successful',
    detectedAt: '2026-07-15T14:18:00Z',
    startPrice: 187.42,
    levelLow: 188.10,
    levelHigh: 188.42,
    maxMovePct: 3.84,
    adverseMovePct: -0.32,
    pathPct: [...PATHS.longBreakout],
  },
  {
    id: 'replay-arb-0752',
    setupId: 'arb-breakout',
    symbol: 'ARBUSDT',
    timeframe: '1m',
    direction: 'long',
    setupKind: 'breakout',
    setupLabel: 'Пробой сопротивления',
    resultLabel: 'Пробой',
    result: 'successful',
    detectedAt: '2026-07-15T12:42:00Z',
    startPrice: 0.7498,
    levelLow: 0.7501,
    levelHigh: 0.7520,
    maxMovePct: 2.16,
    adverseMovePct: -0.21,
    pathPct: PATHS.longBreakout.map((value) => value * 0.5625),
  },
  {
    id: 'replay-op-1603',
    setupId: 'op-support-break',
    symbol: 'OPUSDT',
    timeframe: '5m',
    direction: 'short',
    setupKind: 'breakout',
    setupLabel: 'Пробой поддержки',
    resultLabel: 'Пробой',
    result: 'successful',
    detectedAt: '2026-07-15T11:09:00Z',
    startPrice: 1.607,
    levelLow: 1.603,
    levelHigh: 1.612,
    maxMovePct: 2.42,
    adverseMovePct: -0.37,
    pathPct: [...PATHS.shortBreakout],
  },
  {
    id: 'replay-eth-3506',
    setupId: 'eth-support-bounce',
    symbol: 'ETHUSDT',
    timeframe: '15m',
    direction: 'long',
    setupKind: 'bounce',
    setupLabel: 'Отскок от поддержки',
    resultLabel: 'Отскок',
    result: 'successful',
    detectedAt: '2026-07-15T09:30:00Z',
    startPrice: 3498.4,
    levelLow: 3492,
    levelHigh: 3506,
    maxMovePct: 1.72,
    adverseMovePct: -0.18,
    pathPct: [...PATHS.longBounce],
  },
  {
    id: 'replay-apt-0716',
    setupId: 'apt-support-break',
    symbol: 'APTUSDT',
    timeframe: '5m',
    direction: 'short',
    setupKind: 'breakout',
    setupLabel: 'Пробой поддержки',
    resultLabel: 'Ложный пробой',
    result: 'failed',
    detectedAt: '2026-07-14T18:22:00Z',
    startPrice: 7.14,
    levelLow: 7.12,
    levelHigh: 7.16,
    maxMovePct: 0.36,
    adverseMovePct: -1.21,
    pathPct: [...PATHS.shortFailed],
  },
  {
    id: 'replay-link-1696',
    setupId: 'link-breakout',
    symbol: 'LINKUSDT',
    timeframe: '5m',
    direction: 'long',
    setupKind: 'breakout',
    setupLabel: 'Пробой сопротивления',
    resultLabel: 'Уровень удержан',
    result: 'failed',
    detectedAt: '2026-07-14T15:07:00Z',
    startPrice: 16.88,
    levelLow: 16.91,
    levelHigh: 16.96,
    maxMovePct: 0.28,
    adverseMovePct: -1.08,
    pathPct: [...PATHS.longFailed],
  },
];

function addMinutes(value: string, minutes: number) {
  return new Date(new Date(value).getTime() + minutes * 60_000).toISOString();
}

function createCandles(config: SessionConfig): ReplayCandle[] {
  return config.pathPct.map((changePct, index) => {
    const close = config.startPrice * (1 + changePct / 100);
    const previousPct = index === 0 ? changePct - 0.08 : config.pathPct[index - 1];
    const open = config.startPrice * (1 + previousPct / 100);
    const spread = config.startPrice * (0.0007 + (index % 4) * 0.00012);
    return {
      timestamp: addMinutes(config.detectedAt, index * 2),
      open,
      high: Math.max(open, close) + spread,
      low: Math.min(open, close) - spread,
      close,
      volume: 62_000 + index * 4_800 + (index % 5) * 11_500,
      tradesCount: 640 + index * 47 + (index % 3) * 86,
    };
  });
}

function createPrints(config: SessionConfig, candles: ReplayCandle[]): ReplayPrint[] {
  return candles.flatMap((candle, index) => {
    const preferredSide: ReplayPrint['side'] =
      config.direction === 'long'
        ? (index >= 8 ? 'buy' : index % 3 === 0 ? 'sell' : 'buy')
        : (index >= 8 ? 'sell' : index % 3 === 0 ? 'buy' : 'sell');

    const quantityScale = Math.max(1, 180 / config.startPrice);
    return [
      {
        id: `${config.id}-print-${index}-a`,
        frameIndex: index,
        timestamp: candle.timestamp,
        price: candle.close,
        quantity: Number((18 * quantityScale + index * 1.8).toFixed(3)),
        quoteValue: 14_000 + index * 1_780,
        side: preferredSide,
        isLarge: index >= 10 && index % 3 === 1,
      },
      {
        id: `${config.id}-print-${index}-b`,
        frameIndex: index,
        timestamp: new Date(new Date(candle.timestamp).getTime() + 21_000).toISOString(),
        price: (candle.open + candle.close) / 2,
        quantity: Number((9 * quantityScale + index * 0.9).toFixed(3)),
        quoteValue: 7_200 + index * 940,
        side: preferredSide === 'buy' ? 'sell' : 'buy',
        isLarge: false,
      },
    ];
  });
}

function createLiquidity(config: SessionConfig): ReplayLiquidityLevel[] {
  const unit = Math.max(config.startPrice * 0.0015, config.levelHigh - config.levelLow);
  return [
    {
      id: `${config.id}-liq-ask-3`,
      side: 'ask',
      price: config.levelHigh + unit * 1.8,
      quoteValue: 164_000,
      ageSec: 1_080,
      baseState: 'Стоит',
      visibleFrom: 0,
    },
    {
      id: `${config.id}-liq-ask-2`,
      side: 'ask',
      price: config.levelHigh + unit * 0.8,
      quoteValue: 238_000,
      ageSec: 540,
      baseState: 'Увеличивается',
      visibleFrom: 2,
    },
    {
      id: `${config.id}-liq-ask-1`,
      side: 'ask',
      price: config.levelHigh,
      quoteValue: 319_000,
      ageSec: 2_040,
      baseState: 'Исполняется',
      visibleFrom: 0,
    },
    {
      id: `${config.id}-liq-bid-1`,
      side: 'bid',
      price: config.levelLow - unit * 0.7,
      quoteValue: 287_000,
      ageSec: 1_420,
      baseState: 'Стоит',
      visibleFrom: 0,
    },
    {
      id: `${config.id}-liq-bid-2`,
      side: 'bid',
      price: config.levelLow - unit * 1.6,
      quoteValue: 196_000,
      ageSec: 720,
      baseState: 'Увеличивается',
      visibleFrom: 4,
    },
  ];
}

function createEvents(config: SessionConfig, candles: ReplayCandle[]): ReplayEvent[] {
  const success = config.result === 'successful';
  return [
    {
      id: `${config.id}-event-1`,
      frameIndex: 0,
      timestamp: candles[0].timestamp,
      title: 'Сетап найден',
      description: `${config.setupLabel}: NEXUS начал наблюдение за зоной.`,
      tone: 'info',
    },
    {
      id: `${config.id}-event-2`,
      frameIndex: 5,
      timestamp: candles[5].timestamp,
      title: 'Подход к уровню',
      description: 'Расстояние до зоны сократилось, активность начинает расти.',
      tone: 'warning',
    },
    {
      id: `${config.id}-event-3`,
      frameIndex: 9,
      timestamp: candles[9].timestamp,
      title: 'Подтверждение',
      description: 'Поток сделок ускорился, объём и количество сделок выше базовых.',
      tone: 'positive',
    },
    {
      id: `${config.id}-event-4`,
      frameIndex: 13,
      timestamp: candles[13].timestamp,
      title: success ? config.resultLabel : 'Реализация не подтверждена',
      description: success
        ? 'Цена вышла за границу зоны и удержалась за уровнем.'
        : 'После выхода за уровень цена быстро вернулась в предыдущий диапазон.',
      tone: success ? 'positive' : 'critical',
    },
    {
      id: `${config.id}-event-5`,
      frameIndex: candles.length - 1,
      timestamp: candles.at(-1)?.timestamp ?? config.detectedAt,
      title: 'Replay завершён',
      description: success
        ? `Максимальное движение составило ${config.maxMovePct.toFixed(2)}%.`
        : `Сетап завершился неудачно, движение против сценария достигло ${Math.abs(config.adverseMovePct).toFixed(2)}%.`,
      tone: success ? 'positive' : 'critical',
    },
  ];
}

function createSession(config: SessionConfig): ReplaySession {
  const candles = createCandles(config);
  return {
    id: config.id,
    setupId: config.setupId,
    symbol: config.symbol,
    exchange: 'BINANCE',
    timeframe: config.timeframe,
    direction: config.direction,
    setupKind: config.setupKind,
    setupLabel: config.setupLabel,
    resultLabel: config.resultLabel,
    result: config.result,
    detectedAt: config.detectedAt,
    endedAt: candles.at(-1)?.timestamp ?? config.detectedAt,
    detectedFrameIndex: 5,
    levelLow: config.levelLow,
    levelHigh: config.levelHigh,
    maxMovePct: config.maxMovePct,
    adverseMovePct: config.adverseMovePct,
    candles,
    prints: createPrints(config, candles),
    liquidity: createLiquidity(config),
    events: createEvents(config, candles),
  };
}

export const REPLAY_SESSIONS = SESSION_CONFIGS.map(createSession);

export function getReplaySession(sessionId: string | null): ReplaySession {
  return REPLAY_SESSIONS.find((session) => session.id === sessionId) ?? REPLAY_SESSIONS[0];
}

export function getReplayStage(frameIndex: number): SetupStage {
  if (frameIndex < 5) return 'observation';
  if (frameIndex < 9) return 'approach';
  if (frameIndex < 13) return 'confirmation';
  return 'triggered';
}
