import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const readSource = (relativePath) => fs.readFileSync(
  new URL(relativePath, import.meta.url),
  'utf8',
);

const readTree = (relativePath) => {
  const directory = new URL(relativePath, import.meta.url);
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.map((entry) => {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    return entry.isDirectory()
      ? readTree(child)
      : /\.(?:css|tsx?)$/u.test(entry.name)
        ? fs.readFileSync(child, 'utf8')
        : '';
  }).join('\n');
};

const tokens = readSource('../src/styles/tokens.css');
const reset = readSource('../src/styles/reset.css');
const appShellCss = readSource('../src/app/layout/AppShell.module.css');
const dashboardSource = readSource('../src/pages/DashboardPage.tsx');
const dashboardCss = readSource('../src/pages/DashboardPage.module.css');
const radarSource = readSource('../src/pages/DashboardLevelRadar.tsx');
const scannerSource = readSource('../src/pages/ScannerPage.tsx');
const scannerCss = readSource('../src/pages/ScannerPage.module.css');
const workspaceSource = readSource('../src/pages/WorkspacePage.tsx');
const workspaceCss = readSource('../src/pages/WorkspacePage.module.css');
const marketCss = readSource('../src/pages/MarketPage.module.css');
const feedbackCss = readSource('../src/shared/feedback/FeedbackProvider.module.css');
const tradingBadgesCss = readSource('../src/shared/ui/TradingBadges.module.css');
const levelLinesSource = readSource('../src/shared/level-lines/model/causalLevelLines.ts');
const chartSource = readSource('../src/shared/charts/ui/NexusCandlestickChart.tsx');
const frontendSource = readTree('../src/');

test('defines turquoise as the single global interface accent without changing trading colors', () => {
  assert.match(tokens, /--nexus-color-accent-primary:\s*#22d3c5;/iu);
  assert.match(tokens, /--nexus-color-accent-hover:/u);
  assert.match(tokens, /--nexus-color-accent-active:/u);
  assert.match(tokens, /--nexus-color-accent-border:/u);
  assert.match(tokens, /--nexus-color-accent-muted:/u);
  assert.match(tokens, /--nexus-color-accent-glow:/u);
  assert.match(tokens, /--nexus-color-focus-ring:\s*var\(--nexus-color-accent-primary\)/u);
  assert.match(reset, /::selection[\s\S]*?var\(--nexus-color-accent-muted\)/u);

  assert.match(tokens, /--nexus-color-long:\s*#32d583;/u);
  assert.match(tokens, /--nexus-color-short:\s*#ff6273;/u);
  assert.match(tokens, /--nexus-color-stage-approach:\s*#f4c95d;/u);
  assert.match(tradingBadgesCss, /var\(--nexus-color-long\)/u);
  assert.match(tradingBadgesCss, /var\(--nexus-color-short\)/u);
  assert.match(levelLinesSource, /support:\s*'#32d583'/u);
  assert.match(levelLinesSource, /resistance:\s*'#ff6273'/u);
  assert.equal((frontendSource.match(/#22d3c5/giu) ?? []).length, 1);

  assert.match(appShellCss, /terminalLinkActive[\s\S]*?var\(--nexus-color-accent-primary\)/u);
  assert.doesNotMatch(appShellCss, /#35df8d|rgb\(53 223 141/iu);
});

test('uses the available Dashboard width and keeps the five required working modules', () => {
  assert.doesNotMatch(dashboardCss, /max-width:\s*1600px/u);
  assert.match(dashboardCss, /\.dashboard\s*\{[\s\S]*?max-width:\s*none;/u);
  assert.match(dashboardCss, /\.dashboard\s*\{[\s\S]*?grid-template-columns:\s*repeat\(12,/u);
  assert.match(dashboardCss, /\.hotCards\s*\{[\s\S]*?repeat\(5,/u);
  assert.match(dashboardCss, /\.scannerTable\s*\{[\s\S]*?overflow:\s*auto;/u);
  assert.match(dashboardCss, /\.levelRadarTable\s*\{[\s\S]*?overflow:\s*auto;/u);
  assert.match(dashboardCss, /\.dashboardVolumeSpikesTable\s*\{[\s\S]*?overflow:\s*auto;/u);
  assert.match(feedbackCss, /\.feedbackDock\s*\{[\s\S]*?left:\s*10px;/u);
  assert.match(feedbackCss, /\.feedbackDock\s*\{[\s\S]*?bottom:\s*12px;/u);

  assert.match(dashboardSource, /BTC MARKET MODE/u);
  assert.match(dashboardSource, /HOT LIST/u);
  assert.match(dashboardSource, /MARKET SCANNER/u);
  assert.match(dashboardSource, /<DashboardLevelRadar/u);
  assert.match(dashboardSource, /ВСПЛЕСКИ ОБЪЁМА/u);
  assert.match(radarSource, /NEXUS LEVEL RADAR/u);
});

test('removes only the Dashboard causal strip while preserving chart Level Lines', () => {
  assert.doesNotMatch(dashboardSource, /CausalLevelStateStrip/u);
  assert.match(
    dashboardSource,
    /<NexusCandlestickChart[\s\S]*?symbol=\{[\s\S]*?dashboardChartSymbol[\s\S]*?horizontalSegments=\{[\s\S]*?dashboardLevelLines[\s\S]*?\.horizontalSegments/u,
  );
  assert.match(dashboardSource, /useCausalLevelLines/u);
  assert.match(dashboardSource, /dashboardCandlesQuery/u);
  assert.match(dashboardSource, /dashboardChartRealtime/u);
});

test('keeps Scanner and Workspace layouts while applying the shared accent', () => {
  assert.match(scannerSource, /data-scanner-layout="focus"/u);
  assert.doesNotMatch(scannerSource, /CausalLevelStateStrip/u);
  assert.match(scannerSource, /horizontalSegments=\{chartHorizontalSegments\}/u);
  assert.match(scannerCss, /var\(--nexus-color-accent-primary\)/u);

  assert.match(workspaceSource, /className=\{styles\.workspaceGrid\}/u);
  assert.doesNotMatch(workspaceSource, /CausalLevelStateStrip/u);
  assert.match(workspaceSource, /Лента/u);
  assert.match(workspaceSource, /Карта/u);
  assert.match(workspaceSource, /Динамика/u);
  assert.match(workspaceCss, /var\(--nexus-color-accent-primary\)/u);
  assert.match(marketCss, /--market-accent:\s*var\(--nexus-color-accent-primary\)/u);
});

test('preserves the shared chart lifecycle contract', () => {
  assert.equal((chartSource.match(/createChart\(/gu) ?? []).length, 1);
  assert.equal((chartSource.match(/new ResizeObserver/gu) ?? []).length, 1);
  assert.match(chartSource, /resizeObserver\.disconnect\(\)/u);
  assert.match(chartSource, /chart\.remove\(\)/u);
});
