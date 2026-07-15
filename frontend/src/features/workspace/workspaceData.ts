export type PrintSide = 'buy' | 'sell';
export type LiquiditySide = 'seller' | 'buyer';
export type LiquidityState = 'Стоит' | 'Увеличивается' | 'Уменьшается' | 'Исполняется' | 'Переставляется';

export type TapePrint = {
  id: string;
  time: string;
  price: string;
  size: string;
  value: string;
  side: PrintSide;
};

export type LiquidityLevel = {
  id: string;
  price: string;
  side: LiquiditySide;
  size: string;
  age: string;
  state: LiquidityState;
  fillPercent: number;
  intensity: number;
};

export const WORKSPACE_PRINTS: TapePrint[] = [
  { id: 'p-1', time: '17:32:14.428', price: '187.42', size: '84.2 SOL', value: '$15 779', side: 'buy' },
  { id: 'p-2', time: '17:32:14.221', price: '187.41', size: '31.6 SOL', value: '$5 921', side: 'buy' },
  { id: 'p-3', time: '17:32:13.982', price: '187.39', size: '18.4 SOL', value: '$3 448', side: 'sell' },
  { id: 'p-4', time: '17:32:13.710', price: '187.40', size: '47.8 SOL', value: '$8 958', side: 'buy' },
  { id: 'p-5', time: '17:32:13.514', price: '187.38', size: '12.1 SOL', value: '$2 267', side: 'sell' },
  { id: 'p-6', time: '17:32:13.286', price: '187.41', size: '109.7 SOL', value: '$20 559', side: 'buy' },
  { id: 'p-7', time: '17:32:12.971', price: '187.37', size: '23.4 SOL', value: '$4 384', side: 'sell' },
  { id: 'p-8', time: '17:32:12.743', price: '187.39', size: '66.5 SOL', value: '$12 461', side: 'buy' },
  { id: 'p-9', time: '17:32:12.511', price: '187.36', size: '14.8 SOL', value: '$2 773', side: 'sell' },
  { id: 'p-10', time: '17:32:12.304', price: '187.38', size: '52.3 SOL', value: '$9 800', side: 'buy' },
];

export const WORKSPACE_LIQUIDITY: LiquidityLevel[] = [
  { id: 'l-1', price: '188.82', side: 'seller', size: '$164K', age: '18м', state: 'Стоит', fillPercent: 4, intensity: 0.68 },
  { id: 'l-2', price: '188.54', side: 'seller', size: '$238K', age: '9м', state: 'Увеличивается', fillPercent: 7, intensity: 0.92 },
  { id: 'l-3', price: '188.26', side: 'seller', size: '$119K', age: '27м', state: 'Уменьшается', fillPercent: 19, intensity: 0.54 },
  { id: 'l-4', price: '188.10', side: 'seller', size: '$312K', age: '34м', state: 'Исполняется', fillPercent: 31, intensity: 1 },
  { id: 'l-5', price: '187.94', side: 'seller', size: '$86K', age: '6м', state: 'Переставляется', fillPercent: 12, intensity: 0.42 },
  { id: 'l-6', price: '187.21', side: 'buyer', size: '$144K', age: '14м', state: 'Стоит', fillPercent: 5, intensity: 0.62 },
  { id: 'l-7', price: '186.96', side: 'buyer', size: '$226K', age: '22м', state: 'Увеличивается', fillPercent: 8, intensity: 0.88 },
  { id: 'l-8', price: '186.70', side: 'buyer', size: '$101K', age: '11м', state: 'Исполняется', fillPercent: 24, intensity: 0.48 },
  { id: 'l-9', price: '186.42', side: 'buyer', size: '$193K', age: '41м', state: 'Стоит', fillPercent: 3, intensity: 0.76 },
];

export const MARKET_DYNAMICS = [
  { label: 'Скорость сделок', value: 'Высокая', change: '+38%', tone: 'positive' as const },
  { label: 'Дельта принтов', value: '+$184K', change: 'Покупатель', tone: 'positive' as const },
  { label: 'Объём 5m', value: '1.84×', change: 'Выше среднего', tone: 'positive' as const },
  { label: 'Корреляция с BTC', value: '0.82', change: 'Стабильная', tone: 'neutral' as const },
];

export const STAGE_FLOW = [
  { id: 'observation', label: 'Наблюдение', description: 'Зона найдена' },
  { id: 'approach', label: 'Подход', description: 'Цена у уровня' },
  { id: 'confirmation', label: 'Подтверждение', description: 'Активность растёт' },
  { id: 'triggered', label: 'Пробой', description: 'Ожидается' },
] as const;
