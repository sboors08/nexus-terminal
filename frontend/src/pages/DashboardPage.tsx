import { useMemo, useState, type CSSProperties } from 'react';
import bullMarket from '@/assets/bull-market.png';
import styles from './DashboardPage.module.css';

type Tone = 'green' | 'orange' | 'yellow' | 'purple' | 'cyan';
type ActivityPeriod = '1M' | '5M' | '15M' | '1H' | '4H' | '24H';
type ChartPeriod = '1M' | '5M' | '15M' | '1H' | '4H' | '1D';

type HotCoin = {
  rank: number;
  symbol: string;
  score: number;
  stage: string;
  state: string;
  tone: Tone;
  color: string;
  icon: string;
  price: string;
  change: string;
  volume: string;
  trades: string;
  speed: string;
  btcLink: string;
  btcStrength: string;
  note: string;
  spark: string;
};

const HOT_COINS: HotCoin[] = [
  { rank: 1, symbol: 'SOL/USDT', score: 96, stage: 'ПОДХОД', state: 'В ИГРЕ', tone: 'green', color: '#32dc8b', icon: '≋', price: '174.20', change: '+2.81%', volume: '$4.21M', trades: '8 420', speed: '1 684/мин', btcLink: '0.42', btcStrength: '+4.82%', note: '(растёт быстрее биткоина)', spark: 'M2 29 L10 19 L16 23 L23 13 L30 18 L36 11 L42 18 L50 12 L58 20 L65 13 L74 18 L83 9 L92 15 L102 8 L113 12 L124 5 L130 9' },
  { rank: 2, symbol: 'SUI/USDT', score: 91, stage: 'ПОДТВЕРЖДЕНИЕ', state: 'В ГОРЯЧО', tone: 'orange', color: '#ff8625', icon: '◉', price: '2.340', change: '+2.34%', volume: '$2.83M', trades: '6 101', speed: '1 220/мин', btcLink: '0.36', btcStrength: '+3.21%', note: '(растёт быстрее биткоина)', spark: 'M2 25 L10 17 L17 22 L24 11 L31 16 L39 13 L46 20 L53 15 L61 22 L68 18 L75 24 L82 17 L91 20 L99 13 L108 18 L116 11 L124 15 L130 8' },
  { rank: 3, symbol: 'WIF/USDT', score: 88, stage: 'ПОДХОД', state: 'В ГОРЯЧО', tone: 'yellow', color: '#f6c21f', icon: '🐶', price: '3.22', change: '+3.42%', volume: '$1.94M', trades: '5 512', speed: '1 104/мин', btcLink: '0.28', btcStrength: '+2.91%', note: '(растёт быстрее биткоина)', spark: 'M2 28 L9 18 L17 22 L25 14 L33 18 L41 16 L49 20 L57 17 L65 21 L74 14 L82 18 L91 10 L100 15 L109 12 L118 16 L125 10 L130 13' },
  { rank: 4, symbol: 'ETH/USDT', score: 84, stage: 'ПОДТВЕРЖДЕНИЕ', state: 'В АКТИВНО', tone: 'purple', color: '#aa78ef', icon: '◆', price: '3 350', change: '+1.67%', volume: '$6.12M', trades: '7 942', speed: '1 588/мин', btcLink: '0.82', btcStrength: '-0.13%', note: '(растёт медленнее биткоина)', spark: 'M2 27 L10 19 L18 23 L26 13 L34 18 L42 12 L50 17 L58 15 L66 20 L75 14 L84 18 L93 12 L102 16 L111 11 L120 15 L130 8' },
  { rank: 5, symbol: 'PEPE/USDT', score: 78, stage: 'ПРОБОЙ', state: 'ПРОСЫПАЕТСЯ', tone: 'cyan', color: '#21d2c4', icon: '🐸', price: '0.00001234', change: '+2.06%', volume: '$1.23M', trades: '4 102', speed: '820/мин', btcLink: '0.18', btcStrength: '+1.19%', note: '(растёт быстрее биткоина)', spark: 'M2 28 L10 21 L18 23 L26 14 L34 19 L42 17 L50 21 L58 13 L66 18 L74 17 L82 23 L90 16 L98 20 L106 13 L114 17 L122 10 L130 13' },
];

