import {
  access,
  readFile,
} from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

const requiredMarkersByFile = {
  'src/shared/config/tradingPresets.ts': [
    'TRADING_PRESET_IDS',
    'TradingPreset',
    'SCANNER_WINDOWS',
    'ScannerWindow',
    'CHART_TIMEFRAMES',
    'ChartTimeframe',
    'TradingPresetDefinition',
    'TRADING_PRESETS',
    'scalping:',
    'intraday:',
    'swing:',
    "defaultScannerWindow: '1m'",
    "defaultScannerWindow: '15m'",
    "defaultScannerWindow: '4h'",
    "scannerWindows: ['1m', '3m', '5m', '15m']",
    "scannerWindows: ['5m', '15m', '30m', '1h', '4h']",
    "scannerWindows: ['1h', '4h', '12h', '1d', '3d']",
    "chartTimeframes: ['1h', '4h', '12h', '1d', '1w']",
    'isTradingPreset',
    'isScannerWindow',
    'isChartTimeframe',
    'getTradingPresetDefinition',
  ],
  'src/pages/ScannerPage.tsx': [
    "const requestedPreset = searchParams.get('preset');",
    "const requestedScannerWindow = searchParams.get('scannerWindow');",
    'to={buildWorkspaceUrl(',
    'preset,',
    'scannerWindow,',
  ],
  'src/pages/WorkspacePage.tsx': [
    "const requestedPreset = searchParams.get('preset');",
    "const requestedScannerWindow = searchParams.get('scannerWindow');",
    'buildCanonicalWorkspaceSearchParams(',
    'preset,',
    'scannerWindow,',
    'buildSetupSelectionUrl(ROUTES.scanner, contractSetup.id, {',
    'buildReplayUrl(',
    'ROUTES.replay',
  ],
  'src/shared/routing/setupContext.ts': [
    'preset?: string | null;',
    'scannerWindow?: string | null;',
    "if (context.preset) params.set('preset', context.preset);",
    "if (context.scannerWindow) params.set('scannerWindow', context.scannerWindow);",
    "context: Omit<SetupRouteContext, 'setupId'> = {},",
  ],
};

const forbiddenMarkersByFile = {
  'src/pages/ScannerPage.tsx': [
    'TRADING_PRESET_IDS.map((value) => (',
    'presetDefinition.scannerWindows.map((value) => (',
    'aria-label="Торговый пресет Scanner"',
    'aria-label="Период анализа Scanner"',
  ],
  'src/pages/ScannerPage.module.css': [
    '.presetFilter {',
    '.presetControl {',
    '.scannerWindowControl {',
  ],
};

const missingFiles = [];
const missingMarkers = [];
const forbiddenMarkers = [];

for (const [file, markers] of Object.entries(requiredMarkersByFile)) {
  const absolutePath = resolve(root, file);

  try {
    await access(absolutePath);
  } catch {
    missingFiles.push(file);
    continue;
  }

  const source = await readFile(absolutePath, 'utf8');

  for (const marker of markers) {
    if (!source.includes(marker)) {
      missingMarkers.push(`${file}: ${marker}`);
    }
  }
}

for (const [file, markers] of Object.entries(forbiddenMarkersByFile)) {
  const absolutePath = resolve(root, file);

  try {
    await access(absolutePath);
  } catch {
    missingFiles.push(file);
    continue;
  }

  const source = await readFile(absolutePath, 'utf8');

  for (const marker of markers) {
    if (source.includes(marker)) {
      forbiddenMarkers.push(`${file}: ${marker}`);
    }
  }
}

if (
  missingFiles.length > 0
  || missingMarkers.length > 0
  || forbiddenMarkers.length > 0
) {
  if (missingFiles.length > 0) {
    console.error(
      'Missing trading preset files: '
      + missingFiles.join(', '),
    );
  }

  if (missingMarkers.length > 0) {
    console.error(
      'Missing trading preset markers:\n'
      + missingMarkers.map((marker) => `- ${marker}`).join('\n'),
    );
  }

  if (forbiddenMarkers.length > 0) {
    console.error(
      'Disconnected Scanner preset markers are still present:\n'
      + forbiddenMarkers.map((marker) => `- ${marker}`).join('\n'),
    );
  }

  process.exit(1);
}

console.log(
  'NEXUS frontend verified: Trading Presets remain in route context while disconnected Scanner controls are absent.',
);
