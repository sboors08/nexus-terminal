import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readSource(path) {
  return readFileSync(
    new URL(path, import.meta.url),
    'utf8',
  ).replace(/\r\n/g, '\n');
}

const scannerSource = readSource('../src/pages/ScannerPage.tsx');
const scannerStyles = readSource('../src/pages/ScannerPage.module.css');
const workspaceSource = readSource('../src/pages/WorkspacePage.tsx');
const dashboardSource = readSource('../src/pages/DashboardPage.tsx');

test('keeps the primary Scanner filters visible and preserves advanced filter state while collapsed', () => {
  for (const label of [
    'Инструмент',
    'Объём 24ч от, млн',
    'Направление',
    'Тип сетапа',
    'Стадия',
    'Таймфрейм графика',
    'Сбросить',
  ]) {
    assert.match(scannerSource, new RegExp(label, 'u'));
  }

  assert.match(
    scannerSource,
    /const \[advancedFiltersOpen, setAdvancedFiltersOpen\] = useState\(false\)/u,
  );
  assert.match(
    scannerSource,
    /aria-expanded=\{advancedFiltersOpen\}[\s\S]*?setAdvancedFiltersOpen\(\(open\) => !open\)/u,
  );
  assert.match(
    scannerSource,
    /advancedFiltersOpen \? \([\s\S]*?value=\{distance\}[\s\S]*?value=\{touches\}[\s\S]*?value=\{btcStrength\}/u,
  );
  assert.match(
    scannerSource,
    /const advancedFilterCount = \[[\s\S]*?distance !== 'all'[\s\S]*?touches !== 'all'[\s\S]*?btcStrength !== 'all'/u,
  );
  assert.doesNotMatch(
    scannerSource,
    /setAdvancedFiltersOpen\(false\)[\s\S]*?setDistance\('all'\)/u,
  );
});

test('renders compact candidate cards by setup id without placeholder metric rows', () => {
  assert.match(
    scannerSource,
    /filteredSetups\.map\(\(setup\) => \{[\s\S]*?key=\{setup\.id\}[\s\S]*?data-setup-id=\{setup\.id\}/u,
  );
  assert.match(scannerSource, /data-direction=\{setup\.direction\}/u);
  assert.doesNotMatch(scannerSource, /new Map<[\s\S]*?setup\.symbol/u);
  assert.match(
    scannerSource,
    /levelCenterLabel \? \([\s\S]*?snapshotDistanceLabel \? \([\s\S]*?setup\.btcStrength !== null \? \(/u,
  );
  assert.match(scannerStyles, /\.tableRow \{[\s\S]*?min-height: 88px/u);
  assert.match(
    scannerStyles,
    /\.tableRowSelected \{[\s\S]*?border-color: var\(--nexus-color-accent-primary\)[\s\S]*?background:/u,
  );
  assert.match(scannerSource, /data-testid="scanner-card-symbol"/u);
  assert.match(scannerSource, /className=\{styles\.cardDirectionBadge\}/u);
  assert.match(scannerSource, /className=\{styles\.cardStageBadge\}/u);
  assert.match(
    scannerStyles,
    /\.cardPrimaryRow \.instrumentCell\s*\{[\s\S]*?grid-template-columns:\s*22px minmax\(52px, 1fr\)/u,
  );
  assert.match(
    scannerStyles,
    /\.cardPrimaryRow \.instrumentCell strong\s*\{[\s\S]*?min-width:\s*52px;[\s\S]*?text-overflow:\s*clip;/u,
  );
  assert.match(
    scannerStyles,
    /\.cardStageBadge > span\s*\{[\s\S]*?font-size:\s*7px;/u,
  );
});

test('keeps current distance separate from the Setup Engine snapshot', () => {
  assert.match(
    scannerSource,
    /buildScannerSetupDistanceView\([\s\S]*?selectedSetup,[\s\S]*?price:\s*realtimeMarket\.price,[\s\S]*?updatedAt:\s*realtimeMarket\.updatedAt/u,
  );
  assert.match(scannerSource, /Расстояние до centerPrice/u);
  assert.match(scannerSource, /Снимок Setup Engine/u);
  assert.match(scannerSource, /До уровня · снимок/u);
});

test('uses causal levels only in the Scanner chart and removes duplicate Scanner panels', () => {
  assert.match(
    scannerSource,
    /buildSelectedSetupHorizontalSegments\([\s\S]*?causalLevelLines[\s\S]*?\.horizontalSegments/u,
  );
  assert.match(scannerSource, /horizontalSegments=\{chartHorizontalSegments\}/u);
  assert.doesNotMatch(scannerSource, /CausalLevelStateStrip/u);
  assert.doesNotMatch(scannerSource, /aria-label=\{`Последние сделки/u);
  assert.doesNotMatch(scannerSource, /aria-label="Всплески объёма"/u);
  assert.doesNotMatch(scannerSource, />ВСПЛЕСКИ ОБЪЁМА</u);

  assert.match(workspaceSource, /buildWorkspaceTradeTape/u);
  assert.match(dashboardSource, /useMarketVolumeSpikes/u);
  assert.match(dashboardSource, /ВСПЛЕСКИ ОБЪЁМА/u);
});

test('places setup actions inside the scrollable context and hides the floating dock', () => {
  assert.match(
    scannerSource,
    /const \{ openSetupFeedback \} = useFeedbackPageContext\([\s\S]*?dock: 'hidden'/u,
  );
  assert.match(
    scannerSource,
    /className=\{styles\.nexusColumn\}[\s\S]*?Открыть Workspace[\s\S]*?onClick=\{openSetupFeedback\}[\s\S]*?Оценить сетап/u,
  );
  assert.match(
    scannerStyles,
    /\.nexusColumn \{[\s\S]*?overflow-y: auto/u,
  );
});

test('constrains the desktop Scanner to the viewport with independent candidate and context scrolling', () => {
  assert.match(
    scannerStyles,
    /@media \(min-width: 1280px\) \{[\s\S]*?\.scanner \{[\s\S]*?height: calc\(100dvh - 80px\)[\s\S]*?overflow: hidden/u,
  );
  assert.match(
    scannerStyles,
    /\.scannerGrid \{[\s\S]*?grid-template-columns: minmax\(244px, 282px\) minmax\(0, 1fr\)[\s\S]*?overflow: hidden/u,
  );
  assert.match(
    scannerStyles,
    /\.tableBody \{[\s\S]*?overflow-x: hidden;[\s\S]*?overflow-y: auto/u,
  );
  assert.match(
    scannerStyles,
    /\.previewPanel \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(252px, 304px\)/u,
  );
  assert.match(
    scannerStyles,
    /\.chartColumn \{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\)/u,
  );
  assert.match(
    scannerStyles,
    /\.symbolLine h2 \{[\s\S]*?overflow-wrap: normal;[\s\S]*?white-space: nowrap;/u,
  );
});

test('opening advanced filters does not key or remount the main candlestick chart', () => {
  const chartStart = scannerSource.indexOf('<NexusCandlestickChart');
  const chartEnd = scannerSource.indexOf('/>', chartStart);
  const chartBlock = scannerSource.slice(chartStart, chartEnd);

  assert.ok(chartStart >= 0);
  assert.doesNotMatch(chartBlock, /key=/u);
  assert.doesNotMatch(chartBlock, /advancedFiltersOpen/u);
  assert.match(chartBlock, /drawingScope=\{`scanner:\$\{selectedSymbol\}:\$\{chartTimeframe\}`\}/u);
});

test('binds setup, candles, causal levels, realtime price and context to one selected symbol', () => {
  assert.match(
    scannerSource,
    /const selectedSetup = useMemo\([\s\S]*?setup\.id === requestedSetupId/u,
  );
  assert.match(
    scannerSource,
    /const selectedSymbol = requestedSymbol \?\? selectedSetup\.symbol/u,
  );
  for (const binding of [
    /useMarketCandles\(\{[\s\S]*?symbol: selectedSymbol/u,
    /useCausalLevelLines\(\{[\s\S]*?symbol: selectedSymbol/u,
    /useRealtimeMarketData\(\{[\s\S]*?symbol:\s*selectedSymbol/u,
    /const realtimeSnapshot = realtime\.snapshots\[selectedSymbol\]/u,
    /buildScannerSetupDistanceView\([\s\S]*?selectedSetup,[\s\S]*?price:\s*realtimeMarket\.price/u,
    /<NexusCandlestickChart[\s\S]*?symbol=\{selectedSymbol\}[\s\S]*?horizontalSegments=\{chartHorizontalSegments\}/u,
    /data-testid="scanner-context-panel"[\s\S]*?selectedSetup\.kind/u,
  ]) {
    assert.match(scannerSource, binding);
  }
  assert.match(
    scannerSource,
    /nextParams\.set\('setupId', setupId\);[\s\S]*?nextParams\.delete\('symbol'\)/u,
  );
});
