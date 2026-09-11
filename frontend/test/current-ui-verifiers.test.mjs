import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('Market verifier requires the current chart, selection, realtime and Workspace contracts', () => {
  const source = read('../scripts/verify-market-realtime.mjs');
  for (const marker of [
    '<NexusCandlestickChart',
    'horizontalSegments=',
    'setSelectedSymbol(',
    'realtime.snapshots[selected.symbol]',
    'buildMarketWorkspaceUrl(',
  ]) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  assert.doesNotMatch(source, /realtimeMarket\.bidLabel|\.realtimeStrip/u);
});

test('Volume Spikes verifier requires Dashboard UI and the shared runtime contract', () => {
  const source = read('../scripts/verify-market-volume-spikes-ui.mjs');
  for (const marker of [
    'src/pages/DashboardPage.tsx',
    'data-testid="dashboard-volume-spikes"',
    'useMarketVolumeSpikes',
    'MARKET_VOLUME_SPIKES_PATH',
    'builds a URL with volume spike filters',
  ]) assert.ok(source.includes(marker), `missing verifier marker: ${marker}`);
  assert.ok(source.includes("doesNotMatch") || source.includes('forbidden'));
});

test('Workspace verifier requires the accepted compact layout and causal chart path', () => {
  const source = read('../scripts/verify-workspace-integrity.mjs');
  for (const marker of [
    'data-workspace-header="compact"',
    'horizontalSegments={causalLevelLines.horizontalSegments}',
    'Лента принтов',
    '<NexusLiquidationHeatmap',
    'Динамика рынка',
    'styles.nexusPanel',
  ]) assert.ok(source.includes(marker), `missing verifier marker: ${marker}`);
  assert.ok(source.includes('CausalLevelStateStrip'));
});

test('Futures verifier follows the current Scanner chart overlay', () => {
  const source = read('../scripts/verify-futures-metrics-terminal.mjs');
  assert.ok(source.includes('src/pages/ScannerChartMarketOverlay.tsx'));
  assert.ok(source.includes('latestLiquidation.side.toUpperCase()'));
  assert.ok(source.includes('Mark Price'));
  assert.ok(source.includes('Open Interest'));
});
