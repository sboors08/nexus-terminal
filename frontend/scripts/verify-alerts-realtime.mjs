import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'src/app/layout/AppShell.tsx',
  'src/pages/AlertsPage.tsx',
  'src/pages/AlertsPage.module.css',
  'src/shared/alerts/alertsRuntimeView.ts',
  'src/shared/api/runtime/alertsRuntimeApi.ts',
  'src/shared/realtime/alertsRealtime.ts',
  'test/alerts-runtime-api.test.mjs',
  'test/alerts-runtime-view.test.mjs',
  'test/alerts-runtime-ui.test.mjs',
  'test/alerts-realtime.test.mjs',
  'test/alerts-realtime-ui.test.mjs',
];

const missingFiles = [];
for (const file of requiredFiles) {
  try {
    await access(resolve(root, file));
  } catch {
    missingFiles.push(file);
  }
}

const [pageSource, cssSource, apiSource, viewSource, packageSource] = await Promise.all([
  readFile(resolve(root, 'src/pages/AlertsPage.tsx'), 'utf8'),
  readFile(resolve(root, 'src/pages/AlertsPage.module.css'), 'utf8'),
  readFile(resolve(root, 'src/shared/api/runtime/alertsRuntimeApi.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/alerts/alertsRuntimeView.ts'), 'utf8'),
  readFile(resolve(root, 'package.json'), 'utf8'),
]);

const requiredMarkers = [
  'fetchAlertsRuntimeView({ limit: 500 })',
  'intervalMs: 5_000',
  'preserveData: true',
  'createAlertRule(input)',
  'updateAlertRule(editingRuleId, input)',
  'setAlertRuleEnabled(rule.id, !rule.enabled)',
  'RUNTIME ONLY',
  'Alerts runtime недоступен',
  'buildMarketWorkspaceUrl',
  'AlertsRuntimeApiError',
  'ALERTS_META_PATH',
  'mapAlertTriggerToView',
  '.runtimeStatus_running',
  '.ruleForm',
  '"test:alerts-runtime"',
];

const corpus = [pageSource, cssSource, apiSource, viewSource, packageSource].join('\n');
const missingMarkers = requiredMarkers.filter((marker) => !corpus.includes(marker));
const forbiddenPageMarkers = [
  'nexusApi.getAlertsView',
  'TEST DATA',
  'Тестовые правила',
  'фиксированный сценарий интерфейса',
];
const presentForbiddenMarkers = forbiddenPageMarkers.filter((marker) => pageSource.includes(marker));
const realtimeHookCount = pageSource.match(/useRealtimeMarketData\(/gu)?.length ?? 0;

if (
  missingFiles.length > 0
  || missingMarkers.length > 0
  || presentForbiddenMarkers.length > 0
  || realtimeHookCount !== 1
) {
  if (missingFiles.length > 0) console.error(`Missing Alerts files: ${missingFiles.join(', ')}`);
  if (missingMarkers.length > 0) console.error(`Missing Alerts runtime markers: ${missingMarkers.join(', ')}`);
  if (presentForbiddenMarkers.length > 0) console.error(`Forbidden Alerts mock markers remain: ${presentForbiddenMarkers.join(', ')}`);
  if (realtimeHookCount !== 1) console.error(`Expected one Alerts realtime hook, found ${realtimeHookCount}`);
  process.exitCode = 1;
} else {
  console.log('NEXUS frontend verified: Alerts Frontend Runtime Integration v0.1 is present.');
}
