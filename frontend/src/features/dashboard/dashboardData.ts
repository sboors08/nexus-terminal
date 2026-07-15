import type { TradeDirection } from '@/shared/ui/DirectionBadge';
import type { SetupStage } from '@/shared/ui/SetupStageBadge';

export type SetupKind =
  | 'Пробой сопротивления'
  | 'Пробой поддержки'
  | 'Отскок от поддержки'
  | 'Отскок от сопротивления';

export type DashboardSetup = {
  id: string;
  symbol: string;
  exchange: 'BINANCE';
  direction: TradeDirection;
  kind: SetupKind;
  stage: SetupStage;
  timeframe: '1m' | '5m' | '15m';
  price: string;
  priceChange: string;
  level: string;
  distance: string;
  touches: number;
  formationTime: string;
  pullbackDepth: 'Глубокие' | 'Неглубокие';
  btcStrength: string;
  volumeAnomaly: string;
  tradesAnomaly: string;
  activity: 'Высокая' | 'Средняя';
  chartPath: string;
  areaPath: string;
  touchPoints: Array<{ x: number; y: number }>;
  levelY: number;
};

export type DashboardEvent = {
  id: string;
  symbol: string;
  text: string;
  time: string;
  tone: 'info' | 'approach' | 'confirmation' | 'long' | 'short';
};

export type CompletedSetup = {
  id: string;
  symbol: string;
  direction: TradeDirection;
  kind: SetupKind;
  result: 'Отработал' | 'Отменён';
  movement: string;
  timeToTarget: string;
};

export const HOT_SETUPS: DashboardSetup[] = [
  {
    id: 'sol-breakout',
    symbol: 'SOLUSDT',
    exchange: 'BINANCE',
    direction: 'long',
    kind: 'Пробой сопротивления',
    stage: 'confirmation',
    timeframe: '5m',
    price: '187.42',
    priceChange: '+4.18%',
    level: '188.10–188.42',
    distance: '0.38%',
    touches: 3,
    formationTime: '2ч 18м',
    pullbackDepth: 'Неглубокие',
    btcStrength: '+2.7%',
    volumeAnomaly: '1.84×',
    tradesAnomaly: '2.16×',
    activity: 'Высокая',
    chartPath: 'M0 154 C38 150 52 131 83 136 C112 141 127 116 155 121 C188 126 204 94 235 101 C264 108 283 80 315 88 C344 96 366 64 396 73 C425 82 449 49 480 58 C510 67 533 42 564 47 C589 51 610 35 640 31',
    areaPath: 'M0 154 C38 150 52 131 83 136 C112 141 127 116 155 121 C188 126 204 94 235 101 C264 108 283 80 315 88 C344 96 366 64 396 73 C425 82 449 49 480 58 C510 67 533 42 564 47 C589 51 610 35 640 31 L640 210 L0 210 Z',
    touchPoints: [
      { x: 315, y: 88 },
      { x: 480, y: 58 },
      { x: 564, y: 47 },
    ],
    levelY: 43,
  },
  {
    id: 'eth-bounce',
    symbol: 'ETHUSDT',
    exchange: 'BINANCE',
    direction: 'long',
    kind: 'Отскок от поддержки',
    stage: 'approach',
    timeframe: '15m',
    price: '3 524.80',
    priceChange: '+1.92%',
    level: '3 498–3 506',
    distance: '0.54%',
    touches: 2,
    formationTime: '5ч 42м',
    pullbackDepth: 'Глубокие',
    btcStrength: '+0.8%',
    volumeAnomaly: '1.31×',
    tradesAnomaly: '1.48×',
    activity: 'Средняя',
    chartPath: 'M0 49 C35 54 52 79 82 73 C116 66 130 101 161 93 C191 85 205 123 237 116 C269 108 282 145 314 136 C348 127 361 159 391 149 C423 139 439 171 470 158 C500 146 518 170 547 151 C573 134 601 112 640 116',
    areaPath: 'M0 49 C35 54 52 79 82 73 C116 66 130 101 161 93 C191 85 205 123 237 116 C269 108 282 145 314 136 C348 127 361 159 391 149 C423 139 439 171 470 158 C500 146 518 170 547 151 C573 134 601 112 640 116 L640 210 L0 210 Z',
    touchPoints: [
      { x: 391, y: 149 },
      { x: 470, y: 158 },
    ],
    levelY: 162,
  },
  {
    id: 'link-breakout',
    symbol: 'LINKUSDT',
    exchange: 'BINANCE',
    direction: 'long',
    kind: 'Пробой сопротивления',
    stage: 'approach',
    timeframe: '5m',
    price: '16.842',
    priceChange: '+3.26%',
    level: '16.91–16.96',
    distance: '0.46%',
    touches: 3,
    formationTime: '1ч 36м',
    pullbackDepth: 'Неглубокие',
    btcStrength: '+1.9%',
    volumeAnomaly: '1.66×',
    tradesAnomaly: '1.73×',
    activity: 'Высокая',
    chartPath: 'M0 161 C42 152 60 165 92 143 C121 123 145 138 177 119 C210 99 230 118 260 96 C290 74 316 94 346 76 C378 56 396 75 428 62 C459 48 482 61 511 48 C543 33 575 46 606 35 C620 30 630 27 640 25',
    areaPath: 'M0 161 C42 152 60 165 92 143 C121 123 145 138 177 119 C210 99 230 118 260 96 C290 74 316 94 346 76 C378 56 396 75 428 62 C459 48 482 61 511 48 C543 33 575 46 606 35 C620 30 630 27 640 25 L640 210 L0 210 Z',
    touchPoints: [
      { x: 428, y: 62 },
      { x: 511, y: 48 },
      { x: 606, y: 35 },
    ],
    levelY: 31,
  },
  {
    id: 'apt-support-break',
    symbol: 'APTUSDT',
    exchange: 'BINANCE',
    direction: 'short',
    kind: 'Пробой поддержки',
    stage: 'confirmation',
    timeframe: '5m',
    price: '7.184',
    priceChange: '-2.74%',
    level: '7.12–7.16',
    distance: '0.41%',
    touches: 3,
    formationTime: '3ч 09м',
    pullbackDepth: 'Неглубокие',
    btcStrength: '-3.1%',
    volumeAnomaly: '1.92×',
    tradesAnomaly: '2.34×',
    activity: 'Высокая',
    chartPath: 'M0 42 C37 48 57 35 91 61 C122 85 143 67 174 91 C205 114 224 96 258 122 C287 144 309 127 342 151 C372 172 399 153 429 174 C457 194 485 170 515 185 C543 198 573 181 603 191 C617 196 629 199 640 201',
    areaPath: 'M0 42 C37 48 57 35 91 61 C122 85 143 67 174 91 C205 114 224 96 258 122 C287 144 309 127 342 151 C372 172 399 153 429 174 C457 194 485 170 515 185 C543 198 573 181 603 191 C617 196 629 199 640 201 L640 210 L0 210 Z',
    touchPoints: [
      { x: 342, y: 151 },
      { x: 429, y: 174 },
      { x: 515, y: 185 },
    ],
    levelY: 188,
  },
  {
    id: 'xrp-resistance-bounce',
    symbol: 'XRPUSDT',
    exchange: 'BINANCE',
    direction: 'short',
    kind: 'Отскок от сопротивления',
    stage: 'observation',
    timeframe: '15m',
    price: '0.5924',
    priceChange: '-0.86%',
    level: '0.6010–0.6032',
    distance: '1.45%',
    touches: 2,
    formationTime: '7ч 24м',
    pullbackDepth: 'Глубокие',
    btcStrength: '-1.4%',
    volumeAnomaly: '1.08×',
    tradesAnomaly: '1.17×',
    activity: 'Средняя',
    chartPath: 'M0 155 C34 147 51 118 83 129 C114 140 130 101 162 111 C194 121 210 80 241 91 C272 102 292 65 324 78 C355 91 376 58 407 73 C438 88 458 67 489 79 C521 91 541 72 572 88 C597 101 618 113 640 108',
    areaPath: 'M0 155 C34 147 51 118 83 129 C114 140 130 101 162 111 C194 121 210 80 241 91 C272 102 292 65 324 78 C355 91 376 58 407 73 C438 88 458 67 489 79 C521 91 541 72 572 88 C597 101 618 113 640 108 L640 210 L0 210 Z',
    touchPoints: [
      { x: 324, y: 78 },
      { x: 407, y: 73 },
    ],
    levelY: 68,
  },
];

