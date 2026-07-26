import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import bearMarket from '@/assets/bear-market.png';
import bullMarket from '@/assets/bull-market.png';
import {
  nexusApi,
  useApiQuery,
  type DashboardActivityPeriod,
  type DashboardChartPeriod,
  type DashboardHotCoin,
  type DashboardMarketModeData,
  type DashboardViewData,
} from '@/shared/api';
import { ROUTES } from '@/app/routing/routes';
import type {
  ScannerWindow,
} from '@/shared/config/tradingPresets';
import { buildWorkspaceUrl } from '@/shared/routing/setupContext';
import {
  buildDashboardRealtimeView,
  buildDashboardScannerUniverseRows,
  countActiveScannerFilters,
  createDefaultScannerFilterState,
  filterAndSortScannerRows,
  buildDashboardScannerMetricView,
  buildDashboardScannerWorkspaceUrl,
  normalizeDashboardRealtimeSymbol,
  sortDashboardScannerRows,
  useBinanceSymbolUniverse,
  useMarketWideScannerMetrics,
  useMarketVolumeSpikes,
  useRealtimeMarketData,
  type DashboardRealtimeCoinView,
  type MarketVolumeSpikeStatus,
  type ScannerFilterState,
} from '@/shared/realtime';
import {
  NexusCandlestickChart,
  useMarketCandles,
  type MarketCandleTimeframe,
} from '@/shared/charts';
import { AsyncDataState } from '@/shared/ui/AsyncDataState';
import { DashboardScannerFilters } from './DashboardScannerFilters';
import filterStyles from './DashboardScannerFilters.module.css';
import styles from './DashboardPage.module.css';

function HotCard({
  coin,
  realtime,
  selected,
  onSelect,
}: {
  coin: DashboardHotCoin;
  realtime: DashboardRealtimeCoinView;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`${styles.hotCard} ${selected ? styles.hotCardSelected : ''}`}
      style={{ '--coin-color': coin.color } as CSSProperties}
    >
      <span className={styles.cardRank}>{coin.rank}</span>
      <div className={styles.cardHead}>
        <span className={`${styles.coinIcon} ${styles[`coin_${coin.tone}`]}`}>{coin.icon}</span>
        <span className={styles.coinIdentity}><strong>{coin.symbol}</strong><small>{coin.stage}</small></span>
        <span className={styles.score}><strong>{coin.score} <i>♨</i></strong><small>{coin.state}</small></span>
      </div>
      <svg className={styles.sparkline} viewBox="0 0 132 36" preserveAspectRatio="none" aria-hidden="true">
        <path d={coin.spark} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d={`${coin.spark} L130 36 L2 36 Z`} fill="currentColor" opacity=".05" />
      </svg>
      <div className={styles.cardStats}>
        <span>Цена <strong>{realtime.priceLabel}</strong></span>
        <span title="Изменение рассчитано по доступным сделкам текущего realtime-потока.">
          Δ потока
          <strong
            className={
              realtime.changePct === null
                ? styles.neutral
                : realtime.changePct < 0
                  ? styles.negative
                  : styles.positive
            }
          >
            {realtime.changeLabel}
          </strong>
        </span>
        <span>Объём <strong>{coin.volume}</strong></span>
        <span>Сделки <strong>{coin.trades}</strong></span>
        <span>Скорость <strong>{coin.speed}</strong></span>
        <span>Связь с BTC <strong>{coin.btcLink}</strong></span>
        <span className={styles.strengthRow}>Сила против BTC <strong className={coin.btcStrength.startsWith('-') ? styles.negative : styles.positive}>{coin.btcStrength}</strong></span>
      </div>
      <small className={styles.cardNote}>
        <b
          className={
            realtime.isLive
              ? styles.sourceLive
              : styles.sourceTest
          }
        >
          {realtime.sourceLabel}
        </b>
        {' ? '}
        {realtime.updatedAtLabel}
        {' ? '}
        {coin.note}
      </small>
    </button>
  );
}

type MarketMode = 'bullish' | 'bearish';

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

type ResolvedMarketMode = DashboardMarketModeData & {
  mode: MarketMode;
  title: 'BULLISH' | 'BEARISH';
  trend: 'TRENDING UP' | 'TRENDING DOWN';
  risk: 'RISK ON' | 'RISK OFF';
  accent: string;
  glow: string;
  image: string;
};

function getMarketModeOverride(): MarketMode | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('marketMode');
  return value === 'bullish' || value === 'bearish' ? value : null;
}

