import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pageSource = fs.readFileSync(new URL('../src/pages/AlertsPage.tsx', import.meta.url), 'utf8');
const apiSource = fs.readFileSync(new URL('../src/shared/api/runtime/alertsRuntimeApi.ts', import.meta.url), 'utf8');

test('loads Alerts from runtime contracts and polls trigger history safely', () => {
  assert.match(pageSource, /fetchAlertsRuntimeView\(\{ limit: 500 \}\)/u);
  assert.match(pageSource, /intervalMs: 5_000/u);
  assert.match(pageSource, /preserveData: true/u);
  assert.doesNotMatch(pageSource, /nexusApi\.getAlertsView/u);
  assert.doesNotMatch(pageSource, /TEST DATA/u);
});

test('uses backend mutations for create, update and enabled actions', () => {
  assert.match(pageSource, /createAlertRule\(input\)/u);
  assert.match(pageSource, /updateAlertRule\(editingRuleId, input\)/u);
  assert.match(pageSource, /setAlertRuleEnabled\(rule\.id, !rule\.enabled\)/u);
  assert.match(apiSource, /ALERTS_RULES_PATH/u);
  assert.match(apiSource, /encodeURIComponent\(normalized\)/u);
});

test('labels persistence and session-only read state explicitly', () => {
  assert.match(pageSource, /RUNTIME ONLY/u);
  assert.match(pageSource, /сбрасываются при перезапуске backend/u);
  assert.match(pageSource, /только в этой вкладке/u);
  assert.match(pageSource, /Alerts runtime недоступен/u);
});
