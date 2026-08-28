import assert from 'node:assert/strict';
import {
  readFileSync,
} from 'node:fs';
import test from 'node:test';

const workspaceSource =
  readFileSync(
    new URL(
      '../src/pages/WorkspacePage.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const workspaceStyles =
  readFileSync(
    new URL(
      '../src/pages/WorkspacePage.module.css',
      import.meta.url,
    ),
    'utf8',
  );

const chartSource =
  readFileSync(
    new URL(
      '../src/shared/charts/ui/NexusCandlestickChart.tsx',
      import.meta.url,
    ),
    'utf8',
  );

const drawingStyles =
  readFileSync(
    new URL(
      '../src/shared/charts/ui/NexusChartDrawingOverlay.module.css',
      import.meta.url,
    ),
    'utf8',
  );

test(
  'renders the professional NEXUS chart shell without replacing chart data contracts',
  () => {
    assert.match(
      workspaceSource,
      /styles\.professionalChartToolbar/,
    );

    assert.match(
      workspaceSource,
      /styles\.chartInstrumentStrip/,
    );

    assert.match(
      workspaceSource,
      /aria-label="OHLC последней свечи"/,
    );

    assert.match(
      workspaceSource,
      /График/,
    );

    assert.match(
      workspaceSource,
      /Глубина/,
    );

    assert.match(
      workspaceSource,
      /Подробности/,
    );

    assert.match(
      workspaceSource,
      /requestFullscreen\(\)/,
    );

    assert.match(
      workspaceStyles,
      /NEXUS Professional Chart Shell v1/,
    );

    assert.match(
      workspaceStyles,
      /height: clamp\(500px, 62vh, 760px\)/,
    );

    assert.match(
      workspaceStyles,
      /\.chartPanel:fullscreen/,
    );

    assert.match(
      drawingStyles,
      /\[data-nexus-chart-toolbar\]\.toolbar/,
    );

    assert.match(
      chartSource,
      /attributionLogo:\s*false/,
    );

    assert.match(
      chartSource,
      /CrosshairMode\.Normal/,
    );

    assert.match(
      workspaceSource,
      /horizontalSegments=\{causalLevelLines\.horizontalSegments\}/,
    );

    assert.match(
      workspaceSource,
      /drawingScope=\{`\$\{contractSetup\.symbol\}:\$\{timeframe\}`\}/,
    );
  },
);
