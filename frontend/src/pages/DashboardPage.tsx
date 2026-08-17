import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import bearMarket from '@/assets/bear-market.png';
import bullMarket from '@/assets/bull-market.png';
import {
  nexusApi,
  useApiQuery,
  type DashboardActivityPeriod,
  type DashboardChartPeriod,
  type DashboardViewData,
} from '@/shared/api';
import { ROUTES } from '@/app/routing/routes';
import type {
  ScannerWindow,
} from '@/shared/config/tradingPresets';
import {
  buildMarketWorkspaceSetupId,
  buildWorkspaceUrl,
} from '@/shared/routing/setupContext';
import {
  buildDashboardRealtimeView,
  buildDashboardScannerUniverseRows,
  countActiveScannerFilters,
  createDefaultScannerFilterState,
  filterAndSortScannerRows,
  buildDashboardScannerMetricView,

  normalizeDashboardRealtimeSymbol,
  sortDashboardScannerRows,
  useBinanceSymbolUniverse,
  useMarketWideScannerMetrics,
  useMarketVolumeSpikes,
  useRealtimeMarketData,
  type MarketVolumeSpikeStatus,
  type ScannerFilterState,
} from '@/shared/realtime';
import {
  NexusCandlestickChart,
  useMarketCandles,
  type MarketCandleTimeframe,
} from '@/shared/charts';
import {
  CausalLevelStateStrip,
  useCausalLevelLines,
} from '@/shared/level-lines';
import { AsyncDataState } from '@/shared/ui/AsyncDataState';
import { DashboardScannerFilters } from './DashboardScannerFilters';
import filterStyles from './DashboardScannerFilters.module.css';
import styles from './DashboardPage.module.css';

type DashboardScannerMetricView =
  ReturnType<typeof buildDashboardScannerMetricView>;

function getDashboardSymbolIcon(
  symbol: string,
): string {
  const baseAsset =
    symbol.split('/')[0] ?? symbol;

  return baseAsset.slice(0, 1) || '◆';
}

function HotCard({
  symbol,
  rank,
  view,
  activityPeriod,
  selected,
  onSelect,
}: {
  symbol: string;
  rank: number;
  view: DashboardScannerMetricView;
  activityPeriod: DashboardActivityPeriod;
  selected: boolean;
  onSelect: () => void;
}) {
  const sourceClass =
    view.sourceLabel === 'LIVE'
      ? styles.sourceLive
      : view.sourceLabel === 'NEW'
        ? styles.sourceCollecting
        : view.sourceLabel === 'BINANCE'
          ? styles.sourceRegistry
          : styles.sourceUnavailable;

  const cardColor =
    view.priceChangePct === null
      ? '#82958d'
      : view.priceChangePct < 0
        ? '#ff6b63'
        : '#35df8d';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`${styles.hotCard} ${
        selected
          ? styles.hotCardSelected
          : ''
      }`}
      style={{
        '--coin-color': cardColor,
      } as CSSProperties}
    >
      <span className={styles.cardRank}>
        {rank}
      </span>

      <div className={styles.cardHead}>
        <span className={styles.coinIcon}>
          {getDashboardSymbolIcon(symbol)}
        </span>

        <span className={styles.coinIdentity}>
          <strong>{symbol}</strong>

          <small>
            {view.activityIsLive
              ? `${activityPeriod} LIVE`
              : view.sourceLabel === 'NEW'
                ? 'СБОР ДАННЫХ'
                : 'НЕТ ДАННЫХ'}
          </small>
        </span>

        <span className={styles.score}>
          <strong>
            {view.activityIsLive
              ? view.activityScore
              : '—'}
            {' '}
            <i>♨</i>
          </strong>

          <small>АКТИВНОСТЬ</small>
        </span>
      </div>

      <div className={styles.cardStats}>
        <span>
          Цена
          <strong>{view.priceLabel}</strong>
        </span>

        <span>
          Изменение
          <strong
            className={
              view.priceChangePct === null
                ? styles.neutral
                : view.priceChangePct < 0
                  ? styles.negative
                  : styles.positive
            }
          >
            {view.priceChangeLabel}
          </strong>
        </span>

        <span>
          Объём
          <strong>{view.quoteVolumeLabel}</strong>
        </span>

        <span>
          Сделки
          <strong>{view.tradesCountLabel}</strong>
        </span>

        <span>
          Скорость
          <strong>{view.speedLabel}</strong>
        </span>

        <span>
          Связь с BTC
          <strong
            className={
              view.btcCorrelation === null
                ? styles.neutral
                : undefined
            }
          >
            {view.btcCorrelationLabel}
          </strong>
        </span>

        <span className={styles.strengthRow}>
          Сила против BTC
          <strong
            className={
              view.relativeStrengthPct === null
                ? styles.neutral
                : view.relativeStrengthPct < 0
                  ? styles.negative
                  : styles.positive
            }
          >
            {view.relativeStrengthLabel}
          </strong>
        </span>

        <span>
          Ликвидность
          <strong>
            {view.liquidityIsLive
              ? `${view.liquidityScore}/9`
              : 'нет данных'}
          </strong>
        </span>
      </div>

      <small className={styles.cardNote}>
        <b className={sourceClass}>
          {view.sourceLabel}
        </b>
        {' · '}
        {view.updatedAtLabel}
      </small>
    </button>
  );
}
type MarketMode =
  | 'bullish'
  | 'bearish'
  | 'neutral';

type ResolvedMarketMode = {
  mode: MarketMode;
  title:
    | 'BULLISH'
    | 'BEARISH'
    | 'NEUTRAL'
    | 'СБОР ДАННЫХ';
  trend:
    | 'TRENDING UP'
    | 'TRENDING DOWN'
    | 'СМЕШАННЫЙ РЫНОК'
    | 'НЕТ СИГНАЛА';
  risk:
    | 'RISK ON'
    | 'RISK OFF'
    | 'RISK —';
  accent: string;
  glow: string;
  image: string | null;
  marketBreadthPct: number | null;
  marketVolatilityPct: number | null;
  marketVolatilityLabel: string;
  liveMarketCount: number;
};

