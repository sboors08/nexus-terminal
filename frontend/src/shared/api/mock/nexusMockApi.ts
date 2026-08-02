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
  STAGE_FLOW,
  WORKSPACE_LIQUIDITY,
  WORKSPACE_PRINTS,
  type LiquidityLevel as WorkspaceLiquidityView,
  type PrintSide,
  type TapePrint,
} from '@/features/workspace/workspaceData';
import type {
  Candle,
  LiquidityLevel,
  MarketActivity,
  MarketSymbol,
  NexusAlert,
  NexusApi,
  PriceLevel,
  ReplayFrame,
  ReplaySession,
  Setup,
  SetupHistoryItem,
  SetupReason,
  TradePrint,
  WorkspaceSnapshot,
} from '@/shared/api/contracts';
import {
  fetchSetupRuntimeCandidate,
  fetchSetupRuntimeCandidates,
  selectPreferredSetupRuntimeCandidate,
} from '../runtime/setupRuntimeApi';
import { fetchLevelV2ShadowSnapshots } from '../runtime/levelV2ShadowApi';
import { fetchRuntimeMarketSymbols } from '../runtime/marketSymbolsApi';
import {
  fetchRuntimeFeedback,
  fetchRuntimeSetupFeedback,
} from '../runtime/feedbackApi';
import { mapLevelV2ShadowSnapshotsToScannerSetups } from '../runtime/levelV2ShadowScanner';
import {
  DASHBOARD_VIEW_DATA,
  type DashboardActivityPeriod,
  type DashboardCandle,
  type DashboardChartPeriod,
  type DashboardHotCoin,
  type DashboardMarketModeData,
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
  DashboardMarketModeData,
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
  getScannerSetups(
    options?: {
      minQuoteVolume24h?: number;
    },
  ): Promise<ScannerSetup[]>;
  getLevelV2ShadowScannerSetups(): Promise<ScannerSetup[]>;
  getWorkspaceView(setupId?: string | null, symbol?: string | null): Promise<WorkspaceViewData | null>;
  getAlertsView(): Promise<AlertsViewData>;
  getMarketHistoryView(): Promise<MarketHistoryViewData>;
  getReplayView(sessionId?: string | null, setupId?: string | null): Promise<ReplayViewSession | null>;
}

