import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'src/app/layout/AppShell.tsx',
  'src/pages/AlertsPage.tsx',
  'src/pages/AlertsPage.module.css',
  'src/features/alerts/alertsData.ts',
  'src/shared/api/mock/nexusMockApi.ts',
  'src/shared/realtime/alertsRealtime.ts',
  'src/shared/realtime/realtimeClient.ts',
  'src/shared/realtime/useRealtimeMarketData.ts',
  'test/alerts-realtime.test.mjs',
  'test/alerts-realtime-ui.test.mjs',
];

const missingFiles = [];

for (const file of requiredFiles) {
  try {
    await access(
      resolve(
        root,
        file,
      ),
    );
  } catch {
    missingFiles.push(
      file,
    );
  }
}

const [
  shellSource,
  pageSource,
  cssSource,
  alertsDataSource,
  mockApiSource,
  helperSource,
  clientSource,
  hookSource,
  realtimeTestSource,
  uiTestSource,
  indexSource,
  tsconfigSource,
  packageSource,
] = await Promise.all([
  readFile(resolve(root, 'src/app/layout/AppShell.tsx'), 'utf8'),
  readFile(resolve(root, 'src/pages/AlertsPage.tsx'), 'utf8'),
  readFile(resolve(root, 'src/pages/AlertsPage.module.css'), 'utf8'),
  readFile(resolve(root, 'src/features/alerts/alertsData.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/api/mock/nexusMockApi.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/alertsRealtime.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/realtimeClient.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/useRealtimeMarketData.ts'), 'utf8'),
  readFile(resolve(root, 'test/alerts-realtime.test.mjs'), 'utf8'),
  readFile(resolve(root, 'test/alerts-realtime-ui.test.mjs'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/index.ts'), 'utf8'),
  readFile(resolve(root, 'tsconfig.realtime-test.json'), 'utf8'),
  readFile(resolve(root, 'package.json'), 'utf8'),
]);

const requiredMarkers = [
  'buildAlertsRealtimeView',
  'useRealtimeMarketData({',
  'symbols: realtimeSymbols',
  'realtime.status?.state ?? null',
  "backendState === 'stopped'",
  'realtimeLiveCount',
  'selectedRealtime.currentPriceLabel',
  'selectedRealtime.moveSinceAlertLabel',
  'selectedRealtime.alertPriceLabel',
  'onClick={realtime.reconnect}',
  'Binance USDⓈ-M Futures',
  'TEST DATA: события, причины, метрики и правила',
  'фиксированный сценарий интерфейса',
  'локально до перезагрузки',
  'сбрасываются после перезагрузки',
  'Тестовые правила',
  '.dataNotice',
  '.liveStatus_pending .liveDot',
  '.liveStatus_error .liveDot',
  "export * from './alertsRealtime'",
  'ALERTS',
  'INITIAL_ALERT_RULES',
  'getAlertsView',
  'test/alerts-realtime.test.mjs',
  'test/alerts-realtime-ui.test.mjs',
  '"verify:alerts-realtime"',
  'marks a stopped Alerts backend as an error',
];

const corpus = [
  shellSource,
  pageSource,
  cssSource,
  alertsDataSource,
  mockApiSource,
  helperSource,
  clientSource,
  hookSource,
  realtimeTestSource,
  uiTestSource,
  indexSource,
  tsconfigSource,
  packageSource,
].join('\n');

const missingMarkers =
  requiredMarkers.filter(
    (marker) =>
      !corpus.includes(
        marker,
      ),
  );

const pageLegacyMarkers = [
  'Сработали сегодня',
];

const shellLegacyMarkers = [
  'AI ANALYSIS',
];

const presentLegacyMarkers = [
  ...pageLegacyMarkers.filter(
    (marker) =>
      pageSource.includes(
        marker,
      ),
  ),
  ...shellLegacyMarkers.filter(
    (marker) =>
      shellSource.includes(
        marker,
      ),
  ),
];

const realtimeHookCount =
  pageSource.match(
    /useRealtimeMarketData\(/gu,
  )?.length
  ?? 0;

if (
  missingFiles.length > 0
  || missingMarkers.length > 0
  || presentLegacyMarkers.length > 0
  || realtimeHookCount !== 1
) {
  if (missingFiles.length > 0) {
    console.error(
      `Missing Alerts files: ${missingFiles.join(', ')}`,
    );
  }

  if (missingMarkers.length > 0) {
    console.error(
      `Missing Alerts integrity markers: ${missingMarkers.join(', ')}`,
    );
  }

  if (presentLegacyMarkers.length > 0) {
    console.error(
      `Legacy Alerts markers remain: ${presentLegacyMarkers.join(', ')}`,
    );
  }

  if (realtimeHookCount !== 1) {
    console.error(
      `Expected one Alerts realtime hook, found ${realtimeHookCount}`,
    );
  }

  process.exitCode = 1;
} else {
  console.log(
    'NEXUS frontend verified: Alerts Data Integrity v0.1 is present.',
  );
}