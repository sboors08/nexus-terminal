export type DashboardTone = 'green' | 'orange' | 'yellow' | 'purple' | 'cyan';
export type DashboardActivityPeriod = '1M' | '5M' | '15M' | '1H' | '4H' | '24H';
export type DashboardChartPeriod = '1M' | '5M' | '15M' | '1H' | '4H' | '1D';

export type DashboardHotCoin = {
  rank: number;
  symbol: string;
  score: number;
  stage: string;
  state: string;
  tone: DashboardTone;
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

export type DashboardCandle = {
  index: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
};

export const DASHBOARD_HOT_COINS: DashboardHotCoin[] = [
  { rank: 1, symbol: 'SOL/USDT', score: 96, stage: 'ПОДХОД', state: 'В ИГРЕ', tone: 'green', color: '#32dc8b', icon: '≋', price: '174.20', change: '+2.81%', volume: '$4.21M', trades: '8 420', speed: '1 684/мин', btcLink: '0.42', btcStrength: '+4.82%', note: '(растёт быстрее биткоина)', spark: 'M2 29 L10 19 L16 23 L23 13 L30 18 L36 11 L42 18 L50 12 L58 20 L65 13 L74 18 L83 9 L92 15 L102 8 L113 12 L124 5 L130 9' },
  { rank: 2, symbol: 'SUI/USDT', score: 91, stage: 'ПОДТВЕРЖДЕНИЕ', state: 'В ГОРЯЧО', tone: 'orange', color: '#ff8625', icon: '◉', price: '2.340', change: '+2.34%', volume: '$2.83M', trades: '6 101', speed: '1 220/мин', btcLink: '0.36', btcStrength: '+3.21%', note: '(растёт быстрее биткоина)', spark: 'M2 25 L10 17 L17 22 L24 11 L31 16 L39 13 L46 20 L53 15 L61 22 L68 18 L75 24 L82 17 L91 20 L99 13 L108 18 L116 11 L124 15 L130 8' },
  { rank: 3, symbol: 'WIF/USDT', score: 88, stage: 'ПОДХОД', state: 'В ГОРЯЧО', tone: 'yellow', color: '#f6c21f', icon: '🐶', price: '3.22', change: '+3.42%', volume: '$1.94M', trades: '5 512', speed: '1 104/мин', btcLink: '0.28', btcStrength: '+2.91%', note: '(растёт быстрее биткоина)', spark: 'M2 28 L9 18 L17 22 L25 14 L33 18 L41 16 L49 20 L57 17 L65 21 L74 14 L82 18 L91 10 L100 15 L109 12 L118 16 L125 10 L130 13' },
  { rank: 4, symbol: 'ETH/USDT', score: 84, stage: 'ПОДТВЕРЖДЕНИЕ', state: 'В АКТИВНО', tone: 'purple', color: '#aa78ef', icon: '◆', price: '3 350', change: '+1.67%', volume: '$6.12M', trades: '7 942', speed: '1 588/мин', btcLink: '0.82', btcStrength: '-0.13%', note: '(растёт медленнее биткоина)', spark: 'M2 27 L10 19 L18 23 L26 13 L34 18 L42 12 L50 17 L58 15 L66 20 L75 14 L84 18 L93 12 L102 16 L111 11 L120 15 L130 8' },
  { rank: 5, symbol: 'PEPE/USDT', score: 78, stage: 'ПРОБОЙ', state: 'ПРОСЫПАЕТСЯ', tone: 'cyan', color: '#21d2c4', icon: '🐸', price: '0.00001234', change: '+2.06%', volume: '$1.23M', trades: '4 102', speed: '820/мин', btcLink: '0.18', btcStrength: '+1.19%', note: '(растёт быстрее биткоина)', spark: 'M2 28 L10 21 L18 23 L26 14 L34 19 L42 17 L50 21 L58 13 L66 18 L74 17 L82 23 L90 16 L98 20 L106 13 L114 17 L122 10 L130 13' },
];

export const DASHBOARD_SCANNER_ROWS = [
  ['SOL/USDT', '96 🔥', '+2.81%', '$4.21M', '8 420', '1 684/мин', '0.42', '+4.82%', 'Высокая', 8],
  ['SUI/USDT', '91 🔥', '+2.34%', '$2.83M', '6 101', '1 220/мин', '0.36', '+3.21%', 'Высокая', 7],
  ['WIF/USDT', '88 🔥', '+3.42%', '$1.94M', '5 512', '1 104/мин', '0.28', '+2.91%', 'Высокая', 7],
  ['ETH/USDT', '84', '+1.67%', '$6.12M', '7 942', '1 588/мин', '0.82', '-0.13%', 'Средняя', 6],
  ['PEPE/USDT', '78', '+2.06%', '$1.23M', '4 102', '820/мин', '0.18', '+1.19%', 'Высокая', 7],
  ['ARB/USDT', '72', '+1.18%', '$843K', '3 201', '640/мин', '0.55', '-0.62%', 'Средняя', 5],
  ['LINK/USDT', '68', '+0.95%', '$1.02M', '2 980', '596/мин', '0.63', '-0.23%', 'Средняя', 5],
] as const;

export const DASHBOARD_INSIGHTS = [
  ['🔥', 'Высокий поток сделок', 'SOL, SUI, WIF показывают аномальный рост количества сделок за последние 1 минуту. Рост от 180% до 320%.'],
  ['💰', 'Рост объёма', 'У всех топовых монет объём выше среднего по рынку. Лидеры: SOL (+320%), ETH (+210%).'],
  ['⚡', 'Сила против BTC', 'SOL и SUI сегодня значительно сильнее биткоина. Опережают BTC на 4.8% и 3.2% соответственно.'],
  ['◉', 'Ликвидность в норме', 'Ликвидность достаточная для скальпинга, проскальзывание минимальное.'],
] as const;

export const DASHBOARD_LEVELS = [
  ['Сопротивление 3', '169.80', 'resistance'],
  ['Сопротивление 2', '168.90', 'resistance'],
  ['Сопротивление 1', '168.10', 'resistance'],
  ['Текущая цена', '167.42', 'current'],
  ['Поддержка 1', '166.30', 'support'],
  ['Поддержка 2', '165.20', 'support'],
  ['Поддержка 3', '164.10', 'support'],
] as const;

export const DASHBOARD_STATS = [
  ['Капитализация', '$79.4B'],
  ['Объём 24ч', '$3.82B'],
  ['Средний спред', '0.012%'],
  ['Ликвидность', 'Высокая'],
  ['Волатильность', '64%'],
  ['Изменение 1ч', '+1.24%'],
  ['Изменение 24ч', '+6.31%'],
] as const;

export const DASHBOARD_CHART_PERIODS: DashboardChartPeriod[] = ['1M', '5M', '15M', '1H', '4H', '1D'];
export const DASHBOARD_ACTIVITY_PERIODS: DashboardActivityPeriod[] = ['1M', '5M', '15M', '1H', '4H', '24H'];

export const DASHBOARD_CANDLES: DashboardCandle[] = Array.from({ length: 70 }, (_, index) => {
  const trend = index * 0.07;
  const wave = Math.sin(index * 0.42) * 0.8 + Math.sin(index * 0.13) * 0.55;
  const open = 160.2 + trend + wave;
  const close = open + Math.sin(index * 1.36) * 0.58 + 0.08;
  return {
    index,
    open,
    close,
    high: Math.max(open, close) + 0.25 + (index % 3) * 0.06,
    low: Math.min(open, close) - 0.24 - (index % 4) * 0.04,
    volume: 8 + (index % 7) * 2.6 + Math.abs(Math.sin(index * 0.55)) * 13,
  };
});

export type DashboardViewData = {
  hotCoins: DashboardHotCoin[];
  scannerRows: typeof DASHBOARD_SCANNER_ROWS;
  insights: typeof DASHBOARD_INSIGHTS;
  levels: typeof DASHBOARD_LEVELS;
  stats: typeof DASHBOARD_STATS;
  chartPeriods: DashboardChartPeriod[];
  activityPeriods: DashboardActivityPeriod[];
  candles: DashboardCandle[];
};

export const DASHBOARD_VIEW_DATA: DashboardViewData = {
  hotCoins: DASHBOARD_HOT_COINS,
  scannerRows: DASHBOARD_SCANNER_ROWS,
  insights: DASHBOARD_INSIGHTS,
  levels: DASHBOARD_LEVELS,
  stats: DASHBOARD_STATS,
  chartPeriods: DASHBOARD_CHART_PERIODS,
  activityPeriods: DASHBOARD_ACTIVITY_PERIODS,
  candles: DASHBOARD_CANDLES,
};