const SCANNER_ROWS = [
  ['SOL/USDT', '96 🔥', '+2.81%', '$4.21M', '8 420', '1 684/мин', '0.42', '+4.82%', 'Высокая', 8],
  ['SUI/USDT', '91 🔥', '+2.34%', '$2.83M', '6 101', '1 220/мин', '0.36', '+3.21%', 'Высокая', 7],
  ['WIF/USDT', '88 🔥', '+3.42%', '$1.94M', '5 512', '1 104/мин', '0.28', '+2.91%', 'Высокая', 7],
  ['ETH/USDT', '84', '+1.67%', '$6.12M', '7 942', '1 588/мин', '0.82', '-0.13%', 'Средняя', 6],
  ['PEPE/USDT', '78', '+2.06%', '$1.23M', '4 102', '820/мин', '0.18', '+1.19%', 'Высокая', 7],
  ['ARB/USDT', '72', '+1.18%', '$843K', '3 201', '640/мин', '0.55', '-0.62%', 'Средняя', 5],
  ['LINK/USDT', '68', '+0.95%', '$1.02M', '2 980', '596/мин', '0.63', '-0.23%', 'Средняя', 5],
] as const;

const INSIGHTS = [
  ['🔥', 'Высокий поток сделок', 'SOL, SUI, WIF показывают аномальный рост количества сделок за последние 1 минуту. Рост от 180% до 320%.'],
  ['💰', 'Рост объёма', 'У всех топовых монет объём выше среднего по рынку. Лидеры: SOL (+320%), ETH (+210%).'],
  ['⚡', 'Сила против BTC', 'SOL и SUI сегодня значительно сильнее биткоина. Опережают BTC на 4.8% и 3.2% соответственно.'],
  ['◉', 'Ликвидность в норме', 'Ликвидность достаточная для скальпинга, проскальзывание минимальное.'],
] as const;

const LEVELS = [
  ['Сопротивление 3', '169.80', 'resistance'],
  ['Сопротивление 2', '168.90', 'resistance'],
  ['Сопротивление 1', '168.10', 'resistance'],
  ['Текущая цена', '167.42', 'current'],
  ['Поддержка 1', '166.30', 'support'],
  ['Поддержка 2', '165.20', 'support'],
  ['Поддержка 3', '164.10', 'support'],
] as const;

const STATS = [
  ['Капитализация', '$79.4B'],
  ['Объём 24ч', '$3.82B'],
  ['Средний спред', '0.012%'],
  ['Ликвидность', 'Высокая'],
  ['Волатильность', '64%'],
  ['Изменение 1ч', '+1.24%'],
  ['Изменение 24ч', '+6.31%'],
] as const;

const CHART_PERIODS: ChartPeriod[] = ['1M', '5M', '15M', '1H', '4H', '1D'];
const ACTIVITY_PERIODS: ActivityPeriod[] = ['1M', '5M', '15M', '1H', '4H', '24H'];

const CANDLES = Array.from({ length: 70 }, (_, index) => {
  const trend = index * 0.07;
  const wave = Math.sin(index * .42) * .8 + Math.sin(index * .13) * .55;
  const open = 160.2 + trend + wave;
  const close = open + Math.sin(index * 1.36) * .58 + .08;
  return {
    index,
    open,
    close,
    high: Math.max(open, close) + .25 + (index % 3) * .06,
    low: Math.min(open, close) - .24 - (index % 4) * .04,
    volume: 8 + (index % 7) * 2.6 + Math.abs(Math.sin(index * .55)) * 13,
  };
});

