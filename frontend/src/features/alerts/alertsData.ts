import type { TradeDirection } from '@/shared/ui/DirectionBadge';
import type { SetupStage } from '@/shared/ui/SetupStageBadge';

export type AlertEventType =
  | 'price-near-level'
  | 'confirmation'
  | 'prints-flow'
  | 'liquidity-increased'
  | 'liquidity-weakened'
  | 'liquidity-removed'
  | 'level-broken'
  | 'bounce'
  | 'invalidated';

export type AlertPriority = 'critical' | 'attention' | 'info';
export type AlertReadStatus = 'new' | 'viewed';

export type AlertMetric = {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'warning' | 'neutral';
};

export type NexusAlert = {
  id: string;
  setupId: string;
  symbol: string;
  exchange: 'BINANCE';
  timeframe: '1m' | '5m' | '15m';
  direction: TradeDirection;
  setupKind: string;
  stage: SetupStage;
  eventType: AlertEventType;
  eventLabel: string;
  title: string;
  explanation: string;
  reasonToOpen: string;
  timestamp: string;
  relativeTime: string;
  price: string;
  changePercent: number;
  priority: AlertPriority;
  readStatus: AlertReadStatus;
  metrics: AlertMetric[];
};

export type AlertRule = {
  id: string;
  title: string;
  description: string;
  scope: string;
  matchesToday: number;
  enabled: boolean;
};

export const ALERT_EVENT_LABELS: Record<AlertEventType, string> = {
  'price-near-level': 'Цена у уровня',
  confirmation: 'Переход в подтверждение',
  'prints-flow': 'Активировался поток принтов',
  'liquidity-increased': 'Плотность увеличилась',
  'liquidity-weakened': 'Плотность ослабла',
  'liquidity-removed': 'Плотность снята',
  'level-broken': 'Уровень пробит',
  bounce: 'Произошёл отскок',
  invalidated: 'Сетап потерял актуальность',
};

