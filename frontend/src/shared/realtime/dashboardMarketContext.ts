import type {
  DashboardScannerMetricView,
  MarketScannerMetrics,
} from './dashboardScannerMetrics.js';

export type DashboardMarketDataState =
  | 'ready'
  | 'collecting'
  | 'error';

export type DashboardMarketMode =
  | 'bullish'
  | 'bearish'
  | 'neutral'
  | 'collecting'
  | 'error';

export type DashboardMarketScannerStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error';

export interface DashboardMarketContextRow {
  view: Pick<
    DashboardScannerMetricView,
    | 'isLive'
    | 'priceChangePct'
    | 'volatilityPct'
  >;
}
export interface NexusMarketSentiment {
  value: number | null;
  label: string;
  tone: string;
}

export interface DashboardMarketContext {
  dataState: DashboardMarketDataState;
  mode: DashboardMarketMode;
  title:
    | 'BULLISH'
    | 'BEARISH'
    | 'NEUTRAL'
    | 'СБОР ДАННЫХ'
    | 'ОШИБКА ДАННЫХ';
  trend:
    | 'TRENDING UP'
    | 'TRENDING DOWN'
    | 'СМЕШАННЫЙ РЫНОК'
    | 'НЕДОСТАТОЧНО ИСТОРИИ'
    | 'ПОВТОРИТЕ ЗАПРОС';
  risk:
    | 'ПОКУПАТЕЛИ СИЛЬНЕЕ'
    | 'ПРОДАВЦЫ СИЛЬНЕЕ'
    | 'БАЛАНС СИЛ'
    | 'СБОР ДАННЫХ'
    | 'НЕТ ДАННЫХ';
  accent: string;
  glow: string;
  btcChangePct: number | null;
  marketBreadthPct: number | null;
  marketVolatilityPct: number | null;
  marketVolatilityLabel: string;
  liveMarketCount: number;
  sentiment: NexusMarketSentiment;
}

export interface ResolveDashboardMarketContextOptions {
  btcMetric:
    | Pick<
        MarketScannerMetrics,
        | 'symbol'
        | 'priceChangePct'
        | 'updatedAt'
      >
    | undefined;
  rows: readonly DashboardMarketContextRow[];
  activityPeriod: string;
  scannerStatus: DashboardMarketScannerStatus;
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

function isFiniteNumber(
  value: number | null | undefined,
): value is number {
  return (
    typeof value === 'number'
    && Number.isFinite(value)
  );
}

function calculateMedian(
  values: readonly number[],
): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort(
    (left, right) => left - right,
  );
  const middle = Math.floor(
    sorted.length / 2,
  );

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null;
  }

  const lower = sorted[middle - 1];
  const upper = sorted[middle];

  return lower === undefined
    || upper === undefined
    ? null
    : (lower + upper) / 2;
}

function resolveSentimentLabel(
  value: number,
): Pick<
  NexusMarketSentiment,
  'label' | 'tone'
> {
  if (value <= 20) {
    return {
      label: 'КРАЙНИЙ СТРАХ',
      tone: '#ff5b54',
    };
  }

  if (value <= 40) {
    return {
      label: 'СТРАХ',
      tone: '#ff8a52',
    };
  }

  if (value < 60) {
    return {
      label: 'НЕЙТРАЛЬНО',
      tone: '#91a39c',
    };
  }

  if (value < 80) {
    return {
      label: 'ЖАДНОСТЬ',
      tone: '#2dd0ba',
    };
  }

  return {
    label: 'КРАЙНЯЯ ЖАДНОСТЬ',
    tone: '#35df8d',
  };
}

function resolveNexusMarketSentiment(
  btcChangePct: number,
  marketBreadthPct: number,
  marketVolatilityPct: number | null,
): NexusMarketSentiment {
  const normalizationVolatility = Math.max(
    marketVolatilityPct
      ?? Math.abs(btcChangePct),
    0.05,
  );

  const normalizedBtcMove = clamp(
    btcChangePct / normalizationVolatility,
    -2,
    2,
  );

  const btcScore =
    50 + normalizedBtcMove * 20;

  const value = Math.round(
    clamp(
      btcScore * 0.55
      + marketBreadthPct * 0.45,
      0,
      100,
    ),
  );

  return {
    value,
    ...resolveSentimentLabel(value),
  };
}