function HotCard({ coin, selected, onSelect }: { coin: HotCoin; selected: boolean; onSelect: () => void }) {
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

function TradingChart() {
  const min = Math.min(...CANDLES.map((candle) => candle.low));
  const max = Math.max(...CANDLES.map((candle) => candle.high));
  const range = Math.max(max - min, 1);
  const mapY = (value: number) => 202 - ((value - min) / range) * 145;
  const step = 900 / CANDLES.length;
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
        {CANDLES.map((candle) => {
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

export function DashboardPage() {
  const [selected, setSelected] = useState(HOT_COINS[0].symbol);
  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>('1M');
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('1M');
  const selectedCoin = useMemo(() => HOT_COINS.find((coin) => coin.symbol === selected) ?? HOT_COINS[0], [selected]);

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
          <div><span>ПЕРИОД АКТИВНОСТИ</span><div className={styles.periods}>{ACTIVITY_PERIODS.map((period) => <button key={period} type="button" className={activityPeriod === period ? styles.periodActive : ''} onClick={() => setActivityPeriod(period)}>{period}</button>)}</div></div>
          <button type="button" className={styles.filterButton}>⌁ &nbsp; НАСТРОИТЬ ФИЛЬТРЫ</button>
        </div>
        <div className={styles.hotTitle}><div><span>🔥</span><strong>HOT LIST</strong><small>— САМЫЕ АКТИВНЫЕ МОНЕТЫ ПРЯМО СЕЙЧАС</small></div><em>5 сетапов ›</em></div>
        <div className={styles.hotCards}>{HOT_COINS.map((coin) => <HotCard key={coin.symbol} coin={coin} selected={coin.symbol === selected} onSelect={() => setSelected(coin.symbol)} />)}</div>
      </article>

      <article className={`${styles.panel} ${styles.scanner}`}>
        <header className={styles.sectionHeader}><div><h2>📊 &nbsp; MARKET SCANNER</h2><small>Найдено: 214 монет</small></div><div className={styles.search}>⌕ Поиск монеты...　⋮</div></header>
        <div className={styles.scannerTable}>
          <div className={styles.scannerHead}><span>#</span><span>МОНЕТА</span><span>АКТИВНОСТЬ</span><span>ЦЕНА 1М</span><span>ОБЪЁМ 1М</span><span>СДЕЛКИ 1М</span><span>СКОРОСТЬ</span><span>СВЯЗЬ С BTC</span><span>СИЛА ПРОТИВ BTC</span><span>ВОЛАТ.</span><span>ЛИКВИДНОСТЬ</span></div>
          {SCANNER_ROWS.map((row, index) => (
            <div key={row[0]} className={styles.scannerRow}>
              <span>{index + 1}</span><strong><i className={styles.coinDot} />{row[0]}</strong><em className={styles.activityScore}>{row[1]}</em><em className={styles.positive}>{row[2]}</em><span>{row[3]}</span><span>{row[4]}</span><span>{row[5]}</span><span>{row[6]}</span><em className={String(row[7]).startsWith('-') ? styles.negative : styles.positive}>{row[7]}</em><span>{row[8]}</span><span className={styles.liquidity}>{Array.from({ length: 9 }, (_, bar) => <i key={bar} className={bar < Number(row[9]) ? styles.liquidityOn : ''} />)}</span>
            </div>
          ))}
        </div>
      </article>

      <article className={`${styles.panel} ${styles.insights}`}>
        <header className={styles.sectionHeader}><div><h2>🤖 &nbsp; NEXUS AI INSIGHTS</h2><small>Почему эти монеты в топе?</small></div><time>12:45</time></header>
        <div className={styles.insightList}>{INSIGHTS.map(([icon, title, text]) => <div key={title}><span>{icon}</span><div><strong>{title}</strong><p>{text}</p></div></div>)}</div>
        <div className={styles.insightConclusion}><strong>Вывод:</strong> Рынок в режиме RISK ON. Активность высокая.<br />Ищем импульсные сделки по топовым монетам.</div>
      </article>

      <article className={`${styles.panel} ${styles.chartPanel}`}>
        <div className={styles.chartHeader}>
          <div className={styles.chartPair}><span className={styles.chartCoin}>≋</span><strong>{selectedCoin.symbol}</strong><span>☆</span></div>
          <div className={styles.chartPeriods}>{CHART_PERIODS.map((period) => <button key={period} type="button" className={chartPeriod === period ? styles.chartPeriodActive : ''} onClick={() => setChartPeriod(period)}>{period}</button>)}</div>
          <div className={styles.chartQuote}><strong>167.42</strong><em>+2.81%</em><span>H 167.89</span><span>L 162.34</span><span>V 4.21M</span></div>
          <span className={styles.indicators}>⌁ Индикаторы　▣　⛶</span>
        </div>
        <TradingChart />
      </article>

      <aside className={styles.marketDetails}>
        <div className={styles.detailTabs}><strong>УРОВНИ</strong><span>СДЕЛКИ</span><span>ПОТОК ОРДЕРОВ</span></div>
        <div className={styles.detailColumns}>
          <article className={styles.detailCard}><h3>КЛЮЧЕВЫЕ УРОВНИ</h3>{LEVELS.map(([label, value, tone]) => <div key={label} className={styles[`level_${tone}`]}><span>{label}</span><strong>{value}</strong></div>)}</article>
          <article className={styles.detailCard}><h3>БЫСТРАЯ СТАТИСТИКА</h3>{STATS.map(([label, value]) => <div key={label}><span>{label}</span><strong className={label === 'Ликвидность' || label.includes('Изменение') ? styles.positive : ''}>{value}</strong></div>)}</article>
        </div>
      </aside>
    </section>
  );
}