const MOCK_LATENCY_MS = 140;
const FIXED_NOW = '2026-07-15T17:32:14Z';


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
  const compact =
    value
      .trim()
      .replace(
        /\s/g,
        '',
      )
      .replace(
        /[^0-9,.-]/g,
        '',
      );

  const lastComma =
    compact.lastIndexOf(
      ',',
    );

  const lastDot =
    compact.lastIndexOf(
      '.',
    );

  const normalized =
    lastComma > lastDot
      ? compact
          .replace(
            /\./g,
            '',
          )
          .replace(
            ',',
            '.',
          )
      : compact.replace(
          /,/g,
          '',
        );

  const parsed =
    Number(
      normalized,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
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



function formatRuntimePrice(
  value: number,
): string {
  const digits =
    value >= 1000
      ? 2
      : value >= 1
        ? 4
        : 8;

  return value.toFixed(
    digits,
  );
}

function formatRuntimeFormation(
  detectedAt: string,
): {
  minutes: number;
  label: string;
} {
  const detectedAtMs =
    Date.parse(
      detectedAt,
    );

  const minutes =
    Number.isFinite(
      detectedAtMs,
    )
      ? Math.max(
          1,
          Math.floor(
            (
              Date.now()
              - detectedAtMs
            ) / 60_000,
          ),
        )
      : 1;

  const hours =
    Math.floor(
      minutes / 60,
    );

  const remainingMinutes =
    minutes % 60;

  return {
    minutes,

    label:
      hours > 0
        ? hours
          + 'ч '
          + remainingMinutes
          + 'м'
        : minutes
          + 'м',
  };
}

function runtimeScannerStage(
  stage: Setup['stage'],
): ScannerSetup['stage'] {
  if (stage === 'watching') {
    return 'observation';
  }

  if (stage === 'approaching') {
    return 'approach';
  }

  if (stage === 'confirmation') {
    return 'confirmation';
  }

  return 'triggered';
}

function runtimeSetupKind(
  setup: Setup,
): ScannerSetupKind {
  if (
    setup.type
    === 'level_bounce'
  ) {
    return setup.level.type
      === 'support'
        ? 'Отскок от поддержки'
        : 'Отскок от сопротивления';
  }

  return setup.level.type
    === 'support'
      ? 'Пробой поддержки'
      : 'Пробой сопротивления';
}

function runtimeStageLabel(
  stage: Setup['stage'],
): string {
  if (stage === 'watching') {
    return 'Наблюдение';
  }

  if (stage === 'approaching') {
    return 'Подход';
  }

  if (stage === 'confirmation') {
    return 'Подтверждение';
  }

  if (stage === 'breakout') {
    return 'Пробой подтверждён';
  }

  if (stage === 'bounce') {
    return 'Отскок подтверждён';
  }

  return 'Сетап истёк';
}

function runtimeContractSetupToScannerSetup(
  setup: Setup,
): ScannerSetup {
  const formation =
    formatRuntimeFormation(
      setup.detectedAt,
    );

  const chartPath =
    setup.direction === 'long'
      ? 'M0 174 C70 168 125 154 180 160 C245 166 300 138 360 143 C425 148 490 119 550 126 C590 130 616 112 640 108'
      : 'M0 36 C70 42 125 58 180 53 C245 47 300 75 360 70 C425 65 490 94 550 88 C590 84 616 102 640 106';

  const levelName =
    setup.level.type
    === 'support'
      ? 'поддержки'
      : 'сопротивления';

  return {
    id:
      setup.id,

    symbol:
      setup.symbol,

    exchange:
      'BINANCE',

    direction:
      setup.direction,

    kind:
      runtimeSetupKind(
        setup,
      ),

    stage:
      runtimeScannerStage(
        setup.stage,
      ),

    timeframe:
      setup.timeframe as
        ScannerTimeframe,

    price:
      formatRuntimePrice(
        setup.currentPrice,
      ),

    priceChange:
      '—',

    level:
      formatRuntimePrice(
        setup.level.zoneLow,
      )
      + '–'
      + formatRuntimePrice(
          setup.level.zoneHigh,
        ),

    distancePercent:
      setup.distanceToLevelPct,

    distanceLabel:
      setup.distanceToLevelPct
        .toFixed(4)
      + '%',

    touches:
      setup.level.touchesCount,

    formationMinutes:
      formation.minutes,

    formationLabel:
      formation.label,

    pullbackDepth:
      '—',

    volumeAnomaly:
      null,

    tradesAnomaly:
      null,

    tradeSpeed:
      'Данные собираются',

    btcCorrelation:
      '—',

    btcStrength:
      null,

    btcStrengthLabel:
      '—',

    activity:
      'Средняя',

    reasons: [
      'Уровень '
        + levelName
        + ' подтверждён: касаний '
        + setup.level.touchesCount
        + '.',

      'Текущая стадия: '
        + runtimeStageLabel(
            setup.stage,
          )
        + '.',

      'Расстояние до уровня: '
        + setup.distanceToLevelPct
            .toFixed(4)
        + '%.',
    ],

    chartPath,

    areaPath:
      chartPath
      + ' L640 210 L0 210 Z',

    levelY:
      106,

    touchPoints: [
      {
        x:
          470,

        y:
          108,
      },
      {
        x:
          555,

        y:
          105,
      },
    ],

    levelActiveFrom:
      setup.level.formedAt,

    runtimeData:
      true,
  };
}

async function resolveRuntimeContractSetup(
  setupId?: string | null,
  symbol?: string | null,
): Promise<Setup | null> {
  if (
    setupId
    && !setupId.startsWith(
      'market-',
    )
  ) {
    const direct =
      await fetchSetupRuntimeCandidate({
        candidateId:
          setupId,
      });

    if (direct) {
      return direct;
    }
  }

  const normalizedSymbol =
    symbol
      ?.trim()
      .replace(
        '/',
        '',
      )
      .toUpperCase();

  const setups =
    await fetchSetupRuntimeCandidates({
      limit:
        100,

      ...(normalizedSymbol
        ? {
            symbol:
              normalizedSymbol,
          }
        : {}),
    });

  return selectPreferredSetupRuntimeCandidate(
    setups,
  );
}

function buildHistoryChartPath(points: number[]) {
  if (points.length === 0) return 'M0 105 L640 105';
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, 1);
  return points.map((value, index) => {
    const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 640;
    const y = 190 - ((value - min) / range) * 170;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

function historyItemToScannerSetup(item: MarketHistoryItem): ScannerSetup {
  const chartPath = buildHistoryChartPath(item.chartPoints);
  const lastPoint = item.chartPoints.at(-1) ?? 50;
  const levelY = Math.max(24, Math.min(186, 190 - lastPoint * 1.5));
  const kind: ScannerSetupKind = item.setupLabel.includes('Отскок')
    ? item.direction === 'long' ? 'Отскок от поддержки' : 'Отскок от сопротивления'
    : item.direction === 'long' ? 'Пробой сопротивления' : 'Пробой поддержки';
  const priceChange = item.maxMovePct ?? item.adverseMovePct ?? 0;
  const priceDecimals = item.detectedPrice >= 1000 ? 2 : item.detectedPrice >= 10 ? 2 : 4;

  return {
    id: item.setupId,
    symbol: item.symbol,
    exchange: item.exchange,
    direction: item.direction,
    kind,
    stage: item.result === 'successful' || item.result === 'failed' ? 'triggered' : item.stageAtDetection,
    timeframe: item.timeframe,
    price: item.detectedPrice.toLocaleString('ru-RU', {
      minimumFractionDigits: priceDecimals,
      maximumFractionDigits: priceDecimals,
    }),
    priceChange: `${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`,
    level: item.levelZone,
    distancePercent: 0,
    distanceLabel: 'архив',
    touches: item.touchesCount,
    formationMinutes: Math.round(item.formationDurationSec / 60),
    formationLabel: `${Math.floor(item.formationDurationSec / 3600)}ч ${Math.round((item.formationDurationSec % 3600) / 60)}м`,
    pullbackDepth: item.pullbackLabel === 'Глубокие' ? 'Глубокие' : 'Неглубокие',
    volumeAnomaly: 1.2,
    tradesAnomaly: 1.15,
    tradeSpeed: 'Средняя',
    btcCorrelation: '0.50',
    btcStrength: item.btcRelativeStrength ?? 0,
    btcStrengthLabel: `${(item.btcRelativeStrength ?? 0) > 0 ? '+' : ''}${(item.btcRelativeStrength ?? 0).toFixed(1)}%`,
    activity: 'Средняя',
    reasons: [item.resultReason, item.resultNote],
    chartPath,
    areaPath: `${chartPath} L640 210 L0 210 Z`,
    levelY,
    touchPoints: item.chartPoints.slice(-Math.max(2, Math.min(3, item.touchesCount))).map((value, index, values) => ({
      x: 460 + (index / Math.max(values.length - 1, 1)) * 150,
      y: Math.max(20, Math.min(190, 190 - value * 1.5)),
    })),
  };
}

const HOT_LIST_ONLY_SETUPS: ScannerSetup[] = [
  {
    id: 'wif-hot-momentum',
    symbol: 'WIFUSDT',
    exchange: 'BINANCE',
    direction: 'long',
    kind: 'Пробой сопротивления',
    stage: 'confirmation',
    timeframe: '1m',
    price: '3.22',
    priceChange: '+3.42%',
    level: '3.24–3.27',
    distancePercent: 0.62,
    distanceLabel: '0.62%',
    touches: 3,
    formationMinutes: 37,
    formationLabel: '37м',
    pullbackDepth: 'Неглубокие',
    volumeAnomaly: 2.18,
    tradesAnomaly: 2.42,
    tradeSpeed: 'Высокая',
    btcCorrelation: '0.28',
    btcStrength: 2.91,
    btcStrengthLabel: '+2.91%',
    activity: 'Высокая',
    reasons: [
      'Количество сделок резко выросло',
      'Три касания локального сопротивления',
      'Монета заметно сильнее BTC',
    ],
    chartPath: 'M0 174 C35 164 51 148 82 153 C113 158 132 128 164 135 C196 142 214 111 245 118 C277 125 297 94 329 102 C361 110 382 76 414 85 C446 94 468 61 500 70 C532 79 555 48 587 57 C610 63 626 46 640 40',
    areaPath: 'M0 174 C35 164 51 148 82 153 C113 158 132 128 164 135 C196 142 214 111 245 118 C277 125 297 94 329 102 C361 110 382 76 414 85 C446 94 468 61 500 70 C532 79 555 48 587 57 C610 63 626 46 640 40 L640 210 L0 210 Z',
    levelY: 47,
    touchPoints: [{ x: 414, y: 85 }, { x: 500, y: 70 }, { x: 587, y: 57 }],
  },
  {
    id: 'pepe-hot-breakout',
    symbol: 'PEPEUSDT',
    exchange: 'BINANCE',
    direction: 'long',
    kind: 'Пробой сопротивления',
    stage: 'approach',
    timeframe: '1m',
    price: '0.00001234',
    priceChange: '+2.06%',
    level: '0.00001248–0.00001256',
    distancePercent: 0.94,
    distanceLabel: '0.94%',
    touches: 3,
    formationMinutes: 29,
    formationLabel: '29м',
    pullbackDepth: 'Неглубокие',
    volumeAnomaly: 1.76,
    tradesAnomaly: 1.89,
    tradeSpeed: 'Высокая',
    btcCorrelation: '0.18',
    btcStrength: 1.19,
    btcStrengthLabel: '+1.19%',
    activity: 'Высокая',
    reasons: [
      'Активность начала ускоряться',
      'Откаты после касаний становятся короче',
      'Объём выше среднего уровня',
    ],
    chartPath: 'M0 168 C34 160 55 170 84 149 C113 128 139 145 169 123 C199 101 225 120 255 97 C285 75 312 96 342 75 C372 54 399 77 429 59 C459 41 487 61 517 46 C547 31 577 48 607 34 C621 29 632 26 640 23',
    areaPath: 'M0 168 C34 160 55 170 84 149 C113 128 139 145 169 123 C199 101 225 120 255 97 C285 75 312 96 342 75 C372 54 399 77 429 59 C459 41 487 61 517 46 C547 31 577 48 607 34 C621 29 632 26 640 23 L640 210 L0 210 Z',
    levelY: 31,
    touchPoints: [{ x: 429, y: 59 }, { x: 517, y: 46 }, { x: 607, y: 34 }],
  },
];

const WORKSPACE_SETUPS: ScannerSetup[] = [...SCANNER_SETUPS, ...HOT_LIST_ONLY_SETUPS];

function resolveWorkspaceSetup(
  setupId?: string | null,
  symbol?: string | null,
): ScannerSetup | null {
  if (setupId) {
    const direct =
      WORKSPACE_SETUPS.find(
        (setup) => setup.id === setupId,
      );

    if (direct) {
      return direct;
    }

    const historyItem =
      MARKET_HISTORY_ITEMS.find(
        (item) => item.setupId === setupId,
      );

    if (historyItem) {
      return historyItemToScannerSetup(
        historyItem,
      );
    }

    if (setupId.startsWith('market-')) {
      const dynamicSymbol =
        setupId
          .slice('market-'.length)
          .toUpperCase();

      return dynamicSymbol
        ? createMarketWorkspaceSetup(
            dynamicSymbol,
          )
        : null;
    }

    return null;
  }

  const requestedSymbol =
    symbol
      ?.trim()
      .replace('/', '')
      .toUpperCase();

  if (requestedSymbol) {
    const active =
      WORKSPACE_SETUPS.find(
        (setup) =>
          setup.symbol === requestedSymbol,
      );

    if (active) {
      return active;
    }

    const historyItem =
      MARKET_HISTORY_ITEMS.find(
        (item) =>
          item.symbol === requestedSymbol,
      );

    if (historyItem) {
      return historyItemToScannerSetup(
        historyItem,
      );
    }

    return createMarketWorkspaceSetup(
      requestedSymbol,
    );
  }

  return WORKSPACE_SETUPS[0] ?? null;
}

function toContractSetup(setup: ScannerSetup, index: number): Setup {
  if (
    setup.volumeAnomaly
      === null
    || setup.tradesAnomaly
      === null
    || setup.btcStrength
      === null
  ) {
    throw new Error(
      'Static mock setup requires complete Scanner metrics',
    );
  }

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
    pullbackType:
      setup.pullbackDepth === '—'
        ? null
        : setup.pullbackDepth === 'Неглубокие'
          ? 'shallow'
          : 'deep',
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

const activeContractSetups: Setup[] = WORKSPACE_SETUPS.map(toContractSetup);
const archivedViewSetups = MARKET_HISTORY_ITEMS
  .filter((item) => !SCANNER_SETUPS.some((setup) => setup.id === item.setupId))
  .map(historyItemToScannerSetup);
const archivedContractSetups = archivedViewSetups.map((setup, index) => ({
  ...toContractSetup(setup, activeContractSetups.length + index),
  detectedAt: MARKET_HISTORY_ITEMS.find((item) => item.setupId === setup.id)?.detectedAt ?? FIXED_NOW,
  updatedAt: MARKET_HISTORY_ITEMS.find((item) => item.setupId === setup.id)?.completedAt ?? FIXED_NOW,
  scoreStatus: 'validated' as const,
}));
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
const contractSetups: Setup[] = [...activeContractSetups, ...inactiveContractSetups, ...archivedContractSetups];

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

function formatDynamicWorkspacePrice(
  value: number,
): string {
  const digits =
    value >= 1000
      ? 2
      : value >= 1
        ? 4
        : 8;

  return value.toLocaleString(
    'ru-RU',
    {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    },
  );
}

function createMarketWorkspaceSetup(
  requestedSymbol: string,
): ScannerSetup {
  const symbol =
    requestedSymbol
      .trim()
      .replace('/', '')
      .toUpperCase();

  const marketSymbol =
    marketSymbols.find(
      (item) => item.symbol === symbol,
    );

  const price =
    marketSymbol?.price ?? 1;

  const change =
    marketSymbol?.priceChangePct ?? 0;

  const direction =
    change < 0
      ? 'short'
      : 'long';

  const levelCenter =
    direction === 'long'
      ? price * 1.003
      : price * 0.997;

  const levelLow =
    levelCenter * 0.999;

  const levelHigh =
    levelCenter * 1.001;

  const btcStrength =
    marketSymbol
      ?.btcRelativeStrength ?? 0;

  const btcCorrelation =
    marketSymbol
      ?.btcCorrelation ?? 0.5;

  const chartPath =
    'M0 174 C70 168 125 154 180 160 '
    + 'C245 166 300 138 360 143 '
    + 'C425 148 490 119 550 126 '
    + 'C590 130 616 112 640 108';

  return {
    id:
      `market-${symbol.toLowerCase()}`,
    symbol,
    exchange: 'BINANCE',
    direction,
    kind:
      direction === 'long'
        ? 'Пробой сопротивления'
        : 'Пробой поддержки',
    stage: 'observation',
    timeframe: '1m',
    price:
      formatDynamicWorkspacePrice(
        price,
      ),
    priceChange:
      `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
    level:
      `${formatDynamicWorkspacePrice(levelLow)}–${formatDynamicWorkspacePrice(levelHigh)}`,
    distancePercent: 0.3,
    distanceLabel: '0.30%',
    touches: 2,
    formationMinutes: 30,
    formationLabel: '30м',
    pullbackDepth: 'Неглубокие',
    volumeAnomaly: 1.2,
    tradesAnomaly: 1.15,
    tradeSpeed: 'Средняя',
    btcCorrelation:
      btcCorrelation.toFixed(2),
    btcStrength,
    btcStrengthLabel:
      `${btcStrength >= 0 ? '+' : ''}${btcStrength.toFixed(2)}%`,
    activity: 'Средняя',
    reasons: [
      'Монета выбрана в Market Scanner.',
      'Рабочий контекст сформирован автоматически.',
    ],
    chartPath,
    areaPath:
      `${chartPath} L640 210 L0 210 Z`,
    levelY: 104,
    touchPoints: [
      { x: 470, y: 108 },
      { x: 555, y: 105 },
    ],
  };
}

function resolveContractSetupById(
  setupId: string,
): Setup | null {
  const stored =
    contractSetups.find(
      (item) => item.id === setupId,
    );

  if (stored) {
    return stored;
  }

  if (!setupId.startsWith('market-')) {
    return null;
  }

  const symbol =
    setupId
      .slice('market-'.length)
      .toUpperCase();

  if (!symbol) {
    return null;
  }

  return toContractSetup(
    createMarketWorkspaceSetup(
      symbol,
    ),
    contractSetups.length,
  );
}

function timeframeToMinutes(timeframe: string): number {
  const value = timeframe.trim().toLowerCase();
  if (value.endsWith('h')) return Math.max(1, Number.parseInt(value, 10) || 1) * 60;
  return Math.max(1, Number.parseInt(value, 10) || 5);
}

function createCandles(symbol: MarketSymbol, count = 48, timeframe = '5m'): Candle[] {
  const start = new Date('2026-07-15T13:32:00Z').getTime();
  const timeframeMinutes = timeframeToMinutes(timeframe);
  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin(index * 0.42) * symbol.price * 0.0025;
    const trend = symbol.price * 0.00025 * index;
    const open = symbol.price * 0.985 + trend + wave;
    const close = open + Math.sin(index * 0.91) * symbol.price * 0.0018;
    const openTime = new Date(start + index * timeframeMinutes * 60_000);
    return {
      openTime: openTime.toISOString(),
      closeTime: new Date(openTime.getTime() + timeframeMinutes * 60_000 - 1).toISOString(),
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
  const symbol:
  MarketSymbol =
    marketSymbols.find(
      (item) =>
        item.symbol
        === setup.symbol,
    )
    ?? {
      symbol:
        setup.symbol,

      baseAsset:
        setup.symbol.replace(
          'USDT',
          '',
        ),

      quoteAsset:
        'USDT',

      exchange:
        'binance',

      price:
        setup.currentPrice,

      priceChangePct:
        0,

      volumeQuote:
        0,

      tradesCount:
        0,

      tradeRate:
        0,

      volatilityPct:
        0,

      btcCorrelation:
        null,

      btcRelativeStrength:
        null,

      updatedAt:
        setup.updatedAt,
    };
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
    workspaceUrl: `/app/workspace?setupId=${setup.id}&symbol=${setup.symbol}&timeframe=${setup.timeframe}`,
  };
});

const canonicalHistory: SetupHistoryItem[] = MARKET_HISTORY_ITEMS.map((item, index) => ({
  setup: contractSetups.find((setup) => setup.id === item.setupId)
    ?? contractSetups.find((setup) => setup.symbol === item.symbol)
    ?? contractSetups[index % contractSetups.length],
  result: item.result,
  maxMovePct: item.maxMovePct,
  adverseMovePct: item.adverseMovePct,
  timeToMaxMoveSec: item.timeToTargetSec,
  completedAt: item.completedAt,
  replayAvailable: item.replayAvailable,
}));

function createCanonicalReplay(sessionId?: string): ReplaySession | null {
  const viewSession = sessionId
    ? REPLAY_SESSIONS.find((session) => session.id === sessionId) ?? null
    : REPLAY_SESSIONS[0] ?? null;
  if (!viewSession) return null;
  const setup = contractSetups.find((item) => item.id === viewSession.setupId)
    ?? contractSetups.find((item) => item.symbol === viewSession.symbol)
    ?? contractSetups[0];
  const initialSnapshot = createWorkspaceSnapshot(setup);
  const frames: ReplayFrame[] = viewSession.candles.map((candle, index) => ({
    timestamp: candle.timestamp,
    candleUpdates: [{
      openTime: candle.timestamp,
      closeTime: new Date(
        new Date(
          candle.timestamp,
        ).getTime()
          + timeframeToMinutes(
            viewSession.timeframe,
          )
            * 60_000
          - 1,
      ).toISOString(),
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
  getMarketSymbols: () => fetchRuntimeMarketSymbols(),
  getMarketCandles: (symbol, timeframe) => {
    const marketSymbol = marketSymbols.find((item) => item.symbol === symbol.toUpperCase()) ?? marketSymbols[0];
    return deliver('market candles', marketSymbol ? createCandles(marketSymbol, 56, timeframe) : [], []);
  },
  getSetups: () =>
    fetchSetupRuntimeCandidates({
      limit:
        100,
    }),

  getSetupById:
    async (setupId) => {
      if (
        setupId.startsWith(
          'market-',
        )
      ) {
        return deliver(
          'setup',
          resolveContractSetupById(
            setupId,
          ),
          null,
        );
      }

      return fetchSetupRuntimeCandidate({
        candidateId:
          setupId,
      });
    },

  getWorkspaceSnapshot:
    async (setupId) => {
      const setup =
        setupId
        && setupId.startsWith(
          'market-',
        )
          ? resolveContractSetupById(
              setupId,
            )
          : await resolveRuntimeContractSetup(
              setupId,
              null,
            );

      return setup
        ? createWorkspaceSnapshot(
            setup,
          )
        : null;
    },

  getAlerts: () => deliver('alerts', canonicalAlerts, []),
  getSetupHistory: () => deliver('setup history', canonicalHistory, []),
  getReplaySession: (sessionId) => deliver('replay session', createCanonicalReplay(sessionId), null),
  sendFeedback:
    (payload) =>
      fetchRuntimeFeedback(payload),
  sendSetupFeedback:
    (payload) =>
      fetchRuntimeSetupFeedback(payload),
};

const viewApi: NexusViewApi = {
  getDashboardView: () => deliver('dashboard', DASHBOARD_VIEW_DATA, null),
  getScannerSetups:
    async (
      options = {},
    ) => {
      const setups =
        await fetchSetupRuntimeCandidates({
          limit:
            1_000,

          ...(
            options.minQuoteVolume24h
            !== undefined
              ? {
                  minQuoteVolume24h:
                    options
                      .minQuoteVolume24h,
                }
              : {}
          ),
        });

      return setups
        .filter(
          (setup) =>
            setup.stage
            !== 'invalidated',
        )
        .map(
          runtimeContractSetupToScannerSetup,
        );
    },

  getLevelV2ShadowScannerSetups:
    async () => {
      const response =
        await fetchLevelV2ShadowSnapshots({
          eligibleForSetups:
            true,
          minScore:
            90,
          limit:
            500,
        });

      return mapLevelV2ShadowSnapshotsToScannerSetups(
        response.items,
      );
    },

  getWorkspaceView:
    async (
      setupId,
      symbol,
    ) => {
      if (
        setupId?.startsWith(
          'market-',
        )
      ) {
        const selectedSetup =
          resolveWorkspaceSetup(
            setupId,
            symbol,
          );

        return selectedSetup
          ? {
              selectedSetup,

              stageFlow:
                STAGE_FLOW,
            }
          : null;
      }

      const setup =
        await resolveRuntimeContractSetup(
          setupId,
          symbol,
        );

      return setup
        ? {
            selectedSetup:
              runtimeContractSetupToScannerSetup(
                setup,
              ),

            stageFlow:
              STAGE_FLOW,
          }
        : null;
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
  getReplayView: (sessionId, setupId) => {
    const session = sessionId
      ? REPLAY_SESSIONS.find((item) => item.id === sessionId)
        ?? (setupId ? REPLAY_SESSIONS.find((item) => item.setupId === setupId) : null)
        ?? null
      : setupId
        ? REPLAY_SESSIONS.find((item) => item.setupId === setupId) ?? null
        : REPLAY_SESSIONS[0] ?? null;
    return deliver('replay view', session, null);
  },
};

export const nexusApi: NexusApi & NexusViewApi = {
  ...contractApi,
  ...viewApi,
};