const DASHBOARD_ACTIVITY_PERIOD_TO_SCANNER_WINDOW:
Record<
  DashboardActivityPeriod,
  ScannerWindow
> = {
  '1M': '1m',
  '5M': '5m',
  '15M': '15m',
  '1H': '1h',
  '4H': '4h',
  '24H': '1d',
};

function calculateMedian(
  values: readonly number[],
): number | null {
  if (values.length === 0) return null;

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

function resolveMarketMode(
  btcChangePct: number | null,
  rows: ReadonlyArray<{
    view: DashboardScannerMetricView;
  }>,
  activityPeriod: DashboardActivityPeriod,
): ResolvedMarketMode {
  const liveViews = rows
    .map(({ view }) => view)
    .filter(
      (view) =>
        view.isLive
        && view.priceChangePct !== null,
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
        .filter(
          (value): value is number =>
            value !== null,
        ),
    );

  const base = {
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
    return {
      ...base,
      mode: 'neutral',
      title: 'СБОР ДАННЫХ',
      trend: 'НЕТ СИГНАЛА',
      risk: 'RISK —',
      accent: '#91a39c',
      glow: 'rgb(145 163 156 / 16%)',
      image: null,
    };
  }

  if (
    btcChangePct > 0
    && marketBreadthPct >= 55
  ) {
    return {
      ...base,
      mode: 'bullish',
      title: 'BULLISH',
      trend: 'TRENDING UP',
      risk: 'RISK ON',
      accent: '#35df8d',
      glow: 'rgb(48 221 137 / 22%)',
      image: bullMarket,
    };
  }

  if (
    btcChangePct < 0
    && marketBreadthPct <= 45
  ) {
    return {
      ...base,
      mode: 'bearish',
      title: 'BEARISH',
      trend: 'TRENDING DOWN',
      risk: 'RISK OFF',
      accent: '#ff5b54',
      glow: 'rgb(255 91 84 / 24%)',
      image: bearMarket,
    };
  }

  return {
    ...base,
    mode: 'neutral',
    title: 'NEUTRAL',
    trend: 'СМЕШАННЫЙ РЫНОК',
    risk: 'RISK —',
    accent: '#91a39c',
    glow: 'rgb(145 163 156 / 16%)',
    image: null,
  };
}


/* Dashboard Volume Spikes v0.1 */
const DASHBOARD_VOLUME_SPIKE_STATUS_LABELS:
Record<MarketVolumeSpikeStatus, string> = {
  new: 'НОВЫЙ ВСПЛЕСК',
  growing: 'УСКОРЕНИЕ',
  stable: 'ВЫШЕ СРЕДНЕГО',
  fading: 'ЗАТУХАЕТ',
};

function formatDashboardVolumeSpikeVolume(
  value: number,
): string {
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (absolute >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (absolute >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return Math.round(value).toLocaleString('ru-RU');
}

function buildDashboardVolumeSpikesScannerUrl(
  symbol?: string,
): string {
  if (!symbol) {
    return ROUTES.scanner;
  }

  const params = new URLSearchParams();
  params.set('symbol', symbol);

  return `${ROUTES.scanner}?${params.toString()}`;
}

function FearGreed({
  value,
  label,
  tone,
}: {
  value: number | null;
  label: string;
  tone: string;
}) {
  if (value === null) {
    return (
      <div className={styles.fearGreedGauge}>
        <span
          style={{
            '--market-tone': tone,
          } as CSSProperties}
        >
          <strong>—</strong>
          <small>{label}</small>
        </span>
      </div>
    );
  }

  const normalized = Math.min(
    100,
    Math.max(0, value),
  );
  const angle =
    Math.PI
    - (normalized / 100) * Math.PI;
  const needleX =
    60 + Math.cos(angle) * 33;
  const needleY =
    58 - Math.sin(angle) * 33;

  return (
    <div className={styles.fearGreedGauge}>
      <svg
        viewBox="0 0 120 66"
        aria-label={`Fear and Greed: ${value}`}
      >
        <defs>
          <linearGradient
            id="fearGauge"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <stop offset="0" stopColor="#ff6c2f" />
            <stop offset=".45" stopColor="#f0d43a" />
            <stop offset="1" stopColor="#35df8d" />
          </linearGradient>
        </defs>
        <path
          d="M12 58 A48 48 0 0 1 108 58"
          fill="none"
          stroke="#14251f"
          strokeWidth="11"
        />
        <path
          d="M12 58 A48 48 0 0 1 108 58"
          fill="none"
          stroke="url(#fearGauge)"
          strokeWidth="11"
        />
        <line
          x1="60"
          y1="58"
          x2={needleX}
          y2={needleY}
          stroke="#eef5f2"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle
          cx="60"
          cy="58"
          r="4"
          fill="#eef5f2"
        />
      </svg>
      <span
        style={{
          '--market-tone': tone,
        } as CSSProperties}
      >
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
    </div>
  );
}

const DASHBOARD_CHART_TIMEFRAMES:
  Readonly<
    Record<
      DashboardChartPeriod,
      MarketCandleTimeframe
    >
  > = {
    '1M': '1m',
    '5M': '5m',
    '15M': '15m',
    '1H': '1h',
    '4H': '4h',
    '1D': '1d',
  };

function formatDashboardChartPrice(
  value: number | null,
): string {
  if (
    value === null
    || !Number.isFinite(value)
  ) {
    return '—';
  }

  const fractionDigits =
    value >= 1000
      ? 2
      : value >= 1
        ? 4
        : 8;

  return value.toLocaleString(
    'ru-RU',
    {
      minimumFractionDigits:
        fractionDigits,
      maximumFractionDigits:
        fractionDigits,
    },
  );
}

function formatDashboardChartVolume(
  value: number | null,
): string {
  if (
    value === null
    || !Number.isFinite(value)
  ) {
    return '—';
  }

  return new Intl.NumberFormat(
    'ru-RU',
    {
      notation: 'compact',
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function DashboardPageContent({ data }: { data: DashboardViewData }) {
  const navigate = useNavigate();
  const { scannerRows, chartPeriods, activityPeriods } = data;
  const [selected, setSelected] = useState(
    String(scannerRows[0]?.[0] ?? 'BTC/USDT'),
  );
  const [activityPeriod, setActivityPeriod] =
    useState<DashboardActivityPeriod>('1M');
  const [chartPeriod, setChartPeriod] =
    useState<DashboardChartPeriod>('1M');
  const [scannerFilters, setScannerFilters] =
    useState<ScannerFilterState>(() =>
      createDefaultScannerFilterState(),
    );
  const [scannerFilterDraft, setScannerFilterDraft] =
    useState<ScannerFilterState>(() =>
      createDefaultScannerFilterState(),
    );
  const [scannerFiltersOpen, setScannerFiltersOpen] =
    useState(false);

  const symbolUniverse =
    useBinanceSymbolUniverse({
      intervalMs: 10_000,
    });

  const scannerUniverseEntries =
    symbolUniverse.snapshot?.entries;

  const scannerUniverseRows = useMemo(
    () =>
      buildDashboardScannerUniverseRows(
        scannerRows,
        scannerUniverseEntries ?? [],
      ),
    [
      scannerRows,
      scannerUniverseEntries,
    ],
  );

  const realtimeSources = useMemo(
    () => [
      {
        symbol: 'BTCUSDT',
        fallbackPrice: 0,
        fallbackChange: 0,
      },
      {
        symbol: selected,
        fallbackPrice: 0,
        fallbackChange: 0,
      },
    ],
    [selected],
  );
  const scannerSymbols = useMemo(
    () =>
      scannerRows.map((row) =>
        normalizeDashboardRealtimeSymbol(
          String(row[0]),
        ),
      ),
    [scannerRows],
  );

  const realtimeSymbols = useMemo(
    () => [
      ...new Set([
        ...realtimeSources.map((source) =>
          normalizeDashboardRealtimeSymbol(
            source.symbol,
          ),
        ),
        ...scannerSymbols,
      ]),
    ],
    [realtimeSources, scannerSymbols],
  );

  const realtime = useRealtimeMarketData({
    symbols: realtimeSymbols,
  });

  const scannerWindow =
    DASHBOARD_ACTIVITY_PERIOD_TO_SCANNER_WINDOW[
      activityPeriod
    ];

  const scannerMetrics =
    useMarketWideScannerMetrics({
      intervalMs: 2_000,
      scannerWindow,
    });
  const dashboardVolumeSpikes =
    useMarketVolumeSpikes({
      intervalMs: 5_000,
      limit: 5,
    });



  const dashboardScannerRows = useMemo(
    () =>
      sortDashboardScannerRows(
        scannerUniverseRows.map((item) => {
        const row = item.row;
        const symbol =
          normalizeDashboardRealtimeSymbol(
            String(row[0]),
          );

        const metricView =
          buildDashboardScannerMetricView(
            {
              symbol,
              priceChangeLabel:
                String(row[2]),
              quoteVolumeLabel:
                String(row[3]),
              tradesCountLabel:
                String(row[4]),
              speedLabel:
                String(row[5]),
              volatilityLabel:
                String(row[8]),
              liquidityScore:
                Number(row[9]),
              activityScore:
                Number(row[1]),
            },
            scannerMetrics.metrics[symbol],
            {
              collectingWindow:
                scannerUniverseEntries
                  !== undefined
                  ? scannerWindow
                  : undefined,
            },
          );

        const sourceLabel:
          DashboardScannerMetricView['sourceLabel'] =
            item.source === 'collecting'
            || metricView.sourceLabel === 'NEW'
              ? 'NEW'
              : metricView.isLive
                ? 'LIVE'
                : item.source === 'registry'
                  ? 'BINANCE'
                  : 'UNAVAILABLE';

        return {
          ...item,
          view: {
            ...metricView,
            sourceLabel,
          },
        };
      }),
      ),
    [
      activityPeriod,
      scannerMetrics.metrics,
      scannerUniverseEntries,
      scannerUniverseRows,
      scannerWindow,
    ],
  );

  const filteredDashboardScannerRows = useMemo(
    () =>
      filterAndSortScannerRows(
        dashboardScannerRows,
        scannerFilters,
      ),
    [
      dashboardScannerRows,
      scannerFilters,
    ],
  );

  const scannerLiveCount =
    filteredDashboardScannerRows.filter(
      ({ view }) => view.isLive,
    ).length;

  const activeScannerFilterCount =
    countActiveScannerFilters(
      scannerFilters,
    );

  const dashboardRealtime = useMemo(
    () =>
      buildDashboardRealtimeView(
        realtimeSources,
        realtime.snapshots,
        realtime.lifecycleState,
        realtime.status?.state ?? null,
      ),
    [
      realtime.lifecycleState,
      realtime.snapshots,
      realtime.status?.state,
      realtimeSources,
    ],
  );

  const btcRealtime =
    dashboardRealtime.coins.BTCUSDT;

  const dashboardHotRows = useMemo(
    () =>
      dashboardScannerRows
        .filter(({ view }) =>
          view.activityIsLive,
        )
        .slice(0, 5),
    [dashboardScannerRows],
  );

  const dashboardChartSymbol =
    normalizeDashboardRealtimeSymbol(
      selected,
    );

  const dashboardChartTimeframe =
    DASHBOARD_CHART_TIMEFRAMES[
      chartPeriod
    ];

  const dashboardCandlesQuery =
    useMarketCandles({
      symbol: dashboardChartSymbol,
      timeframe: dashboardChartTimeframe,
    });

  const dashboardLevelLines =
    useCausalLevelLines({
      symbol: dashboardChartSymbol,
      timeframe: dashboardChartTimeframe,
      candles:
        dashboardCandlesQuery.data
        ?? [],
    });

  const dashboardChartRealtime =
    dashboardRealtime.coins[
      dashboardChartSymbol
    ];

  const dashboardChartLatestCandle =
    dashboardCandlesQuery.status
      === 'success'
    && dashboardCandlesQuery.data
      ?.length
      ? dashboardCandlesQuery.data[
          dashboardCandlesQuery.data.length
          - 1
        ]
      : undefined;

  const dashboardChartPrice =
    dashboardChartRealtime?.priceValue
    ?? dashboardChartLatestCandle?.close
    ?? null;

  const marketMode = useMemo(
    () =>
      resolveMarketMode(
        btcRealtime.changePct,
        dashboardScannerRows,
        activityPeriod,
      ),
    [
      activityPeriod,
      btcRealtime.changePct,
      dashboardScannerRows,
    ],
  );
  const marketModeStyle = {
    '--market-tone': marketMode.accent,
    '--market-glow': marketMode.glow,
  } as CSSProperties;

  const selectedScannerView =
    dashboardScannerRows.find(
      ({ row }) =>
        normalizeDashboardRealtimeSymbol(
          String(row[0]),
        ) === dashboardChartSymbol,
    )?.view ?? null;

  const liveInsightRows =
    dashboardScannerRows.filter(
      ({ view }) => view.isLive,
    );

  const dashboardInsights: Array<{
    icon: string;
    title: string;
    text: string;
  }> = [];

  const activityLeader =
    liveInsightRows.find(
      ({ view }) =>
        view.activityIsLive,
    );

  if (activityLeader) {
    dashboardInsights.push({
      icon: '🔥',
      title: 'Лидер активности',
      text:
        `${String(activityLeader.row[0])}: `
        + `${activityLeader.view.activityScore}/100, `
        + `${activityLeader.view.tradesCountLabel} сделок, `
        + `${activityLeader.view.speedLabel}.`,
    });
  }

  const volumeLeader = [
    ...liveInsightRows,
  ]
    .filter(
      ({ view }) =>
        view.quoteVolumeValue !== null,
    )
    .sort(
      (left, right) =>
        (
          right.view.quoteVolumeValue
          ?? 0
        )
        - (
          left.view.quoteVolumeValue
          ?? 0
        ),
    )[0];

  if (volumeLeader) {
    dashboardInsights.push({
      icon: '💰',
      title: 'Лидер объёма',
      text:
        `${String(volumeLeader.row[0])}: `
        + `${volumeLeader.view.quoteVolumeLabel} `
        + `за окно ${activityPeriod}.`,
    });
  }

  const strengthLeader = [
    ...liveInsightRows,
  ]
    .filter(
      ({ view }) =>
        view.relativeStrengthPct !== null,
    )
    .sort(
      (left, right) =>
        (
          right.view.relativeStrengthPct
          ?? Number.NEGATIVE_INFINITY
        )
        - (
          left.view.relativeStrengthPct
          ?? Number.NEGATIVE_INFINITY
        ),
    )[0];

  if (strengthLeader) {
    dashboardInsights.push({
      icon: '⚡',
      title: 'Сильнее BTC',
      text:
        `${String(strengthLeader.row[0])}: `
        + `${strengthLeader.view.relativeStrengthLabel} `
        + `относительно BTC за окно ${activityPeriod}.`,
    });
  }

  const liquidityLeader = [
    ...liveInsightRows,
  ]
    .filter(
      ({ view }) =>
        view.liquidityIsLive,
    )
    .sort(
      (left, right) =>
        right.view.liquidityScore
        - left.view.liquidityScore,
    )[0];

  if (liquidityLeader) {
    dashboardInsights.push({
      icon: '◉',
      title: 'Лучшая ликвидность',
      text:
        `${String(liquidityLeader.row[0])}: `
        + `${liquidityLeader.view.liquidityScore}/9`
        + (
          liquidityLeader.view.spreadPct === null
            ? '.'
            : `, спред ${
                liquidityLeader.view.spreadPct
                  .toFixed(4)
              }%.`
        ),
    });
  }

  const dashboardInsightConclusion =
    marketMode.title === 'СБОР ДАННЫХ'
      ? 'Недостаточно завершённых live-метрик для вывода по рынку.'
      : marketMode.mode === 'bullish'
        ? 'BTC и ширина рынка направлены вверх. Приоритет — подтверждённые лидеры активности.'
        : marketMode.mode === 'bearish'
          ? 'BTC и ширина рынка направлены вниз. Повышен риск продолжения снижения.'
          : 'Движение BTC и ширина рынка не дают согласованного направления.';

  const dashboardVisibleCandles =
    (
      dashboardCandlesQuery.data
      ?? []
    ).slice(-100);

  const dashboardRangeRows: Array<{
    label: string;
    value: string;
    tone:
      | 'resistance'
      | 'current'
      | 'support';
  }> =
    dashboardVisibleCandles.length === 0
      ? [
          {
            label: 'Диапазон',
            value: 'нет данных',
            tone: 'current',
          },
        ]
      : [
          {
            label: 'Верх диапазона',
            value:
              formatDashboardChartPrice(
                Math.max(
                  ...dashboardVisibleCandles.map(
                    (candle) => candle.high,
                  ),
                ),
              ),
            tone: 'resistance',
          },
          {
            label: 'Текущая цена',
            value:
              formatDashboardChartPrice(
                dashboardChartPrice,
              ),
            tone: 'current',
          },
          {
            label: 'Низ диапазона',
            value:
              formatDashboardChartPrice(
                Math.min(
                  ...dashboardVisibleCandles.map(
                    (candle) => candle.low,
                  ),
                ),
              ),
            tone: 'support',
          },
        ];

  const dashboardDetailStats: Array<{
    label: string;
    value: string;
    tone:
      | 'positive'
      | 'negative'
      | 'neutral';
  }> = selectedScannerView
    ? [
        {
          label: `Изменение ${activityPeriod}`,
          value:
            selectedScannerView
              .priceChangeLabel,
          tone:
            selectedScannerView
              .priceChangePct === null
              ? 'neutral'
              : selectedScannerView
                  .priceChangePct < 0
                ? 'negative'
                : 'positive',
        },
        {
          label: `Объём ${activityPeriod}`,
          value:
            selectedScannerView
              .quoteVolumeLabel,
          tone: 'neutral',
        },
        {
          label: 'Сделки',
          value:
            selectedScannerView
              .tradesCountLabel,
          tone: 'neutral',
        },
        {
          label: 'Скорость',
          value:
            selectedScannerView
              .speedLabel,
          tone: 'neutral',
        },
        {
          label: 'Волатильность',
          value:
            selectedScannerView
              .volatilityLabel,
          tone: 'neutral',
        },
        {
          label: 'Спред',
          value:
            selectedScannerView
              .spreadPct === null
              ? 'нет данных'
              : `${
                  selectedScannerView
                    .spreadPct
                    .toFixed(4)
                }%`,
          tone: 'neutral',
        },
        {
          label: 'Ликвидность',
          value:
            selectedScannerView
              .liquidityIsLive
              ? `${
                  selectedScannerView
                    .liquidityScore
                }/9`
              : 'нет данных',
          tone:
            selectedScannerView
              .liquidityIsLive
              ? 'positive'
              : 'neutral',
        },
        {
          label: 'Источник',
          value:
            selectedScannerView
              .sourceLabel,
          tone:
            selectedScannerView.isLive
              ? 'positive'
              : 'neutral',
        },
      ]
    : [
        {
          label: 'Источник',
          value: 'нет данных',
          tone: 'neutral',
        },
      ];

  return (
    <section className={styles.dashboard}>
      <article className={`${styles.panel} ${styles.marketMode}`} style={marketModeStyle} data-market-mode={marketMode.mode}>
        <header className={styles.panelHeader}>
          <h2>
            BTC MARKET MODE
            <small className={styles.autoBadge}>
              CALCULATED
            </small>
          </h2>

          <div className={styles.panelHeaderTools}>
            <span
              className={`${styles.realtimeStatus} ${styles[`realtimeStatus_${dashboardRealtime.connectionTone}`]}`}
            >
              <i />
              {dashboardRealtime.connectionLabel}
              {' ? '}
              {dashboardRealtime.liveCount}/
              {dashboardRealtime.totalCount}
            </span>

            <span
              className={styles.info}
              title="Режим рассчитывается по направлению BTC и доле растущих монет среди завершённых live-метрик."
            >
              i
            </span>
          </div>
        </header>
        <div className={styles.marketModeBody}>
          <div className={styles.marketMood}>
            {marketMode.image ? (
              <img
                src={marketMode.image}
                alt={
                  marketMode.mode === 'bullish'
                    ? 'Бычий режим рынка'
                    : 'Медвежий режим рынка'
                }
              />
            ) : (
              <div
                className={
                  styles.marketMoodPlaceholder
                }
                aria-hidden="true"
              >
                ∿
              </div>
            )}

            <div>
              <strong>{marketMode.title}</strong>
              <span>{marketMode.trend}</span>
              <em>{marketMode.risk}</em>
            </div>
          </div>

          <div className={styles.btcStats}>
            <div>
              <span>BTC PRICE</span>
              <strong>
                {btcRealtime.priceValue === null
                  ? '—'
                  : `${btcRealtime.priceLabel}`}
              </strong>
              <em
                className={
                  btcRealtime.changePct === null
                    ? styles.neutral
                    : btcRealtime.changePct < 0
                      ? styles.negative
                      : styles.positive
                }
                title="Изменение рассчитано по доступным сделкам текущего realtime-потока."
              >
                {btcRealtime.changeLabel}
              </em>
            </div>

            <div>
              <span>MARKET BREADTH</span>
              <strong>
                {marketMode.marketBreadthPct === null
                  ? '—'
                  : `${
                      marketMode.marketBreadthPct
                        .toFixed(1)
                    }%`}
              </strong>
              <small>
                {marketMode.liveMarketCount > 0
                  ? `${marketMode.liveMarketCount} LIVE`
                  : 'нет данных'}
              </small>
            </div>

            <div>
              <span>MARKET VOLATILITY</span>
              <strong>
                {marketMode.marketVolatilityPct === null
                  ? '—'
                  : `${
                      marketMode.marketVolatilityPct
                        .toFixed(2)
                    }%`}
              </strong>
              <small>
                {marketMode.marketVolatilityLabel}
              </small>
            </div>
          </div>
        </div>

        <div className={styles.fearRow}>
          <span>FEAR &amp; GREED</span>
          <FearGreed
            value={null}
            label="нет данных"
            tone={marketMode.accent}
          />
        </div>
      </article>

      <article className={`${styles.panel} ${styles.hotList}`}>
        <div className={styles.activityToolbar}>
          <div><span>ПЕРИОД АКТИВНОСТИ</span><div className={styles.periods}>{activityPeriods.map((period) => <button key={period} type="button" className={activityPeriod === period ? styles.periodActive : ''} onClick={() => setActivityPeriod(period)}>{period}</button>)}</div></div>
          <button
            type="button"
            className={`${styles.filterButton} ${activeScannerFilterCount > 0 ? filterStyles.filterButtonActive : ''}`}
            aria-expanded={scannerFiltersOpen}
            onClick={() => {
              setScannerFilterDraft({
                ...scannerFilters,
              });
              setScannerFiltersOpen(true);
            }}
          >
            ⌁ &nbsp; НАСТРОИТЬ ФИЛЬТРЫ
            {activeScannerFilterCount > 0
              ? ` · ${activeScannerFilterCount}`
              : ''}
          </button>
        </div>
        <div className={styles.hotTitle}>
          <div>
            <span>🔥</span>
            <strong>HOT LIST</strong>
            <small>
              — САМЫЕ АКТИВНЫЕ МОНЕТЫ ПРЯМО СЕЙЧАС
            </small>
          </div>

          <em>
            {dashboardHotRows.length} LIVE
          </em>
        </div>

        <div className={styles.hotCards}>
          {dashboardHotRows.length > 0
            ? dashboardHotRows.map(
                ({ row, view }, index) => {
                  const symbol = String(row[0]);

                  return (
                    <HotCard
                      key={symbol}
                      symbol={symbol}
                      rank={index + 1}
                      view={view}
                      activityPeriod={activityPeriod}
                      selected={symbol === selected}
                      onSelect={() => {
                        setSelected(symbol);
                      }}
                    />
                  );
                },
              )
            : (
                <div className={styles.hotEmpty}>
                  Данные активности собираются.
                  Hot List появится после завершения
                  выбранного окна {activityPeriod}.
                </div>
              )}
        </div>
      </article>

      <DashboardScannerFilters
        open={scannerFiltersOpen}
        value={scannerFilterDraft}
        onChange={setScannerFilterDraft}
        onApply={() => {
          setScannerFilters({
            ...scannerFilterDraft,
          });
          setScannerFiltersOpen(false);
        }}
        onReset={() => {
          const nextFilters =
            createDefaultScannerFilterState();

          setScannerFilterDraft(nextFilters);
          setScannerFilters(nextFilters);
        }}
        onClose={() => {
          setScannerFiltersOpen(false);
        }}
      />

      <article className={`${styles.panel} ${styles.scanner}`}>

        <header className={styles.sectionHeader}>
          <div>
            <h2>📊 &nbsp; MARKET SCANNER</h2>
            <small>
              Показано: {filteredDashboardScannerRows.length}/
              {dashboardScannerRows.length}
              {' · '}
              {activityPeriod} LIVE: {scannerLiveCount}/
              {filteredDashboardScannerRows.length}
            </small>
          </div>

          <label className={filterStyles.searchField}>
            <span aria-hidden="true">⌕</span>

            <input
              type="search"
              value={scannerFilters.query}
              placeholder="Поиск монеты..."
              aria-label="Поиск монеты в Market Scanner"
              onChange={(event) => {
                const query =
                  event.currentTarget.value;

                setScannerFilters((current) => ({
                  ...current,
                  query,
                }));

                setScannerFilterDraft((current) => ({
                  ...current,
                  query,
                }));
              }}
            />

            {scannerFilters.query ? (
              <button
                type="button"
                className={filterStyles.clearSearch}
                aria-label="Очистить поиск"
                onClick={() => {
                  setScannerFilters((current) => ({
                    ...current,
                    query: '',
                  }));

                  setScannerFilterDraft((current) => ({
                    ...current,
                    query: '',
                  }));
                }}
              >
                ×
              </button>
            ) : null}
          </label>
        </header>
        <div className={styles.scannerTable}>

          <div className={styles.scannerHead}>
            <span>#</span>
            <span>МОНЕТА</span>
            <span>АКТИВНОСТЬ</span>
            <span>ЦЕНА / {activityPeriod}</span>
            <span>ОБЪЁМ {activityPeriod}</span>
            <span>СДЕЛКИ {activityPeriod}</span>
            <span>СКОРОСТЬ</span>
            <span>СВЯЗЬ С BTC</span>
            <span>СИЛА ПРОТИВ BTC</span>
            <span>ВОЛАТ.</span>
            <span>ЛИКВИДНОСТЬ</span>
          </div>

          {filteredDashboardScannerRows.map(
            ({ row, view }, index) => (
              <button
                key={String(row[0])}
                type="button"
                className={[
                  styles.scannerRow,
                  normalizeDashboardRealtimeSymbol(
                    String(row[0]),
                  ) === dashboardChartSymbol
                    ? styles.scannerRowSelected
                    : '',
                ].filter(Boolean).join(' ')}
                aria-label={
                  `Показать ${String(row[0])} на графике`
                }
                onClick={() => {
                  setSelected(
                    String(row[0]),
                  );
                }}
                title={
                  `Показать ${String(row[0])} на графике · `
                  + `${view.sourceLabel} · `
                  + view.updatedAtLabel
                }
              >
                <span>{index + 1}</span>

                <strong
                  className={styles.scannerSymbol}
                >
                  <i className={styles.coinDot} />

                  <span>{row[0]}</span>

                  <small
                    className={
                      view.sourceLabel
                        === 'NEW'
                        ? styles.sourceCollecting
                        : view.isLive
                          ? styles.sourceLive
                          : view.sourceLabel
                              === 'BINANCE'
                            ? styles.sourceRegistry
                            : styles.sourceUnavailable
                    }
                  >
                    {view.sourceLabel
                      === 'NEW'
                      ? 'NEW · СБОР'
                      : view.isLive
                        ? `${activityPeriod} LIVE`
                        : view.sourceLabel}
                  </small>
                </strong>

                <em
                  className={styles.activityScore}
                  title={view.activityTitle}
                >
                  {view.activityIsLive ? view.activityScore : '—'}
                </em>

                <span
                  className={styles.scannerPrice}
                >
                  <strong>
                    {view.priceLabel}
                  </strong>

                  <em
                    className={
                      view.priceChangeLabel
                        .startsWith('-')
                        ? styles.negative
                        : (
                            view.priceChangeLabel
                              === 'нет данных'
                            || view.priceChangeLabel
                              === 'сбор данных'
                          )
                          ? styles.neutral
                          : styles.positive
                    }
                  >
                    {view.priceChangeLabel}
                  </em>
                </span>

                <span>
                  {view.quoteVolumeLabel}
                </span>

                <span>
                  {view.tradesCountLabel}
                </span>

                <span>
                  {view.speedLabel}
                </span>

                <span
                  className={
                    view.btcCorrelation === null
                      ? styles.neutral
                      : undefined
                  }
                  title=
                    "Корреляция доходностей монеты и BTC от -1 до 1 за окно 1M"
                >
                  {view.btcCorrelationLabel}
                </span>

                <em
                  className={
                    view.relativeStrengthPct === null
                      ? styles.neutral
                      : view.relativeStrengthPct < 0
                        ? styles.negative
                        : styles.positive
                  }
                  title=
                    "Изменение монеты минус изменение BTC за окно 1M"
                >
                  {view.relativeStrengthLabel}
                </em>

                <span>{view.volatilityLabel}</span>

                <span
                  className={styles.liquidity}
                  title={view.liquidityTitle}
                >
                  {Array.from(
                    { length: 9 },
                    (_, bar) => (
                      <i
                        key={bar}
                        className={
                          bar < view.liquidityScore
                            ? styles.liquidityOn
                            : ''
                        }
                      />
                    ),
                  )}
                </span>
              </button>
            ),
          )}
        </div>
      </article>




      <div className={styles.dashboardSidebar}>
      <article
        className={
          `${styles.panel} ${styles.insights}`
        }
      >
        <header className={styles.sectionHeader}>
          <div>
            <h2>
              ◈ &nbsp; NEXUS MARKET INSIGHTS
            </h2>
            <small>
              Почему эти монеты находятся в топе?
            </small>
          </div>

          <time>
            {dashboardHotRows[0]
              ?.view.updatedAtLabel
              ?? 'нет данных'}
          </time>
        </header>

        <div className={styles.insightList}>
          {dashboardInsights.length > 0
            ? dashboardInsights.map(
                ({
                  icon,
                  title,
                  text,
                }) => (
                  <div key={title}>
                    <span>{icon}</span>

                    <div>
                      <strong>{title}</strong>
                      <p>{text}</p>
                    </div>
                  </div>
                ),
              )
            : (
                <div>
                  <span>…</span>

                  <div>
                    <strong>
                      Сбор данных
                    </strong>
                    <p>
                      Сводка появится после
                      завершения live-окна
                      Scanner Metrics.
                    </p>
                  </div>
                </div>
              )}
        </div>

        <div className={styles.insightConclusion}>
          <strong>Вывод:</strong>
          {' '}
          {dashboardInsightConclusion}
        </div>
      </article>


      {/* Dashboard Volume Spikes Reference Layout v0.1 */}

      <article

        className={

          `${styles.panel} ${styles.dashboardVolumeSpikes}`

        }

      >

        <header className={styles.dashboardVolumeSpikesHeader}>

          <div>

            <h2>⚡ &nbsp; ВСПЛЕСКИ ОБЪЁМА</h2>

            <small>

              МОНЕТЫ С АНОМАЛЬНЫМ РОСТОМ ОБЪЁМА

            </small>

          </div>



          <span

            className={

              dashboardVolumeSpikes.status === 'ready'

                ? styles.dashboardVolumeSpikesLive

                : dashboardVolumeSpikes.status === 'error'

                  ? styles.dashboardVolumeSpikesError

                  : styles.dashboardVolumeSpikesPending

            }

          >

            <i />

            {dashboardVolumeSpikes.status === 'ready'

              ? 'LIVE'

              : dashboardVolumeSpikes.status === 'error'

                ? 'ОШИБКА'

                : 'ЗАГРУЗКА'}

          </span>

        </header>



        {dashboardVolumeSpikes.status === 'loading' ? (

          <div className={styles.dashboardVolumeSpikesState}>

            Получаем всплески рынка…

          </div>

        ) : dashboardVolumeSpikes.status === 'error' ? (

          <div

            className={

              `${styles.dashboardVolumeSpikesState} `

              + styles.dashboardVolumeSpikesStateError

            }

          >

            <span>

              {dashboardVolumeSpikes.error?.message

                ?? 'Не удалось загрузить всплески'}

            </span>



            <button

              type="button"

              onClick={dashboardVolumeSpikes.retry}

            >

              Повторить

            </button>

          </div>

        ) : dashboardVolumeSpikes.spikes.length === 0 ? (

          <div className={styles.dashboardVolumeSpikesState}>

            Активных всплесков сейчас нет

          </div>

        ) : (

          <div className={styles.dashboardVolumeSpikesTable}>

            <div className={styles.dashboardVolumeSpikesHead}>

              <span>#</span>

              <span>МОНЕТА</span>

              <span>СИЛА ОБЪЁМА</span>

              <span>ОБЪЁМ (СЕЙЧАС)</span>

              <span>СТАТУС</span>

            </div>



            {dashboardVolumeSpikes.spikes

              .slice(0, 5)

              .map((spike, index) => {

const barCount =

                  Math.min(

                    8,

                    Math.max(

                      2,

                      Math.round(

                        spike.volumeRatio * 2,

                      ),

                    ),

                  );



                return (

                  <button

                    key={spike.symbol}

                    type="button"

                    className={

                      `${styles.dashboardVolumeSpikeRow} `

                      + styles[

                        `dashboardVolumeSpike_${spike.status}`

                      ]

                    }

                    title={

                      `Открыть ${spike.symbol} в Market Scanner`

                    }

                    onClick={() => {

                      navigate(

                        buildDashboardVolumeSpikesScannerUrl(

                          spike.symbol,

                        ),

                      );

                    }}

                  >

                    <span>{index + 1}</span>



                    <strong>

                      <i />

                      {spike.symbol}

                    </strong>



                    <span

                      className={

                        styles.dashboardVolumeSpikeGrowth

                      }

                    >

                      <span

                        className={

                          styles.dashboardVolumeSpikeBars

                        }

                        aria-hidden="true"

                      >

                        {Array.from(

                          { length: 8 },

                          (_, bar) => (

                            <i

                              key={bar}

                              className={

                                bar < barCount

                                  ? styles.dashboardVolumeSpikeBarOn

                                  : ''

                              }

                            />

                          ),

                        )}

                      </span>



                      <em>{spike.volumeRatio.toFixed(2)}×</em>

                    </span>



                    <span>

                      {

                        formatDashboardVolumeSpikeVolume(

                          spike.currentQuoteVolume,

                        )

                      }

                    </span>



                    <em>

                      {

                        DASHBOARD_VOLUME_SPIKE_STATUS_LABELS[

                          spike.status

                        ]

                      }

                    </em>

                  </button>

                );

              })}

          </div>

        )}

      </article>


        <aside className={styles.marketDetails}>
          <div className={styles.detailTabs}>
            <strong>
              ДАННЫЕ ИНСТРУМЕНТА
            </strong>
          </div>

          <div className={styles.detailColumns}>
            <article className={styles.detailCard}>
              <h3>
                ДИАПАЗОН ЗАГРУЖЕННЫХ СВЕЧЕЙ
              </h3>

              {dashboardRangeRows.map(
                ({
                  label,
                  value,
                  tone,
                }) => (
                  <div
                    key={label}
                    className={
                      styles[`level_${tone}`]
                    }
                  >
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ),
              )}
            </article>

            <article className={styles.detailCard}>
              <h3>LIVE-СТАТИСТИКА</h3>

              {dashboardDetailStats.map(
                ({
                  label,
                  value,
                  tone,
                }) => (
                  <div key={label}>
                    <span>{label}</span>

                    <strong
                      className={
                        tone === 'positive'
                          ? styles.positive
                          : tone === 'negative'
                            ? styles.negative
                            : styles.neutral
                      }
                    >
                      {value}
                    </strong>
                  </div>
                ),
              )}
            </article>
          </div>
        </aside>
      </div>

      <article className={`${styles.panel} ${styles.chartPanel}`}>
        <div className={styles.chartHeader}>
          <div className={styles.chartPair}>
            <span className={styles.chartCoin}>
              {getDashboardSymbolIcon(selected)}
            </span>

            <strong>
              {selected}
            </strong>

            <span aria-hidden="true">
              ☆
            </span>
          </div>

          <div className={styles.chartPeriods}>
            {chartPeriods.map((period) => (
              <button
                key={period}
                type="button"
                className={
                  chartPeriod === period
                    ? styles.chartPeriodActive
                    : ''
                }
                onClick={() =>
                  setChartPeriod(period)
                }
              >
                {period}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={styles.chartWorkspaceButton}
            onClick={() => {
              navigate(
                buildWorkspaceUrl(
                  ROUTES.workspace,
                  {
                    setupId:
                      buildMarketWorkspaceSetupId(
                        dashboardChartSymbol,
                      ),
                    symbol:
                      dashboardChartSymbol,
                    scannerWindow,
                    timeframe:
                      dashboardChartTimeframe,
                  },
                ),
              );
            }}
          >
            Открыть в Workspace
          </button>

          <div className={styles.chartQuote}>
            <strong>
              {
                formatDashboardChartPrice(
                  dashboardChartPrice,
                )
              }
            </strong>

            <em
              className={
                dashboardChartRealtime
                  ?.changePct == null
                  ? styles.neutral
                  : dashboardChartRealtime
                      .changePct < 0
                    ? styles.negative
                    : styles.positive
              }
            >
              {
                dashboardChartRealtime
                  ?.changeLabel
                ?? 'нет данных'
              }
            </em>

            <span>
              H {
                formatDashboardChartPrice(
                  dashboardChartLatestCandle
                    ?.high
                  ?? null,
                )
              }
            </span>

            <span>
              L {
                formatDashboardChartPrice(
                  dashboardChartLatestCandle
                    ?.low
                  ?? null,
                )
              }
            </span>

            <span>
              V {
                formatDashboardChartVolume(
                  dashboardChartLatestCandle
                    ?.volume
                  ?? null,
                )
              }
            </span>
          </div>

          <span className={styles.indicators}>
            {
              dashboardCandlesQuery
                .isLoadingOlder
                ? 'Загружаем историю…'
                : dashboardCandlesQuery
                    .hasMore
                  ? 'История доступна влево'
                  : 'История загружена'
            }
          </span>
        </div>

        <div className={styles.chartCanvas}>
          {
            dashboardCandlesQuery.status
              === 'loading'
              ? (
                <div className={styles.chartState}>
                  Загружаем реальные свечи…
                </div>
              )
              : null
          }

          {
            dashboardCandlesQuery.status
              === 'error'
              ? (
                <div className={styles.chartState}>
                  <span>
                    Свечи не загрузились.
                  </span>

                  <button
                    type="button"
                    onClick={
                      dashboardCandlesQuery.retry
                    }
                  >
                    Повторить
                  </button>
                </div>
              )
              : null
          }

          {
            dashboardCandlesQuery.status
              === 'success'
            && dashboardCandlesQuery.data
              ?.length === 0
              ? (
                <div className={styles.chartState}>
                  Для выбранного периода нет свечей.
                </div>
              )
              : null
          }

          {
            dashboardCandlesQuery.status
              === 'success'
            && dashboardCandlesQuery.data
            && dashboardCandlesQuery.data
              .length > 0
              ? (
                <NexusCandlestickChart
                  candles={
                    dashboardCandlesQuery.data
                  }
                  symbol={
                    dashboardChartSymbol
                  }
                  fillContainer
                  horizontalSegments={
                    dashboardLevelLines
                      .horizontalSegments
                  }
                  enableDrawingTools
                  drawingScope={
                    `dashboard:${dashboardChartSymbol}:${dashboardChartTimeframe}`
                  }
                  onLoadOlder={
                    dashboardCandlesQuery
                      .loadOlder
                  }
                  isLoadingOlder={
                    dashboardCandlesQuery
                      .isLoadingOlder
                  }
                  hasMore={
                    dashboardCandlesQuery
                      .hasMore
                  }
                />
              )
              : null
          }
        </div>

        <CausalLevelStateStrip
          levels={dashboardLevelLines}
        />
      </article>

    </section>
  );
}


export function DashboardPage() {
  const query = useApiQuery('dashboard-view', () => nexusApi.getDashboardView());

  if (query.status === 'loading') return <AsyncDataState state="loading" />;
  if (query.status === 'error') {
    return <AsyncDataState state="error" message={query.error?.message} onRetry={query.retry} />;
  }
  if (!query.data) return <AsyncDataState state="empty" />;

  return <DashboardPageContent data={query.data} />;
}
