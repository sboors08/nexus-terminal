import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readSource(relativePath) {
  return readFileSync(
    new URL(relativePath, import.meta.url),
    'utf8',
  ).replace(/\r\n/g, '\n');
}

const workspaceSource = readSource(
  '../src/pages/WorkspacePage.tsx',
);
const workspaceStyles = readSource(
  '../src/pages/WorkspacePage.module.css',
);
const heatmapSource = readSource(
  '../src/shared/charts/ui/NexusLiquidationHeatmap.tsx',
);
const heatmapStyles = readSource(
  '../src/shared/charts/ui/NexusLiquidationHeatmap.module.css',
);
const chartSource = readSource(
  '../src/shared/charts/ui/NexusCandlestickChart.tsx',
);
const desktopLayoutStyles = workspaceStyles.slice(
  workspaceStyles.indexOf(
    '/* Workspace Desktop Visual Layout v0.1 */',
  ),
);

test(
  'bounds the desktop Workspace to the available viewport and keeps three tools visible',
  () => {
    assert.match(
      desktopLayoutStyles,
      /Workspace Desktop Visual Layout v0\.1[\s\S]*?@media \(min-width: 1181px\)[\s\S]*?\.workspace\s*\{[\s\S]*?height:\s*calc\(100dvh - var\(--nexus-topbar-height\) - var\(--nexus-space-2\)\);[\s\S]*?overflow:\s*hidden;/u,
    );
    assert.match(
      desktopLayoutStyles,
      /\.workspaceGrid\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?align-items:\s*stretch;/u,
    );
    assert.match(
      desktopLayoutStyles,
      /\.leftColumn\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\) clamp\(240px, 31vh, 330px\);/u,
    );
    assert.match(
      desktopLayoutStyles,
      /\.lowerGrid\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?grid-template-columns:\s*minmax\(0, 0\.95fr\) minmax\(0, 1\.18fr\) minmax\(0, 0\.87fr\);/u,
    );
  },
);

test(
  'keeps long Workspace content inside its own panels',
  () => {
    for (const className of [
      'tradeTapePanel',
      'panelScrollBody',
      'nexusPanelBody',
    ]) {
      assert.match(
        workspaceSource,
        new RegExp(`styles\\.${className}\\b`, 'u'),
      );
    }

    assert.match(
      desktopLayoutStyles,
      /\.tapeTable\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*auto;/u,
    );
    assert.match(
      desktopLayoutStyles,
      /\.panelScrollBody\s*,\s*\n\.nexusPanelBody\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*auto;/u,
    );
    assert.match(
      desktopLayoutStyles,
      /\.tapeHeader\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*0;/u,
    );
  },
);

test(
  'lets the Workspace heatmap fill its panel without changing its data model',
  () => {
    assert.match(
      workspaceSource,
      /<NexusLiquidationHeatmap[\s\S]*?fillContainer/u,
    );
    assert.match(
      heatmapSource,
      /fillContainer\?:\s*boolean/u,
    );
    assert.match(
      heatmapStyles,
      /\.fillContainer\s*\{[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;[\s\S]*?grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto;/u,
    );
    assert.match(
      heatmapStyles,
      /\.fillContainer \.chart\s*\{[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;/u,
    );
  },
);

test(
  'keeps compact controls readable and restores document flow below desktop',
  () => {
    assert.match(
      workspaceSource,
      /className=\{styles\.secondaryButton\}[\s\S]*?Открыть черновик заметки/u,
    );
    assert.match(
      desktopLayoutStyles,
      /\.tapeRow\s*\{[\s\S]*?font-size:\s*11px;/u,
    );
    assert.match(
      desktopLayoutStyles,
      /@media \(max-width: 1180px\)[\s\S]*?\.workspace\s*\{[\s\S]*?height:\s*auto;[\s\S]*?overflow:\s*visible;/u,
    );
    assert.match(
      desktopLayoutStyles,
      /@media \(min-width: 1181px\) and \(max-width: 1500px\) and \(max-height: 820px\)[\s\S]*?\.leftColumn\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0, 1fr\) 170px;[\s\S]*?\.chartCanvas\s*\{[\s\S]*?min-height:\s*280px;/u,
    );
    assert.match(
      heatmapStyles,
      /@media \(min-width: 1181px\) and \(max-height: 820px\)[\s\S]*?\.fillContainer \.chartControls span\s*\{[\s\S]*?display:\s*none;[\s\S]*?\.fillContainer \.footer\s*\{[\s\S]*?max-height:\s*38px;/u,
    );
    assert.match(
      heatmapStyles,
      /@media \(min-width: 1181px\) and \(max-width: 1500px\) and \(max-height: 820px\)[\s\S]*?\.fillContainer\s*\{[\s\S]*?height:\s*360px;[\s\S]*?grid-template-rows:\s*auto auto minmax\(200px, 1fr\) auto;/u,
    );
  },
);

test(
  'uses stable keyboard-accessible compact tabs without changing the 1920 three-column mode',
  () => {
    assert.match(
      workspaceSource,
      /data-workspace-region="chart-canvas"/u,
    );
    assert.match(
      workspaceSource,
      /useState<WorkspaceCompactTool>\('tape'\)/u,
    );
    assert.match(
      workspaceSource,
      /WORKSPACE_COMPACT_TOOLS[\s\S]*?label: 'Лента'[\s\S]*?label: 'Карта'[\s\S]*?label: 'Динамика'/u,
    );
    assert.match(
      workspaceSource,
      /role="tablist"[\s\S]*?aria-label="Нижние инструменты Workspace"/u,
    );
    assert.match(
      workspaceSource,
      /onKeyDown=\{handleCompactToolKeyDown\}/u,
    );
    assert.match(
      desktopLayoutStyles,
      /\.compactToolTabs\s*\{[\s\S]*?display:\s*none;/u,
    );
    assert.match(
      desktopLayoutStyles,
      /@media \(min-width: 1181px\) and \(max-width: 1500px\) and \(max-height: 820px\)[\s\S]*?\.compactToolTabs\s*\{[\s\S]*?display:\s*flex;[\s\S]*?\.compactPanelInactive\s*\{[\s\S]*?display:\s*none;/u,
    );
    assert.match(
      desktopLayoutStyles,
      /\.liquidationHeatmapPanel\s*\{[\s\S]*?overflow:\s*auto;/u,
    );
  },
);

test(
  'retains one resize observer and one chart cleanup path',
  () => {
    assert.equal(
      (chartSource.match(/new ResizeObserver/gu) ?? []).length,
      1,
    );
    assert.equal(
      (chartSource.match(/resizeObserver\.disconnect\(\)/gu) ?? []).length,
      1,
    );
    assert.equal(
      (chartSource.match(/chart\.remove\(\)/gu) ?? []).length,
      1,
    );
  },
);
