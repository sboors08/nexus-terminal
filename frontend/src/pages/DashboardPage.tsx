import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import bearMarket from '@/assets/bear-market.png';
import bullMarket from '@/assets/bull-market.png';
import {
  nexusApi,
  useApiQuery,
  type DashboardActivityPeriod,
  type DashboardCandle,
  type DashboardChartPeriod,
  type DashboardHotCoin,
  type DashboardMarketModeData,
  type DashboardViewData,
} from '@/shared/api';
import { ROUTES } from '@/app/routing/routes';
import { buildWorkspaceUrl } from '@/shared/routing/setupContext';
import {
  buildDashboardRealtimeView,
  buildDashboardScannerMetricView,
  normalizeDashboardRealtimeSymbol,
  useDashboardScannerMetrics,
  useRealtimeMarketData,
  type DashboardRealtimeCoinView,
} from '@/shared/realtime';
import { AsyncDataState } from '@/shared/ui/AsyncDataState';
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

function TradingChart({ candles }: { candles: DashboardCandle[] }) {
  const min = Math.min(...candles.map((candle) => candle.low));
  const max = Math.max(...candles.map((candle) => candle.high));
  const range = Math.max(max - min, 1);
  const mapY = (value: number) => 202 - ((value - min) / range) * 145;
  const step = 900 / candles.length;
  const bodyWidth = Math.max(4, step * .58);

  return (
    <div className={styles.chartCanvas}>
      <div className={styles.chartTools}>{['⌖', '╱', '⌁', 'T', '□', '⌕'].map((tool) => <span key={tool}>{tool}</span>)}</div>
      <svg viewBox="0 0 900 230" preserveAspectRatio="none" role="img" aria-label="График SOL/USDT">
        <g className={styles.chartGrid}>
          {[38, 76, 114, 152, 190].map((y) => <line key={`y${y}`} x1="0" x2="900" y1={y} y2={y} />)}
          {[112, 224, 336, 448, 560, 672, 784].map((x) => <line key={`x${x}`} x1={x} x2={x} y1="0" y2="230" />)}
        </g>
        <line x1="0" x2="900" y1="68" y2="68" className={styles.priceLine} />
        {candles.map((candle) => {
          const x = candle.index * step + step / 2;
          const isUp = candle.close >= candle.open;
          const openY = mapY(candle.open);
          const closeY = mapY(candle.close);
          return (
            <g key={candle.index} className={isUp ? styles.candleUp : styles.candleDown}>
              <line x1={x} x2={x} y1={mapY(candle.high)} y2={mapY(candle.low)} />
              <rect x={x - bodyWidth / 2} y={Math.min(openY, closeY)} width={bodyWidth} height={Math.max(2, Math.abs(closeY - openY))} rx=".6" />
              <rect x={x - bodyWidth / 2} y={226 - candle.volume} width={bodyWidth} height={candle.volume} className={styles.volumeBar} />
            </g>
          );
        })}
        <path d="M0 187 C92 180 160 151 235 157 C318 164 369 131 447 137 C527 143 602 121 680 127 C758 133 818 109 900 102" className={styles.maFast} fill="none" />
        <path d="M0 198 C102 195 184 181 268 174 C352 167 442 154 529 147 C614 140 696 133 778 125 C830 120 872 114 900 110" className={styles.maSlow} fill="none" />
        <g className={styles.priceTag} transform="translate(846 55)"><rect width="54" height="23" rx="2" /><text x="27" y="15">167.42</text></g>
      </svg>
      <div className={styles.chartTimes}><span>11:30</span><span>11:40</span><span>11:50</span><span>12:00</span><span>12:10</span><span>12:20</span><span>12:30</span><span>12:40</span></div>
    </div>
  );
}

