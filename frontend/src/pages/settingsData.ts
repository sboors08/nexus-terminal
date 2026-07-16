export type SettingsPresetId = 'scalping' | 'intraday' | 'swing' | 'custom';
export type SettingsGroupId =
  | 'general'
  | 'setups'
  | 'levels'
  | 'indicators'
  | 'notifications'
  | 'integrations'
  | 'appearance';

export type PrimaryTimeframe = '1m' | '5m' | '15m' | '1h';
export type PullbackDepth = 'any' | 'shallow' | 'deep';
export type ExternalTerminal = 'none' | 'tiger' | 'cscalp' | 'atas';

export interface NexusSettings {
  primaryTimeframe: PrimaryTimeframe;
  additionalTimeframes: PrimaryTimeframe[];

  breakoutEnabled: boolean;
  bounceEnabled: boolean;
  longEnabled: boolean;
  shortEnabled: boolean;

  levelTolerancePct: number;
  minTouches: number;
  pullbackDepth: PullbackDepth;
  formationMinutes: number;

  minLevelStrength: number;
  minActivity: number;
  useVolumeAnomaly: boolean;
  useTradesAnomaly: boolean;
  useBtcContext: boolean;

  notifyNearLevel: boolean;
  notifyConfirmation: boolean;
  notifyPrints: boolean;
  notifyLiquidity: boolean;
  notifyTriggered: boolean;
  notifyInvalidated: boolean;
  soundEnabled: boolean;

  externalTerminal: ExternalTerminal;
  autoOpenWorkspace: boolean;

  compactMode: boolean;
  showTooltips: boolean;
  reduceMotion: boolean;
}

export interface SettingsPreset {
  id: Exclude<SettingsPresetId, 'custom'>;
  name: string;
  description: string;
  badge: string;
  settings: NexusSettings;
}

export const SETTINGS_GROUPS: Array<{
  id: SettingsGroupId;
  shortLabel: string;
  title: string;
  description: string;
}> = [
  {
    id: 'general',
    shortLabel: 'ОБ',
    title: 'Общие',
    description: 'Таймфреймы и базовый режим работы терминала.',
  },
  {
    id: 'setups',
    shortLabel: 'СЕ',
    title: 'Сетапы',
    description: 'Типы торговых ситуаций и направления поиска.',
  },
  {
    id: 'levels',
    shortLabel: 'УР',
    title: 'Уровни',
    description: 'Допуск зоны, касания, откаты и время формирования.',
  },
  {
    id: 'indicators',
    shortLabel: 'ИН',
    title: 'Индикаторы',
    description: 'Активность, сила уровня и BTC-контекст.',
  },
  {
    id: 'notifications',
    shortLabel: 'УВ',
    title: 'Уведомления',
    description: 'События, которые требуют внимания трейдера.',
  },
  {
    id: 'integrations',
    shortLabel: 'ИТ',
    title: 'Интеграции',
    description: 'Биржа, внешний терминал и будущие подключения.',
  },
  {
    id: 'appearance',
    shortLabel: 'ВИ',
    title: 'Внешний вид',
    description: 'Плотность интерфейса, подсказки и анимация.',
  },
];

export const SETTINGS_PRESETS: SettingsPreset[] = [
  {
    id: 'scalping',
    name: 'Скальпинг',
    description: 'Быстрые ситуации на 1–5 минутах с повышенной чувствительностью.',
    badge: 'Быстро',
    settings: {
      primaryTimeframe: '1m',
      additionalTimeframes: ['5m', '15m'],
      breakoutEnabled: true,
      bounceEnabled: true,
      longEnabled: true,
      shortEnabled: true,
      levelTolerancePct: 0.3,
      minTouches: 2,
      pullbackDepth: 'shallow',
      formationMinutes: 30,
      minLevelStrength: 55,
      minActivity: 1.3,
      useVolumeAnomaly: true,
      useTradesAnomaly: true,
      useBtcContext: true,
      notifyNearLevel: true,
      notifyConfirmation: true,
      notifyPrints: true,
      notifyLiquidity: true,
      notifyTriggered: true,
      notifyInvalidated: true,
      soundEnabled: true,
      externalTerminal: 'cscalp',
      autoOpenWorkspace: false,
      compactMode: true,
      showTooltips: true,
      reduceMotion: false,
    },
  },
  {
    id: 'intraday',
    name: 'Интрадей',
    description: 'Сбалансированный режим для внутридневных сетапов.',
    badge: 'Рекомендуется',
    settings: {
      primaryTimeframe: '5m',
      additionalTimeframes: ['1m', '15m', '1h'],
      breakoutEnabled: true,
      bounceEnabled: true,
      longEnabled: true,
      shortEnabled: true,
      levelTolerancePct: 0.4,
      minTouches: 3,
      pullbackDepth: 'any',
      formationMinutes: 120,
      minLevelStrength: 65,
      minActivity: 1.5,
      useVolumeAnomaly: true,
      useTradesAnomaly: true,
      useBtcContext: true,
      notifyNearLevel: true,
      notifyConfirmation: true,
      notifyPrints: true,
      notifyLiquidity: true,
      notifyTriggered: true,
      notifyInvalidated: true,
      soundEnabled: true,
      externalTerminal: 'none',
      autoOpenWorkspace: false,
      compactMode: false,
      showTooltips: true,
      reduceMotion: false,
    },
  },
  {
    id: 'swing',
    name: 'Свинг',
    description: 'Более крупные уровни и спокойная фильтрация рыночного шума.',
    badge: 'Спокойно',
    settings: {
      primaryTimeframe: '1h',
      additionalTimeframes: ['15m'],
      breakoutEnabled: true,
      bounceEnabled: true,
      longEnabled: true,
      shortEnabled: true,
      levelTolerancePct: 0.5,
      minTouches: 3,
      pullbackDepth: 'deep',
      formationMinutes: 720,
      minLevelStrength: 75,
      minActivity: 1.8,
      useVolumeAnomaly: true,
      useTradesAnomaly: false,
      useBtcContext: true,
      notifyNearLevel: true,
      notifyConfirmation: true,
      notifyPrints: false,
      notifyLiquidity: false,
      notifyTriggered: true,
      notifyInvalidated: true,
      soundEnabled: false,
      externalTerminal: 'none',
      autoOpenWorkspace: false,
      compactMode: false,
      showTooltips: true,
      reduceMotion: true,
    },
  },
];

export const DEFAULT_SETTINGS = SETTINGS_PRESETS[1].settings;

export function cloneSettings(settings: NexusSettings): NexusSettings {
  return {
    ...settings,
    additionalTimeframes: [...settings.additionalTimeframes],
  };
}
