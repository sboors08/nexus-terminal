export const TRADING_PRESET_IDS = [
  'scalping',
  'intraday',
  'swing',
] as const;

export type TradingPreset = (typeof TRADING_PRESET_IDS)[number];

export const SCANNER_WINDOWS = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '12h',
  '1d',
  '3d',
] as const;

export type ScannerWindow = (typeof SCANNER_WINDOWS)[number];

export const CHART_TIMEFRAMES = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '12h',
  '1d',
  '1w',
] as const;

export type ChartTimeframe = (typeof CHART_TIMEFRAMES)[number];

export type TradingPresetDefinition = {
  label: string;
  scannerWindows: readonly ScannerWindow[];
  chartTimeframes: readonly ChartTimeframe[];
  defaultScannerWindow: ScannerWindow;
  defaultChartTimeframe: ChartTimeframe;
};

export const TRADING_PRESETS = {
  scalping: {
    label: 'Скальпинг',
    scannerWindows: ['1m', '3m', '5m', '15m'],
    chartTimeframes: ['1m', '3m', '5m', '15m'],
    defaultScannerWindow: '1m',
    defaultChartTimeframe: '1m',
  },
  intraday: {
    label: 'Интрадей',
    scannerWindows: ['5m', '15m', '30m', '1h', '4h'],
    chartTimeframes: ['5m', '15m', '30m', '1h', '4h'],
    defaultScannerWindow: '15m',
    defaultChartTimeframe: '15m',
  },
  swing: {
    label: 'Свинг',
    scannerWindows: ['1h', '4h', '12h', '1d', '3d'],
    chartTimeframes: ['1h', '4h', '12h', '1d', '1w'],
    defaultScannerWindow: '4h',
    defaultChartTimeframe: '4h',
  },
} as const satisfies Record<TradingPreset, TradingPresetDefinition>;

export function isTradingPreset(value: string | null): value is TradingPreset {
  return value !== null && TRADING_PRESET_IDS.includes(value as TradingPreset);
}

export function isScannerWindow(value: string | null): value is ScannerWindow {
  return value !== null && SCANNER_WINDOWS.includes(value as ScannerWindow);
}

export function isChartTimeframe(value: string | null): value is ChartTimeframe {
  return value !== null && CHART_TIMEFRAMES.includes(value as ChartTimeframe);
}

export function getTradingPresetDefinition(
  preset: TradingPreset,
): TradingPresetDefinition {
  return TRADING_PRESETS[preset];
}