function resolveMarketMode(source: DashboardMarketModeData): ResolvedMarketMode {
  const override = getMarketModeOverride();
  const scenario = override === 'bearish'
    ? {
        ...source,
        btcPrice: 98_760,
        btcChangePct: -2.14,
        btcDominancePct: 54.1,
        btcDominanceChangePct: 0.48,
        marketVolatilityPct: 82,
        marketVolatilityLabel: 'Высокая',
        fearGreedIndex: 28,
        fearGreedLabel: 'Fear',
      }
    : source;

  const automaticScore = scenario.btcChangePct + (scenario.fearGreedIndex - 50) / 20;
  const mode: MarketMode = override ?? (automaticScore >= 0 ? 'bullish' : 'bearish');

  return mode === 'bullish'
    ? {
        ...scenario,
        mode,
        title: 'BULLISH',
        trend: 'TRENDING UP',
        risk: 'RISK ON',
        accent: '#35df8d',
        glow: 'rgb(48 221 137 / 22%)',
        image: bullMarket,
      }
    : {
        ...scenario,
        mode,
        title: 'BEARISH',
        trend: 'TRENDING DOWN',
        risk: 'RISK OFF',
        accent: '#ff5b54',
        glow: 'rgb(255 91 84 / 24%)',
        image: bearMarket,
      };
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
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

function FearGreed({ value, label, tone }: { value: number; label: string; tone: string }) {
  const normalized = Math.min(100, Math.max(0, value));
  const angle = Math.PI - (normalized / 100) * Math.PI;
  const needleX = 60 + Math.cos(angle) * 33;
  const needleY = 58 - Math.sin(angle) * 33;

  return (
    <div className={styles.fearGreedGauge}>
      <svg viewBox="0 0 120 66" aria-label={`Fear and Greed: ${value}`}>
        <defs>
          <linearGradient id="fearGauge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ff6c2f" />
            <stop offset=".45" stopColor="#f0d43a" />
            <stop offset="1" stopColor="#35df8d" />
          </linearGradient>
        </defs>
        <path d="M12 58 A48 48 0 0 1 108 58" fill="none" stroke="#14251f" strokeWidth="11" />
        <path d="M12 58 A48 48 0 0 1 108 58" fill="none" stroke="url(#fearGauge)" strokeWidth="11" />
        <line x1="60" y1="58" x2={needleX} y2={needleY} stroke="#eef5f2" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="60" cy="58" r="4" fill="#eef5f2" />
      </svg>
      <span style={{ '--market-tone': tone } as CSSProperties}><strong>{value}</strong><small>{label}</small></span>
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
  const { marketMode: marketModeSource, hotCoins, scannerRows, insights, levels, stats, chartPeriods, activityPeriods } = data;
  const [selected, setSelected] = useState(
    hotCoins[0].symbol,
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
      intervalMs: 60_000,
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
        fallbackPrice: marketModeSource.btcPrice,
        fallbackChange: marketModeSource.btcChangePct,
      },
      ...hotCoins.map((coin) => ({
        symbol: coin.symbol,
        fallbackPrice: coin.price,
        fallbackChange: coin.change,
      })),
    ],
    [
      hotCoins,
      marketModeSource.btcChangePct,
      marketModeSource.btcPrice,
    ],
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

        return {
          ...item,
          view: {
            ...metricView,
            sourceLabel:
              item.source
                === 'collecting'
              || metricView.sourceLabel
                === 'NEW'
                ? 'NEW'
                : metricView.isLive
                  ? 'LIVE'
                  : item.source
                      === 'registry'
                    ? 'BINANCE'
                    : 'TEST',
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

  const resolvedMarketModeSource = useMemo(
    () => ({
      ...marketModeSource,
      btcPrice:
        btcRealtime.priceValue
        ?? marketModeSource.btcPrice,
      btcChangePct:
        btcRealtime.changePct
        ?? marketModeSource.btcChangePct,
    }),
    [
      btcRealtime.changePct,
      btcRealtime.priceValue,
      marketModeSource,
    ],
  );

  const selectedCoin = useMemo(
    () =>
      hotCoins.find(
        (coin) => coin.symbol === selected,
      ) ?? hotCoins[0],
    [hotCoins, selected],
  );

  const dashboardChartSymbol =
    normalizeDashboardRealtimeSymbol(
      selectedCoin.symbol,
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
    () => resolveMarketMode(
      resolvedMarketModeSource,
    ),
    [resolvedMarketModeSource],
  );
  const marketModeStyle = {
    '--market-tone': marketMode.accent,
    '--market-glow': marketMode.glow,
  } as CSSProperties;

  return (
    <section className={styles.dashboard}>
      <article className={`${styles.panel} ${styles.marketMode}`} style={marketModeStyle} data-market-mode={marketMode.mode}>
        <header className={styles.panelHeader}>
          <h2>
            BTC MARKET MODE
            <small className={styles.autoBadge}>
              AUTO
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
              title="Режим определяется автоматически по изменению BTC и индексу Fear & Greed."
            >
              i
            </span>
          </div>
        </header>
        <div className={styles.marketModeBody}>
          <div className={styles.marketMood}>
            <img src={marketMode.image} alt={marketMode.mode === 'bullish' ? 'Бычье настроение рынка' : 'Медвежье настроение рынка'} />
            <div><strong>{marketMode.title}</strong><span>{marketMode.trend}</span><em>{marketMode.risk}</em></div>
          </div>
          <div className={styles.btcStats}>
            <div>
              <span>BTC PRICE</span>
              <strong>
                {'$'}{btcRealtime.priceLabel}
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
            <div><span>BTC DOMINANCE</span><strong>{marketMode.btcDominancePct.toFixed(1)}%</strong><em className={marketMode.btcDominanceChangePct >= 0 ? styles.positive : styles.negative}>{formatSignedPercent(marketMode.btcDominanceChangePct)}</em></div>
            <div><span>MARKET VOLATILITY</span><strong>{marketMode.marketVolatilityPct}%</strong><small>{marketMode.marketVolatilityLabel}</small></div>
          </div>
        </div>
        <div className={styles.fearRow}><span>FEAR &amp; GREED</span><FearGreed value={marketMode.fearGreedIndex} label={marketMode.fearGreedLabel} tone={marketMode.accent} /></div>
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
        <div className={styles.hotTitle}><div><span>🔥</span><strong>HOT LIST</strong><small>— САМЫЕ АКТИВНЫЕ МОНЕТЫ ПРЯМО СЕЙЧАС</small></div><em>5 сетапов ›</em></div>
        <div className={styles.hotCards}>{hotCoins.map((coin) => (
          <HotCard
            key={coin.setupId}
            coin={coin}
            realtime={
              dashboardRealtime.coins[
                normalizeDashboardRealtimeSymbol(
                  coin.symbol,
                )
              ]
            }
            selected={coin.symbol === selected}
            onSelect={() => {
              setSelected(coin.symbol);
              navigate(buildWorkspaceUrl(ROUTES.workspace, {
                setupId: coin.setupId,
                symbol: coin.symbol.replace('/', ''),
                timeframe: coin.timeframe,
              }));
            }}
          />
        ))}</div>
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
              <div
                key={String(row[0])}
                className={styles.scannerRow}
                role="link"
                tabIndex={0}
                aria-label={
                  `Открыть ${String(row[0])} в Charts / Workspace`
                }
                onClick={() => {
                  navigate(
                    buildDashboardScannerWorkspaceUrl(
                      ROUTES.workspace,
                      String(row[0]),
                    ),
                  );
                }}
                onKeyDown={(event) => {
                  if (
                    event.key !== 'Enter'
                    && event.key !== ' '
                  ) {
                    return;
                  }

                  event.preventDefault();

                  navigate(
                    buildDashboardScannerWorkspaceUrl(
                      ROUTES.workspace,
                      String(row[0]),
                    ),
                  );
                }}
                title={
                  `Открыть ${String(row[0])} в Charts / Workspace · `
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
                            : styles.sourceTest
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
                  {view.activityScore}
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
              </div>
            ),
          )}
        </div>
      </article>




      <div className={styles.dashboardSidebar}>
      <article className={`${styles.panel} ${styles.insights}`}>

        <header className={styles.sectionHeader}><div><h2>🤖 &nbsp; NEXUS AI INSIGHTS</h2><small>Почему эти монеты в топе?</small></div><time>12:45</time></header>

        <div className={styles.insightList}>{insights.map(([icon, title, text]) => <div key={title}><span>{icon}</span><div><strong>{title}</strong><p>{text}</p></div></div>)}</div>

        <div className={styles.insightConclusion}><strong>Вывод:</strong> Рынок в режиме RISK ON. Активность высокая.<br />Ищем импульсные сделки по топовым монетам.</div>

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
          <div className={styles.detailTabs}><strong>УРОВНИ</strong><span>СДЕЛКИ</span><span>ПОТОК ОРДЕРОВ</span></div>
          <div className={styles.detailColumns}>
            <article className={styles.detailCard}><h3>КЛЮЧЕВЫЕ УРОВНИ</h3>{levels.map(([label, value, tone]) => <div key={label} className={styles[`level_${tone}`]}><span>{label}</span><strong>{value}</strong></div>)}</article>
            <article className={styles.detailCard}><h3>БЫСТРАЯ СТАТИСТИКА</h3>{stats.map(([label, value]) => <div key={label}><span>{label}</span><strong className={label === 'Ликвидность' || label.includes('Изменение') ? styles.positive : ''}>{value}</strong></div>)}</article>
          </div>
        </aside>
      </div>

      <article className={`${styles.panel} ${styles.chartPanel}`}>
        <div className={styles.chartHeader}>
          <div className={styles.chartPair}>
            <span className={styles.chartCoin}>
              {selectedCoin.icon}
            </span>

            <strong>
              {selectedCoin.symbol}
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
                  ?.changePct !== null
                && dashboardChartRealtime
                  ?.changePct !== undefined
                && dashboardChartRealtime
                  .changePct < 0
                  ? styles.negative
                  : styles.positive
              }
            >
              {
                dashboardChartRealtime
                  ?.changeLabel
                ?? selectedCoin.change
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
  if (!query.data || query.data.hotCoins.length === 0) return <AsyncDataState state="empty" />;

  return <DashboardPageContent data={query.data} />;
}