export function formatDashboardMarketChange(
  value: number | null,
): string {
  if (!isFiniteNumber(value)) {
    return '—';
  }

  return (
    `${value > 0 ? '+' : ''}`
    + `${value.toFixed(2)}%`
  );
}

export function resolveDashboardMarketContext(
  options: ResolveDashboardMarketContextOptions,
): DashboardMarketContext {
  const {
    btcMetric,
    rows,
    activityPeriod,
    scannerStatus,
  } = options;

  const liveViews = rows
    .map(({ view }) => view)
    .filter(
      (view) =>
        view.isLive
        && isFiniteNumber(
          view.priceChangePct,
        ),
    );

  const marketBreadthPct =
    liveViews.length === 0
      ? null
      : (
          liveViews.filter(
            (view) =>
              (view.priceChangePct ?? 0) > 0,
          ).length
          / liveViews.length
        ) * 100;

  const marketVolatilityPct =
    calculateMedian(
      liveViews
        .map((view) => view.volatilityPct)
        .filter(isFiniteNumber),
    );

  const btcChangePct =
    btcMetric?.symbol === 'BTCUSDT'
    && isFiniteNumber(
      btcMetric.priceChangePct,
    )
      ? btcMetric.priceChangePct
      : null;

  const base = {
    btcChangePct,
    marketBreadthPct,
    marketVolatilityPct,
    marketVolatilityLabel:
      marketVolatilityPct === null
        ? 'нет данных'
        : `медиана ${activityPeriod}`,
    liveMarketCount: liveViews.length,
  };

  if (
    btcChangePct === null
    || marketBreadthPct === null
    || liveViews.length < 5
  ) {
    const requestFailed =
      scannerStatus === 'error';

    return {
      ...base,
      dataState:
        requestFailed
          ? 'error'
          : 'collecting',
      mode:
        requestFailed
          ? 'error'
          : 'collecting',
      title:
        requestFailed
          ? 'ОШИБКА ДАННЫХ'
          : 'СБОР ДАННЫХ',
      trend:
        requestFailed
          ? 'ПОВТОРИТЕ ЗАПРОС'
          : 'НЕДОСТАТОЧНО ИСТОРИИ',
      risk:
        requestFailed
          ? 'НЕТ ДАННЫХ'
          : 'СБОР ДАННЫХ',
      accent:
        requestFailed
          ? '#ff5b54'
          : '#91a39c',
      glow:
        requestFailed
          ? 'rgb(255 91 84 / 18%)'
          : 'rgb(145 163 156 / 16%)',
      sentiment: {
        value: null,
        label:
          requestFailed
            ? 'ошибка данных'
            : 'сбор данных',
        tone:
          requestFailed
            ? '#ff5b54'
            : '#91a39c',
      },
    };
  }

  const sentiment =
    resolveNexusMarketSentiment(
      btcChangePct,
      marketBreadthPct,
      marketVolatilityPct,
    );

  if (
    btcChangePct > 0
    && marketBreadthPct >= 55
  ) {
    return {
      ...base,
      dataState: 'ready',
      mode: 'bullish',
      title: 'BULLISH',
      trend: 'TRENDING UP',
      risk: 'ПОКУПАТЕЛИ СИЛЬНЕЕ',
      accent: '#35df8d',
      glow: 'rgb(48 221 137 / 22%)',
      sentiment,
    };
  }

  if (
    btcChangePct < 0
    && marketBreadthPct <= 45
  ) {
    return {
      ...base,
      dataState: 'ready',
      mode: 'bearish',
      title: 'BEARISH',
      trend: 'TRENDING DOWN',
      risk: 'ПРОДАВЦЫ СИЛЬНЕЕ',
      accent: '#ff5b54',
      glow: 'rgb(255 91 84 / 24%)',
      sentiment,
    };
  }

  return {
    ...base,
    dataState: 'ready',
    mode: 'neutral',
    title: 'NEUTRAL',
    trend: 'СМЕШАННЫЙ РЫНОК',
    risk: 'БАЛАНС СИЛ',
    accent: '#91a39c',
    glow: 'rgb(145 163 156 / 16%)',
    sentiment,
  };
}