function DashboardPageContent({ data }: { data: DashboardViewData }) {
  const navigate = useNavigate();
  const { marketMode: marketModeSource, hotCoins, scannerRows, insights, levels, stats, chartPeriods, activityPeriods, candles } = data;
  const [selected, setSelected] = useState(
    hotCoins[0].symbol,
  );
  const [activityPeriod, setActivityPeriod] =
    useState<DashboardActivityPeriod>('1M');
  const [chartPeriod, setChartPeriod] =
    useState<DashboardChartPeriod>('1M');

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

  const scannerMetrics =
    useDashboardScannerMetrics({
      symbols: scannerSymbols,
    });

  const dashboardScannerRows = useMemo(
    () =>
      scannerRows.map((row) => {
        const symbol =
          normalizeDashboardRealtimeSymbol(
            String(row[0]),
          );

        return {
          row,
          view:
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
              },
              scannerMetrics.metrics[symbol],
            ),
        };
      }),
    [
      scannerMetrics.metrics,
      scannerRows,
    ],
  );

  const scannerLiveCount =
    dashboardScannerRows.filter(
      ({ view }) => view.isLive,
    ).length;

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
          <button type="button" className={styles.filterButton}>⌁ &nbsp; НАСТРОИТЬ ФИЛЬТРЫ</button>
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

      <article className={`${styles.panel} ${styles.scanner}`}>

        <header className={styles.sectionHeader}>
          <div>
            <h2>📊 &nbsp; MARKET SCANNER</h2>
            <small>
              Показано: {dashboardScannerRows.length}
              {' · '}
              1M LIVE: {scannerLiveCount}/
              {dashboardScannerRows.length}
            </small>
          </div>

          <div className={styles.search}>
            ⌕ Поиск монеты...　⋮
          </div>
        </header>
        <div className={styles.scannerTable}>
          <div className={styles.scannerHead}>
            <span>#</span>
            <span>МОНЕТА</span>
            <span>АКТИВНОСТЬ</span>
            <span>ЦЕНА / 1М</span>
            <span>ОБЪЁМ 1М</span>
            <span>СДЕЛКИ 1М</span>
            <span>СКОРОСТЬ</span>
            <span>СВЯЗЬ С BTC</span>
            <span>СИЛА ПРОТИВ BTC</span>
            <span>ВОЛАТ.</span>
            <span>ЛИКВИДНОСТЬ</span>
          </div>

          {dashboardScannerRows.map(
            ({ row, view }, index) => (
              <div
                key={String(row[0])}
                className={styles.scannerRow}
                title={
                  `${view.sourceLabel} · `
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
                      view.isLive
                        ? styles.sourceLive
                        : styles.sourceTest
                    }
                  >
                    {view.isLive
                      ? '1M LIVE'
                      : 'TEST'}
                  </small>
                </strong>

                <em
                  className={styles.activityScore}
                >
                  {row[1]}
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
                        : view.priceChangeLabel
                            === 'нет данных'
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

                <span>{row[6]}</span>

                <em
                  className={
                    String(row[7]).startsWith('-')
                      ? styles.negative
                      : styles.positive
                  }
                >
                  {row[7]}
                </em>

                <span>{row[8]}</span>

                <span
                  className={styles.liquidity}
                >
                  {Array.from(
                    { length: 9 },
                    (_, bar) => (
                      <i
                        key={bar}
                        className={
                          bar < Number(row[9])
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

      <article className={`${styles.panel} ${styles.insights}`}>
        <header className={styles.sectionHeader}><div><h2>🤖 &nbsp; NEXUS AI INSIGHTS</h2><small>Почему эти монеты в топе?</small></div><time>12:45</time></header>
        <div className={styles.insightList}>{insights.map(([icon, title, text]) => <div key={title}><span>{icon}</span><div><strong>{title}</strong><p>{text}</p></div></div>)}</div>
        <div className={styles.insightConclusion}><strong>Вывод:</strong> Рынок в режиме RISK ON. Активность высокая.<br />Ищем импульсные сделки по топовым монетам.</div>
      </article>

      <article className={`${styles.panel} ${styles.chartPanel}`}>
        <div className={styles.chartHeader}>
          <div className={styles.chartPair}><span className={styles.chartCoin}>≋</span><strong>{selectedCoin.symbol}</strong><span>☆</span></div>
          <div className={styles.chartPeriods}>{chartPeriods.map((period) => <button key={period} type="button" className={chartPeriod === period ? styles.chartPeriodActive : ''} onClick={() => setChartPeriod(period)}>{period}</button>)}</div>
          <div className={styles.chartQuote}><strong>167.42</strong><em>+2.81%</em><span>H 167.89</span><span>L 162.34</span><span>V 4.21M</span></div>
          <span className={styles.indicators}>⌁ Индикаторы　▣　⛶</span>
        </div>
        <TradingChart candles={candles} />
      </article>

      <aside className={styles.marketDetails}>
        <div className={styles.detailTabs}><strong>УРОВНИ</strong><span>СДЕЛКИ</span><span>ПОТОК ОРДЕРОВ</span></div>
        <div className={styles.detailColumns}>
          <article className={styles.detailCard}><h3>КЛЮЧЕВЫЕ УРОВНИ</h3>{levels.map(([label, value, tone]) => <div key={label} className={styles[`level_${tone}`]}><span>{label}</span><strong>{value}</strong></div>)}</article>
          <article className={styles.detailCard}><h3>БЫСТРАЯ СТАТИСТИКА</h3>{stats.map(([label, value]) => <div key={label}><span>{label}</span><strong className={label === 'Ликвидность' || label.includes('Изменение') ? styles.positive : ''}>{value}</strong></div>)}</article>
        </div>
      </aside>
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
