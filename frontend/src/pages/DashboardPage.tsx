import { useMemo, useState, type CSSProperties } from 'react';
import bullMarket from '@/assets/bull-market.png';
import {
  nexusApi,
  useApiQuery,
  type DashboardActivityPeriod,
  type DashboardCandle,
  type DashboardChartPeriod,
  type DashboardHotCoin,
  type DashboardViewData,
} from '@/shared/api';
import { AsyncDataState } from '@/shared/ui/AsyncDataState';
import styles from './DashboardPage.module.css';

function HotCard({ coin, selected, onSelect }: { coin: DashboardHotCoin; selected: boolean; onSelect: () => void }) {
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
        <span>Цена <strong className={styles.positive}>{coin.change}</strong></span>
        <span>Объём <strong>{coin.volume}</strong></span>
        <span>Сделки <strong>{coin.trades}</strong></span>
        <span>Скорость <strong>{coin.speed}</strong></span>
        <span>Связь с BTC <strong>{coin.btcLink}</strong></span>
        <span className={styles.strengthRow}>Сила против BTC <strong className={coin.btcStrength.startsWith('-') ? styles.negative : styles.positive}>{coin.btcStrength}</strong></span>
      </div>
      <small className={styles.cardNote}>{coin.note}</small>
    </button>
  );
}

function FearGreed() {
  return (
    <div className={styles.fearGreedGauge}>
      <svg viewBox="0 0 120 66" aria-label="Fear and Greed: 72">
        <defs>
          <linearGradient id="fearGauge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ff6c2f" />
            <stop offset=".45" stopColor="#f0d43a" />
            <stop offset="1" stopColor="#35df8d" />
          </linearGradient>
        </defs>
        <path d="M12 58 A48 48 0 0 1 108 58" fill="none" stroke="#14251f" strokeWidth="11" />
        <path d="M12 58 A48 48 0 0 1 108 58" fill="none" stroke="url(#fearGauge)" strokeWidth="11" />
        <line x1="60" y1="58" x2="82" y2="35" stroke="#eef5f2" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="60" cy="58" r="4" fill="#eef5f2" />
      </svg>
      <span><strong>72</strong><small>Greed</small></span>
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
  const { hotCoins, scannerRows, insights, levels, stats, chartPeriods, activityPeriods, candles } = data;
  const [selected, setSelected] = useState(hotCoins[0].symbol);
  const [activityPeriod, setActivityPeriod] = useState<DashboardActivityPeriod>('1M');
  const [chartPeriod, setChartPeriod] = useState<DashboardChartPeriod>('1M');
  const selectedCoin = useMemo(() => hotCoins.find((coin) => coin.symbol === selected) ?? hotCoins[0], [hotCoins, selected]);

  return (
    <section className={styles.dashboard}>
      <article className={`${styles.panel} ${styles.marketMode}`}>
        <header className={styles.panelHeader}><h2>BTC MARKET MODE</h2><span className={styles.info}>i</span></header>
        <div className={styles.marketModeBody}>
          <div className={styles.marketMood}>
            <img src={bullMarket} alt="Бычье настроение рынка" />
            <div><strong>BULLISH</strong><span>TRENDING UP</span><em>RISK ON</em></div>
          </div>
          <div className={styles.btcStats}>
            <div><span>BTC PRICE</span><strong>$104,250</strong><em>+1.82%</em></div>
            <div><span>BTC DOMINANCE</span><strong>53.6%</strong><em className={styles.negative}>-0.35%</em></div>
            <div><span>MARKET VOLATILITY</span><strong>64%</strong><small>Средняя</small></div>
          </div>
        </div>
        <div className={styles.fearRow}><span>FEAR &amp; GREED</span><FearGreed /></div>
      </article>

      <article className={`${styles.panel} ${styles.hotList}`}>
        <div className={styles.activityToolbar}>
          <div><span>ПЕРИОД АКТИВНОСТИ</span><div className={styles.periods}>{activityPeriods.map((period) => <button key={period} type="button" className={activityPeriod === period ? styles.periodActive : ''} onClick={() => setActivityPeriod(period)}>{period}</button>)}</div></div>
          <button type="button" className={styles.filterButton}>⌁ &nbsp; НАСТРОИТЬ ФИЛЬТРЫ</button>
        </div>
        <div className={styles.hotTitle}><div><span>🔥</span><strong>HOT LIST</strong><small>— САМЫЕ АКТИВНЫЕ МОНЕТЫ ПРЯМО СЕЙЧАС</small></div><em>5 сетапов ›</em></div>
        <div className={styles.hotCards}>{hotCoins.map((coin) => <HotCard key={coin.symbol} coin={coin} selected={coin.symbol === selected} onSelect={() => setSelected(coin.symbol)} />)}</div>
      </article>

      <article className={`${styles.panel} ${styles.scanner}`}>
        <header className={styles.sectionHeader}><div><h2>📊 &nbsp; MARKET SCANNER</h2><small>Найдено: 214 монет</small></div><div className={styles.search}>⌕ Поиск монеты...　⋮</div></header>
        <div className={styles.scannerTable}>
          <div className={styles.scannerHead}><span>#</span><span>МОНЕТА</span><span>АКТИВНОСТЬ</span><span>ЦЕНА 1М</span><span>ОБЪЁМ 1М</span><span>СДЕЛКИ 1М</span><span>СКОРОСТЬ</span><span>СВЯЗЬ С BTC</span><span>СИЛА ПРОТИВ BTC</span><span>ВОЛАТ.</span><span>ЛИКВИДНОСТЬ</span></div>
          {scannerRows.map((row, index) => (
            <div key={row[0]} className={styles.scannerRow}>
              <span>{index + 1}</span><strong><i className={styles.coinDot} />{row[0]}</strong><em className={styles.activityScore}>{row[1]}</em><em className={styles.positive}>{row[2]}</em><span>{row[3]}</span><span>{row[4]}</span><span>{row[5]}</span><span>{row[6]}</span><em className={String(row[7]).startsWith('-') ? styles.negative : styles.positive}>{row[7]}</em><span>{row[8]}</span><span className={styles.liquidity}>{Array.from({ length: 9 }, (_, bar) => <i key={bar} className={bar < Number(row[9]) ? styles.liquidityOn : ''} />)}</span>
            </div>
          ))}
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