export const ALERTS: NexusAlert[] = [
  {
    id: 'alert-sol-confirmation',
    setupId: 'sol-breakout',
    symbol: 'SOLUSDT',
    exchange: 'BINANCE',
    timeframe: '5m',
    direction: 'long',
    setupKind: 'Пробой сопротивления',
    stage: 'confirmation',
    eventType: 'confirmation',
    eventLabel: 'Подтверждение',
    title: 'Сетап перешёл в подтверждение',
    explanation: 'После третьего касания объём вырос до 1.84×, а скорость сделок — до 42 сделок/с. Цена удерживается в 0.38% от зоны 188.10–188.42.',
    reasonToOpen: 'Импульс формируется непосредственно под сопротивлением. В Workspace стоит проверить закрепление за зоной и финальное усиление потока принтов.',
    timestamp: '17:32:14',
    relativeTime: '12 сек назад',
    price: '187.42',
    changePercent: 4.18,
    priority: 'critical',
    readStatus: 'new',
    metrics: [
      { label: 'До уровня', value: '0.38%', tone: 'warning' },
      { label: 'Объём', value: '1.84×', tone: 'positive' },
      { label: 'Сделки', value: '2.16×', tone: 'positive' },
      { label: 'Сила к BTC', value: '+2.7%', tone: 'positive' },
    ],
  },
  {
    id: 'alert-apt-near-level',
    setupId: 'apt-support-break',
    symbol: 'APTUSDT',
    exchange: 'BINANCE',
    timeframe: '5m',
    direction: 'short',
    setupKind: 'Пробой поддержки',
    stage: 'approach',
    eventType: 'price-near-level',
    eventLabel: 'Цена у уровня',
    title: 'Цена подошла к зоне поддержки',
    explanation: 'APTUSDT находится в 0.41% от поддержки 7.12–7.16. Подход идёт без глубокого отката, продавцы сохраняют инициативу.',
    reasonToOpen: 'Сетап близок к переходу в подтверждение. В Workspace нужно оценить реакцию покупателей и наличие удерживающей плотности под уровнем.',
    timestamp: '17:31:38',
    relativeTime: '48 сек назад',
    price: '7.19',
    changePercent: -3.1,
    priority: 'attention',
    readStatus: 'new',
    metrics: [
      { label: 'До уровня', value: '0.41%', tone: 'warning' },
      { label: 'Касания', value: '3', tone: 'neutral' },
      { label: 'Объём', value: '1.92×', tone: 'negative' },
      { label: 'Сила к BTC', value: '-3.1%', tone: 'negative' },
    ],
  },
  {
    id: 'alert-eth-prints',
    setupId: 'eth-support-bounce',
    symbol: 'ETHUSDT',
    exchange: 'BINANCE',
    timeframe: '15m',
    direction: 'long',
    setupKind: 'Отскок от поддержки',
    stage: 'confirmation',
    eventType: 'prints-flow',
    eventLabel: 'Поток принтов',
    title: 'Активировался поток покупок',
    explanation: 'В зоне поддержки прошла серия крупных покупок. Скорость сделок выросла на 46%, дельта принтов стала положительной.',
    reasonToOpen: 'Появилась реакция от уровня, но цена ещё находится внутри зоны. Workspace поможет проверить устойчивость покупателя и глубину захода.',
    timestamp: '17:28:02',
    relativeTime: '4 мин назад',
    price: '3 482.6',
    changePercent: 0.8,
    priority: 'attention',
    readStatus: 'new',
    metrics: [
      { label: 'Скорость', value: '+46%', tone: 'positive' },
      { label: 'Дельта', value: '+$286K', tone: 'positive' },
      { label: 'Глубина зоны', value: '34%', tone: 'neutral' },
      { label: 'Потенциал', value: '1.9%', tone: 'positive' },
    ],
  },
  {
    id: 'alert-op-breakout',
    setupId: 'op-support-break',
    symbol: 'OPUSDT',
    exchange: 'BINANCE',
    timeframe: '5m',
    direction: 'short',
    setupKind: 'Пробой поддержки',
    stage: 'triggered',
    eventType: 'level-broken',
    eventLabel: 'Пробой уровня',
    title: 'Поддержка пробита импульсом',
    explanation: 'Цена вышла ниже зоны 1.603–1.612 на объёме 2.34×. За уровнем прошло 68% сделок от локального всплеска.',
    reasonToOpen: 'Пробой уже реализуется. В Workspace стоит оценить закрепление, возможный ретест и остаток ближайшей покупательской ликвидности.',
    timestamp: '17:25:46',
    relativeTime: '6 мин назад',
    price: '1.594',
    changePercent: -2.4,
    priority: 'critical',
    readStatus: 'new',
    metrics: [
      { label: 'За уровнем', value: '0.56%', tone: 'negative' },
      { label: 'Объём', value: '2.34×', tone: 'negative' },
      { label: 'Сделки', value: '2.61×', tone: 'negative' },
      { label: 'Исполнение', value: '68%', tone: 'warning' },
    ],
  },
  {
    id: 'alert-arb-density-up',
    setupId: 'arb-breakout',
    symbol: 'ARBUSDT',
    exchange: 'BINANCE',
    timeframe: '1m',
    direction: 'long',
    setupKind: 'Пробой сопротивления',
    stage: 'approach',
    eventType: 'liquidity-increased',
    eventLabel: 'Плотность растёт',
    title: 'Плотность продавца увеличилась',
    explanation: 'Объём заявки в зоне 0.7510–0.7520 вырос с $164K до $238K за 3 минуты. Цена остаётся в 0.63% от уровня.',
    reasonToOpen: 'Усиление плотности может задержать подход или стать топливом для импульса. В Workspace важно следить, стоит ли заявка и как она исполняется.',
    timestamp: '17:21:18',
    relativeTime: '11 мин назад',
    price: '0.7464',
    changePercent: 1.2,
    priority: 'info',
    readStatus: 'viewed',
    metrics: [
      { label: 'Размер', value: '$238K', tone: 'warning' },
      { label: 'Изменение', value: '+45%', tone: 'warning' },
      { label: 'Возраст', value: '9 мин', tone: 'neutral' },
      { label: 'Исполнено', value: '7%', tone: 'neutral' },
    ],
  },
  {
    id: 'alert-xrp-density-down',
    setupId: 'xrp-resistance-bounce',
    symbol: 'XRPUSDT',
    exchange: 'BINANCE',
    timeframe: '15m',
    direction: 'short',
    setupKind: 'Отскок от сопротивления',
    stage: 'observation',
    eventType: 'liquidity-weakened',
    eventLabel: 'Плотность ослабла',
    title: 'Защитная плотность потеряла 37%',
    explanation: 'Плотность продавца над текущей ценой снизилась с $312K до $196K. Снятие происходит частями без заметного исполнения.',
    reasonToOpen: 'Ослабление продавца меняет контекст отскока. В Workspace нужно проверить, не переставляется ли заявка выше и не теряет ли сетап актуальность.',
    timestamp: '17:16:33',
    relativeTime: '16 мин назад',
    price: '2.824',
    changePercent: -1.4,
    priority: 'info',
    readStatus: 'viewed',
    metrics: [
      { label: 'Было', value: '$312K', tone: 'neutral' },
      { label: 'Стало', value: '$196K', tone: 'warning' },
      { label: 'Ослабление', value: '-37%', tone: 'warning' },
      { label: 'Исполнено', value: '13%', tone: 'neutral' },
    ],
  },
  {
    id: 'alert-inj-density-removed',
    setupId: 'inj-breakout',
    symbol: 'INJUSDT',
    exchange: 'BINANCE',
    timeframe: '1m',
    direction: 'long',
    setupKind: 'Пробой сопротивления',
    stage: 'confirmation',
    eventType: 'liquidity-removed',
    eventLabel: 'Плотность снята',
    title: 'Крупная заявка исчезла перед касанием',
    explanation: 'Плотность $186K на 28.04 снята при расстоянии цены 0.18%. Признаков полного исполнения нет.',
    reasonToOpen: 'Сопротивление стало слабее, но снятие может быть перестановкой. В Workspace нужно проверить соседние уровни карты ликвидности и поток сделок.',
    timestamp: '17:12:04',
    relativeTime: '20 мин назад',
    price: '27.98',
    changePercent: 3.6,
    priority: 'attention',
    readStatus: 'viewed',
    metrics: [
      { label: 'Размер', value: '$186K', tone: 'warning' },
      { label: 'До уровня', value: '0.18%', tone: 'warning' },
      { label: 'Исполнено', value: '4%', tone: 'neutral' },
      { label: 'Вероятность снятия', value: 'Высокая', tone: 'warning' },
    ],
  },
  {
    id: 'alert-sui-bounce',
    setupId: 'sui-support-bounce',
    symbol: 'SUIUSDT',
    exchange: 'BINANCE',
    timeframe: '5m',
    direction: 'long',
    setupKind: 'Отскок от поддержки',
    stage: 'triggered',
    eventType: 'bounce',
    eventLabel: 'Отскок',
    title: 'Отскок от поддержки подтверждён',
    explanation: 'Цена вышла из зоны поддержки после серии покупок. Максимальное движение от точки реакции составляет 1.26%.',
    reasonToOpen: 'Сетап реализован, но движение продолжается. Workspace позволит оценить остаточный потенциал до следующего сопротивления.',
    timestamp: '17:04:42',
    relativeTime: '27 мин назад',
    price: '3.918',
    changePercent: 2.1,
    priority: 'info',
    readStatus: 'viewed',
    metrics: [
      { label: 'Движение', value: '+1.26%', tone: 'positive' },
      { label: 'Реакция', value: 'Сильная', tone: 'positive' },
      { label: 'До цели', value: '0.84%', tone: 'neutral' },
      { label: 'Время', value: '18 мин', tone: 'neutral' },
    ],
  },
  {
    id: 'alert-doge-invalid',
    setupId: 'doge-resistance-bounce',
    symbol: 'DOGEUSDT',
    exchange: 'BINANCE',
    timeframe: '1m',
    direction: 'short',
    setupKind: 'Отскок от сопротивления',
    stage: 'observation',
    eventType: 'invalidated',
    eventLabel: 'Потеря актуальности',
    title: 'Сетап снят с наблюдения',
    explanation: 'Цена ушла от рабочей зоны на 2.4%, а время формирования превысило установленный лимит. Активность возле уровня снизилась.',
    reasonToOpen: 'Открывать Workspace не обязательно: событие объясняет, почему сетап удалён из активного списка и останется только в Market History.',
    timestamp: '16:51:19',
    relativeTime: '41 мин назад',
    price: '0.1426',
    changePercent: -0.3,
    priority: 'info',
    readStatus: 'viewed',
    metrics: [
      { label: 'От зоны', value: '2.4%', tone: 'neutral' },
      { label: 'Формирование', value: '9ч 12м', tone: 'warning' },
      { label: 'Активность', value: 'Низкая', tone: 'neutral' },
      { label: 'Статус', value: 'Закрыт', tone: 'neutral' },
    ],
  },
];

export const INITIAL_ALERT_RULES: AlertRule[] = [
  {
    id: 'rule-confirmation',
    title: 'Переход в подтверждение',
    description: 'Все сетапы, которые выполнили условия стадии подтверждения.',
    scope: 'Все инструменты · 1m / 5m / 15m',
    matchesToday: 4,
    enabled: true,
  },
  {
    id: 'rule-distance',
    title: 'Цена ближе 0.5% к уровню',
    description: 'Раннее предупреждение о приближении к рабочей ценовой зоне.',
    scope: 'LONG и SHORT · все сетапы',
    matchesToday: 7,
    enabled: true,
  },
  {
    id: 'rule-liquidity',
    title: 'Изменение значимой плотности',
    description: 'Рост, ослабление или снятие плотности возле активного уровня.',
    scope: 'Размер от $150K',
    matchesToday: 3,
    enabled: true,
  },
  {
    id: 'rule-triggered',
    title: 'Пробой или отскок',
    description: 'Сетап перешёл в финальную стадию реализации.',
    scope: 'Только Hot List',
    matchesToday: 2,
    enabled: false,
  },
];