export const RECENT_EVENTS: DashboardEvent[] = [
  {
    id: 'event-1',
    symbol: 'SOLUSDT',
    text: 'Переход в подтверждение: выросли объём и скорость сделок',
    time: '12 сек назад',
    tone: 'confirmation',
  },
  {
    id: 'event-2',
    symbol: 'APTUSDT',
    text: 'Цена сжалась у поддержки, продавец удерживает инициативу',
    time: '48 сек назад',
    tone: 'short',
  },
  {
    id: 'event-3',
    symbol: 'LINKUSDT',
    text: 'Расстояние до сопротивления сократилось до 0.46%',
    time: '2 мин назад',
    tone: 'approach',
  },
  {
    id: 'event-4',
    symbol: 'ETHUSDT',
    text: 'Обнаружено второе касание зоны поддержки',
    time: '5 мин назад',
    tone: 'info',
  },
];

export const COMPLETED_SETUPS: CompletedSetup[] = [
  {
    id: 'completed-1',
    symbol: 'ARBUSDT',
    direction: 'long',
    kind: 'Пробой сопротивления',
    result: 'Отработал',
    movement: '+3.8%',
    timeToTarget: '18 мин',
  },
  {
    id: 'completed-2',
    symbol: 'OPUSDT',
    direction: 'short',
    kind: 'Отскок от сопротивления',
    result: 'Отработал',
    movement: '+2.4%',
    timeToTarget: '31 мин',
  },
  {
    id: 'completed-3',
    symbol: 'SUIUSDT',
    direction: 'long',
    kind: 'Отскок от поддержки',
    result: 'Отменён',
    movement: '—',
    timeToTarget: '—',
  },
];
